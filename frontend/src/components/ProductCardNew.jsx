import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, Heart, Eye } from 'lucide-react';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import { cn } from '../lib/utils';
import SizeSelectionDialog from './SizeSelectionDialog';

const ProductCardNew = ({ product, className }) => {
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

  return (
    <>
      <motion.div
        className={cn("group relative", className)}
        whileHover={{ y: -12, scale: 1.05, rotateY: 2 }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card className="overflow-hidden border-4 border-primary/10 hover:border-primary/40 shadow-xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] transition-all duration-600 bg-gradient-to-br from-white via-primary/5 to-secondary-accent/10 relative backdrop-blur-sm transform-gpu">
          {/* Bold pattern background */}
          <div 
            className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity duration-500"
            style={{
              backgroundImage: `radial-gradient(circle, #F39C12 2px, transparent 2px)`,
              backgroundSize: '25px 25px'
            }}
          />
          
          {/* Strong gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary-accent/15 opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          {/* Premium border glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary-accent/15 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-lg" />
          
          {/* Prominent corner accent */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/20 to-transparent opacity-30 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />
          
          {/* Animated pulse ring */}
          <motion.div
            className="absolute inset-0 border-2 border-primary/30 rounded-lg opacity-0 group-hover:opacity-100"
            animate={isHovered ? { scale: [1, 1.02, 1], opacity: [0.3, 0.6, 0.3] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 2, repeat: isHovered ? Infinity : 0 }}
          />
          {/* Discount Badge */}
          {discount > 0 && (
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: -15 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="absolute top-2 left-2 z-20"
            >
              <Badge 
                variant="destructive" 
                className="text-sm font-bold shadow-2xl bg-gradient-to-r from-red-500 via-red-600 to-red-700 border-2 border-red-400 px-3 py-1"
              >
                {discount}% OFF
              </Badge>
              {/* Badge glow effect */}
              <div className="absolute inset-0 bg-red-500 rounded-full blur-lg opacity-40 -z-10"></div>
            </motion.div>
          )}

          {/* Cart Status Badge */}
          {currentQuantity > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20"
            >
              <Badge 
                className="bg-gradient-to-r from-primary via-primary to-secondary-accent text-white shadow-2xl border-2 border-primary/50 px-3 py-1 text-sm font-bold"
              >
                {getCartLabel()}
              </Badge>
              {/* Badge glow effect */}
              <div className="absolute inset-0 bg-primary rounded-full blur-lg opacity-50 -z-10"></div>
            </motion.div>
          )}

          {/* Favorite Button */}
          <motion.div
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.85 }}
            className="absolute top-2 right-2 z-20"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteToggle}
              className="h-10 w-10 bg-white/95 backdrop-blur-sm hover:bg-white shadow-xl border-2 border-white/80 hover:border-red-200"
            >
              <Heart 
                className={cn(
                  "h-5 w-5 transition-all duration-300",
                  isFavorited 
                    ? "text-red-500 fill-red-500 scale-125" 
                    : "text-gray-600 hover:text-red-500"
                )}
              />
            </Button>
            {/* Button glow effect */}
            {isFavorited && (
              <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-30 -z-10"></div>
            )}
          </motion.div>

          <Link to={`/products/${product.id}`} className="block">
            {/* Product Image */}
            <div className="relative h-52 bg-gradient-to-br from-primary/10 via-white to-secondary-accent/10 overflow-hidden">
              {/* Bold image border/frame effect */}
              <div className="absolute inset-1 bg-gradient-to-br from-white/40 via-primary/10 to-white/40 rounded-lg opacity-50 group-hover:opacity-90 transition-opacity duration-500 pointer-events-none border-2 border-white/50" />
              
              {imageLoading ? (
                <div className="w-full h-full bg-gradient-to-r from-primary/20 via-white to-secondary-accent/20 bg-[length:200%_100%] animate-pulse" />
              ) : (
                <img
                  src={primaryImage || product.image_url || '/placeholder-product.jpg'}
                  alt={product.name}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-115 group-hover:brightness-125 group-hover:saturate-110"
                  onError={(e) => {
                    if (e.target && e.target.src !== '/placeholder-product.jpg') {
                      e.target.src = '/placeholder-product.jpg';
                    }
                  }}
                />
              )}
              
              {/* Enhanced gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-primary/10 opacity-70 group-hover:opacity-40 transition-opacity duration-500" />
              
              {/* Overlay with Quick Actions */}
              <motion.div 
                className={cn(
                  "absolute inset-0 bg-gradient-to-t from-black/70 via-primary/20 to-transparent flex items-center justify-center transition-all duration-500",
                  isHovered ? "opacity-100" : "opacity-0"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
              >
                <motion.div
                  initial={{ scale: 0.6, y: 30 }}
                  animate={{ 
                    scale: isHovered ? 1.1 : 0.6, 
                    y: isHovered ? 0 : 30 
                  }}
                  transition={{ delay: 0.1, type: "spring" }}
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12 bg-white hover:bg-primary hover:text-white shadow-2xl backdrop-blur-sm border-2 border-white"
                  >
                    <Eye className="h-6 w-6" />
                  </Button>
                </motion.div>
              </motion.div>
              
              {/* Enhanced shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-800 ease-out" />
              
              {/* Pulsing highlight border */}
              <motion.div
                className="absolute inset-0 border-2 border-primary/50 rounded-lg opacity-0 group-hover:opacity-100"
                animate={isHovered ? { 
                  boxShadow: [
                    "0 0 0 0 rgba(243, 156, 18, 0.4)",
                    "0 0 0 8px rgba(243, 156, 18, 0.1)",
                    "0 0 0 0 rgba(243, 156, 18, 0.4)"
                  ]
                } : {}}
                transition={{ duration: 1.5, repeat: isHovered ? Infinity : 0 }}
              />
            </div>

            <CardContent className="p-4 relative">
              {/* Content background gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10">
                {/* Rating */}
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Star
                        className={cn(
                          "h-3 w-3 transition-all duration-200",
                          i < Math.floor(rating) 
                            ? "text-yellow-400 fill-yellow-400 drop-shadow-sm" 
                            : "text-muted-foreground"
                        )}
                      />
                    </motion.div>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 font-medium">
                    ({rating})
                  </span>
                </div>

                {/* Product Name */}
                <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-primary transition-all duration-300 leading-snug">
                  {product.name}
                </h3>

                {/* Product Description */}
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                  {product.description && product.description.length > 80
                    ? `${product.description.substring(0, 80)}...`
                    : product.description
                  }
                </p>

                {/* Price Section */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <motion.span 
                      className="text-xl font-black bg-gradient-to-r from-primary via-secondary-accent to-primary bg-clip-text text-transparent drop-shadow-sm"
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      ₹{parseFloat(product.price).toFixed(2)}
                    </motion.span>
                    {discount > 0 && (
                      <span className="text-sm text-muted-foreground line-through font-medium">
                        ₹{(parseFloat(product.price) * (1 + discount / 100)).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-sm bg-gradient-to-r from-green-100 to-green-50 text-green-800 border-2 border-green-200 font-bold px-3 py-1 shadow-md">
                    ✓ In Stock
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Link>

          <CardFooter className="p-4 pt-2 relative">
            {/* Bold footer gradient background */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-secondary-accent/5 to-transparent opacity-50 group-hover:opacity-80 transition-opacity duration-500 pointer-events-none" />
            
            <motion.div
              className="w-full relative z-10"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Button
                onClick={handleAddToCart}
                className="w-full h-12 bg-gradient-to-r from-primary via-primary to-secondary-accent hover:from-secondary-accent hover:via-primary hover:to-primary shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-primary/20 hover:border-primary/40 text-white font-bold text-base"
                size="lg"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                <span>Add to Cart</span>
              </Button>
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary-accent rounded-lg blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-500 -z-10"></div>
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

export default ProductCardNew;