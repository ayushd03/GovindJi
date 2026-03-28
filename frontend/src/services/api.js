import axios from 'axios';
import { API_BASE_URL } from '../config/apiBaseUrl';
import { clearAuthData, storeAuthData } from '../utils/authUtils';
import { shouldAutoRefreshAfterAuthError } from '../utils/authInterceptorPolicy';
import { buildAuthPath } from '../utils/authRouting';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  config.headers = config.headers || {};
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiration and refresh
let isRefreshing = false;
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if ((error.response?.status === 403 || error.response?.status === 401) && originalRequest && !originalRequest._retry) {
      const url = error.config?.url || '';
      const shouldAttemptRecovery = shouldAutoRefreshAfterAuthError(url);

      if (shouldAttemptRecovery) {
        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers || {};
        
        // If already refreshing, wait for that refresh to complete
        if (isRefreshing) {
          return refreshPromise.then(() => {
            const newToken = localStorage.getItem('authToken');
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return api(originalRequest);
            }
            throw error;
          });
        }
        
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          console.log('API interceptor: Starting token refresh due to 401/403');
          isRefreshing = true;
          
          refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })
          .then(async (response) => {
            if (response.ok) {
              const data = await response.json();
              const { session } = data;
              
              if (session) {
                console.log('API interceptor: Token refresh successful');
                // Store new tokens using utility
                const userDataStr = localStorage.getItem('userData');
                const userData = userDataStr ? JSON.parse(userDataStr) : null;
                storeAuthData(session, userData);
                
                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
                return api(originalRequest);
              }
            }
            throw new Error('Token refresh failed');
          })
          .catch((refreshError) => {
            console.log('API interceptor: Token refresh failed:', refreshError);
            // Refresh failed, clear all auth data
            clearAuthData();

            const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

            if (!window.location.pathname.includes('/auth')) {
              console.log('API interceptor: Redirecting to auth');
              window.location.href = buildAuthPath({
                mode: 'sign-in',
                reason: 'session-expired',
                next: nextPath,
              });
            }
            throw error;
          })
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
          
          return refreshPromise;
        } else {
          // No refresh token, clear auth data and redirect
          clearAuthData();

          const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

          if (!window.location.pathname.includes('/auth')) {
            window.location.href = buildAuthPath({
              mode: 'sign-in',
              reason: 'session-expired',
              next: nextPath,
            });
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: (userData) => api.post('/api/auth/signup', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resendConfirmation: (email) => api.post('/api/auth/resend-confirmation', { email }),
  exchangeLinkSession: (payload) => api.post('/api/auth/session-from-link', payload),
  updatePassword: (password, session = {}) => api.post(
    '/api/auth/update-password',
    session?.accessToken || session?.refreshToken
      ? {
          password,
          access_token: session.accessToken || undefined,
          refresh_token: session.refreshToken || undefined,
        }
      : { password },
    session?.accessToken ? { headers: { Authorization: `Bearer ${session.accessToken}` } } : undefined
  ),
  validateToken: () => api.get('/api/auth/validate'),
  getProfile: () => api.get('/api/auth/profile'),
  refreshToken: (refreshToken) => api.post('/api/auth/refresh', { refresh_token: refreshToken }),
};

export const productsAPI = {
  getAll: () => api.get('/api/products'),
  getById: (id) => api.get(`/api/products/${id}`),
  getByCategory: (category) => api.get(`/api/products/category/${category}`),
  getReviews: (productId) => api.get(`/api/products/${productId}/reviews`),
  addReview: (productId, reviewData) => api.post(`/api/products/${productId}/reviews`, reviewData),
  getImages: (productId) => api.get(`/api/products/${productId}/images`),
  // Variant endpoints
  getVariants: (productId) => api.get(`/api/admin/products/${productId}/variants`),
  saveVariants: (productId, variants) => api.post(`/api/admin/products/${productId}/variants`, { variants }),
  updateVariant: (productId, variantId, updates) => api.put(`/api/admin/products/${productId}/variants/${variantId}`, updates),
  deleteVariant: (productId, variantId) => api.delete(`/api/admin/products/${productId}/variants/${variantId}`),
};

export const categoriesAPI = {
  getAll: () => api.get('/api/categories'),
};

export const ordersAPI = {
  create: (orderData) => api.post('/api/orders', orderData),
  releaseUnpaid: (orderId) => api.put(`/api/orders/${orderId}/release-unpaid`),
  getUserOrders: (userId) => api.get(`/api/orders/${userId}`),
  createCheckoutSession: (items) => api.post('/api/create-checkout-session', { items }),
};

export const adminOrdersAPI = {
  getAll: (params) => api.get('/api/admin/orders', { params }),
  updateStatus: (orderId, status) => api.put(`/api/admin/orders/${orderId}/status`, { status }),
  cancel: (orderId) => api.put(`/api/admin/orders/${orderId}/cancel`),
  markCodCollected: (orderId) => api.put(`/api/admin/orders/${orderId}/mark-cod-collected`),
  getShipmentReadiness: (orderId) => api.get(`/api/admin/orders/${orderId}/shipment-readiness`),
};

export const deliveryAPI = {
  // Customer-facing endpoints
  trackOrder: (orderId) => api.get(`/api/delivery/track/${orderId}`),
  checkServiceability: (pincode) => api.get(`/api/delivery/check-serviceability?pincode=${pincode}`),
  getOptions: (pincode, subtotal = 0) => api.get('/api/delivery/options', {
    params: {
      pincode,
      subtotal,
    },
  }),

  // Admin endpoints
  getSettings: () => api.get('/api/admin/delivery/settings'),
  updateSettings: (settings) => api.put('/api/admin/delivery/settings', settings),
  createShipment: (orderId) => api.post(`/api/admin/delivery/create-shipment/${orderId}`),
  retryPickup: (orderId) => api.post(`/api/admin/delivery/retry-pickup/${orderId}`),
  schedulePickup: (pickupData) => api.post('/api/admin/delivery/schedule-pickup', pickupData),
  getShipments: (params) => api.get('/api/admin/delivery/shipments', { params }),
  getShipmentByAwb: (awbNumber) => api.get(`/api/admin/delivery/shipment/${awbNumber}`),
  cancelShipment: (awbNumber) => api.put(`/api/admin/delivery/cancel/${awbNumber}`),
  getPickupRequests: () => api.get('/api/admin/delivery/pickup-requests'),
};

export default api;
