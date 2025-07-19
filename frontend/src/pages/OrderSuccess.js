import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const location = useLocation();
  const order = location.state?.order;

  return (
    <div className="order-success-page">
      <div className="container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h1>Order Placed Successfully!</h1>
          <p>Thank you for your order. We'll send you a confirmation email shortly.</p>
          
          {order && (
            <div className="order-details">
              <h3>Order Details</h3>
              <p><strong>Order ID:</strong> {order.order?.id}</p>
              <p><strong>Total Amount:</strong> ${parseFloat(order.order?.total_amount || 0).toFixed(2)}</p>
              <p><strong>Payment Method:</strong> Cash on Delivery</p>
              <p><strong>Status:</strong> {order.order?.status || 'Pending'}</p>
            </div>
          )}
          
          <div className="success-actions">
            <Link to="/products" className="continue-shopping-btn">
              Continue Shopping
            </Link>
            <Link to="/orders" className="view-orders-btn">
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;