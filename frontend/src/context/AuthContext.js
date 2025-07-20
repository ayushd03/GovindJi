import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

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
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

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
      
      localStorage.setItem('authToken', session.access_token);
      localStorage.setItem('userData', JSON.stringify(user));
      setUser(user);
      
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
        localStorage.setItem('authToken', data.session.access_token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        return { success: true };
      }
      
      // Handle other cases
      const { user, session } = data;
      if (session) {
        localStorage.setItem('authToken', session.access_token);
        localStorage.setItem('userData', JSON.stringify(user));
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

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};