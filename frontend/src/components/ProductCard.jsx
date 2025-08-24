import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, Heart, Eye, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import { handleImageError } from '../utils/imageUtils';
import { cn } from '../lib/utils';
import SizeSelectionDialog from './SizeSelectionDialog';

const ProductCard = ({ product, className, viewMode = "grid" }) => {
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

  // Handle different view modes
  const cardClasses = viewMode === "list" 
    ? "group relative w-full flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow" 
    : "group relative w-full";

  const cardLayoutClasses = viewMode === "list"
    ? "overflow-hidden border-0 bg-white relative flex flex-row rounded-xl"
    : "overflow-hidden border-0 bg-white relative h-full flex flex-col rounded-xl";

  return (
    <>
      <motion.div
        className={cn(cardClasses, className)}
        whileHover={{ y: viewMode === "list" ? 0 : -8 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card className={cardLayoutClasses}>
          {/* Premium card shadow and border effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50/30 via-white to-gray-50/30 rounded-xl" />
          <div 
            className="absolute inset-0 rounded-xl border border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-700 ease-out"
            style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #fdfdfd 100%)',
            }}
          />
          
          {/* Premium inner border glow */}
          <div className="absolute inset-0.5 rounded-xl border border-white/60 pointer-events-none" />
          
          {/* Sophisticated hover glow */}
          <motion.div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.02) 0%, rgba(168, 85, 247, 0.02) 50%, rgba(236, 72, 153, 0.02) 100%)'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          />
          {/* Discount Badge */}
          {discount > 0 && (
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: -12 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              className="absolute top-3 left-3 z-20"
            >
              <Badge 
                className="text-xs font-bold shadow-lg bg-gradient-to-r from-red-500 to-red-600 text-white border-0 px-2.5 py-1 rounded-md"
              >
                {discount}% OFF
              </Badge>
            </motion.div>
          )}

          {/* Cart Status Badge */}
          {currentQuantity > 0 && (
            <motion.div
              initial={{ scale: 0, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20"
            >
              <Badge 
                className="bg-emerald-500 text-white shadow-md border-0 px-2.5 py-1 text-xs font-semibold rounded-md"
              >
                {getCartLabel()}
              </Badge>
            </motion.div>
          )}

          {/* Favorite Button */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-3 right-3 z-20"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteToggle}
              className="h-9 w-9 bg-white/90 backdrop-blur-sm hover:bg-white shadow-md border border-gray-200/50 hover:border-red-200 rounded-lg transition-all duration-300"
            >
              <Heart 
                className={cn(
                  "h-4 w-4 transition-all duration-300",
                  isFavorited 
                    ? "text-red-500 fill-red-500" 
                    : "text-gray-500 hover:text-red-500"
                )}
              />
            </Button>
          </motion.div>

          <Link to={`/products/${product.id}`} className="block relative z-10">
            {/* Product Image */}
            <div className="relative h-56 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden rounded-t-xl">
              {imageLoading ? (
                <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-pulse" />
              ) : primaryImage || product.image_url ? (
                <motion.img
                  src={primaryImage || product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  onError={(e) => handleImageError(e, 'product')}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <div className="text-gray-400 text-center">
                    <div className="text-4xl mb-2">📦</div>
                    <div className="text-sm">No image</div>
                  </div>
                </div>
              )}
              
              {/* Subtle overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent opacity-50 group-hover:opacity-30 transition-opacity duration-300" />
              
              {/* Quick view overlay */}
              <motion.div 
                className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
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
                    className="bg-white/95 backdrop-blur-sm hover:bg-white text-gray-800 hover:text-gray-900 shadow-lg border border-white/50 px-4 py-2 rounded-lg font-medium text-sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Quick View
                  </Button>
                </motion.div>
              </motion.div>
              
              {/* Premium shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000 ease-out" />
            </div>

            <CardContent className="p-5 relative flex-1 flex flex-col">
              <div className="relative z-10 flex-1 flex flex-col">
                {/* Rating */}
                <div className="flex items-center gap-1 mb-3">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5 transition-all duration-200",
                          i < Math.floor(rating) 
                            ? "text-amber-400 fill-amber-400" 
                            : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600 ml-1.5 font-medium">
                    ({rating})
                  </span>
                </div>

                {/* Product Name */}
                <h3 className="font-heading font-semibold text-base text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 leading-tight tracking-tight">
                  {product.name}
                </h3>

                {/* Product Description */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed flex-1 font-body">
                  {product.description && product.description.length > 85
                    ? `${product.description.substring(0, 85)}...`
                    : product.description
                  }
                </p>

                {/* Price Section */}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-900 font-heading tracking-tight">
                      ₹{parseFloat(product.price).toFixed(2)}
                    </span>
                    {discount > 0 && (
                      <span className="text-sm text-gray-500 line-through font-medium">
                        ₹{(parseFloat(product.price) * (1 + discount / 100)).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold rounded-md hover:bg-emerald-100 transition-colors tracking-wide">
                    ✓ In Stock
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Link>

          <CardFooter className="p-5 pt-0 relative">
            <motion.div
              className="w-full relative z-10"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Button
                onClick={handleAddToCart}
                className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-heading font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border-0 group/btn tracking-wide"
                size="lg"
              >
                <ShoppingCart className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                <span className="tracking-wide">Add to Cart</span>
                <ArrowRight className="h-4 w-4 ml-2 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all duration-200" />
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

export default ProductCard;