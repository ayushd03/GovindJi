import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  signup: (userData) => api.post('/api/auth/signup', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
};

export const productsAPI = {
  getAll: () => api.get('/api/products'),
  getById: (id) => api.get(`/api/products/${id}`),
  getByCategory: (category) => api.get(`/api/products/category/${category}`),
  getReviews: (productId) => api.get(`/api/products/${productId}/reviews`),
  addReview: (productId, reviewData) => api.post(`/api/products/${productId}/reviews`, reviewData),
};

export const ordersAPI = {
  create: (orderData) => api.post('/api/orders', orderData),
  getUserOrders: (userId) => api.get(`/api/orders/${userId}`),
  createCheckoutSession: (items) => api.post('/api/create-checkout-session', { items }),
};

export default api;