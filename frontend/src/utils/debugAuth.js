/**
 * Debug utility to test authentication flow
 */

export const debugAuthStorage = () => {
  const authData = {
    authToken: localStorage.getItem('authToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    userData: localStorage.getItem('userData'),
    tokenExpiry: localStorage.getItem('tokenExpiry')
  };

  console.log('=== AUTH STORAGE DEBUG ===');
  console.log('Auth Token:', authData.authToken ? 'Present' : 'Missing');
  console.log('Refresh Token:', authData.refreshToken ? 'Present' : 'Missing');
  console.log('User Data:', authData.userData ? JSON.parse(authData.userData) : 'Missing');
  
  if (authData.tokenExpiry) {
    const expiryDate = new Date(parseInt(authData.tokenExpiry));
    const now = new Date();
    const isExpired = now > expiryDate;
    console.log('Token Expiry:', expiryDate.toISOString());
    console.log('Current Time:', now.toISOString());
    console.log('Is Expired:', isExpired);
    console.log('Time until expiry:', Math.floor((expiryDate - now) / 1000 / 60), 'minutes');
  } else {
    console.log('Token Expiry: Missing');
  }
  console.log('========================');
  
  return authData;
};

export const testTokenRefresh = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    console.error('No refresh token available for testing');
    return false;
  }

  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Token refresh test successful:', data);
      return true;
    } else {
      const error = await response.text();
      console.error('Token refresh test failed:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('Token refresh test error:', error);
    return false;
  }
};

// Make debug functions available globally for testing
window.debugAuthStorage = debugAuthStorage;
window.testTokenRefresh = testTokenRefresh;