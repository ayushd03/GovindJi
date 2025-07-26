import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './CartPopup.css';

const CartPopup = ({ isOpen, onClose }) => {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleCheckout = () => {
    onClose();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
    } else {
      navigate('/checkout');
    }
  };

  const handleContinueShopping = () => {
    onClose();
    navigate('/products');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="cart-popup-backdrop"
            onClick={onClose}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="cart-popup"
          >
            {/* Header */}
            <div className="cart-popup-header">
              <div className="cart-popup-title">
                <ShoppingBag className="w-6 h-6" />
                <h2>Shopping Cart</h2>
              </div>
              <button onClick={onClose} className="cart-popup-close">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="cart-popup-content">
              {cartItems.length === 0 ? (
                <div className="cart-empty">
                  <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3>Your cart is empty</h3>
                  <p>Add some products to get started!</p>
                  <button 
                    onClick={handleContinueShopping}
                    className="continue-shopping-btn"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Items */}
                  <div className="cart-items-list">
                    {cartItems.map(item => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="cart-item-popup"
                      >
                        <div className="cart-item-image">
                          <img 
                            src={item.image_url || '/placeholder-product.jpg'} 
                            alt={item.name}
                            onError={(e) => {
                              e.target.src = '/placeholder-product.jpg';
                            }}
                          />
                        </div>
                        
                        <div className="cart-item-details">
                          <h4>{item.name}</h4>
                          <p className="cart-item-price">₹{parseFloat(item.price).toFixed(2)}</p>
                          
                          <div className="cart-item-actions">
                            <div className="quantity-controls">
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                className="quantity-btn"
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="quantity-display">{item.quantity}</span>
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                className="quantity-btn"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="remove-item-btn"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        
                        <div className="cart-item-total">
                          ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Cart Summary */}
                  <div className="cart-summary-popup">
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <span>₹{getCartTotal().toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Shipping:</span>
                      <span>Free</span>
                    </div>
                    <div className="summary-row total-row">
                      <span>Total:</span>
                      <span>₹{getCartTotal().toFixed(2)}</span>
                    </div>
                    
                    <div className="cart-popup-actions">
                      <button onClick={handleCheckout} className="checkout-btn-popup">
                        Proceed to Checkout
                      </button>
                      <button onClick={handleContinueShopping} className="continue-shopping-link-popup">
                        Continue Shopping
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartPopup;