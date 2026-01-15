import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Payment API Service
 * Handles all payment-related API calls
 */
const paymentAPI = {
  /**
   * Initiate payment for an order
   * @param {string} orderId - Order ID
   * @param {number} amount - Amount in rupees
   * @param {Object} customerInfo - Customer information (phone, email)
   * @param {string} paymentMethod - Payment method (default: PHONEPE)
   * @returns {Promise<Object>} Payment initiation response
   */
  initiatePayment: async (orderId, amount, customerInfo, paymentMethod = 'PHONEPE') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axiosInstance.post(
        '/api/payments/initiate',
        {
          orderId,
          amount,
          customerInfo,
          paymentMethod
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Payment initiation error:', error);
      throw error;
    }
  },

  /**
   * Check payment status
   * @param {string} merchantTransactionId - Transaction ID
   * @returns {Promise<Object>} Payment status response
   */
  checkPaymentStatus: async (merchantTransactionId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axiosInstance.get(
        `/api/payments/status/${merchantTransactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Payment status check error:', error);
      throw error;
    }
  }
};

export default paymentAPI;
