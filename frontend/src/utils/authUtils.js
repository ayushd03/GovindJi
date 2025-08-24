/**
 * Utility functions for authentication handling
 */

/**
 * Check if the stored token is still valid based on expiry time
 * @returns {boolean} true if token is valid and not expired
 */
export const isTokenValid = () => {
  const token = localStorage.getItem('authToken');
  const tokenExpiry = localStorage.getItem('tokenExpiry');
  
  if (!token || !tokenExpiry) {
    return false;
  }
  
  const expiryTime = parseInt(tokenExpiry);
  const currentTime = new Date().getTime();
  
  return currentTime < expiryTime;
};

/**
 * Check if token needs refresh (expires within 5 minutes)
 * @returns {boolean} true if token needs refresh
 */
export const shouldRefreshToken = () => {
  const tokenExpiry = localStorage.getItem('tokenExpiry');
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!tokenExpiry || !refreshToken) {
    return false;
  }
  
  const expiryTime = parseInt(tokenExpiry);
  const currentTime = new Date().getTime();
  const timeUntilExpiry = expiryTime - currentTime;
  
  // Refresh if expires in next 5 minutes
  return timeUntilExpiry < 300000 && timeUntilExpiry > 0;
};

/**
 * Clear all authentication data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('tokenExpiry');
};

/**
 * Get user data from localStorage safely
 * @returns {object|null} user data or null if not found/invalid
 */
export const getStoredUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error parsing stored user data:', error);
    return null;
  }
};

/**
 * Store authentication data securely
 * @param {object} session - Supabase session object
 * @param {object} user - User data object
 */
export const storeAuthData = (session, user) => {
  // Store authentication data
  
  localStorage.setItem('authToken', session.access_token);
  localStorage.setItem('refreshToken', session.refresh_token);
  localStorage.setItem('userData', JSON.stringify(user));
  
  // Use expires_at if available (Unix timestamp), otherwise calculate from expires_in
  let expiryTime;
  if (session.expires_at) {
    expiryTime = session.expires_at * 1000; // Convert to milliseconds
  } else {
    expiryTime = new Date().getTime() + (session.expires_in * 1000);
  }
  
  localStorage.setItem('tokenExpiry', expiryTime.toString());
  // Token expiry set
};