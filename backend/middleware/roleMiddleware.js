const { createClient } = require('@supabase/supabase-js');
const { logger, asyncHandler } = require('./errorHandler');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// User roles enum (matching frontend)
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CUSTOMER: 'customer'
};

// Admin panel permissions enum (matching frontend)
const ADMIN_PERMISSIONS = {
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

// Role-based permission mapping (matching frontend)
const ROLE_PERMISSIONS = {
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
const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

// Helper function to check if a role has any of the required permissions
const hasAnyPermission = (userRole, permissions) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) return false;
  return permissions.some(permission => hasPermission(userRole, permission));
};

// Base authentication middleware
const authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    logger.warn('Authentication attempt without token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    return res.sendStatus(401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    logger.warn('Authentication attempt with invalid token', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    return res.sendStatus(403);
  }

  req.user = user;
  next();
});

// Enhanced admin authentication with role checking
const authenticateAdmin = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    logger.warn('Admin authentication attempt without token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    return res.sendStatus(401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    logger.warn('Admin authentication attempt with invalid token', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    return res.sendStatus(403);
  }

  // Check if user has admin role
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin, role')
    .eq('id', user.id)
    .single();

  if (userError) throw userError;

  if (!userData) {
    logger.warn('User not found in database during admin authentication', {
      userId: user.id,
      userEmail: user.email,
      path: req.originalUrl
    });
    return res.status(403).json({ message: 'User not found' });
  }

  // Check if user can access admin panel (admin or manager)
  const canAccessAdmin = userData.role === USER_ROLES.ADMIN || userData.role === USER_ROLES.MANAGER;
  
  if (!canAccessAdmin) {
    logger.warn('Non-admin user attempted to access admin route', {
      userId: user.id,
      userEmail: user.email,
      userRole: userData.role,
      path: req.originalUrl,
      ip: req.ip
    });
    return res.status(403).json({ message: 'Admin access required' });
  }

  req.user = user;
  req.userRole = userData.role;
  req.userData = userData;
  next();
});

// Permission-based middleware factory
const requirePermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    // First authenticate as admin
    await authenticateAdmin(req, res, () => {
      // Then check specific permission
      if (!hasPermission(req.userRole, permission)) {
        logger.warn('User denied access due to insufficient permissions', {
          userId: req.user?.id,
          userRole: req.userRole,
          requiredPermission: permission,
          path: req.originalUrl,
          ip: req.ip
        });
        return res.status(403).json({ 
          message: `Permission denied. Required: ${permission}`,
          userRole: req.userRole 
        });
      }
      next();
    });
  });
};

// Multiple permissions middleware factory
const requireAnyPermission = (permissions) => {
  return asyncHandler(async (req, res, next) => {
    // First authenticate as admin
    await authenticateAdmin(req, res, () => {
      // Then check if user has any of the required permissions
      if (!hasAnyPermission(req.userRole, permissions)) {
        logger.warn('User denied access due to insufficient permissions (any)', {
          userId: req.user?.id,
          userRole: req.userRole,
          requiredPermissions: permissions,
          path: req.originalUrl,
          ip: req.ip
        });
        return res.status(403).json({ 
          message: `Permission denied. Required one of: ${permissions.join(', ')}`,
          userRole: req.userRole 
        });
      }
      next();
    });
  });
};

// Role-specific middleware
const requireAdminRole = asyncHandler(async (req, res, next) => {
  await authenticateAdmin(req, res, () => {
    if (req.userRole !== USER_ROLES.ADMIN) {
      logger.warn('Non-admin user attempted to access admin-only route', {
        userId: req.user?.id,
        userRole: req.userRole,
        path: req.originalUrl,
        ip: req.ip
      });
      return res.status(403).json({ message: 'Admin role required' });
    }
    next();
  });
});

const requireManagerRole = asyncHandler(async (req, res, next) => {
  await authenticateAdmin(req, res, () => {
    if (req.userRole !== USER_ROLES.MANAGER && req.userRole !== USER_ROLES.ADMIN) {
      logger.warn('Insufficient role for manager route access', {
        userId: req.user?.id,
        userRole: req.userRole,
        path: req.originalUrl,
        ip: req.ip
      });
      return res.status(403).json({ message: 'Manager or Admin role required' });
    }
    next();
  });
});

module.exports = {
  USER_ROLES,
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  authenticateToken,
  authenticateAdmin,
  requirePermission,
  requireAnyPermission,
  requireAdminRole,
  requireManagerRole
};