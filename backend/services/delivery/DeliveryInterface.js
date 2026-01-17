/**
 * DeliveryInterface - Abstract base class for delivery gateway implementations
 *
 * This defines the contract that all delivery provider implementations must follow.
 * Similar to the PaymentGateway pattern used in the codebase.
 */

class DeliveryInterface {
  /**
   * Check if delivery is available to a specific pincode
   * @param {string} pincode - 6-digit pincode
   * @returns {Promise<{serviceable: boolean, delivery_codes: Array}>}
   */
  async checkServiceability(pincode) {
    throw new Error('checkServiceability method must be implemented');
  }

  /**
   * Create a shipment/order with the delivery provider
   * @param {Object} orderData - Order information
   * @param {Object} shipmentDetails - Shipment-specific details (weight, dimensions, etc.)
   * @returns {Promise<{awb: string, upload_wbn: string, success: boolean}>}
   */
  async createShipment(orderData, shipmentDetails) {
    throw new Error('createShipment method must be implemented');
  }

  /**
   * Track a shipment by AWB number
   * @param {string} awbNumber - Air Waybill tracking number
   * @returns {Promise<Object>} Tracking information
   */
  async trackShipment(awbNumber) {
    throw new Error('trackShipment method must be implemented');
  }

  /**
   * Schedule a pickup with the courier
   * @param {Object} pickupDetails - Pickup location, date, time, package count
   * @returns {Promise<{pickup_id: string, success: boolean}>}
   */
  async schedulePickup(pickupDetails) {
    throw new Error('schedulePickup method must be implemented');
  }

  /**
   * Cancel a shipment
   * @param {string} awbNumber - Air Waybill number to cancel
   * @returns {Promise<{success: boolean}>}
   */
  async cancelShipment(awbNumber) {
    throw new Error('cancelShipment method must be implemented');
  }

  /**
   * Edit shipment details (if not yet dispatched)
   * @param {string} awbNumber - Air Waybill number
   * @param {Object} updates - Fields to update
   * @returns {Promise<{success: boolean}>}
   */
  async editShipment(awbNumber, updates) {
    throw new Error('editShipment method must be implemented');
  }

  /**
   * Get waybill numbers in bulk for future use
   * @param {number} count - Number of AWB numbers to fetch
   * @returns {Promise<Array<string>>} Array of AWB numbers
   */
  async getWaybills(count) {
    throw new Error('getWaybills method must be implemented');
  }

  /**
   * Verify webhook callback signature/authenticity
   * @param {Object} payload - Webhook payload
   * @param {Object} headers - Request headers
   * @returns {Promise<{valid: boolean, data: Object}>}
   */
  async verifyWebhookSignature(payload, headers) {
    throw new Error('verifyWebhookSignature method must be implemented');
  }
}

module.exports = DeliveryInterface;
