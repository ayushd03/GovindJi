/**
 * Delivery Routes - Customer-facing endpoints
 *
 * Handles customer tracking requests and webhook callbacks from Delhivery
 */

const express = require('express');
const router = express.Router();
const deliveryService = require('../services/delivery/DeliveryService');

/**
 * GET /api/delivery/track/:orderId
 * Track shipment by order ID
 */
router.get('/track/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const shipment = await deliveryService.trackShipmentByOrderId(orderId);

    res.json({
      success: true,
      shipment
    });

  } catch (error) {
    console.error('[DeliveryRoutes] Track failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/delivery/check-serviceability
 * Check if delivery is available to a pincode
 */
router.get('/check-serviceability', async (req, res) => {
  try {
    const { pincode } = req.query;

    if (!pincode || pincode.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid 6-digit pincode is required'
      });
    }

    const result = await deliveryService.checkServiceability(pincode);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[DeliveryRoutes] Serviceability check failed:', error.message);
    res.status(500).json({
      success: false,
      serviceable: false,
      error: error.message
    });
  }
});

/**
 * POST /api/delivery/webhook
 * Webhook endpoint for Delhivery status updates
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers;

    console.log('[DeliveryRoutes] Webhook received');

    await deliveryService.processWebhook(payload, headers);

    // Always return 200 OK to Delhivery
    res.json({ success: true });

  } catch (error) {
    console.error('[DeliveryRoutes] Webhook processing error:', error.message);

    // Still return 200 to prevent Delhivery retries
    // Log the error for investigation
    res.json({ success: true, error: error.message });
  }
});

module.exports = router;
