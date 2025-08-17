// User roles enum
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CUSTOMER: 'customer'
};

// Admin panel permissions enum
export const ADMIN_PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_CATEGORIES: 'view_categories',
  MANAGE_CATEGORIES: 'manage_categories',
  VIEW_PRODUCTS: 'view_products',
  MANAGE_PRODUCTS: 'manage_products',
  VIEW_ORDERS: 'view_orders',
  MANAGE_ORDERS: 'manage_orders',
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
  VIEW_CUSTOMERS: 'view_customers',
  MANAGE_CUSTOMERS: 'manage_customers',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_VENDORS: 'view_vendors',
  MANAGE_VENDORS: 'manage_vendors',
  VIEW_EMPLOYEES: 'view_employees',
  MANAGE_EMPLOYEES: 'manage_employees',
  VIEW_EXPENSES: 'view_expenses',
  MANAGE_EXPENSES: 'manage_expenses'
};

// Admin tabs configuration with their required permissions
export const ADMIN_TABS = {
  DASHBOARD: {
    path: '/admin',
    label: 'Dashboard',
    icon: 'ChartBarIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_DASHBOARD]
  },
  ORDERS: {
    path: '/admin/orders',
    label: 'Orders',
    icon: 'ShoppingCartIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_ORDERS]
  },
  EXPENSES: {
    path: '/admin/expenses',
    label: 'Expenses',
    icon: 'CurrencyDollarIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_EXPENSES]
  },
  PRODUCTS: {
    path: '/admin/products',
    label: 'Products',
    icon: 'CubeIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_PRODUCTS]
  },
  CATEGORIES: {
    path: '/admin/categories',
    label: 'Categories',
    icon: 'TagIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_CATEGORIES]
  },
  INVENTORY: {
    path: '/admin/inventory',
    label: 'Inventory',
    icon: 'ClipboardDocumentListIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_INVENTORY]
  },
  CUSTOMERS: {
    path: '/admin/customers',
    label: 'Customers',
    icon: 'UsersIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_CUSTOMERS]
  },
  ANALYTICS: {
    path: '/admin/analytics',
    label: 'Analytics',
    icon: 'ChartPieIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_ANALYTICS]
  },
  PARTIES: {
    path: '/admin/parties',
    label: 'Party Management',
    icon: 'BuildingOfficeIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_VENDORS]
  },
  PURCHASE_ORDERS: {
    path: '/admin/purchase-orders',
    label: 'Purchase Orders',
    icon: 'ClipboardDocumentListIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_VENDORS]
  },
  PURCHASE_BILLS: {
    path: '/admin/purchase-bills',
    label: 'Purchase Bills',
    icon: 'DocumentTextIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_VENDORS]
  },
  EMPLOYEES: {
    path: '/admin/employees',
    label: 'Employees',
    icon: 'UserGroupIcon',
    permissions: [ADMIN_PERMISSIONS.VIEW_EMPLOYEES]
  }
};

// Role-based permission mapping
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    ADMIN_PERMISSIONS.VIEW_DASHBOARD,
    ADMIN_PERMISSIONS.VIEW_CATEGORIES,
    ADMIN_PERMISSIONS.MANAGE_CATEGORIES,
    ADMIN_PERMISSIONS.VIEW_PRODUCTS,
    ADMIN_PERMISSIONS.MANAGE_PRODUCTS,
    ADMIN_PERMISSIONS.VIEW_ORDERS,
    ADMIN_PERMISSIONS.MANAGE_ORDERS,
    ADMIN_PERMISSIONS.VIEW_INVENTORY,
    ADMIN_PERMISSIONS.MANAGE_INVENTORY,
    ADMIN_PERMISSIONS.VIEW_CUSTOMERS,
    ADMIN_PERMISSIONS.MANAGE_CUSTOMERS,
    ADMIN_PERMISSIONS.VIEW_ANALYTICS,
    ADMIN_PERMISSIONS.VIEW_VENDORS,
    ADMIN_PERMISSIONS.MANAGE_VENDORS,
    ADMIN_PERMISSIONS.VIEW_EMPLOYEES,
    ADMIN_PERMISSIONS.MANAGE_EMPLOYEES,
    ADMIN_PERMISSIONS.VIEW_EXPENSES,
    ADMIN_PERMISSIONS.MANAGE_EXPENSES
  ],
  [USER_ROLES.MANAGER]: [
    ADMIN_PERMISSIONS.VIEW_DASHBOARD,
    ADMIN_PERMISSIONS.VIEW_ORDERS,
    ADMIN_PERMISSIONS.MANAGE_ORDERS,
    ADMIN_PERMISSIONS.VIEW_INVENTORY,
    ADMIN_PERMISSIONS.MANAGE_INVENTORY
  ],
  [USER_ROLES.CUSTOMER]: []
};

// Helper function to check if a role has a specific permission
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

// Helper function to check if a role has any of the required permissions
export const hasAnyPermission = (userRole, permissions) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) return false;
  return permissions.some(permission => hasPermission(userRole, permission));
};

// Helper function to get all accessible tabs for a role
export const getAccessibleTabs = (userRole) => {
  if (!userRole) return [];
  
  return Object.values(ADMIN_TABS).filter(tab => 
    hasAnyPermission(userRole, tab.permissions)
  );
};

// Helper function to check if user can access admin panel
export const canAccessAdminPanel = (userRole) => {
  return userRole === USER_ROLES.ADMIN || userRole === USER_ROLES.MANAGER;
};