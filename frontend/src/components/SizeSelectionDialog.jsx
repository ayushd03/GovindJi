import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import {
  buildCartItem,
  clampQuantityToStock,
  formatDiscountPercent,
  formatCompactStockLabel,
  getStockLevel,
  getProductPricing,
  getProductVariants,
  getSelectedVariant,
} from '../utils/productPricing';
import { cn } from '../lib/utils';

const SizeSelectionDialog = ({ isOpen, onClose, product, onAddToCart }) => {
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const { primaryImage } = useProductImage(product?.id, product?.image_url);
  const variants = getProductVariants(product);
  const pricing = getProductPricing(product, selectedSize);
  const selectedVariant = getSelectedVariant(product, selectedSize, { preferInStock: false });
  const selectedStock = pricing.availableStock;
  const lowStockThreshold = product?.min_stock_level || 5;

  useEffect(() => {
    if (isOpen && variants.length > 0) {
      const defaultVariant = getSelectedVariant(product, null, { preferInStock: true });
      setSelectedSize(defaultVariant?.id || '');
      setQuantity(1);
    }
  }, [isOpen, product, variants.length]);

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }

    setQuantity((currentQuantity) => clampQuantityToStock(currentQuantity, selectedVariant.stock_quantity));
  }, [selectedVariant]);

  const handleAddToCart = async () => {
    if (!selectedSize || !product || !selectedVariant || selectedStock <= 0) return;

    setIsAdding(true);
    const productWithSize = buildCartItem({
      ...product,
      image_url: primaryImage || product.image_url,
    }, selectedSize);

    try {
      if (!productWithSize) {
        throw new Error('Selected variant is unavailable');
      }

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

  const totalPrice = selectedVariant ? pricing.selectedPrice * quantity : 0;

  // Don't show dialog if no variants configured
  if (!isOpen || variants.length === 0) return null;

  const renderVariantButton = (variant) => {
    const stockQuantity = variant.stock_quantity ?? 0;
    const isDisabled = stockQuantity <= 0;
    const isSelected = selectedSize === variant.id;
    const stockLevel = getStockLevel(stockQuantity, lowStockThreshold);
    const stockLabel = formatCompactStockLabel(stockQuantity, lowStockThreshold);

    return (
      <button
        key={variant.id}
        type="button"
        onClick={() => {
          if (!isDisabled) {
            setSelectedSize(variant.id);
            setQuantity(1);
          }
        }}
        disabled={isDisabled}
        className={cn(
          "relative flex min-h-[94px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs transition-all",
          isDisabled
            ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-55"
            : isSelected
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background hover:border-primary/60 hover:shadow-sm"
        )}
      >
        {variant.is_default && !isDisabled && (
          <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
        )}

        <div className="font-semibold leading-tight">{variant.variant_name}</div>
        <div className="space-y-0.5 text-center">
          <div className="text-xs font-semibold opacity-90">₹{Number.parseFloat(variant.price).toFixed(0)}</div>
          {variant.hasMrp && (
            <div className={cn(
              'flex flex-col items-center text-[10px]',
              isSelected ? 'text-white/85' : 'text-muted-foreground'
            )}>
              <span className="line-through">MRP ₹{variant.mrp.toFixed(0)}</span>
              <span>{formatDiscountPercent(variant.discountPercent)}% off</span>
            </div>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 whitespace-nowrap",
            isSelected
              ? "border-white/20 bg-white/12 text-white"
              : stockLevel === 'out'
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : stockLevel === 'low'
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {stockLabel}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg">Select Size</DialogTitle>
        </DialogHeader>

        {/* Product Info - Compact */}
        <div className="flex items-center gap-3 px-4 pb-3">
          {primaryImage || product?.image_url ? (
            <img
              src={primaryImage || product.image_url}
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
            {variants.slice(0, 3).map(renderVariantButton)}
          </div>

          {variants.length > 3 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {variants.slice(3).map(renderVariantButton)}
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
              onClick={() => setQuantity(clampQuantityToStock(quantity + 1, selectedVariant?.stock_quantity))}
              disabled={selectedStock <= 0 || (selectedVariant && quantity >= selectedStock)}
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
            disabled={!selectedSize || !selectedVariant || selectedStock <= 0 || isAdding}
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
