import React from 'react';
import { UsersIcon } from '@heroicons/react/24/outline';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';

const CustomerManagement = () => {
  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_CUSTOMERS}>
      <div className="admin-page">
        <div className="admin-page-header">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <UsersIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="admin-page-title">Customer Management</h1>
              <p className="admin-page-description">Customer profiles, account activity, and support actions will live here.</p>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <div className="admin-empty-state border-solid bg-card px-8 py-16">
            <UsersIcon className="mb-4 h-16 w-16 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground">Customer workspace coming next</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              This page is reserved for customer profiles, account activity, and support workflows. The shell is now aligned with the rest of the admin panel so the feature can be added without redesigning the page again.
            </p>
            <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm text-primary">
              Accessible to the Admin role only.
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default CustomerManagement;
