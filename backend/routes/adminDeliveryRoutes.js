/**
 * Admin Delivery Routes - Admin-only endpoints for delivery management
 *
 * Handles manual shipment creation, pickup scheduling, and shipment management
 */

const express = require('express');
const router = express.Router();
const deliveryService = require('../services/delivery/DeliveryService');
const deliverySettingsService = require('../services/delivery/DeliverySettingsService');
const roleMiddleware = require('../middleware/roleMiddleware');
const { createBackendSupabaseClient } = require('../config/supabaseClient');
const { parsePageLimit, buildPagePagination } = require('../utils/pagination');

// Initialize Supabase client
const supabase = createBackendSupabaseClient({ preferServiceRole: true });

router.use(roleMiddleware.authenticateAdmin);

router.get('/settings', async (req, res) => {
  try {
    const settings = await deliverySettingsService.getSettings();
    const nextPickupSlot = deliverySettingsService.calculateNextPickupSlot(settings);

    res.json({
      success: true,
      settings,
      next_pickup_slot: nextPickupSlot
    });
  } catch (error) {
    console.error('[AdminDeliveryRoutes] Get settings failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await deliverySettingsService.saveSettings(req.body, req.user?.id);
    const nextPickupSlot = deliverySettingsService.calculateNextPickupSlot(settings);

    res.json({
      success: true,
      settings,
      next_pickup_slot: nextPickupSlot
    });
  } catch (error) {
    console.error('[AdminDeliveryRoutes] Save settings failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/delivery/create-shipment/:orderId
 * Manually create shipment for an order
 */
router.post('/create-shipment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const settings = await deliverySettingsService.getSettings();

    const result = await deliveryService.ensureShipmentAndPickup(orderId, {
      settings,
      schedulePickup: settings.auto_schedule_pickup,
    });

    res.json({
      success: result.success,
      ...result
    });

  } catch (error) {
    console.error('[AdminDeliveryRoutes] Shipment creation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/retry-pickup/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const settings = await deliverySettingsService.getSettings();
    const result = await deliveryService.schedulePickupForOrder(orderId, settings);

    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    console.error('[AdminDeliveryRoutes] Pickup retry failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/delivery/schedule-pickup
 * Schedule a pickup with Delhivery
 */
router.post('/schedule-pickup', async (req, res) => {
  try {
    const { pickup_date, pickup_time, expected_package_count, pickup_location } = req.body;

    if (!pickup_date || !pickup_time || !expected_package_count) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pickup_date, pickup_time, expected_package_count'
      });
    }

    const result = await deliveryService.schedulePickup({
      pickup_date,
      pickup_time,
      expected_package_count,
      pickup_location: pickup_location || process.env.DELHIVERY_WAREHOUSE_NAME
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[AdminDeliveryRoutes] Pickup scheduling failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/delivery/shipments
 * Get all shipments with optional filters
 */
router.get('/shipments', async (req, res) => {
  try {
    const { status, order_id } = req.query;
    const { page, limit, offset } = parsePageLimit(req.query, {
      defaultLimit: 50,
      minLimit: 1,
      maxLimit: 200
    });

    let query = supabase
      .from('shipments')
      .select(`
        *,
        orders (
          id,
          total_amount,
          customer_phone,
          customer_email,
          shipping_address
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (order_id) {
      query = query.eq('order_id', order_id);
    }

    const { data: shipments, error, count } = await query;

    if (error) throw error;

    const pagination = buildPagePagination({
      total: count || 0,
      page,
      limit
    });

    res.json({
      success: true,
      shipments: shipments || [],
      pagination,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages
    });

  } catch (error) {
    console.error('[AdminDeliveryRoutes] Get shipments failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/delivery/shipment/:awbNumber
 * Get shipment details by AWB number
 */
router.get('/shipment/:awbNumber', async (req, res) => {
  try {
    const { awbNumber } = req.params;

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select(`
        *,
        shipment_tracking_events (*),
        orders (*)
      `)
      .eq('awb_number', awbNumber)
      .order('created_at', { foreignTable: 'shipment_tracking_events', ascending: false })
      .single();

    if (error) throw error;
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }

    res.json({
      success: true,
      shipment
    });

  } catch (error) {
    console.error('[AdminDeliveryRoutes] Get shipment failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/delivery/cancel/:awbNumber
 * Cancel a shipment
 */
router.put('/cancel/:awbNumber', async (req, res) => {
  try {
    const { awbNumber } = req.params;

    const result = await deliveryService.cancelShipment(awbNumber);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[AdminDeliveryRoutes] Cancellation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/delivery/pickup-requests
 * Get all pickup requests
 */
router.get('/pickup-requests', async (req, res) => {
  try {
    const { data: pickupRequests, error } = await supabase
      .from('pickup_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      success: true,
      pickup_requests: pickupRequests
    });

  } catch (error) {
    console.error(error);
    console.error('[AdminDeliveryRoutes] Get pickup requests failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
