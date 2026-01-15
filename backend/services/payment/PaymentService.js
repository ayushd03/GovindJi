const PhonePeGateway = require('./PhonePeGateway');

/**
 * Payment Service Orchestrator
 *
 * This service manages multiple payment gateways and provides a unified interface
 * for payment operations. It initializes all configured gateways and routes
 * requests to the appropriate gateway based on the payment method.
 */
class PaymentService {
  constructor() {
    this.gateways = new Map();
    this.initializeGateways();
  }

  /**
   * Initialize all configured payment gateways
   */
  initializeGateways() {
    // PhonePe Gateway
    if (process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET) {
      console.log('Initializing PhonePe gateway...');
      this.gateways.set('PHONEPE', new PhonePeGateway({
        merchantId: process.env.PHONEPE_MERCHANT_ID,
        clientId: process.env.PHONEPE_CLIENT_ID,
        clientSecret: process.env.PHONEPE_CLIENT_SECRET,
        saltKey: process.env.PHONEPE_SALT_KEY,
        saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      }));
      console.log('PhonePe gateway initialized successfully');
    } else {
      console.warn('PhonePe gateway not initialized - missing credentials');
    }

    // Future gateways can be added here
    // Example:
    // if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    //   this.gateways.set('RAZORPAY', new RazorpayGateway({
    //     keyId: process.env.RAZORPAY_KEY_ID,
    //     keySecret: process.env.RAZORPAY_KEY_SECRET,
    //     environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    //   }));
    // }

    console.log(`Payment service initialized with ${this.gateways.size} gateway(s):`, Array.from(this.gateways.keys()));
  }

  /**
   * Get gateway instance
   */
  getGateway(gatewayName = 'PHONEPE') {
    const gateway = this.gateways.get(gatewayName.toUpperCase());
    if (!gateway) {
      throw new Error(`Payment gateway ${gatewayName} not configured. Available gateways: ${Array.from(this.gateways.keys()).join(', ')}`);
    }
    return gateway;
  }

  /**
   * Initiate payment through specified gateway
   */
  async initiatePayment(gatewayName, params) {
    const gateway = this.getGateway(gatewayName);
    return await gateway.initiatePayment(params);
  }

  /**
   * Verify callback from specified gateway
   */
  async verifyCallback(gatewayName, payload, headers) {
    const gateway = this.getGateway(gatewayName);
    return await gateway.verifyCallback(payload, headers);
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(gatewayName, merchantTransactionId) {
    const gateway = this.getGateway(gatewayName);
    return await gateway.checkPaymentStatus(merchantTransactionId);
  }

  /**
   * Initiate refund
   */
  async initiateRefund(gatewayName, params) {
    const gateway = this.getGateway(gatewayName);
    return await gateway.initiateRefund(params);
  }
}

// Export singleton instance
module.exports = new PaymentService();
