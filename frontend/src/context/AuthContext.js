import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { isTokenValid, shouldRefreshToken, clearAuthData, getStoredUserData, storeAuthData } from '../utils/authUtils';
import '../utils/debugAuth'; // Initialize debug utilities

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const userData = localStorage.getItem('userData');
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      
      console.log('Initializing auth with stored data:', {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
        hasUserData: !!userData,
        tokenExpiry: tokenExpiry ? new Date(parseInt(tokenExpiry)).toISOString() : null,
        isExpired: tokenExpiry ? new Date().getTime() > parseInt(tokenExpiry) : null
      });
      
      // If we have stored auth data, try to use it
      if (token && userData) {
        try {
          // Check if token is expired based on our stored expiry
          if (tokenExpiry && new Date().getTime() > parseInt(tokenExpiry)) {
            console.log('Token expired based on stored expiry, attempting refresh...');
            
            // Token is expired, try to refresh if we have refresh token
            if (refreshToken) {
              try {
                const refreshResponse = await authAPI.refreshToken(refreshToken);
                const { session } = refreshResponse.data;
                
                if (session) {
                  // Store new tokens
                  storeAuthData(session, JSON.parse(userData));
                  setUser(JSON.parse(userData));
                  console.log('Token refreshed successfully on startup');
                  setLoading(false);
                  return;
                }
              } catch (refreshError) {
                console.log('Token refresh failed on startup:', refreshError);
              }
            }
            
            // If refresh failed or no refresh token, clear data
            console.log('Unable to refresh expired token, clearing data');
            clearAuthData();
            setUser(null);
            setLoading(false);
            return;
          }
          
          // Token appears valid, try to use it
          console.log('Token appears valid, attempting validation...');
          try {
            // First validate token, then get fresh profile data
            await authAPI.validateToken();
            const profileResponse = await authAPI.getProfile();
            const { profile } = profileResponse.data;
            
            // Update user data with fresh profile information including role
            const updatedUser = {
              ...JSON.parse(userData),
              ...profile
            };
            
            // Update stored user data with latest profile
            localStorage.setItem('userData', JSON.stringify(updatedUser));
            setUser(updatedUser);
            console.log('Token validation and profile update successful');
          } catch (validationError) {
            console.log('Token validation failed, attempting refresh...');
            
            // Validation failed, try refresh if available
            if (refreshToken) {
              try {
                const refreshResponse = await authAPI.refreshToken(refreshToken);
                const { session } = refreshResponse.data;
                
                if (session) {
                  storeAuthData(session, JSON.parse(userData));
                  setUser(JSON.parse(userData));
                  console.log('Token refreshed after validation failure');
                  setLoading(false);
                  return;
                }
              } catch (refreshError) {
                console.log('Token refresh failed after validation failure:', refreshError);
              }
            }
            
            // Both validation and refresh failed
            console.log('Both validation and refresh failed, clearing data');
            clearAuthData();
            setUser(null);
          }
        } catch (error) {
          console.error('Unexpected error during auth initialization:', error);
          clearAuthData();
          setUser(null);
        }
      } else {
        console.log('No stored auth data found');
      }
      
      setLoading(false);
    };

    initializeAuth();

    // Listen for storage changes (when token is removed by API interceptor)
    const handleStorageChange = (e) => {
      if ((e.key === 'authToken' || e.key === 'refreshToken' || e.key === 'userData') && !e.newValue) {
        // Auth data was removed, update user state
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for manual localStorage changes in the same tab
    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
      if (key === 'authToken' || key === 'refreshToken' || key === 'userData') {
        setUser(null);
      }
      return originalRemoveItem.apply(this, arguments);
    };

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      localStorage.removeItem = originalRemoveItem;
    };
  }, []);

  // Auto-refresh tokens before they expire
  useEffect(() => {
    if (!user) return;

    const checkAndRefreshToken = async () => {
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      const refreshToken = localStorage.getItem('refreshToken');
      const userData = localStorage.getItem('userData');
      
      if (tokenExpiry && refreshToken && userData) {
        const expiryTime = parseInt(tokenExpiry);
        const currentTime = new Date().getTime();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // Refresh token if it expires in the next 5 minutes (300000ms)
        if (timeUntilExpiry < 300000 && timeUntilExpiry > 0) {
          try {
            console.log('Auto-refreshing token (expires in', Math.floor(timeUntilExpiry / 1000 / 60), 'minutes)');
            const refreshResponse = await authAPI.refreshToken(refreshToken);
            const { session } = refreshResponse.data;
            
            if (session) {
              storeAuthData(session, JSON.parse(userData));
              console.log('Token auto-refreshed successfully');
            }
          } catch (error) {
            console.error('Auto token refresh failed:', error);
            // Don't logout automatically on refresh failure, let the API interceptor handle it
          }
        } else if (timeUntilExpiry > 0) {
          console.log('Token is valid for', Math.floor(timeUntilExpiry / 1000 / 60), 'more minutes');
        }
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Set up interval to check every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 300000);

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { user, session } = response.data;
      
      if (!session || !user) {
        return { 
          success: false, 
          error: 'Invalid login response' 
        };
      }
      
      // Store all token information for production-ready auth
      storeAuthData(session, user);
      
      // Get fresh profile data including role after successful login
      try {
        const profileResponse = await authAPI.getProfile();
        const { profile } = profileResponse.data;
        
        // Update user data with profile information including role
        const updatedUser = {
          ...user,
          ...profile
        };
        
        // Update stored user data with latest profile
        localStorage.setItem('userData', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch (profileError) {
        console.warn('Failed to fetch profile after login:', profileError);
        // Still set the basic user data if profile fetch fails
        setUser(user);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Login failed' 
      };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await authAPI.signup({ name, email, password });
      const data = response.data;
      
      // Handle email confirmation required case
      if (data.confirmationRequired) {
        return { 
          success: true, 
          message: data.message || 'Please check your email to confirm your account',
          confirmationRequired: true
        };
      }
      
      // Handle successful signup with immediate session
      if (data.session && data.user) {
        storeAuthData(data.session, data.user);
        setUser(data.user);
        return { success: true };
      }
      
      // Handle other cases
      const { user, session } = data;
      if (session) {
        storeAuthData(session, user);
        setUser(user);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Signup failed' 
      };
    }
  };

  const refreshUserToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const refreshResponse = await authAPI.refreshToken(refreshToken);
      const { session } = refreshResponse.data;
      
      if (session) {
        const userData = getStoredUserData();
        if (userData) {
          storeAuthData(session, userData);
          return { success: true };
        }
      }
      throw new Error('Invalid refresh response');
    } catch (error) {
      clearAuthData();
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    clearAuthData();
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    refreshUserToken,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};