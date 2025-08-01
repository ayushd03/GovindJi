import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { 
  hasPermission, 
  hasAnyPermission, 
  getAccessibleTabs, 
  canAccessAdminPanel,
  USER_ROLES 
} from '../enums/roles';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user } = useAuth();
  
  // Get user role from user object, fallback to customer
  const userRole = user?.role || USER_ROLES.CUSTOMER;
  
  // Permission checking functions
  const checkPermission = (permission) => {
    return hasPermission(userRole, permission);
  };
  
  const checkAnyPermission = (permissions) => {
    return hasAnyPermission(userRole, permissions);
  };
  
  const getAvailableTabs = () => {
    return getAccessibleTabs(userRole);
  };
  
  const canAccessAdmin = () => {
    return canAccessAdminPanel(userRole);
  };
  
  const isAdmin = () => {
    return userRole === USER_ROLES.ADMIN;
  };
  
  const isManager = () => {
    return userRole === USER_ROLES.MANAGER;
  };
  
  const isCustomer = () => {
    return userRole === USER_ROLES.CUSTOMER;
  };

  const value = {
    userRole,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    getAccessibleTabs: getAvailableTabs,
    canAccessAdminPanel: canAccessAdmin,
    isAdmin,
    isManager,
    isCustomer
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};