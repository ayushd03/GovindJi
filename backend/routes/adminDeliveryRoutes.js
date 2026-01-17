/**
 * Admin Delivery Routes - Admin-only endpoints for delivery management
 *
 * Handles manual shipment creation, pickup scheduling, and shipment management
 */

const express = require('express');
const router = express.Router();
const deliveryService = require('../services/delivery/DeliveryService');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * POST /api/admin/delivery/create-shipment/:orderId
 * Manually create shipment for an order
 */
router.post('/create-shipment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await deliveryService.autoCreateShipment(orderId);

    res.json({
      success: true,
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
    const { status, page = 1, limit = 50 } = req.query;

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
      `)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: shipments, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      shipments,
      page: parseInt(page),
      limit: parseInt(limit)
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
    console.error('[AdminDeliveryRoutes] Get pickup requests failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
