/**
 * Pickup Scheduler - Automated daily pickup scheduling for Delhivery
 *
 * Schedules pickups automatically every day at 6 PM IST for shipments
 * created during the day.
 */

const cron = require('node-cron');
const deliveryService = require('./DeliveryService');
const deliverySettingsService = require('./DeliverySettingsService');
const { createBackendSupabaseClient } = require('../../config/supabaseClient');

const supabase = createBackendSupabaseClient({ preferServiceRole: true });

class PickupScheduler {
  constructor() {
    this.isScheduled = false;
    this.cronTask = null;
  }

  /**
   * Start the automated pickup scheduler
   */
  start() {
    if (this.isScheduled) {
      console.log('[PickupScheduler] Already running');
      return;
    }

    // Run every day at 6 PM IST (18:00)
    this.cronTask = cron.schedule('0 18 * * *', async () => {
      console.log('[PickupScheduler] Running daily pickup scheduling...');
      await this.scheduleDailyPickup();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    this.isScheduled = true;
    console.log('[PickupScheduler] Daily pickup scheduling enabled (6 PM IST)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.isScheduled = false;
      console.log('[PickupScheduler] Stopped');
    }
  }

  /**
   * Schedule daily pickup for pending shipments
   */
  async scheduleDailyPickup() {
    try {
      // Get all shipments created today that need pickup
      const today = new Date().toISOString().split('T')[0];
      const settings = await deliverySettingsService.getSettings();

      if (!settings.is_enabled) {
        console.log('[PickupScheduler] Delivery integration is disabled. Skipping daily pickup scheduling.');
        return;
      }

      if (!settings.auto_schedule_pickup) {
        console.log('[PickupScheduler] Auto pickup scheduling is disabled. Skipping daily pickup scheduling.');
        return;
      }

      const { data: pendingShipments, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .in('status', ['PENDING', 'MANIFESTED'])
        .gte('created_at', `${today}T00:00:00`)
        .is('pickup_scheduled_date', null);

      if (fetchError) {
        console.error('[PickupScheduler] Error fetching pending shipments:', fetchError);
        return;
      }

      if (!pendingShipments || pendingShipments.length === 0) {
        console.log('[PickupScheduler] No pending shipments for pickup today');
        return;
      }

      console.log(`[PickupScheduler] Found ${pendingShipments.length} shipments needing pickup`);

      const pickupResult = await deliveryService.schedulePickupForShipments(pendingShipments, settings);

      if (pickupResult.success) {
        console.log(
          `[PickupScheduler] ✅ Successfully scheduled pickup for ${pickupResult.scheduled_count} shipments on ${pickupResult.pickup_date} at ${pickupResult.pickup_time}`
        );
      }

    } catch (error) {
      console.error('[PickupScheduler] Failed to schedule pickup:', error.message);

      // TODO: Send alert to admin via email/SMS
      // This is a critical failure that should be notified
    }
  }

  /**
   * Manual trigger for testing or admin override
   */
  async triggerNow() {
    console.log('[PickupScheduler] Manual trigger initiated');
    await this.scheduleDailyPickup();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isScheduled,
      nextRun: this.cronTask ? 'Daily at 6:00 PM IST' : 'Not scheduled'
    };
  }
}

// Export singleton instance
module.exports = new PickupScheduler();
