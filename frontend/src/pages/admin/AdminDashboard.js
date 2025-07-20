import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/dashboard', {
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

  const initializeCategories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/init-categories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Categories initialized successfully!');
      }
    } catch (err) {
      console.error('Error initializing categories:', err);
      alert('Failed to initialize categories');
    }
  };

  if (loading) return <div className="admin-loading">Loading dashboard...</div>;
  if (error) return <div className="admin-error">Error: {error}</div>;

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back, {user?.user_metadata?.name || user?.email}</p>
        <div className="dashboard-actions">
          <button onClick={initializeCategories} className="init-categories-btn">
            Initialize Categories
          </button>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{dashboardData?.totalProducts || 0}</h3>
            <p>Total Products</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-content">
            <h3>{dashboardData?.totalOrders || 0}</h3>
            <p>Total Orders</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{dashboardData?.lowStockItems || 0}</h3>
            <p>Low Stock Items</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>₹{dashboardData?.todaysRevenue?.toFixed(2) || '0.00'}</h3>
            <p>Today's Revenue</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <h2>Recent Orders</h2>
          <div className="recent-orders">
            {dashboardData?.recentOrders?.length > 0 ? (
              dashboardData.recentOrders.map(order => (
                <div key={order.id} className="order-item">
                  <div className="order-info">
                    <span className="order-id">#{order.id.slice(0, 8)}</span>
                    <span className="order-amount">₹{order.total_amount}</span>
                  </div>
                  <div className={`order-status ${order.status}`}>
                    {order.status}
                  </div>
                </div>
              ))
            ) : (
              <p>No recent orders</p>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Low Stock Alerts</h2>
          <div className="low-stock-items">
            {dashboardData?.lowStockProducts?.length > 0 ? (
              dashboardData.lowStockProducts.map(product => (
                <div key={product.id} className="stock-item">
                  <div className="product-info">
                    <span className="product-name">{product.name}</span>
                    <span className="stock-level">
                      {product.stock_quantity} {product.unit}
                    </span>
                  </div>
                  <div className="stock-warning">
                    Min: {product.min_stock_level}
                  </div>
                </div>
              ))
            ) : (
              <p>All products are well stocked</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;