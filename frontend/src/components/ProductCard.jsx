import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import { handleImageError } from '../utils/imageUtils';
import {
  buildCartItem,
  formatDiscountPercent,
  getProductPricing,
} from '../utils/productPricing';
import { cn } from '../lib/utils';
import SizeSelectionDialog from './SizeSelectionDialog';

const ProductCard = ({ product, className, viewMode = "grid" }) => {
  const { getProductCartInfo, addToCart } = useCart();
  const { primaryImage, loading: imageLoading } = useProductImage(product.id, product.image_url);
  const [showSizeDialog, setShowSizeDialog] = useState(false);

  const productCartInfo = getProductCartInfo(product.id);
  const currentQuantity = productCartInfo.totalQuantity;
  const pricing = getProductPricing(product);
  const variantCount = pricing.variants.length;
  const displayPrice = pricing.displayPrice;
  const isInStock = pricing.isPurchasable;
  const actionLabel = !isInStock
    ? 'Sold out'
    : pricing.hasVariants && variantCount > 1
      ? 'Select pack'
      : 'Add to cart';

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (pricing.hasVariants && variantCount > 1) {
      setShowSizeDialog(true);
    } else if (pricing.hasVariants && pricing.selectedVariant) {
      addToCart(buildCartItem(product, pricing.selectedVariant.id), 1);
    } else {
      addToCart(buildCartItem(product), 1);
    }
  };

  const getCartLabel = () => {
    if (currentQuantity === 0) return null;

    const items = productCartInfo.items;
    if (items.length === 1) {
      const item = items[0];
      return item.size ? `${item.quantity}x of ${item.size}` : `${item.quantity}x in cart`;
    } else if (items.length > 1) {
      return `${currentQuantity}x in cart`;
    }
    return null;
  };

  const discount = pricing.displayDiscountPercent;
  const cartLabel = getCartLabel();
  const description = product.description?.trim();
  const truncatedDescription = description
    ? description.length > (viewMode === 'list' ? 120 : 84)
      ? `${description.substring(0, viewMode === 'list' ? 120 : 84)}...`
      : description
    : 'Carefully packed dry fruits for everyday snacking and gifting.';
  const detailLine = pricing.hasVariants
    ? `${variantCount} pack option${variantCount === 1 ? '' : 's'}`
    : product.weight
      ? `${product.weight} ${product.unit || 'kg'}`
      : 'Standard pack';

  return (
    <>
      <motion.div
        className={cn('group h-full', className)}
        whileHover={{ y: viewMode === 'list' ? -2 : -4 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <Card
          className={cn(
            'h-full overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.045)] transition-all duration-300 group-hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]',
            viewMode === 'list' && 'rounded-[1.3rem]'
          )}
        >
          <div className={cn('flex h-full flex-col', viewMode === 'list' && 'lg:flex-row')}>
            <Link to={`/products/${product.id}`} className={cn('flex min-w-0 flex-1 flex-col', viewMode === 'list' && 'lg:flex-row')}>
              <div
                className={cn(
                  'relative overflow-hidden bg-[#f5f1e8]',
                  viewMode === 'list'
                    ? 'aspect-[5/4] w-full lg:min-h-full lg:w-56 lg:flex-none'
                    : 'aspect-[4/4.35] w-full'
                )}
              >
                {imageLoading ? (
                  <div className="h-full w-full animate-pulse bg-gradient-to-r from-[#ece7dc] via-[#f7f4ed] to-[#ece7dc] bg-[length:200%_100%]" />
                ) : primaryImage || product.image_url ? (
                  <motion.img
                    src={primaryImage || product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    onError={(e) => handleImageError(e, 'product')}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#f1ece2] text-center text-sm font-medium text-slate-500">
                    No image
                  </div>
                )}

                <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
                  {discount > 0 && (
                    <Badge className="rounded-full border-0 bg-slate-900/88 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                      {formatDiscountPercent(discount)}% off
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className={cn('flex flex-1 flex-col p-4', viewMode === 'list' && 'lg:p-5')}>
                {product.category_name && (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {product.category_name}
                  </p>
                )}

                <h3 className="mt-2 line-clamp-2 font-heading text-[1.02rem] font-semibold leading-snug tracking-tight text-slate-900 transition-colors duration-200 group-hover:text-[#23442a]">
                  {product.name}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                  {truncatedDescription}
                </p>

                <div className="mt-auto border-t border-slate-100 pt-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      {pricing.hasPriceRange && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          From
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-heading text-[1.28rem] font-semibold tracking-tight text-slate-900">
                          ₹{displayPrice.toFixed(2)}
                        </span>
                        {pricing.displayHasMrp && (
                          <span className="text-sm font-medium text-slate-400 line-through">
                            ₹{pricing.displayMrp.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {detailLine}
                        {cartLabel ? ` • ${cartLabel}` : ''}
                      </p>
                    </div>

                    <p className={cn('shrink-0 text-xs font-medium', isInStock ? 'text-emerald-700' : 'text-rose-700')}>
                      {isInStock ? 'In stock' : 'Sold out'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Link>

            <div
              className={cn(
                'px-4 pb-4 pt-0',
                viewMode === 'list' && 'lg:flex lg:w-[178px] lg:flex-none lg:items-end lg:border-l lg:border-slate-100 lg:p-5'
              )}
            >
              <Button
                onClick={handleAddToCart}
                disabled={!isInStock}
                className={cn(
                  'h-10 w-full rounded-xl bg-[#1f3425] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#16271b] disabled:cursor-not-allowed disabled:opacity-50',
                  viewMode === 'list' && 'lg:rounded-full'
                )}
                size="lg"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {actionLabel}
              </Button>
            </div>
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
};

export default ProductCard;
