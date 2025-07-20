import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, Heart, Eye } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import SizeSelectionPopup from './SizeSelectionPopup';

const ProductCard = ({ product }) => {
  const { addToCart, updateQuantity, cartItems, getProductCartInfo } = useCart();
  const { primaryImage, loading: imageLoading } = useProductImage(product.id, product.image_url);
  const [isAdding, setIsAdding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showSizePopup, setShowSizePopup] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const addToCartButtonRef = useRef(null);
  
  // Get the current quantity of this product in cart (all sizes combined)
  const productCartInfo = getProductCartInfo(product.id);
  const currentQuantity = productCartInfo.totalQuantity;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSizePopup(true);
  };

  const handleSizePopupAddToCart = async (productWithSize, quantity) => {
    await addToCart(productWithSize, quantity);
  };

  const handleQuantitySelect = (e, newQuantity) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedQuantity(newQuantity);
    setShowSizePopup(true);
  };

  const handleFavoriteToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  const getCartLabel = () => {
    if (currentQuantity === 0) return null;
    
    const items = productCartInfo.items;
    if (items.length === 1) {
      const item = items[0];
      return `${item.quantity}x of ${item.size || '250g'}`;
    } else if (items.length > 1) {
      return `${currentQuantity}x in cart`;
    }
    return null;
  };

  const rating = 4.5; // This would come from product data in a real app
  const discount = product.discount || 0;

  return (
    <motion.div
      className="group relative bg-white rounded-2xl border-2 border-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden my-4"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)'
      }}
      whileHover={{ 
        y: -8,
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15)'
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Discount Badge */}
      {discount > 0 && (
        <motion.div
          className="absolute top-3 left-3 z-10 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {discount}% OFF
        </motion.div>
      )}

      {/* Favorite Button */}
      <motion.button
        onClick={handleFavoriteToggle}
        className="absolute top-3 right-3 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all duration-300"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Heart 
          className={`w-5 h-5 transition-colors duration-300 ${
            isFavorited ? 'text-red-500 fill-red-500' : 'text-gray-600'
          }`} 
        />
      </motion.button>

      <Link to={`/products/${product.id}`} className="block">
        {/* Product Image */}
        <div className="relative h-64 bg-gradient-to-br from-light-gray to-gray-100 overflow-hidden">
          {imageLoading ? (
            <motion.div 
              className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]"
              animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <motion.img
              src={primaryImage || product.image_url || '/placeholder-product.jpg'}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={(e) => {
                if (e.target && e.target.src !== '/placeholder-product.jpg') {
                  e.target.src = '/placeholder-product.jpg';
                }
              }}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            />
          )}
          
          {/* Overlay with Quick Actions */}
          <motion.div
            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            <motion.div
              className="flex space-x-3"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-accent hover:text-white transition-all duration-300"
              >
                <Eye className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Product Info */}
        <div className="p-6">
          {/* Rating */}
          <div className="flex items-center space-x-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(rating) 
                    ? 'text-yellow-400 fill-yellow-400' 
                    : i < rating 
                    ? 'text-yellow-400 fill-yellow-400' 
                    : 'text-gray-300'
                }`}
              />
            ))}
            <span className="text-sm text-gray-600 ml-1">({rating})</span>
          </div>

          {/* Product Name */}
          <h3 className="text-lg font-semibold text-primary-text mb-2 line-clamp-2 group-hover:text-primary-accent transition-colors duration-300">
            {product.name}
          </h3>

          {/* Product Description */}
          <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
            {product.description && product.description.length > 100
              ? `${product.description.substring(0, 100)}...`
              : product.description
            }
          </p>

          {/* Price Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary-accent">
                ₹{parseFloat(product.price).toFixed(2)}
              </span>
              {discount > 0 && (
                <span className="text-sm text-gray-500 line-through">
                  ₹{(parseFloat(product.price) * (1 + discount / 100)).toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-sm text-green-600 font-medium">In Stock</div>
          </div>
        </div>
      </Link>

      {/* Cart Label (if item is in cart) */}
      {currentQuantity > 0 && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-primary-accent text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg"
          >
            {getCartLabel()}
          </motion.div>
        </div>
      )}

      {/* Add to Cart Button */}
      <div className="px-6 pb-6">
        <motion.button
          ref={addToCartButtonRef}
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center space-x-2 ${
            isAdding
              ? 'bg-green-500 cursor-not-allowed'
              : 'bg-primary-accent hover:bg-secondary-accent shadow-md hover:shadow-lg'
          }`}
          whileHover={{ scale: isAdding ? 1 : 1.02 }}
          whileTap={{ scale: isAdding ? 1 : 0.98 }}
          animate={isAdding ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.6 }}
        >
          {isAdding ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
              <span>Added!</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              <span>Add to Cart</span>
            </>
          )}
        </motion.button>
        
        {/* Quantity selector (optional - for quick selection) */}
        <div className="flex justify-center mt-3 space-x-2">
          {[1, 2, 3, 5].map((qty) => (
            <button
              key={qty}
              onClick={(e) => handleQuantitySelect(e, qty)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                selectedQuantity === qty
                  ? 'bg-primary-accent text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {qty}
            </button>
          ))}
        </div>
      </div>

      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-primary-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Size Selection Popup */}
      <SizeSelectionPopup
        isOpen={showSizePopup}
        onClose={() => setShowSizePopup(false)}
        product={product}
        quantity={selectedQuantity}
        onAddToCart={handleSizePopupAddToCart}
        triggerElement={addToCartButtonRef.current}
      />
    </motion.div>
  );
};

export default ProductCard;