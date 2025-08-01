import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { 
  ShieldCheckIcon, 
  UserIcon, 
  CogIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const RoleIndicator = ({ showDetails = false }) => {
  const { user } = useAuth();
  const { userRole, getAccessibleTabs, canAccessAdminPanel } = usePermissions();

  if (!user) return null;

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return ShieldCheckIcon;
      case 'manager': return CogIcon;
      case 'customer': return UserIcon;
      default: return UserIcon;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'customer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const RoleIcon = getRoleIcon(userRole);
  const accessibleTabs = getAccessibleTabs();

  if (!showDetails) {
    return (
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(userRole)}`}>
        <RoleIcon className="w-3 h-3 mr-1" />
        {userRole?.charAt(0).toUpperCase() + userRole?.slice(1) || 'Customer'}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Role Information</h3>
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(userRole)}`}>
          <RoleIcon className="w-3 h-3 mr-1" />
          {userRole?.charAt(0).toUpperCase() + userRole?.slice(1) || 'Customer'}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">User Information</p>
          <p className="text-sm text-gray-900">{user.name || user.email}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Admin Panel Access</p>
          {canAccessAdminPanel() ? (
            <div className="flex items-center text-sm text-green-600">
              <ShieldCheckIcon className="w-4 h-4 mr-1" />
              Granted
            </div>
          ) : (
            <div className="flex items-center text-sm text-gray-500">
              <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
              Denied
            </div>
          )}
        </div>

        {accessibleTabs.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Accessible Tabs ({accessibleTabs.length})</p>
            <div className="flex flex-wrap gap-1">
              {accessibleTabs.map((tab, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {tab.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleIndicator;