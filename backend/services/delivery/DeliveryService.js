/**
 * DeliveryService - Singleton service for managing delivery gateway operations
 *
 * Provides a centralized interface for delivery operations across the application.
 * Handles gateway initialization, shipment creation, tracking, and webhook processing.
 */

const DelhiveryGateway = require('./DelhiveryGateway');
const { createClient } = require('@supabase/supabase-js');

class DeliveryService {
  constructor() {
    this.gateway = null;
    this.initialized = false;

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Initialize the delivery gateway based on environment configuration
   */
  initialize() {
    if (this.initialized) {
      console.log('[DeliveryService] Already initialized');
      return;
    }

    // Check if Delhivery credentials are configured
    if (!process.env.DELHIVERY_API_TOKEN) {
      console.warn('[DeliveryService] Delhivery API token not configured. Delivery features will be disabled.');
      return;
    }

    try {
      this.gateway = new DelhiveryGateway({
        apiToken: process.env.DELHIVERY_API_TOKEN,
        clientName: process.env.DELHIVERY_CLIENT_NAME || '',
        warehouseName: process.env.DELHIVERY_WAREHOUSE_NAME || 'Main Warehouse',
        environment: process.env.DELHIVERY_ENVIRONMENT || 'staging'
      });

      this.initialized = true;
      console.log('[DeliveryService] Initialized successfully');

    } catch (error) {
      console.error('[DeliveryService] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure gateway is initialized
   */
  ensureInitialized() {
    if (!this.initialized || !this.gateway) {
      throw new Error('DeliveryService not initialized. Please check configuration.');
    }
  }

  /**
   * Check if pincode is serviceable
   */
  async checkServiceability(pincode) {
    this.ensureInitialized();
    return await this.gateway.checkServiceability(pincode);
  }

  /**
   * Auto-create shipment when order status changes to 'processing'
   */
  async autoCreateShipment(orderId) {
    this.ensureInitialized();

    try {
      console.log(`[DeliveryService] Auto-creating shipment for order ${orderId}`);

      // Fetch order with all details
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (*)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Order not found');

      // Check if shipment already exists
      const { data: existingShipment } = await this.supabase
        .from('shipments')
        .select('id')
        .eq('order_id', orderId)
        .single();

      if (existingShipment) {
        console.log(`[DeliveryService] Shipment already exists for order ${orderId}`);
        return { success: true, message: 'Shipment already exists', shipment_id: existingShipment.id };
      }

      // Validate shipping address
      if (!order.shipping_address || !order.shipping_address.pincode) {
        throw new Error('Invalid shipping address');
      }

      // Check pincode serviceability
      const serviceability = await this.checkServiceability(order.shipping_address.pincode);
      if (!serviceability.serviceable) {
        throw new Error(`Delivery not available to pincode ${order.shipping_address.pincode}`);
      }

      // Calculate total weight
      let totalWeight = 0;
      let productsDesc = [];

      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          const weight = item.products?.weight_grams || 250; // Default 250g if not set
          totalWeight += weight * item.quantity;
          productsDesc.push(`${item.products?.name || 'Product'} (${item.quantity})`);
        }
      }

      // Determine payment mode
      const paymentMode = order.payment_method === 'COD' ? 'COD' : 'Prepaid';
      const codAmount = paymentMode === 'COD' ? order.total_amount : 0;

      // Prepare shipment details
      const shipmentDetails = {
        weight_grams: totalWeight,
        payment_mode: paymentMode,
        cod_amount: codAmount,
        products_desc: productsDesc.join(', '),
        quantity: order.order_items?.length || 1,
        shipping_mode: 'Surface', // Can be made configurable
        dimensions_width: 15,
        dimensions_height: 15,
        dimensions_length: 20
      };

      // Prepare order data for Delhivery
      const orderData = {
        id: order.id,
        order_id: order.id.substring(0, 8).toUpperCase(),
        customer_name: order.shipping_address.name || 'Customer',
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        shipping_address: order.shipping_address,
        total_amount: order.total_amount,
        created_at: order.created_at
      };

      // Create shipment via Delhivery API
      const shipmentResult = await this.gateway.createShipment(orderData, shipmentDetails);

      if (!shipmentResult.success) {
        throw new Error(shipmentResult.rmk || 'Shipment creation failed');
      }

      console.log('[DeliveryService] Shipment result from Delhivery:');
      console.log(`  - AWB Number: ${shipmentResult.awb_number}`);
      console.log(`  - Upload WBN: ${shipmentResult.upload_wbn}`);
      console.log(`  - Sort Code: ${shipmentResult.sort_code}`);
      console.log(`  - Reference Number: ${shipmentResult.refnum}`);
      console.log(`  - Package Status: ${shipmentResult.package_status}`);
      console.log(`  - Serviceable: ${shipmentResult.serviceable}`);

      // Validate shipment was created successfully
      if (shipmentResult.package_status !== 'Success') {
        throw new Error(`Package creation returned status: ${shipmentResult.package_status}`);
      }

      // Store shipment in database
      const { data: shipment, error: shipmentError } = await this.supabase
        .from('shipments')
        .insert({
          order_id: orderId,
          awb_number: shipmentResult.awb_number,
          upload_wbn: shipmentResult.upload_wbn,
          courier_provider: 'DELHIVERY',
          shipping_mode: shipmentDetails.shipping_mode,
          payment_mode: paymentMode,
          status: 'MANIFESTED', // Shipment successfully created with Delhivery
          weight_grams: totalWeight,
          dimensions_length: shipmentDetails.dimensions_length,
          dimensions_width: shipmentDetails.dimensions_width,
          dimensions_height: shipmentDetails.dimensions_height,
          cod_amount: codAmount,
          delhivery_response: {
            ...shipmentResult.response,
            sort_code: shipmentResult.sort_code,
            refnum: shipmentResult.refnum,
            package_status: shipmentResult.package_status
          }
        })
        .select()
        .single();

      if (shipmentError) {
        console.error('[DeliveryService] Failed to save shipment to database:', shipmentError);
        throw shipmentError;
      }

      // Update order with shipment info
      const { error: orderUpdateError } = await this.supabase
        .from('orders')
        .update({
          has_shipment: true,
          tracking_url: `https://www.delhivery.com/track/package/${shipmentResult.awb_number}`
        })
        .eq('id', orderId);

      if (orderUpdateError) {
        console.error('[DeliveryService] Failed to update order with tracking info:', orderUpdateError);
      }

      console.log(`[DeliveryService] Shipment created and stored successfully. AWB: ${shipmentResult.awb_number}`);

      return {
        success: true,
        shipment_id: shipment.id,
        awb_number: shipmentResult.awb_number,
        tracking_url: `https://www.delhivery.com/track/package/${shipmentResult.awb_number}`
      };

    } catch (error) {
      console.error(`[DeliveryService] Auto-shipment creation failed for order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Track shipment by AWB number
   */
  async trackShipment(awbNumber) {
    this.ensureInitialized();
    return await this.gateway.trackShipment(awbNumber);
  }

  /**
   * Track shipment by order ID
   */
  async trackShipmentByOrderId(orderId) {
    try {
      const { data: shipment, error } = await this.supabase
        .from('shipments')
        .select('*, shipment_tracking_events(*)')
        .eq('order_id', orderId)
        .order('created_at', { foreignTable: 'shipment_tracking_events', ascending: false })
        .single();

      if (error) throw error;
      if (!shipment) throw new Error('Shipment not found for this order');

      return shipment;

    } catch (error) {
      console.error('[DeliveryService] Track by order ID failed:', error.message);
      throw error;
    }
  }

  /**
   * Schedule pickup
   */
  async schedulePickup(pickupDetails) {
    this.ensureInitialized();

    try {
      const result = await this.gateway.schedulePickup(pickupDetails);

      // Store pickup request in database
      await this.supabase
        .from('pickup_requests')
        .insert({
          pickup_location: pickupDetails.pickup_location,
          pickup_date: pickupDetails.pickup_date,
          pickup_time: pickupDetails.pickup_time,
          expected_package_count: pickupDetails.expected_package_count,
          status: 'SCHEDULED',
          delhivery_pickup_id: result.pickup_id,
          delhivery_response: result.response
        });

      return result;

    } catch (error) {
      console.error('[DeliveryService] Pickup scheduling failed:', error.message);
      throw error;
    }
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(awbNumber) {
    this.ensureInitialized();

    try {
      const result = await this.gateway.cancelShipment(awbNumber);

      // Update shipment status in database
      await this.supabase
        .from('shipments')
        .update({ status: 'CANCELLED' })
        .eq('awb_number', awbNumber);

      return result;

    } catch (error) {
      console.error('[DeliveryService] Shipment cancellation failed:', error.message);
      throw error;
    }
  }

  /**
   * Process webhook callback from Delhivery
   */
  async processWebhook(payload, headers) {
    try {
      console.log('[DeliveryService] Processing webhook:', payload);

      // Verify webhook signature
      const verification = await this.gateway.verifyWebhookSignature(payload, headers);
      if (!verification.valid) {
        throw new Error('Invalid webhook signature');
      }

      const shipmentData = payload.Shipment;
      const awbNumber = shipmentData.AWB;
      const statusData = shipmentData.Status;

      // Find shipment in database
      const { data: shipment, error: shipmentError } = await this.supabase
        .from('shipments')
        .select('*')
        .eq('awb_number', awbNumber)
        .single();

      if (shipmentError || !shipment) {
        console.error(`[DeliveryService] Shipment not found for AWB: ${awbNumber}`);
        return { success: false, error: 'Shipment not found' };
      }

      // Check for duplicate event
      const { data: existingEvent } = await this.supabase
        .from('shipment_tracking_events')
        .select('id')
        .eq('shipment_id', shipment.id)
        .eq('scan_datetime', statusData.StatusDateTime)
        .single();

      if (existingEvent) {
        console.log('[DeliveryService] Duplicate webhook event, skipping');
        return { success: true, message: 'Duplicate event' };
      }

      // Insert tracking event
      await this.supabase
        .from('shipment_tracking_events')
        .insert({
          shipment_id: shipment.id,
          status: statusData.Status,
          status_type: statusData.StatusType,
          location: statusData.StatusLocation,
          scan_datetime: statusData.StatusDateTime,
          instructions: statusData.Instructions || '',
          webhook_payload: payload
        });

      // Update shipment current status
      await this.supabase
        .from('shipments')
        .update({
          status: this.mapDelhiveryStatus(statusData.Status),
          current_location: statusData.StatusLocation,
          last_scan_status: statusData.Status,
          last_scan_datetime: statusData.StatusDateTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.id);

      // Update order status based on delivery status
      await this.updateOrderStatusFromDelivery(shipment.order_id, statusData.Status);

      console.log(`[DeliveryService] Webhook processed successfully for AWB: ${awbNumber}`);

      return { success: true };

    } catch (error) {
      console.error('[DeliveryService] Webhook processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Map Delhivery status to internal status
   */
  mapDelhiveryStatus(delhiveryStatus) {
    const statusMap = {
      'Pending': 'PENDING',
      'Manifested': 'MANIFESTED',
      'Dispatched': 'IN_TRANSIT',
      'In Transit': 'IN_TRANSIT',
      'Out for Delivery': 'OUT_FOR_DELIVERY',
      'Delivered': 'DELIVERED',
      'RTO': 'RTO',
      'Cancelled': 'CANCELLED'
    };

    return statusMap[delhiveryStatus] || 'IN_TRANSIT';
  }

  /**
   * Update order status based on delivery status
   */
  async updateOrderStatusFromDelivery(orderId, delhiveryStatus) {
    try {
      let newOrderStatus = null;

      // Map delivery status to order status
      if (delhiveryStatus === 'Delivered') {
        newOrderStatus = 'completed';
      } else if (delhiveryStatus === 'Out for Delivery' || delhiveryStatus === 'In Transit') {
        newOrderStatus = 'shipped';
      } else if (delhiveryStatus === 'RTO' || delhiveryStatus === 'Cancelled') {
        newOrderStatus = 'cancelled';
      }

      if (newOrderStatus) {
        await this.supabase
          .from('orders')
          .update({ status: newOrderStatus })
          .eq('id', orderId);

        console.log(`[DeliveryService] Order ${orderId} status updated to ${newOrderStatus}`);
      }

    } catch (error) {
      console.error('[DeliveryService] Order status update failed:', error.message);
    }
  }
}

// Export singleton instance
module.exports = new DeliveryService();
