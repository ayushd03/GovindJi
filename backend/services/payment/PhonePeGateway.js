const crypto = require('crypto');
const axios = require('axios');
const PaymentGateway = require('./PaymentGateway');

/**
 * PhonePe Payment Gateway Implementation
 *
 * IMPORTANT: This uses PhonePe's v2 API with OAuth authentication
 * Key differences from v1:
 * - Uses OAuth tokens (O-Bearer) instead of X-VERIFY headers for payment initiation and status checks
 * - No base64 encoding for payment requests
 * - Different request/response structure
 * - Callback verification still uses X-VERIFY with salt key
 *
 * Official Documentation: https://developer.phonepe.com/payment-gateway/
 */
class PhonePeGateway extends PaymentGateway {
  constructor(config) {
    super(config);
    this.merchantId = config.merchantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.saltKey = config.saltKey; // Still needed for callback verification
    this.saltIndex = config.saltIndex; // Still needed for callback verification
    this.environment = config.environment || 'sandbox';
    this.baseUrl = this.environment === 'production'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    // OAuth endpoints differ between environments
    this.oauthUrl = this.environment === 'production'
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    // OAuth token cache
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Get OAuth access token for PhonePe APIs
   * Tokens are cached and reused until expiration
   */
  async getOAuthToken() {
    try {
      // Return cached token if still valid
      const currentTime = Math.floor(Date.now() / 1000);
      if (this.accessToken && this.tokenExpiresAt && currentTime < this.tokenExpiresAt) {
        console.log('Using cached OAuth token');
        return this.accessToken;
      }

      // Request new token
      console.log('Requesting new OAuth token from:', this.oauthUrl);

      const response = await axios.post(
        this.oauthUrl,
        new URLSearchParams({
          client_id: this.clientId,
          client_version: '1',
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = response.data.expires_at;

      console.log('OAuth token obtained successfully, expires at:', this.tokenExpiresAt);
      return this.accessToken;
    } catch (error) {
      console.error('OAuth token error:', error.response?.data || error.message);
      throw new Error('Failed to obtain OAuth token: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Verify callback signature from PhonePe
   * Note: Callbacks still use the old signature verification method
   */
  verifyCallbackSignature(base64Payload, xVerifyHeader) {
    const stringToHash = base64Payload + this.saltKey;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const expectedSignature = `${sha256Hash}###${this.saltIndex}`;
    return expectedSignature === xVerifyHeader;
  }

  /**
   * Initiate PhonePe payment using v2 API
   * Uses OAuth token for authorization (not X-VERIFY)
   */
  async initiatePayment(params) {
    try {
      const { amount, merchantTransactionId, redirectUrl, callbackUrl, customerInfo } = params;

      console.log('Initiating PhonePe payment for:', merchantTransactionId, 'Amount:', amount);

      // Get OAuth token first
      const accessToken = await this.getOAuthToken();

      // Prepare v2 API request payload (NO base64 encoding needed)
      const paymentPayload = {
        merchantOrderId: merchantTransactionId,
        amount: amount, // Amount in paise
        paymentFlow: {
          type: 'PG_CHECKOUT',
          merchantUrls: {
            redirectUrl: redirectUrl
          }
        }
      };

      console.log('Payment payload:', JSON.stringify(paymentPayload, null, 2));

      // Make API request to v2 endpoint
      const response = await axios.post(
        `${this.baseUrl}/checkout/v2/pay`,
        paymentPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `O-Bearer ${accessToken}`
          }
        }
      );

      console.log('PhonePe API response:', JSON.stringify(response.data, null, 2));

      // v2 API response structure
      if (response.data && response.data.redirectUrl) {
        return {
          success: true,
          paymentUrl: response.data.redirectUrl,
          merchantTransactionId: merchantTransactionId,
          phonepeTransactionId: response.data.orderId,
          orderId: response.data.orderId,
          state: response.data.state,
          expireAt: response.data.expireAt,
          response: response.data
        };
      } else {
        throw new Error(response.data?.message || 'Payment initiation failed - no redirect URL received');
      }
    } catch (error) {
      console.error('PhonePe payment initiation error:', error.response?.data || error.message);
      throw {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Verify PhonePe callback
   */
  async verifyCallback(payload, headers) {
    try {
      const xVerify = headers['x-verify'];
      const base64Response = payload.response;

      if (!xVerify || !base64Response) {
        throw new Error('Missing required callback fields: X-VERIFY or response');
      }

      // Verify signature
      const isValid = this.verifyCallbackSignature(base64Response, xVerify);

      if (!isValid) {
        throw new Error('Invalid callback signature');
      }

      // Decode payload
      const decodedPayload = Buffer.from(base64Response, 'base64').toString('utf-8');
      const paymentData = JSON.parse(decodedPayload);

      console.log('Callback verified successfully:', JSON.stringify(paymentData, null, 2));

      return {
        valid: true,
        data: paymentData
      };
    } catch (error) {
      console.error('Callback verification error:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check payment status with PhonePe using v2 API
   * Uses OAuth token for authorization
   */
  async checkPaymentStatus(merchantTransactionId) {
    try {
      console.log('Checking payment status for:', merchantTransactionId);

      // Get OAuth token
      const accessToken = await this.getOAuthToken();

      // v2 API endpoint
      const url = `${this.baseUrl}/checkout/v2/order/${merchantTransactionId}/status`;

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${accessToken}`
        }
      });

      console.log('Status check response:', JSON.stringify(response.data, null, 2));

      return {
        success: true,
        state: response.data.state,
        status: response.data.state,
        data: response.data
      };
    } catch (error) {
      console.error('Status check error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initiate refund
   */
  async initiateRefund(params) {
    // Implementation for refund API
    // Reference: https://developer.phonepe.com/v1/reference/initiate-refund-1
    throw new Error('Refund not yet implemented');
  }
}

module.exports = PhonePeGateway;
