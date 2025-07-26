import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useCart } from '../context/CartContext';
import { cn } from '../lib/utils';

const SizeSelectionDialog = ({ isOpen, onClose, product, onAddToCart }) => {
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();

  const sizes = [
    { id: '250g', label: '250g', price: product?.price || 0, popular: false },
    { id: '500g', label: '500g', price: product?.price ? product.price * 1.8 : 0, popular: true },
    { id: '1kg', label: '1kg', price: product?.price ? product.price * 3.5 : 0, popular: false },
    { id: '2kg', label: '2kg', price: product?.price ? product.price * 6.8 : 0, popular: false },
    { id: '5kg', label: '5kg', price: product?.price ? product.price * 16 : 0, popular: false }
  ];

  useEffect(() => {
    if (isOpen && sizes.length > 0) {
      // Default to the popular option or first option
      const defaultSize = sizes.find(size => size.popular) || sizes[0];
      setSelectedSize(defaultSize.id);
      setQuantity(1);
    }
  }, [isOpen]);

  const handleAddToCart = async () => {
    if (!selectedSize || !product) return;

    setIsAdding(true);
    
    const selectedSizeData = sizes.find(size => size.id === selectedSize);
    const productWithSize = {
      ...product,
      size: selectedSize,
      price: selectedSizeData.price,
      originalId: product.id,
      id: `${product.id}-${selectedSize}`
    };

    try {
      if (onAddToCart) {
        // Use custom onAddToCart if provided
        await onAddToCart(productWithSize, quantity);
      } else {
        // Fallback to default cart context
        await addToCart(productWithSize, quantity);
        onClose();
      }
      
      setTimeout(() => {
        setIsAdding(false);
      }, 500);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setIsAdding(false);
    }
  };

  const selectedSizeData = sizes.find(size => size.id === selectedSize);
  const totalPrice = selectedSizeData ? selectedSizeData.price * quantity : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg">Select Size</DialogTitle>
        </DialogHeader>

        {/* Product Info - Compact */}
        <div className="flex items-center gap-3 px-4 pb-3">
          {product?.image_url ? (
            <img
              src={product.image_url}
              alt={product?.name}
              className="w-12 h-12 object-cover rounded-md"
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 flex items-center justify-center rounded-md">
              <div className="text-gray-400 text-lg">📦</div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{product?.name}</h4>
            <p className="text-xs text-muted-foreground">Qty: {quantity}</p>
          </div>
        </div>

        {/* Size Selection - Compact Grid */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {sizes.slice(0, 3).map((size) => (
              <button
                key={size.id}
                onClick={() => setSelectedSize(size.id)}
                className={cn(
                  "relative p-2 rounded-md border text-center transition-all text-xs",
                  selectedSize === size.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary"
                )}
              >
                {size.popular && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
                <div className="font-semibold">{size.label}</div>
                <div className="text-xs opacity-80">₹{size.price.toFixed(0)}</div>
              </button>
            ))}
          </div>
          
          {sizes.length > 3 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sizes.slice(3).map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size.id)}
                  className={cn(
                    "p-2 rounded-md border text-center transition-all text-xs",
                    selectedSize === size.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  )}
                >
                  <div className="font-semibold">{size.label}</div>
                  <div className="text-xs opacity-80">₹{size.price.toFixed(0)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity & Price - Single Row */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="h-7 w-7"
            >
              -
            </Button>
            <span className="text-sm font-medium w-8 text-center">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(quantity + 1)}
              className="h-7 w-7"
            >
              +
            </Button>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold text-primary">₹{totalPrice.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>

        {/* Add to Cart Button */}
        <div className="p-4 pt-2 border-t">
          <Button
            onClick={handleAddToCart}
            disabled={!selectedSize || isAdding}
            className="w-full"
            size="sm"
          >
            {isAdding ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                />
                Adding...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SizeSelectionDialog;