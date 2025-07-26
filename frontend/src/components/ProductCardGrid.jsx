import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, Heart, Eye, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import { cn } from '../lib/utils';
import SizeSelectionDialog from './SizeSelectionDialog';

const ProductCardGrid = ({ product, className, viewMode = 'grid' }) => {
  const { getProductCartInfo } = useCart();
  const { primaryImage, loading: imageLoading } = useProductImage(product.id, product.image_url);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  
  const productCartInfo = getProductCartInfo(product.id);
  const currentQuantity = productCartInfo.totalQuantity;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSizeDialog(true);
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

  const rating = 4.5;
  const discount = product.discount || 0;

  if (viewMode === 'list') {
    return (
      <>
        <motion.div
          className={cn("group relative w-full", className)}
          whileHover={{ y: -4 }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Card className="overflow-hidden border-0 bg-white relative h-full rounded-lg">
            {/* Card background and effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-gray-50/50 to-white rounded-lg" />
            <div className="absolute inset-0 rounded-lg border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] transition-all duration-500" />
            
            <div className="relative z-10 flex p-4 gap-4">
              {/* Product Image */}
              <Link to={`/products/${product.id}`} className="block flex-shrink-0">
                <div className="relative w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden rounded-lg">
                  {imageLoading ? (
                    <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-pulse" />
                  ) : (
                    <img
                      src={primaryImage || product.image_url || '/placeholder-product.jpg'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        if (e.target && e.target.src !== '/placeholder-product.jpg') {
                          e.target.src = '/placeholder-product.jpg';
                        }
                      }}
                    />
                  )}
                </div>
              </Link>

              {/* Product Info */}
              <Link to={`/products/${product.id}`} className="flex-1 min-w-0">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    {/* Name and Rating */}
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-heading font-semibold text-base text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors duration-300 tracking-tight pr-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs text-gray-600 font-medium">{rating}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed font-body mb-2">
                      {product.description && product.description.length > 120
                        ? `${product.description.substring(0, 120)}...`
                        : product.description
                      }
                    </p>
                  </div>

                  {/* Price and Stock */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-gray-900 font-heading tracking-tight">
                        ₹{parseFloat(product.price).toFixed(2)}
                      </span>
                      {discount > 0 && (
                        <span className="text-sm text-gray-500 line-through font-medium">
                          ₹{(parseFloat(product.price) * (1 + discount / 100)).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-xs font-semibold rounded-md">
                      ✓ In Stock
                    </Badge>
                  </div>
                </div>
              </Link>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 items-end">
                {/* Favorite Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFavoriteToggle}
                  className="h-8 w-8 bg-gray-50/80 backdrop-blur-sm hover:bg-gray-100 rounded-lg border-0"
                >
                  <Heart 
                    className={cn(
                      "h-3.5 w-3.5 transition-all duration-300",
                      isFavorited 
                        ? "text-red-500 fill-red-500" 
                        : "text-gray-500 hover:text-red-500"
                    )}
                  />
                </Button>

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  className="h-8 px-3 bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs rounded-lg"
                >
                  <ShoppingCart className="h-3 w-3 mr-1.5" />
                  Add
                </Button>
              </div>

              {/* Badges */}
              {discount > 0 && (
                <div className="absolute top-2 left-2 z-20">
                  <Badge className="text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-2 py-1 rounded-md">
                    {discount}% OFF
                  </Badge>
                </div>
              )}

              {currentQuantity > 0 && (
                <div className="absolute top-2 right-2 z-20">
                  <Badge className="bg-emerald-500 text-white border-0 px-2 py-1 text-xs font-semibold rounded-md">
                    {getCartLabel()}
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <SizeSelectionDialog
          isOpen={showSizeDialog}
          onClose={() => setShowSizeDialog(false)}
          product={product}
        />
      </>
    );
  }

  // Grid view (default)
  return (
    <>
      <motion.div
        className={cn("group relative w-full", className)}
        whileHover={{ y: -6 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card className="overflow-hidden border-0 bg-white relative h-full flex flex-col rounded-lg">
          {/* Premium card effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50/20 via-white to-gray-50/20 rounded-lg" />
          <div className="absolute inset-0 rounded-lg border border-gray-100/70 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] group-hover:shadow-[0_6px_24px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-600 ease-out" />
          
          {/* Subtle hover glow */}
          <motion.div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-400"
            style={{
              background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.015) 0%, rgba(168, 85, 247, 0.015) 50%, rgba(236, 72, 153, 0.015) 100%)'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          />

          {/* Badges */}
          {discount > 0 && (
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: -12 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
              className="absolute top-2 left-2 z-20"
            >
              <Badge className="text-xs font-bold shadow-md bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-2 py-1 rounded-md">
                {discount}% OFF
              </Badge>
            </motion.div>
          )}

          {currentQuantity > 0 && (
            <motion.div
              initial={{ scale: 0, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20"
            >
              <Badge className="bg-emerald-500 text-white shadow-sm border-0 px-2 py-1 text-xs font-semibold rounded-md">
                {getCartLabel()}
              </Badge>
            </motion.div>
          )}

          {/* Favorite Button */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-2 right-2 z-20"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteToggle}
              className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm border border-gray-200/40 hover:border-red-200 rounded-lg transition-all duration-300"
            >
              <Heart 
                className={cn(
                  "h-3.5 w-3.5 transition-all duration-300",
                  isFavorited 
                    ? "text-red-500 fill-red-500" 
                    : "text-gray-500 hover:text-red-500"
                )}
              />
            </Button>
          </motion.div>

          <Link to={`/products/${product.id}`} className="block relative z-10 flex-1 flex flex-col">
            {/* Product Image */}
            <div className="relative h-72 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden rounded-t-lg">
              {imageLoading ? (
                <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-pulse" />
              ) : (
                <motion.img
                  src={primaryImage || product.image_url || '/placeholder-product.jpg'}
                  alt={product.name}
                  className="w-full h-full object-cover transition-all duration-400 group-hover:scale-105"
                  onError={(e) => {
                    if (e.target && e.target.src !== '/placeholder-product.jpg') {
                      e.target.src = '/placeholder-product.jpg';
                    }
                  }}
                />
              )}
              
              {/* Quick view overlay */}
              <motion.div 
                className="absolute inset-0 bg-black/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: isHovered ? 1 : 0.8, 
                    opacity: isHovered ? 1 : 0 
                  }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/95 backdrop-blur-sm hover:bg-white text-gray-800 hover:text-gray-900 shadow-lg border border-white/50 px-3 py-1.5 rounded-lg font-medium text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1.5" />
                    Quick View
                  </Button>
                </motion.div>
              </motion.div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-800 ease-out" />
            </div>

            <CardContent className="p-3 relative flex-1 flex flex-col">
              <div className="relative z-10 flex-1 flex flex-col">
                {/* Rating */}
                <div className="flex items-center gap-1 mb-1.5">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3 w-3 transition-all duration-200",
                          i < Math.floor(rating) 
                            ? "text-amber-400 fill-amber-400" 
                            : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600 ml-1 font-medium">
                    ({rating})
                  </span>
                </div>

                {/* Product Name */}
                <h3 className="font-heading font-semibold text-sm text-gray-900 mb-1.5 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 leading-tight tracking-tight flex-1">
                  {product.name}
                </h3>

                {/* Price Section */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-gray-900 font-heading tracking-tight">
                      ₹{parseFloat(product.price).toFixed(2)}
                    </span>
                    {discount > 0 && (
                      <span className="text-xs text-gray-500 line-through font-medium">
                        ₹{(parseFloat(product.price) * (1 + discount / 100)).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-xs font-semibold rounded-md tracking-wide">
                    ✓ In Stock
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Link>

          <CardFooter className="p-3 pt-0 relative">
            <motion.div
              className="w-full relative z-10"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Button
                onClick={handleAddToCart}
                className="w-full h-9 bg-gray-900 hover:bg-gray-800 text-white font-heading font-medium text-xs rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border-0 group/btn tracking-wide"
              >
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5 group-hover/btn:scale-110 transition-transform duration-200" />
                <span className="tracking-wide">Add to Cart</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all duration-200" />
              </Button>
            </motion.div>
          </CardFooter>
        </Card>
      </motion.div>

      <SizeSelectionDialog
        isOpen={showSizeDialog}
        onClose={() => setShowSizeDialog(false)}
        product={product}
      />
    </>
  );
};

export default ProductCardGrid;