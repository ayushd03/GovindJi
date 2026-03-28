/**
 * DeliveryService - Singleton service for managing delivery gateway operations
 *
 * Provides a centralized interface for delivery operations across the application.
 * Handles gateway initialization, shipment creation, tracking, and webhook processing.
 */

const DelhiveryGateway = require('./DelhiveryGateway');
const deliverySettingsService = require('./DeliverySettingsService');
const { createBackendSupabaseClient } = require('../../config/supabaseClient');

class DeliveryService {
  constructor() {
    this.gateway = null;
    this.initialized = false;

    // Initialize Supabase client
    this.supabase = createBackendSupabaseClient({ preferServiceRole: true });
  }

  isGatewayReady() {
    return Boolean(this.initialized && this.gateway);
  }

  normalizeShippingMode(value, fallback = 'Surface') {
    const raw = String(value || '').trim().toLowerCase();

    if (raw === 'express') {
      return 'Express';
    }

    if (['surface', 'normal', 'standard'].includes(raw)) {
      return 'Surface';
    }

    return fallback;
  }

  parseMoney(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
  }

  createDateFromParts(dateString, timeString = '00:00:00') {
    const [year, month, day] = String(dateString || '').split('-').map(Number);
    const [hours, minutes, seconds] = String(timeString || '00:00:00').split(':').map(Number);

    return new Date(
      Number.isFinite(year) ? year : 1970,
      Number.isFinite(month) ? month - 1 : 0,
      Number.isFinite(day) ? day : 1,
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      Number.isFinite(seconds) ? seconds : 0,
      0
    );
  }

  addCalendarDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + (Number.parseInt(days, 10) || 0));
    return next;
  }

  buildDeliveryOption({
    mode,
    label,
    description,
    subtotal,
    dispatchSlot,
    freeShippingThreshold,
    freeShippingEligible,
    baseFee,
    minDays,
    maxDays,
    isDefault,
  }) {
    const normalizedBaseFee = this.parseMoney(baseFee, 0);
    const normalizedSubtotal = this.parseMoney(subtotal, 0);
    const normalizedThreshold = this.parseMoney(freeShippingThreshold, 0);
    const freeShippingApplied = Boolean(
      freeShippingEligible &&
      normalizedThreshold > 0 &&
      normalizedSubtotal >= normalizedThreshold
    );
    const fee = freeShippingApplied ? 0 : normalizedBaseFee;
    const dispatchDate = this.createDateFromParts(dispatchSlot.pickup_date, dispatchSlot.pickup_time);
    const estimatedStart = this.addCalendarDays(dispatchDate, minDays);
    const estimatedEnd = this.addCalendarDays(dispatchDate, maxDays);

    return {
      id: mode.toLowerCase(),
      mode,
      label,
      description,
      is_default: isDefault,
      fee,
      base_fee: normalizedBaseFee,
      free_shipping_applied: freeShippingApplied,
      free_shipping_threshold: normalizedThreshold,
      transit_min_days: minDays,
      transit_max_days: maxDays,
      estimated_dispatch_date: dispatchSlot.pickup_date,
      estimated_dispatch_time: dispatchSlot.pickup_time,
      estimated_delivery_start: deliverySettingsService.formatDate(estimatedStart),
      estimated_delivery_end: deliverySettingsService.formatDate(estimatedEnd),
    };
  }

  async getServiceabilitySnapshot(pincode, settings = null) {
    const resolvedSettings = settings || await deliverySettingsService.getSettings();
    const fallback = {
      pincode,
      serviceable: true,
      serviceability_checked: false,
      reason: !resolvedSettings.is_enabled
        ? 'Courier automation is currently disabled. Using saved store delivery defaults.'
        : 'Courier API is unavailable right now. Using saved store delivery defaults.',
    };

    if (!resolvedSettings.is_enabled || !this.isGatewayReady()) {
      return fallback;
    }

    try {
      const result = await this.gateway.checkServiceability(pincode);
      return {
        ...result,
        pincode,
        serviceability_checked: true,
      };
    } catch (error) {
      console.error('[DeliveryService] Delivery quote serviceability check failed:', error.message);
      return {
        ...fallback,
        serviceability_error: error.message,
      };
    }
  }

  async getDeliveryOptions({ pincode, orderSubtotal = 0 } = {}) {
    const normalizedPincode = String(pincode || '').trim();
    if (!/^\d{6}$/.test(normalizedPincode)) {
      throw new Error('Valid 6-digit pincode is required to calculate delivery options');
    }

    const settings = await deliverySettingsService.getSettings();
    const serviceability = await this.getServiceabilitySnapshot(normalizedPincode, settings);
    const defaultMode = this.normalizeShippingMode(settings.shipping_mode);
    const nextPickupSlot = deliverySettingsService.calculateNextPickupSlot(settings);

    if (serviceability.serviceability_checked && !serviceability.serviceable) {
      return {
        success: true,
        pincode: normalizedPincode,
        default_mode: defaultMode,
        pickup_slot: nextPickupSlot,
        options: [],
        ...serviceability,
      };
    }

    const subtotal = this.parseMoney(orderSubtotal, 0);
    const options = [
      this.buildDeliveryOption({
        mode: 'Surface',
        label: 'Normal delivery',
        description: 'Balanced delivery speed with the lowest shipping cost.',
        subtotal,
        dispatchSlot: nextPickupSlot,
        freeShippingThreshold: settings.free_shipping_threshold,
        freeShippingEligible: true,
        baseFee: settings.surface_delivery_fee,
        minDays: settings.surface_min_delivery_days,
        maxDays: settings.surface_max_delivery_days,
        isDefault: defaultMode === 'Surface',
      }),
      this.buildDeliveryOption({
        mode: 'Express',
        label: 'Express delivery',
        description: 'Priority dispatch for faster doorstep delivery.',
        subtotal,
        dispatchSlot: nextPickupSlot,
        freeShippingThreshold: settings.free_shipping_threshold,
        freeShippingEligible: false,
        baseFee: settings.express_delivery_fee,
        minDays: settings.express_min_delivery_days,
        maxDays: settings.express_max_delivery_days,
        isDefault: defaultMode === 'Express',
      }),
    ];

    return {
      success: true,
      pincode: normalizedPincode,
      default_mode: defaultMode,
      pickup_slot: nextPickupSlot,
      options,
      ...serviceability,
    };
  }

  async resolveDeliverySelection({ pincode, orderSubtotal = 0, requestedMode = null } = {}) {
    const quoteResponse = await this.getDeliveryOptions({ pincode, orderSubtotal });

    if (quoteResponse.serviceability_checked && !quoteResponse.serviceable) {
      throw new Error(
        quoteResponse.message ||
        quoteResponse.reason ||
        `Delivery is not available to pincode ${pincode}`
      );
    }

    const desiredMode = this.normalizeShippingMode(requestedMode, quoteResponse.default_mode);
    const selectedOption = quoteResponse.options.find((option) => option.mode === desiredMode)
      || quoteResponse.options.find((option) => option.mode === quoteResponse.default_mode)
      || quoteResponse.options[0];

    if (!selectedOption) {
      throw new Error('No delivery options are available for this order');
    }

    return {
      ...selectedOption,
      quote_snapshot: {
        ...selectedOption,
        pincode: quoteResponse.pincode,
        pickup_slot: quoteResponse.pickup_slot,
        serviceability: {
          serviceable: quoteResponse.serviceable,
          serviceability_checked: quoteResponse.serviceability_checked,
          city: quoteResponse.city || null,
          state: quoteResponse.state || null,
          cod_available: quoteResponse.cod_available ?? null,
          prepaid_available: quoteResponse.prepaid_available ?? null,
          reason: quoteResponse.reason || quoteResponse.message || null,
        },
      },
    };
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

      // Fetch order with all details including product variants
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (*),
            product_variants (*)
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

      // Calculate total weight with variant support
      let totalWeight = 0;
      let productsDesc = [];
      const weightDetails = [];

      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          let itemWeight = 0;
          let weightSource = 'default';

          // Priority: variant weight > product weight > default 250g
          if (item.variant_id && item.product_variants?.weight_grams) {
            itemWeight = item.product_variants.weight_grams;
            weightSource = 'variant';
          } else if (item.products?.weight_grams) {
            itemWeight = item.products.weight_grams;
            weightSource = 'product';
          } else {
            itemWeight = 250;  // Last resort default
            weightSource = 'default';
            console.warn(`[DeliveryService] Order ${orderId} item ${item.id}: No weight configured. Using default 250g. Product: ${item.products?.name}`);
          }

          const lineWeight = itemWeight * item.quantity;
          totalWeight += lineWeight;

          // Build product description
          const itemName = item.products?.name || 'Product';
          const variantName = item.product_variants?.variant_name;
          const displayName = variantName ? `${itemName} - ${variantName}` : itemName;
          productsDesc.push(`${displayName} (${item.quantity})`);

          // Track weight details for logging
          weightDetails.push({
            product: itemName,
            variant: variantName || null,
            quantity: item.quantity,
            unit_weight: itemWeight,
            total_weight: lineWeight,
            source: weightSource
          });
        }
      }

      // Validate total weight
      if (totalWeight === 0) {
        const errorMsg = `Cannot create shipment for order ${orderId}: Total weight is 0g. Please configure product weights in admin panel.`;
        console.error(`[DeliveryService] ${errorMsg}`, { weightDetails });
        throw new Error(errorMsg);
      }

      if (totalWeight < 50) {
        console.warn(`[DeliveryService] Order ${orderId}: Very low weight ${totalWeight}g`, { weightDetails });
      }

      // Log weight calculation breakdown
      console.log(`[DeliveryService] Order ${orderId} weight calculation:`, {
        total_grams: totalWeight,
        total_kg: Math.ceil(totalWeight / 1000),
        items: weightDetails
      });

      // Determine payment mode
      const paymentMode = order.payment_method === 'COD' ? 'COD' : 'Prepaid';
      const codAmount = paymentMode === 'COD' ? order.total_amount : 0;

      // Prepare shipment details
      const settings = await deliverySettingsService.getSettings();
      const selectedShippingMode = this.normalizeShippingMode(order.delivery_mode, settings.shipping_mode);

      const shipmentDetails = {
        weight_grams: totalWeight,
        payment_mode: paymentMode,
        cod_amount: codAmount,
        products_desc: productsDesc.join(', '),
        quantity: order.order_items?.length || 1,
        shipping_mode: selectedShippingMode,
        dimensions_width: settings.default_package_width,
        dimensions_height: settings.default_package_height,
        dimensions_length: settings.default_package_length
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

  async schedulePickupForShipments(shipments, settings = null) {
    this.ensureInitialized();

    if (!shipments || shipments.length === 0) {
      return { success: true, reused_existing_request: false, scheduled_count: 0 };
    }

    const resolvedSettings = settings || await deliverySettingsService.getSettings();
    const slot = deliverySettingsService.calculateNextPickupSlot(resolvedSettings);
    const shipmentIds = shipments.map((shipment) => shipment.id);
    const existingStatuses = ['SCHEDULED', 'REQUESTED', 'CREATED'];

    const { data: existingRequest, error: pickupRequestError } = await this.supabase
      .from('pickup_requests')
      .select('*')
      .eq('pickup_location', slot.pickup_location)
      .eq('pickup_date', slot.pickup_date)
      .eq('pickup_time', slot.pickup_time)
      .in('status', existingStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pickupRequestError) {
      throw pickupRequestError;
    }

    let pickupResult = null;
    let reusedExistingRequest = false;

    if (existingRequest) {
      reusedExistingRequest = true;
      pickupResult = {
        success: true,
        pickup_id: existingRequest.delhivery_pickup_id,
        response: existingRequest.delhivery_response
      };
    } else {
      pickupResult = await this.schedulePickup({
        pickup_date: slot.pickup_date,
        pickup_time: slot.pickup_time,
        pickup_location: slot.pickup_location,
        expected_package_count: shipments.length
      });
    }

    const { error: shipmentUpdateError } = await this.supabase
      .from('shipments')
      .update({
        pickup_scheduled_date: slot.pickup_date,
        pickup_scheduled_time: slot.pickup_time,
        status: 'PICKUP_SCHEDULED',
        updated_at: new Date().toISOString()
      })
      .in('id', shipmentIds);

    if (shipmentUpdateError) {
      throw shipmentUpdateError;
    }

    return {
      ...pickupResult,
      reused_existing_request: reusedExistingRequest,
      pickup_date: slot.pickup_date,
      pickup_time: slot.pickup_time,
      pickup_location: slot.pickup_location,
      scheduled_count: shipments.length
    };
  }

  async schedulePickupForOrder(orderId, settings = null) {
    const { data: shipments, error } = await this.supabase
      .from('shipments')
      .select('*')
      .eq('order_id', orderId)
      .is('pickup_scheduled_date', null)
      .in('status', ['MANIFESTED', 'PENDING']);

    if (error) {
      throw error;
    }

    return this.schedulePickupForShipments(shipments || [], settings);
  }

  async processOrderForFulfillment(orderId, options = {}) {
    this.ensureInitialized();

    const { data: order, error } = await this.supabase
      .from('orders')
      .select('id, status, payment_method, payment_status, has_shipment')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    if (!order) throw new Error('Order not found');

    if (['cancelled', 'delivered', 'completed'].includes(order.status)) {
      return {
        success: false,
        skipped: true,
        reason: `Order is already ${order.status}`
      };
    }

    const settings = await deliverySettingsService.getSettings();
    if (!settings.is_enabled) {
      return {
        success: false,
        skipped: true,
        reason: 'Delhivery integration is disabled in settings'
      };
    }

    const result = {
      success: true,
      order_id: orderId,
      status_updated: false,
      shipment_created: false,
      pickup_scheduled: false
    };

    let readyForFulfillment = order.status === 'processing';

    if (!readyForFulfillment && settings.auto_move_orders_to_processing) {
      const { error: statusUpdateError } = await this.supabase
        .from('orders')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (statusUpdateError) throw statusUpdateError;
      result.status_updated = true;
      readyForFulfillment = true;
    }

    if (!readyForFulfillment) {
      return {
        ...result,
        waiting_for_manual_processing: true,
        reason: 'Order is still pending. Move it to processing to start shipment and pickup automation.'
      };
    }

    if (settings.auto_create_shipment && !order.has_shipment) {
      const shipmentResult = await this.autoCreateShipment(orderId);
      result.shipment_created = true;
      result.shipment = shipmentResult;
    }

    if (settings.auto_schedule_pickup) {
      const pickupResult = await this.schedulePickupForOrder(orderId, settings);
      result.pickup_scheduled = Boolean(pickupResult?.scheduled_count);
      result.pickup = pickupResult;
    }

    return result;
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
