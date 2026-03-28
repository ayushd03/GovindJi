import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import { getCartItemStock } from '../utils/productPricing';
import { buildAuthPath } from '../utils/authRouting';
import './CartPopup.css';

const CartPopup = ({ isOpen, onClose }) => {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

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
      navigate(buildAuthPath({ mode: 'sign-in', next: '/checkout' }));
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-popup-title"
          >
            <div className="cart-drawer__header">
              <div className="cart-drawer__heading">
                <p className="cart-drawer__eyebrow">Your Cart</p>
                <div className="cart-drawer__title-row">
                  <h2 id="cart-popup-title">Order review</h2>
                  {itemCount > 0 && <span className="cart-drawer__count">{itemCountLabel}</span>}
                </div>
                <p className="cart-drawer__subtitle">
                  {cartItems.length === 0
                    ? 'Add a few products to start building your order.'
                    : 'Review the items in your order before moving to checkout.'}
                </p>
              </div>

              <button onClick={onClose} className="cart-drawer__close" type="button" aria-label="Close cart">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="cart-drawer__content">
              {cartItems.length === 0 ? (
                <div className="cart-drawer__empty">
                  <div className="cart-drawer__empty-icon">
                    <ShoppingBag className="h-9 w-9" />
                  </div>
                  <h3>Your cart is empty</h3>
                  <p>Explore the catalogue and add a few products before checkout.</p>
                  <button
                    onClick={handleContinueShopping}
                    className="cart-drawer__secondary-button"
                    type="button"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="cart-drawer__items">
                  {cartItems.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -14 }}
                      className="cart-drawer__item"
                    >
                      <div className="cart-drawer__item-image">
                        {item.image_url ? (
                          <img
                            src={getImageUrl(item.image_url, 'product')}
                            alt={item.name}
                            onError={(e) => handleImageError(e, 'product')}
                          />
                        ) : (
                          <div className="cart-drawer__item-placeholder">
                            <span>📦</span>
                          </div>
                        )}
                      </div>

                      <div className="cart-drawer__item-body">
                        <div className="cart-drawer__item-header">
                          <div className="cart-drawer__item-copy">
                            <h4>{item.name}</h4>
                            {item.size && <p className="cart-drawer__item-variant">{item.size}</p>}
                            <p className="cart-drawer__item-unit-price">
                              ₹{parseFloat(item.price).toFixed(2)} each
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="cart-drawer__remove"
                            type="button"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="cart-drawer__item-footer">
                          <div className="cart-drawer__quantity">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              className="cart-drawer__quantity-button"
                              disabled={item.quantity <= 1}
                              type="button"
                              aria-label={`Decrease quantity for ${item.name}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="cart-drawer__quantity-value">{item.quantity}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="cart-drawer__quantity-button"
                              disabled={getCartItemStock(item) !== null && item.quantity >= getCartItemStock(item)}
                              type="button"
                              aria-label={`Increase quantity for ${item.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="cart-drawer__item-total">
                            ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="cart-drawer__footer">
                <div className="cart-drawer__summary">
                  <div className="cart-drawer__summary-row">
                    <span>Subtotal</span>
                    <span>₹{getCartTotal().toFixed(2)}</span>
                  </div>
                  <div className="cart-drawer__summary-row">
                    <span>Shipping</span>
                    <span className="cart-drawer__summary-highlight">Calculated at checkout</span>
                  </div>
                  <div className="cart-drawer__summary-row cart-drawer__summary-row--total">
                    <span>Items total</span>
                    <span>₹{getCartTotal().toFixed(2)}</span>
                  </div>
                </div>

                <p className="cart-drawer__footer-note">
                  Delivery fee, ETA, and payment confirmation are shown in the next step.
                </p>

                <div className="cart-drawer__actions">
                  <button onClick={handleCheckout} className="cart-drawer__primary-button" type="button">
                    Proceed to Checkout
                  </button>
                  <button onClick={handleContinueShopping} className="cart-drawer__secondary-button" type="button">
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartPopup;
