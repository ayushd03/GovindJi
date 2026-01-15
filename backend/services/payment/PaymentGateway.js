/**
 * Abstract Payment Gateway Interface
 * All payment gateways must implement this interface
 *
 * This provides a consistent API for different payment providers (PhonePe, Razorpay, Stripe, etc.)
 * allowing easy addition of new gateways without changing the core payment logic.
 */
class PaymentGateway {
  constructor(config) {
    if (this.constructor === PaymentGateway) {
      throw new Error("Cannot instantiate abstract class PaymentGateway");
    }
    this.config = config;
  }

  /**
   * Initiate a payment transaction
   * @param {Object} params - Payment parameters
   * @param {number} params.amount - Amount in smallest currency unit (paise for INR)
   * @param {string} params.orderId - Internal order ID
   * @param {string} params.merchantTransactionId - Unique transaction ID
   * @param {string} params.redirectUrl - URL to redirect after payment
   * @param {string} params.callbackUrl - URL for payment notifications
   * @param {Object} params.customerInfo - Customer details
   * @returns {Promise<Object>} - Payment initiation response with redirect URL
   */
  async initiatePayment(params) {
    throw new Error("Method 'initiatePayment' must be implemented by subclass");
  }

  /**
   * Verify payment callback
   * @param {Object} payload - Callback payload from gateway
   * @param {Object} headers - Request headers
   * @returns {Promise<Object>} - Verification result
   */
  async verifyCallback(payload, headers) {
    throw new Error("Method 'verifyCallback' must be implemented by subclass");
  }

  /**
   * Check payment status
   * @param {string} merchantTransactionId - Transaction ID
   * @returns {Promise<Object>} - Payment status
   */
  async checkPaymentStatus(merchantTransactionId) {
    throw new Error("Method 'checkPaymentStatus' must be implemented by subclass");
  }

  /**
   * Process refund
   * @param {Object} params - Refund parameters
   * @returns {Promise<Object>} - Refund response
   */
  async initiateRefund(params) {
    throw new Error("Method 'initiateRefund' must be implemented by subclass");
  }
}

module.exports = PaymentGateway;
