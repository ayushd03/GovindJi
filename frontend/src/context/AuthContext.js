import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authAPI } from '../services/api';
import { clearAuthData, getStoredUserData, storeAuthData } from '../utils/authUtils';

const AuthContext = createContext();

const mergeUserState = (authUser, profile, fallbackUser = null) => {
  const merged = {
    ...(fallbackUser || {}),
    ...(authUser || {}),
    ...(profile || {}),
    email: profile?.email || authUser?.email || fallbackUser?.email || '',
    name:
      profile?.name ||
      fallbackUser?.name ||
      authUser?.user_metadata?.name ||
      authUser?.email?.split('@')[0] ||
      '',
    user_metadata: authUser?.user_metadata || fallbackUser?.user_metadata || {},
  };

  // Ensure role comes from profile (backend source of truth)
  // Profile role takes precedence as it comes from the database
  if (profile?.role) {
    merged.role = profile.role;
  } else if (!merged.role) {
    // If no role is available, default to customer
    merged.role = 'customer';
  }

  return merged;
};

const persistUserData = (nextUser) => {
  if (nextUser) {
    localStorage.setItem('userData', JSON.stringify(nextUser));
  } else {
    localStorage.removeItem('userData');
  }
};

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

  const fetchProfileAndSyncUser = useCallback(async (fallbackUser = null) => {
    const profileResponse = await authAPI.getProfile();
    const { profile, user: authUser } = profileResponse.data;
    const mergedUser = mergeUserState(authUser, profile, fallbackUser);
    persistUserData(mergedUser);
    setUser(mergedUser);
    return mergedUser;
  }, []);

  const applySession = useCallback(async (session, fallbackUser = null) => {
    storeAuthData(session, fallbackUser);

    try {
      return await fetchProfileAndSyncUser(fallbackUser);
    } catch (profileError) {
      if (fallbackUser) {
        persistUserData(fallbackUser);
        setUser(fallbackUser);
        return fallbackUser;
      }

      throw profileError;
    }
  }, [fetchProfileAndSyncUser]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      const storedUser = getStoredUserData();

      if (!token) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      const finish = () => {
        if (isMounted) {
          setLoading(false);
        }
      };

      try {
        const expiryTime = tokenExpiry ? parseInt(tokenExpiry, 10) : null;

        if (expiryTime && Date.now() > expiryTime) {
          if (refreshToken) {
            try {
              const refreshResponse = await authAPI.refreshToken(refreshToken);
              const { session, user: refreshedUser } = refreshResponse.data;

              if (session) {
                await applySession(session, refreshedUser || storedUser);
                finish();
                return;
              }
            } catch (refreshError) {
              console.log('Token refresh failed on startup:', refreshError);
            }
          }

          clearAuthData();
          if (isMounted) {
            setUser(null);
          }
          finish();
          return;
        }

        try {
          await authAPI.validateToken();
          await fetchProfileAndSyncUser(storedUser);
          finish();
          return;
        } catch (validationError) {
          console.log('Token validation failed on startup:', validationError);

          if (refreshToken) {
            try {
              const refreshResponse = await authAPI.refreshToken(refreshToken);
              const { session, user: refreshedUser } = refreshResponse.data;

              if (session) {
                await applySession(session, refreshedUser || storedUser);
                finish();
                return;
              }
            } catch (refreshError) {
              console.log('Token refresh after validation failure failed:', refreshError);
            }
          }
        }

        clearAuthData();
        if (isMounted) {
          setUser(null);
        }
      } catch (error) {
        console.error('Unexpected auth initialization error:', error);
        clearAuthData();
        if (isMounted) {
          setUser(null);
        }
      }

      finish();
    };

    initializeAuth();

    const handleStorageChange = (event) => {
      if (
        (event.key === 'authToken' || event.key === 'refreshToken' || event.key === 'userData') &&
        !event.newValue
      ) {
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [applySession, fetchProfileAndSyncUser]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const checkAndRefreshToken = async () => {
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      const refreshToken = localStorage.getItem('refreshToken');
      const storedUser = getStoredUserData();

      if (!tokenExpiry || !refreshToken) {
        return;
      }

      const expiryTime = parseInt(tokenExpiry, 10);
      const timeUntilExpiry = expiryTime - Date.now();

      if (timeUntilExpiry < 300000 && timeUntilExpiry > 0) {
        try {
          const refreshResponse = await authAPI.refreshToken(refreshToken);
          const { session, user: refreshedUser } = refreshResponse.data;

          if (session) {
            await applySession(session, refreshedUser || storedUser || user);
          }
        } catch (error) {
          console.error('Auto token refresh failed:', error);
        }
      }
    };

    checkAndRefreshToken();
    const interval = setInterval(checkAndRefreshToken, 300000);

    return () => clearInterval(interval);
  }, [applySession, user]);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { user: authUser, session } = response.data;

      if (!session || !authUser) {
        return {
          success: false,
          error: 'Invalid login response',
          code: 'invalid_login_response',
        };
      }

      await applySession(session, authUser);

      return {
        success: true,
        user: authUser,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Login failed',
        code: error.response?.data?.code || 'login_failed',
      };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await authAPI.signup({ name, email, password });
      const data = response.data;

      if (data.confirmationRequired) {
        return {
          success: true,
          email,
          message: data.message || 'Please check your email to confirm your account',
          confirmationRequired: true,
        };
      }

      if (data.session && data.user) {
        await applySession(data.session, data.user);
      }

      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Signup failed',
        code: error.response?.data?.code || 'signup_failed',
      };
    }
  };

  const refreshUserToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const storedUser = getStoredUserData();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const refreshResponse = await authAPI.refreshToken(refreshToken);
      const { session, user: refreshedUser } = refreshResponse.data;

      if (!session) {
        throw new Error('Invalid refresh response');
      }

      await applySession(session, refreshedUser || storedUser || user);
      return { success: true };
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
    applySession,
    refreshUserToken,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
