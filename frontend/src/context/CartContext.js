import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { clampQuantityToStock, getCartItemStock } from '../utils/productPricing';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartNotification, setCartNotification] = useState(null);
  const [isCartPopupOpen, setIsCartPopupOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const notificationTimeoutRef = useRef(null);

  const showCartNotification = (type, message) => {
    setCartNotification({
      type,
      message,
      id: Date.now()
    });

    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    notificationTimeoutRef.current = setTimeout(() => {
      setCartNotification(null);
      notificationTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cartItems');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      }
    } catch (_) {
      // ignore invalid JSON and start fresh
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems, isHydrated]);

  const addToCart = (product, quantity = 1) => {
    const requestedQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1);
    const availableStock = getCartItemStock(product);
    let notificationDetails = null;

    if (availableStock !== null && availableStock <= 0) {
      showCartNotification('warning', `${product.name} is currently out of stock.`);
      return;
    }

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);

      if (existingItem) {
        const maxQuantity = getCartItemStock(existingItem);
        const nextQuantity = clampQuantityToStock(
          existingItem.quantity + requestedQuantity,
          maxQuantity
        );

        if (nextQuantity === existingItem.quantity) {
          notificationDetails = {
            type: 'warning',
            message: `${product.name}${product.size ? ` (${product.size})` : ''} is already at the maximum available quantity.`,
          };
          return prevItems;
        }

        notificationDetails = {
          type: nextQuantity < existingItem.quantity + requestedQuantity ? 'warning' : 'success',
          message:
            nextQuantity < existingItem.quantity + requestedQuantity
              ? `${product.name}${product.size ? ` (${product.size})` : ''} has limited stock. Cart quantity was capped at ${nextQuantity}.`
              : `${product.name}${product.size ? ` (${product.size})` : ''} quantity updated in cart.`,
        };

        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: nextQuantity }
            : item
        );
      }

      const initialQuantity = clampQuantityToStock(requestedQuantity, availableStock);

      if (initialQuantity <= 0) {
        notificationDetails = {
          type: 'warning',
          message: `${product.name} is currently out of stock.`,
        };
        return prevItems;
      }

      notificationDetails = {
        type: initialQuantity < requestedQuantity ? 'warning' : 'success',
        message:
          initialQuantity < requestedQuantity
            ? `${product.name}${product.size ? ` (${product.size})` : ''} has limited stock. Added the maximum available quantity.`
            : `${product.name}${product.size ? ` (${product.size})` : ''} added to cart!`,
      };

      return [...prevItems, { ...product, quantity: initialQuantity }];
    });

    if (notificationDetails) {
      showCartNotification(notificationDetails.type, notificationDetails.message);
    }
  };

  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    const requestedQuantity = Number.parseInt(quantity, 10) || 0;

    if (requestedQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    let notificationDetails = null;

    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== productId) {
          return item;
        }

        const nextQuantity = clampQuantityToStock(requestedQuantity, getCartItemStock(item));

        if (nextQuantity !== requestedQuantity) {
          notificationDetails = {
            type: 'warning',
            message: `${item.name}${item.size ? ` (${item.size})` : ''} is limited to ${nextQuantity} in cart.`,
          };
        }

        return { ...item, quantity: nextQuantity };
      })
    );

    if (notificationDetails) {
      showCartNotification(notificationDetails.type, notificationDetails.message);
    }
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemsCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getProductCartInfo = (productId) => {
    const productItems = cartItems.filter(item => 
      item.originalId === productId || item.id === productId
    );
    
    if (productItems.length === 0) {
      return { totalQuantity: 0, items: [] };
    }
    
    const totalQuantity = productItems.reduce((total, item) => total + item.quantity, 0);
    return { totalQuantity, items: productItems };
  };

  const openCartPopup = () => setIsCartPopupOpen(true);
  const closeCartPopup = () => setIsCartPopupOpen(false);
  const toggleCartPopup = () => setIsCartPopupOpen(prev => !prev);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
    getProductCartInfo,
    cartNotification,
    isCartPopupOpen,
    openCartPopup,
    closeCartPopup,
    toggleCartPopup,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
