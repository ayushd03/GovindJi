import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  CubeIcon,
  ShoppingCartIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  TruckIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <span className="ml-3 text-lg text-muted-foreground">Loading dashboard...</span>
    </div>
  );
  
  if (error) return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
      <div className="flex items-center">
        <XCircleIcon className="w-5 h-5 text-destructive mr-3" />
        <span className="text-destructive-foreground">Error: {error}</span>
      </div>
    </div>
  );

  const statsCards = [
    {
      title: 'Total Products',
      value: dashboardData?.totalProducts || 0,
      icon: CubeIcon,
      color: 'primary',
      change: '+12%',
      changeType: 'increase'
    },
    {
      title: 'Total Orders',
      value: dashboardData?.totalOrders || 0,
      icon: ShoppingCartIcon,
      color: 'success',
      change: '+8%',
      changeType: 'increase'
    },
    {
      title: 'Low Stock Items',
      value: dashboardData?.lowStockItems || 0,
      icon: ExclamationTriangleIcon,
      color: 'warning',
      change: '-3%',
      changeType: 'decrease'
    },
    {
      title: "Today's Revenue",
      value: `₹${dashboardData?.todaysRevenue?.toFixed(2) || '0.00'}`,
      icon: CurrencyDollarIcon,
      color: 'secondary',
      change: '+15%',
      changeType: 'increase'
    }
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return ClockIcon;
      case 'processing': return CubeIcon;
      case 'shipped': return TruckIcon;
      case 'delivered': return CheckCircleIcon;
      case 'cancelled': return XCircleIcon;
      default: return ClockIcon;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-400/10 text-yellow-500';
      case 'processing': return 'bg-blue-400/10 text-blue-500';
      case 'shipped': return 'bg-indigo-400/10 text-indigo-500';
      case 'delivered': return 'bg-green-400/10 text-green-500';
      case 'cancelled': return 'bg-red-400/10 text-red-500';
      default: return 'bg-gray-400/10 text-gray-500';
    }
  };

  const getStatsIconColor = (color) => {
    switch (color) {
      case 'primary': return 'bg-blue-400/10 text-blue-500';
      case 'success': return 'bg-green-400/10 text-green-500';
      case 'warning': return 'bg-yellow-400/10 text-yellow-500';
      case 'secondary': return 'bg-indigo-400/10 text-indigo-500';
      default: return 'bg-gray-400/10 text-gray-500';
    }
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_DASHBOARD}>
      <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back, {user?.user_metadata?.name || user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div key={index} className="bg-card rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
                  <div className="flex items-center mt-3">
                    {stat.changeType === 'increase' ? (
                      <ArrowUpIcon className="w-4 h-4 text-success mr-1" />
                    ) : (
                      <ArrowDownIcon className="w-4 h-4 text-destructive mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      stat.changeType === 'increase' ? 'text-success' : 'text-destructive'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${getStatsIconColor(stat.color)}`}>
                  <IconComponent className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
            <p className="text-sm text-muted-foreground">Latest orders from your customers</p>
          </div>
          <div className="p-6">
            {dashboardData?.recentOrders?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.recentOrders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  return (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors duration-200">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <StatusIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            #{order.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-muted-foreground">Order ID</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          ₹{order.total_amount}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCartIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No recent orders</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-foreground">Low Stock Alerts</h2>
            <p className="text-sm text-muted-foreground">Products running low on inventory</p>
          </div>
          <div className="p-6">
            {dashboardData?.lowStockProducts?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border border-destructive/20 bg-destructive/10 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {product.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Current: {product.stock_quantity} {product.unit}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-destructive">
                        Min: {product.min_stock_level}
                      </p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive-foreground">
                        Low Stock
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircleIcon className="w-12 h-12 text-success/50 mx-auto mb-3" />
                <p className="text-muted-foreground">All products are well stocked</p>
                <p className="text-sm text-success font-medium">Great job!</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </PermissionGuard>
  );
};

export default AdminDashboard;
