/**
 * Pickup Scheduler - Automated daily pickup scheduling for Delhivery
 *
 * Schedules pickups automatically every day at 6 PM IST for shipments
 * created during the day.
 */

const cron = require('node-cron');
const deliveryService = require('./DeliveryService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

      const { data: pendingShipments, error: fetchError } = await supabase
        .from('shipments')
        .select('id, awb_number, created_at')
        .eq('status', 'PENDING')
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

      // Schedule pickup for next day at 10 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const pickupDate = tomorrow.toISOString().split('T')[0];

      const pickupResult = await deliveryService.schedulePickup({
        pickup_date: pickupDate,
        pickup_time: '10:00:00',
        pickup_location: process.env.DELHIVERY_WAREHOUSE_NAME || 'Main Warehouse',
        expected_package_count: pendingShipments.length
      });

      if (pickupResult.success) {
        // Update shipments with pickup details
        const { error: updateError } = await supabase
          .from('shipments')
          .update({
            pickup_scheduled_date: pickupDate,
            pickup_scheduled_time: '10:00:00',
            status: 'PICKUP_SCHEDULED',
            updated_at: new Date().toISOString()
          })
          .in('id', pendingShipments.map(s => s.id));

        if (updateError) {
          console.error('[PickupScheduler] Error updating shipments:', updateError);
        } else {
          console.log(`[PickupScheduler] ✅ Successfully scheduled pickup for ${pendingShipments.length} shipments on ${pickupDate} at 10:00 AM`);
        }
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
