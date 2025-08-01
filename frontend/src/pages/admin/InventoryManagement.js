import React from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const InventoryManagement = () => {
  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_INVENTORY}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <ClipboardDocumentListIcon className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
              <p className="mt-1 text-gray-500">Manage stock levels and inventory tracking</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Inventory Management</h3>
            <p className="text-gray-600 mb-6">
              This feature allows you to track stock movements, adjust inventory levels, and manage warehouse operations.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                This page is accessible by Admin and Manager roles only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default InventoryManagement;