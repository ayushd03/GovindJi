import React from 'react';
import { usePermissions } from '../context/PermissionContext';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Component to guard content based on permissions
export const PermissionGuard = ({ 
  permission, 
  permissions, 
  fallback, 
  children,
  showFallback = true 
}) => {
  const { hasPermission, hasAnyPermission } = usePermissions();
  
  let hasAccess = false;
  
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && Array.isArray(permissions)) {
    hasAccess = hasAnyPermission(permissions);
  }
  
  if (!hasAccess) {
    if (fallback) {
      return fallback;
    }
    
    if (showFallback) {
      return (
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <ExclamationTriangleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600">You don't have permission to view this content.</p>
          </div>
        </div>
      );
    }
    
    return null;
  }
  
  return children;
};

// Higher-Order Component for protecting components
export const withPermission = (permission, permissions) => (WrappedComponent) => {
  return function PermissionWrappedComponent(props) {
    return (
      <PermissionGuard permission={permission} permissions={permissions}>
        <WrappedComponent {...props} />
      </PermissionGuard>
    );
  };
};

// Admin Panel Guard - specifically for admin routes
export const AdminPanelGuard = ({ children, fallback }) => {
  const { canAccessAdminPanel } = usePermissions();
  
  if (!canAccessAdminPanel()) {
    if (fallback) {
      return fallback;
    }
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don't have permission to access the admin panel.</p>
          <a 
            href="/" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Store
          </a>
        </div>
      </div>
    );
  }
  
  return children;
};