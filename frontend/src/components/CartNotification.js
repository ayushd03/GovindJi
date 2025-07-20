import React from 'react';
import { useCart } from '../context/CartContext';
import './CartNotification.css';

const CartNotification = () => {
  const { cartNotification } = useCart();

  if (!cartNotification) return null;

  return (
    <div className={`cart-notification ${cartNotification.type}`}>
      <div className="notification-content">
        <span className="notification-icon">🛒</span>
        <span className="notification-message">{cartNotification.message}</span>
      </div>
    </div>
  );
};

export default CartNotification;