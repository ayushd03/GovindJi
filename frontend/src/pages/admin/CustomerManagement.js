import React from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import { UsersIcon } from '@heroicons/react/24/outline';

const CustomerManagement = () => {
  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_CUSTOMERS}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <UsersIcon className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
              <p className="mt-1 text-gray-500">Manage customer accounts and information</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Customer Management</h3>
            <p className="text-gray-600 mb-6">
              This feature allows you to view customer profiles, manage accounts, and handle customer support.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-red-800">
                This page is accessible by Admin role only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default CustomerManagement;