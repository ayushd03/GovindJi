import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart } from 'lucide-react';

const SizeSelectionPopup = ({ 
  isOpen, 
  onClose, 
  product, 
  quantity, 
  onAddToCart,
  triggerElement 
}) => {
  const [selectedSize, setSelectedSize] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const popupRef = useRef(null);
  const dotRef = useRef(null);

  const sizes = [
    { id: '250g', label: '250g', price: product?.price },
    { id: '500g', label: '500g', price: product?.price ? product.price * 1.8 : 0 },
    { id: '1kg', label: '1kg', price: product?.price ? product.price * 3.5 : 0 },
    { id: '2kg', label: '2kg', price: product?.price ? product.price * 6.8 : 0 },
    { id: '5kg', label: '5kg', price: product?.price ? product.price * 16 : 0 }
  ];

  useEffect(() => {
    if (isOpen && sizes.length > 0) {
      setSelectedSize(sizes[0].id);
    }
  }, [isOpen]);

  const handleAddToCart = async () => {
    if (!selectedSize) return;

    setIsAdding(true);
    
    const selectedSizeData = sizes.find(size => size.id === selectedSize);
    const productWithSize = {
      ...product,
      size: selectedSize,
      price: selectedSizeData.price,
      originalId: product.id,
      id: `${product.id}-${selectedSize}`
    };

    if (dotRef.current && triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      const cartIcon = document.querySelector('[data-cart-icon]');
      
      if (cartIcon) {
        const cartRect = cartIcon.getBoundingClientRect();
        
        const dot = dotRef.current;
        dot.style.display = 'block';
        dot.style.position = 'fixed';
        dot.style.left = `${rect.left + rect.width / 2}px`;
        dot.style.top = `${rect.top + rect.height / 2}px`;
        dot.style.zIndex = '9999';
        dot.style.pointerEvents = 'none';
        
        await new Promise(resolve => {
          const animation = dot.animate([
            { 
              transform: 'translate(-50%, -50%) scale(1)',
              opacity: '1'
            },
            { 
              transform: `translate(${cartRect.left - rect.left - rect.width / 2 + 20}px, ${cartRect.top - rect.top - rect.height / 2 + 20}px) scale(0.2)`,
              opacity: '0.8'
            }
          ], {
            duration: 800,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          });
          animation.addEventListener('finish', () => {
            dot.style.display = 'none';
            resolve();
          });
        });
      }
    }

    await onAddToCart(productWithSize, quantity);
    
    setTimeout(() => {
      setIsAdding(false);
      onClose();
    }, 300);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleOverlayClick}
      >
        <motion.div
          ref={popupRef}
          className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
          initial={{ scale: 0.7, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.7, opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">Select Size</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center mb-6 p-4 bg-gray-50 rounded-xl">
            {product?.image_url ? (
              <img
                src={product.image_url}
                alt={product?.name}
                className="w-16 h-16 object-cover rounded-lg mr-4"
                onError={(e) => e.target.style.display = 'none'}
              />
            ) : (
              <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded-lg mr-4">
                <div className="text-gray-400 text-2xl">📦</div>
              </div>
            )}
            <div>
              <h4 className="font-semibold text-gray-800">{product?.name}</h4>
              <p className="text-sm text-gray-600">Quantity: {quantity}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Choose size:</p>
            <div className="grid grid-cols-2 gap-3">
              {sizes.map((size) => (
                <motion.button
                  key={size.id}
                  onClick={() => setSelectedSize(size.id)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    selectedSize === size.id
                      ? 'border-primary-accent bg-primary-accent text-white'
                      : 'border-gray-200 hover:border-primary-accent'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="font-semibold">{size.label}</div>
                  <div className="text-sm opacity-80">₹{size.price.toFixed(2)}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <motion.button
            onClick={handleAddToCart}
            disabled={!selectedSize || isAdding}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center space-x-2 ${
              isAdding
                ? 'bg-green-500 cursor-not-allowed'
                : selectedSize
                ? 'bg-primary-accent hover:bg-secondary-accent'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
            whileHover={selectedSize && !isAdding ? { scale: 1.02 } : {}}
            whileTap={selectedSize && !isAdding ? { scale: 0.98 } : {}}
          >
            {isAdding ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                <span>Add to Cart</span>
              </>
            )}
          </motion.button>

          <motion.div
            ref={dotRef}
            className="w-4 h-4 bg-primary-accent rounded-full absolute"
            style={{ display: 'none' }}
            initial={{ scale: 0 }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SizeSelectionPopup;