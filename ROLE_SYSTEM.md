# Role-Based Permission System

This document explains the role-based permission system implemented for the admin panel.

## Overview

The system provides granular access control for admin panel features based on user roles. It uses enums for clean, maintainable permission management and supports easy addition of new roles and permissions.

## User Roles

### Admin
- **Full Access**: Can access all admin panel features
- **Permissions**: All available permissions
- **Use Cases**: Store owners, system administrators

### Manager
- **Limited Access**: Can only access specific operational features
- **Permissions**: 
  - View Dashboard
  - View & Manage Orders
  - View & Manage Inventory
- **Use Cases**: Store managers, operational staff

### Customer
- **No Admin Access**: Cannot access admin panel
- **Permissions**: None
- **Use Cases**: Regular store customers

## Implementation

### Frontend Structure

```
src/
├── enums/
│   └── roles.js                    # Role and permission definitions
├── context/
│   └── PermissionContext.js        # Permission context provider
├── components/
│   ├── PermissionGuard.js          # Permission-based component guards
│   └── RoleIndicator.js            # Role display component
└── pages/admin/
    ├── AdminDashboard.js           # Protected with VIEW_DASHBOARD
    ├── ProductManagement.js        # Protected with VIEW_PRODUCTS
    ├── OrderManagement.js          # Protected with VIEW_ORDERS
    ├── CategoryManagement.js       # Protected with VIEW_CATEGORIES
    ├── InventoryManagement.js      # Protected with VIEW_INVENTORY
    ├── CustomerManagement.js       # Protected with VIEW_CUSTOMERS
    └── AnalyticsManagement.js      # Protected with VIEW_ANALYTICS
```

### Backend Structure

```
backend/
├── middleware/
│   └── roleMiddleware.js           # Role-based authentication middleware
├── setup-roles.js                 # Script to assign roles to users
└── server.js                      # API endpoints with permission checks
```

## Usage

### Frontend Permission Checking

```javascript
import { usePermissions } from '../context/PermissionContext';
import { ADMIN_PERMISSIONS } from '../enums/roles';

function MyComponent() {
  const { hasPermission, userRole } = usePermissions();
  
  // Check single permission
  if (hasPermission(ADMIN_PERMISSIONS.VIEW_PRODUCTS)) {
    // User can view products
  }
  
  // Check user role
  if (userRole === 'admin') {
    // User is admin
  }
}
```

### Component Protection

```javascript
import { PermissionGuard } from '../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../enums/roles';

function ProductPage() {
  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_PRODUCTS}>
      <div>Products content...</div>
    </PermissionGuard>
  );
}
```

### Backend Permission Checking

```javascript
const { requirePermission, ADMIN_PERMISSIONS } = require('./middleware/roleMiddleware');

// Protect endpoint with specific permission
app.get('/api/admin/products', requirePermission(ADMIN_PERMISSIONS.VIEW_PRODUCTS), (req, res) => {
  // Only users with VIEW_PRODUCTS permission can access
});
```

## Setting Up User Roles

### Method 1: Using Setup Script

```bash
# Navigate to backend directory
cd backend

# Set user as admin
node setup-roles.js <user_id> admin

# Set user as manager
node setup-roles.js <user_id> manager

# Set user as customer
node setup-roles.js <user_id> customer
```

### Method 2: Direct Database Update

```sql
-- Update user role in Supabase
UPDATE users 
SET role = 'manager', is_admin = true 
WHERE id = '<user_id>';
```

## Adding New Roles

### 1. Update Frontend Enums

```javascript
// src/enums/roles.js
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor', // New role
  CUSTOMER: 'customer'
};

export const ROLE_PERMISSIONS = {
  [USER_ROLES.SUPERVISOR]: [
    ADMIN_PERMISSIONS.VIEW_DASHBOARD,
    ADMIN_PERMISSIONS.VIEW_PRODUCTS,
    // Add specific permissions
  ],
  // ... other roles
};
```

### 2. Update Backend Middleware

```javascript
// backend/middleware/roleMiddleware.js
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor', // New role
  CUSTOMER: 'customer'
};

const ROLE_PERMISSIONS = {
  [USER_ROLES.SUPERVISOR]: [
    // Add permissions for new role
  ],
  // ... other roles
};
```

### 3. Update Setup Script

```javascript
// backend/setup-roles.js
const validRoles = ['admin', 'manager', 'supervisor', 'customer'];
```

## Adding New Permissions

### 1. Define Permission

```javascript
// src/enums/roles.js
export const ADMIN_PERMISSIONS = {
  // ... existing permissions
  MANAGE_REPORTS: 'manage_reports', // New permission
};
```

### 2. Assign to Roles

```javascript
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    // ... existing permissions
    ADMIN_PERMISSIONS.MANAGE_REPORTS,
  ],
  // ... other roles
};
```

### 3. Create Protected Component/Route

```javascript
<PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_REPORTS}>
  <ReportsComponent />
</PermissionGuard>
```

## Testing

### Test Different Roles

1. Create test users with different roles using the setup script
2. Log in as each user type
3. Verify that:
   - Appropriate admin tabs are visible/hidden
   - Permission guards work correctly
   - Backend endpoints respect permissions
   - Role indicator shows correct information

### Visual Indicators

- **Role Indicator**: Shows current user's role and accessible tabs
- **Permission Guards**: Display access denied messages for restricted content
- **Dynamic Navigation**: Only shows tabs user has permission to access

## Security Notes

- All permission checks are enforced on both frontend and backend
- Frontend guards are for UX only - backend validation is the security boundary
- Tokens include user information, but permissions are checked against database
- Role changes require re-authentication to take effect
- Always validate permissions on the backend for sensitive operations

## Troubleshooting

### Common Issues

1. **Role not updating**: Clear browser cache and localStorage, then log in again
2. **Permission denied**: Check user role in database matches expected permissions
3. **Tabs not showing**: Verify PermissionProvider is wrapping the app correctly
4. **Backend errors**: Ensure role middleware is imported and used correctly

### Debug Information

The RoleIndicator component shows current role and accessible tabs for debugging. Set `showDetails={true}` for expanded information.