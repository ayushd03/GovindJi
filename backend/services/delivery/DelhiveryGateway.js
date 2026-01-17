/**
 * DelhiveryGateway - Concrete implementation of DeliveryInterface for Delhivery API
 *
 * Handles all interactions with Delhivery B2B API including:
 * - Pincode serviceability checks
 * - Shipment creation
 * - Tracking
 * - Pickup scheduling
 * - Webhook verification
 */

const axios = require('axios');
const DeliveryInterface = require('./DeliveryInterface');

class DelhiveryGateway extends DeliveryInterface {
  constructor(config) {
    super();

    // Validate required configuration
    if (!config || !config.apiToken) {
      throw new Error('DelhiveryGateway requires apiToken in configuration');
    }

    this.apiToken = config.apiToken;
    this.clientName = config.clientName || '';
    this.warehouseName = config.warehouseName || '';
    this.environment = config.environment || 'staging';

    // Validate environment
    if (!['staging', 'production'].includes(this.environment)) {
      console.warn(`[DelhiveryGateway] Invalid environment '${this.environment}', defaulting to 'staging'`);
      this.environment = 'staging';
    }

    // Set base URL based on environment
    this.baseUrl = this.environment === 'production'
      ? 'https://track.delhivery.com'
      : 'https://staging-express.delhivery.com';

    // Cache for waybills
    this.waybillCache = [];

    console.log(`[DelhiveryGateway] Initialized in ${this.environment} mode`);
    console.log(`[DelhiveryGateway] Base URL: ${this.baseUrl}`);
    console.log(`[DelhiveryGateway] Client: ${this.clientName || 'Not specified'}`);
    console.log(`[DelhiveryGateway] Warehouse: ${this.warehouseName || 'Not specified'}`);
  }

  /**
   * Get common headers for Delhivery API requests
   */
  getHeaders() {
    return {
      'Authorization': `Token ${this.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Check if delivery is available to a specific pincode
   */
  async checkServiceability(pincode) {
    try {
      console.log(`[DelhiveryGateway] Checking serviceability for pincode: ${pincode}`);

      const response = await axios.get(`${this.baseUrl}/c/api/pin-codes/json/`, {
        headers: this.getHeaders(),
        params: {
          filter_codes: pincode
        }
      });

      const data = response.data;

      // Delhivery returns array of delivery codes
      if (data && data.delivery_codes && data.delivery_codes.length > 0) {
        const pincodeData = data.delivery_codes[0];

        return {
          serviceable: true,
          pincode: pincodeData.postal_code.pin,
          city: pincodeData.postal_code.city,
          state: pincodeData.postal_code.state_code,
          cod_available: pincodeData.cod === 'Y',
          prepaid_available: pincodeData.pre_paid === 'Y',
          pickup_available: pincodeData.pickup === 'Y',
          repl_available: pincodeData.repl === 'Y'
        };
      }

      return {
        serviceable: false,
        message: 'Delivery not available to this pincode'
      };

    } catch (error) {
      console.error('[DelhiveryGateway] Serviceability check failed:', error.message);

      // If pincode not found, return not serviceable
      if (error.response?.status === 404 || error.response?.status === 400) {
        return {
          serviceable: false,
          message: 'Pincode not found in Delhivery network'
        };
      }

      throw error;
    }
  }

  /**
   * Get waybill numbers in bulk
   */
  async getWaybills(count = 1) {
    try {
      console.log(`[DelhiveryGateway] Fetching ${count} waybill numbers`);

      // Check cache first
      if (this.waybillCache.length >= count) {
        const waybills = this.waybillCache.splice(0, count);
        console.log(`[DelhiveryGateway] Using ${count} waybills from cache`);
        return waybills;
      }

      // Fetch from API
      const response = await axios.get(`${this.baseUrl}/waybill/api/bulk/json/`, {
        headers: this.getHeaders(),
        params: {
          count: Math.max(count, 10), // Fetch at least 10 for caching
          client: this.clientName
        }
      });

      console.log('[DelhiveryGateway] Raw waybill response type:', typeof response.data);
      console.log('[DelhiveryGateway] Raw waybill response:', response.data);

      let waybills = [];

      // Handle different response formats from Delhivery API
      if (typeof response.data === 'string') {
        // Handle comma-separated string format (most common)
        // Example: "35827210000770,35827210000781,35827210000792"
        waybills = response.data
          .split(',')
          .map(wb => wb.trim())
          .filter(wb => wb.length > 0);

        console.log(`[DelhiveryGateway] Parsed ${waybills.length} waybills from string format`);

      } else if (response.data && Array.isArray(response.data.data)) {
        // Handle nested array format
        // Example: { data: ["AWB1", "AWB2"] }
        waybills = response.data.data;
        console.log(`[DelhiveryGateway] Extracted ${waybills.length} waybills from nested array format`);

      } else if (response.data && typeof response.data.data === 'string') {
        // Handle nested string format
        // Example: { data: "AWB1,AWB2,AWB3" }
        waybills = response.data.data
          .split(',')
          .map(wb => wb.trim())
          .filter(wb => wb.length > 0);
        console.log(`[DelhiveryGateway] Parsed ${waybills.length} waybills from nested string format`);

      } else if (Array.isArray(response.data)) {
        // Handle direct array format
        // Example: ["AWB1", "AWB2"]
        waybills = response.data;
        console.log(`[DelhiveryGateway] Using ${waybills.length} waybills from direct array format`);
      }

      // Validate we received waybills
      if (waybills.length === 0) {
        console.error('[DelhiveryGateway] No waybills received. Response data:', response.data);
        throw new Error('No waybills received from Delhivery API');
      }

      console.log(`[DelhiveryGateway] Successfully received ${waybills.length} waybills:`, waybills);

      // Cache extra waybills for future use
      if (waybills.length > count) {
        this.waybillCache = waybills.slice(count);
        console.log(`[DelhiveryGateway] Cached ${this.waybillCache.length} waybills for future use`);
      }

      return waybills.slice(0, count);

    } catch (error) {
      console.error('[DelhiveryGateway] Failed to fetch waybills:', error.message);

      // Log additional error details for debugging
      if (error.response) {
        console.error('[DelhiveryGateway] Error status:', error.response.status);
        console.error('[DelhiveryGateway] Error response:', error.response.data);
      }

      throw new Error(`Waybill generation failed: ${error.message}`);
    }
  }

  /**
   * Create a shipment with Delhivery
   */
  async createShipment(orderData, shipmentDetails) {
    try {
      console.log(`[DelhiveryGateway] Creating shipment for order ${orderData.id}`);

      // Validate required data
      if (!orderData.shipping_address || !orderData.shipping_address.pincode) {
        throw new Error('Missing shipping address or pincode in order data');
      }

      // Get AWB number
      const awbNumbers = await this.getWaybills(1);
      const awbNumber = awbNumbers[0];
      console.log(`[DelhiveryGateway] Assigned AWB number: ${awbNumber}`);

      // Prepare shipment data according to Delhivery format
      const shipmentData = {
        shipments: [
          {
            // Waybill number
            waybill: awbNumber,

            // Customer details
            name: orderData.customer_name || 'Customer',
            add: orderData.shipping_address.address,
            pin: orderData.shipping_address.pincode,
            city: orderData.shipping_address.city,
            state: orderData.shipping_address.state,
            country: 'India',
            phone: orderData.customer_phone,

            // Order details
            order: orderData.order_id || orderData.id,
            payment_mode: shipmentDetails.payment_mode || 'Prepaid', // Prepaid or COD
            return_pin: '', // Can be set to warehouse pincode for returns
            return_city: '',
            return_phone: '',
            return_add: '',
            return_state: '',
            return_country: '',

            // Product details
            products_desc: shipmentDetails.products_desc || 'Dry Fruits',
            hsn_code: '',
            cod_amount: shipmentDetails.cod_amount || 0,
            order_date: orderData.created_at ? new Date(orderData.created_at).toISOString() : new Date().toISOString(),
            total_amount: orderData.total_amount || 0,
            seller_add: '',
            seller_name: 'Govind Ji Dry Fruits',
            seller_inv: '',
            quantity: shipmentDetails.quantity || 1,

            // Physical details
            shipment_width: shipmentDetails.dimensions_width || 10,
            shipment_height: shipmentDetails.dimensions_height || 10,
            weight: Math.ceil(shipmentDetails.weight_grams / 1000) || 1, // Convert grams to kg, round up
            seller_gst_tin: '',
            shipping_mode: shipmentDetails.shipping_mode || 'Surface', // Surface or Express
            address_type: 'home'
          }
        ],
        pickup_location: {
          name: this.warehouseName
        }
      };

      // Format as required by Delhivery (form-data format)
      const formData = `format=json&data=${JSON.stringify(shipmentData)}`;

      const response = await axios.post(`${this.baseUrl}/api/cmu/create.json`, formData, {
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      console.log('[DelhiveryGateway] Shipment API response:', JSON.stringify(response.data, null, 2));

      // Validate response
      if (!response.data) {
        throw new Error('Empty response from Delhivery API');
      }

      // Check for success status
      const isSuccess = response.data.success === true || response.data.success === 'true';

      if (!isSuccess && response.data.rmk) {
        console.error('[DelhiveryGateway] Shipment creation failed with message:', response.data.rmk);
        throw new Error(response.data.rmk);
      }

      // Validate packages array exists
      if (!response.data.packages || response.data.packages.length === 0) {
        console.error('[DelhiveryGateway] No packages in response');
        throw new Error('No package information in Delhivery response');
      }

      // Extract package details (Delhivery returns array, we use first package)
      const packageInfo = response.data.packages[0];

      // Validate package status
      if (packageInfo.status !== 'Success') {
        const errorMsg = packageInfo.remarks?.join(', ') || 'Package creation failed';
        console.error('[DelhiveryGateway] Package status not successful:', packageInfo.status, errorMsg);
        throw new Error(`Package creation failed: ${errorMsg}`);
      }

      // Validate AWB number matches
      if (packageInfo.waybill !== awbNumber) {
        console.warn(`[DelhiveryGateway] AWB mismatch - Expected: ${awbNumber}, Got: ${packageInfo.waybill}`);
      }

      console.log('[DelhiveryGateway] Shipment created successfully with AWB:', awbNumber);
      console.log('[DelhiveryGateway] Sort Code:', packageInfo.sort_code);
      console.log('[DelhiveryGateway] Reference Number:', packageInfo.refnum);
      console.log('[DelhiveryGateway] Upload WBN:', response.data.upload_wbn);

      return {
        success: isSuccess,
        awb_number: packageInfo.waybill, // Use the actual waybill from response
        upload_wbn: response.data.upload_wbn || '',

        // Package specific details
        package_status: packageInfo.status,
        sort_code: packageInfo.sort_code || '',
        refnum: packageInfo.refnum || '',
        serviceable: packageInfo.serviceable,
        payment_mode: packageInfo.payment || '',

        // Summary stats
        package_count: response.data.package_count || 1,
        cod_count: response.data.cod_count || 0,
        prepaid_count: response.data.prepaid_count || 0,

        // Full response for audit
        response: response.data
      };

    } catch (error) {
      console.error('[DelhiveryGateway] Shipment creation failed:', error.response?.data || error.message);

      // Log detailed error information
      if (error.response) {
        console.error('[DelhiveryGateway] Error status:', error.response.status);
        console.error('[DelhiveryGateway] Error headers:', error.response.headers);
        console.error('[DelhiveryGateway] Error data:', JSON.stringify(error.response.data, null, 2));
      }

      throw new Error(`Failed to create shipment: ${error.response?.data?.rmk || error.message}`);
    }
  }

  /**
   * Track a shipment by AWB number
   */
  async trackShipment(awbNumber) {
    try {
      console.log(`[DelhiveryGateway] Tracking shipment: ${awbNumber}`);

      if (!awbNumber || typeof awbNumber !== 'string') {
        throw new Error('Invalid AWB number provided');
      }

      const response = await axios.get(`${this.baseUrl}/api/v1/packages/json/`, {
        headers: this.getHeaders(),
        params: {
          waybill: awbNumber
        }
      });

      console.log('[DelhiveryGateway] Tracking API response received');

      if (response.data && response.data.ShipmentData && response.data.ShipmentData.length > 0) {
        const shipmentData = response.data.ShipmentData[0];

        // Validate essential tracking data
        if (!shipmentData.Shipment) {
          throw new Error('Invalid shipment data structure received');
        }

        const trackingInfo = {
          awb: shipmentData.Shipment.AWB || awbNumber,
          status: shipmentData.Shipment.Status?.Status || 'Unknown',
          status_location: shipmentData.Shipment.Status?.StatusLocation || '',
          status_datetime: shipmentData.Shipment.Status?.StatusDateTime || '',
          scans: shipmentData.Shipment.Scans || [],
          destination: shipmentData.Shipment.Destination || '',
          consignee: shipmentData.Shipment.Consignee || {},
          origin: shipmentData.Shipment.Origin || '',
          raw_data: shipmentData
        };

        console.log(`[DelhiveryGateway] Tracking info - Status: ${trackingInfo.status}, Location: ${trackingInfo.status_location}`);

        return trackingInfo;
      }

      console.warn(`[DelhiveryGateway] No shipment data found for AWB: ${awbNumber}`);
      throw new Error('Shipment not found or tracking information unavailable');

    } catch (error) {
      console.error('[DelhiveryGateway] Tracking failed:', error.message);

      if (error.response) {
        console.error('[DelhiveryGateway] Tracking error status:', error.response.status);
        console.error('[DelhiveryGateway] Tracking error data:', error.response.data);
      }

      throw error;
    }
  }

  /**
   * Schedule a pickup with Delhivery
   */
  async schedulePickup(pickupDetails) {
    try {
      console.log('[DelhiveryGateway] Scheduling pickup:', pickupDetails);

      const pickupData = {
        pickup_location: pickupDetails.pickup_location || this.warehouseName,
        pickup_date: pickupDetails.pickup_date, // YYYY-MM-DD
        pickup_time: pickupDetails.pickup_time, // HH:MM:SS
        expected_package_count: pickupDetails.expected_package_count
      };

      const response = await axios.post(`${this.baseUrl}/fm/request/new/`, pickupData, {
        headers: this.getHeaders()
      });

      console.log('[DelhiveryGateway] Pickup scheduled successfully:', response.data);

      return {
        success: true,
        pickup_id: response.data.pickup_id || response.data.id,
        response: response.data
      };

    } catch (error) {
      console.error('[DelhiveryGateway] Pickup scheduling failed:', error.response?.data || error.message);
      throw new Error(`Failed to schedule pickup: ${error.message}`);
    }
  }

  /**
   * Cancel a shipment
   */
  async cancelShipment(awbNumber) {
    try {
      console.log(`[DelhiveryGateway] Cancelling shipment: ${awbNumber}`);

      const cancelData = {
        waybill: awbNumber,
        cancellation: true
      };

      const response = await axios.post(`${this.baseUrl}/api/p/edit`, cancelData, {
        headers: this.getHeaders()
      });

      console.log('[DelhiveryGateway] Shipment cancelled successfully');

      return {
        success: true,
        response: response.data
      };

    } catch (error) {
      console.error('[DelhiveryGateway] Cancellation failed:', error.message);
      throw error;
    }
  }

  /**
   * Edit shipment details
   */
  async editShipment(awbNumber, updates) {
    try {
      console.log(`[DelhiveryGateway] Editing shipment: ${awbNumber}`, updates);

      const editData = {
        waybill: awbNumber,
        ...updates
      };

      const response = await axios.post(`${this.baseUrl}/api/p/edit`, editData, {
        headers: this.getHeaders()
      });

      console.log('[DelhiveryGateway] Shipment edited successfully');

      return {
        success: true,
        response: response.data
      };

    } catch (error) {
      console.error('[DelhiveryGateway] Edit failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * Note: Delhivery webhook verification depends on their implementation
   * This is a placeholder - update based on Delhivery's actual webhook security
   */
  async verifyWebhookSignature(payload, headers) {
    try {
      // For now, we'll accept all webhooks and validate the payload structure
      // Update this method once Delhivery provides signature verification details

      if (!payload || !payload.Shipment) {
        return {
          valid: false,
          error: 'Invalid webhook payload structure'
        };
      }

      return {
        valid: true,
        data: payload
      };

    } catch (error) {
      console.error('[DelhiveryGateway] Webhook verification failed:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = DelhiveryGateway;
