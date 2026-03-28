import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { useCart } from '../context/CartContext';
import ProductImageGallery from '../components/ProductImageGallery';
import SizeSelectionDialog from '../components/SizeSelectionDialog';
import {
  getStoredDeliveryPincode,
  normalizeDeliveryPincode,
  useDeliveryOptions,
} from '../hooks/useDeliveryOptions';
import {
  formatDeliveryCurrency,
  formatDeliveryRange,
  getDeliveryModeLabel,
  getSelectedDeliveryOption,
} from '../utils/deliveryUtils';
import {
  buildCartItem,
  clampQuantityToStock,
  formatCompactStockLabel,
  getProductPricing,
  getProductVariants,
  getSelectedVariant,
} from '../utils/productPricing';
import { API_BASE_URL } from '../config/apiBaseUrl';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, openCartPopup } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('');
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [deliveryPincode, setDeliveryPincode] = useState(getStoredDeliveryPincode());

  useEffect(() => {
    setSelectedSize('');
    setQuantity(1);
    setShowSizeDialog(false);
    setPendingAction(null);

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        } else if (response.status === 404) {
          setProduct(null);
          setError('Product not found');
        } else {
          setProduct(null);
          setError('Failed to load product');
        }
      } catch (err) {
        setProduct(null);
        setError('Failed to load product');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!product || selectedSize) {
      return;
    }

    const defaultVariant = getSelectedVariant(product, null, { preferInStock: true });
    if (defaultVariant && defaultVariant.id !== selectedSize) {
      setSelectedSize(defaultVariant.id);
    }
  }, [product, selectedSize]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const pricing = getProductPricing(product, selectedSize);
  const variants = getProductVariants(product);
  const hasVariants = pricing.hasVariants;
  const selectedVariant = getSelectedVariant(product, selectedSize, { preferInStock: false });
  const activeVariantId = selectedSize || selectedVariant?.id || '';
  const availableStock = hasVariants ? pricing.availableStock : pricing.totalStock;
  const isOutOfStock = hasVariants ? !pricing.isPurchasable : availableStock <= 0;
  const lowStockThreshold = product?.min_stock_level || 5;
  const isLowStock = availableStock > 0 && availableStock <= lowStockThreshold;
  const canPurchase = hasVariants ? Boolean(selectedVariant) && availableStock > 0 : availableStock > 0;
  const deliveryEstimateSubtotal = Number.parseFloat(pricing.selectedPrice || 0) * Math.max(Number(quantity) || 1, 1);
  const {
    data: deliveryOptionsData,
    loading: deliveryOptionsLoading,
    error: deliveryOptionsError,
  } = useDeliveryOptions({
    pincode: deliveryPincode,
    subtotal: deliveryEstimateSubtotal,
    enabled: Boolean(product),
  });
  const featuredDeliveryOption = getSelectedDeliveryOption(
    deliveryOptionsData?.options,
    deliveryOptionsData?.default_mode
  );

  useEffect(() => {
    if (!product) {
      return;
    }

    setQuantity((currentQuantity) => clampQuantityToStock(currentQuantity, availableStock));
  }, [availableStock, product]);

  if (loading) {
    return (
      <div className="page-shell-soft product-detail-shell">
        <div className="page-container">
          <div className="product-detail-skeleton">
            <div className="product-detail-skeleton-media"></div>
            <div className="space-y-4">
              <div className="product-detail-skeleton-line product-detail-skeleton-line--short"></div>
              <div className="product-detail-skeleton-line product-detail-skeleton-line--mid"></div>
              <div className="product-detail-skeleton-block"></div>
              <div className="product-detail-skeleton-block"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell-soft product-detail-shell">
        <div className="page-container">
          <div className="product-detail-state-card">
            <h2>{error}</h2>
            <p>The product could not be loaded right now. Return to the catalogue and try another selection.</p>
            <div className="product-detail-state-actions">
              <button onClick={() => navigate('/products')} className="store-button-secondary" type="button">
                Back to Products
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-shell-soft product-detail-shell">
        <div className="page-container">
          <div className="product-detail-state-card">
            <h2>Product not found</h2>
            <p>This item is not available in the catalogue anymore.</p>
            <div className="product-detail-state-actions">
              <button onClick={() => navigate('/products')} className="store-button-secondary" type="button">
                Back to Products
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const buildSelectedCartItem = () => {
    if (!product) {
      return null;
    }

    if (!hasVariants) {
      return buildCartItem(product);
    }

    return buildCartItem(product, activeVariantId);
  };

  const handleCartAction = (actionType) => {
    if (hasVariants && !activeVariantId) {
      setPendingAction(actionType);
      setShowSizeDialog(true);
      return;
    }

    if (!canPurchase) {
      return;
    }

    const cartItem = buildSelectedCartItem();
    if (!cartItem) {
      setPendingAction(actionType);
      setShowSizeDialog(true);
      return;
    }

    addToCart(cartItem, quantity);

    if (actionType === 'buyNow') {
      openCartPopup();
    }
  };

  const handleAddToCart = () => {
    handleCartAction('addToCart');
  };

  const handleBuyNow = () => {
    handleCartAction('buyNow');
  };

  const handleSizeSelect = (variantId) => {
    const variant = variants.find((item) => item.id === variantId);
    if (!variant || (variant.stock_quantity ?? 0) <= 0) {
      return;
    }

    setSelectedSize(variantId);
    setQuantity(1);
  };

  const stockSummary = isOutOfStock
    ? 'Currently unavailable'
    : isLowStock
      ? `${availableStock} left${selectedVariant ? ` in ${selectedVariant.variant_name}` : ''}`
      : `${availableStock} in stock${selectedVariant ? ` for ${selectedVariant.variant_name}` : ''}`;

  const stockPillClassName = isOutOfStock
    ? 'product-detail-stock-pill product-detail-stock-pill--danger'
    : isLowStock
      ? 'product-detail-stock-pill product-detail-stock-pill--warning'
      : 'product-detail-stock-pill product-detail-stock-pill--success';

  const availableVariantCount = variants.filter((variant) => (variant.stock_quantity ?? 0) > 0).length;

  const productFacts = [
    product.category_name || product.category_id
      ? { label: 'Category', value: product.category_name || 'General' }
      : null,
    product.weight
      ? { label: 'Weight', value: `${product.weight} ${product.unit || 'kg'}` }
      : null,
    { label: 'Selection', value: selectedVariant?.variant_name || 'Standard pack' },
    hasVariants
      ? { label: 'Pack options', value: `${availableVariantCount} available` }
      : { label: 'Stock', value: `${availableStock} units ready` },
  ].filter(Boolean);

  return (
    <div className="page-shell-soft product-detail-shell">
      <div className="page-container">
        <div className="product-detail-stack">
          <button
            onClick={() => navigate('/products')}
            className="product-detail-back-button"
            type="button"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Products
          </button>

          <section className="product-detail-card">
            <div className="product-detail-grid">
              <div className="product-detail-visual-panel">
                <ProductImageGallery
                  productId={product.id}
                  fallbackImageUrl={product.image_url}
                />
              </div>

              <div className="product-detail-info-panel">
                <div className="space-y-3">
                  <div className="product-detail-badge-row">
                    {product.category_name && (
                      <span className="product-detail-badge">{product.category_name}</span>
                    )}
                    {product.sku && (
                      <span className="product-detail-badge product-detail-badge--neutral">
                        SKU {product.sku}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <h1 className="product-detail-title">{product.name}</h1>
                    {product.description && (
                      <p className="product-detail-description">{product.description}</p>
                    )}
                  </div>
                </div>

                <div className="product-detail-purchase-card">
                  <div className="product-detail-price-header">
                    <div>
                      <p className="product-detail-caption">Price</p>
                      <div className="product-detail-price-row">
                        <span className="product-detail-price">₹{pricing.selectedPrice.toFixed(2)}</span>
                        <span className="product-detail-unit">
                          {hasVariants && selectedVariant
                            ? `for ${selectedVariant.variant_name}`
                            : product.unit
                              ? `per ${product.unit}`
                              : 'per pack'}
                        </span>
                      </div>
                    </div>

                    <span className={stockPillClassName}>{stockSummary}</span>
                  </div>

                  {hasVariants && (
                    <div className="product-detail-panel-section">
                      <div className="product-detail-section-header product-detail-section-header--compact">
                        <div>
                          <h2 className="product-detail-section-title">Choose pack size</h2>
                          <p className="product-detail-section-copy">
                            Each pack shows the live selling price and current stock.
                          </p>
                        </div>
                      </div>

                      <div className="product-detail-options-grid">
                        {variants.map((variant) => {
                          const isSelected = activeVariantId === variant.id;
                          const isDisabled = (variant.stock_quantity ?? 0) <= 0;
                          const optionClassName = [
                            'product-detail-option',
                            isSelected ? 'product-detail-option--selected' : '',
                            variant.is_default ? 'product-detail-option--default' : '',
                            isDisabled ? 'product-detail-option--disabled' : '',
                          ].filter(Boolean).join(' ');

                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => handleSizeSelect(variant.id)}
                              disabled={isDisabled}
                              className={optionClassName}
                            >
                              <span className="product-detail-option-label">{variant.variant_name}</span>
                              <span className="product-detail-option-price">
                                ₹{parseFloat(variant.price).toFixed(0)}
                              </span>
                              <span className="product-detail-option-stock">
                                {formatCompactStockLabel(variant.stock_quantity, lowStockThreshold)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isOutOfStock && (
                    <div className="product-detail-panel-section">
                      <div className="product-detail-purchase-layout">
                        <div className="product-detail-quantity-block">
                          <label htmlFor="quantity" className="product-detail-quantity-label">
                            Quantity
                          </label>
                          <div className="product-detail-quantity-controls">
                            <button
                              type="button"
                              className="product-detail-quantity-button"
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              disabled={quantity <= 1}
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <input
                              id="quantity"
                              type="number"
                              min="1"
                              max={Math.max(availableStock, 1)}
                              value={quantity}
                              onChange={(e) => setQuantity(clampQuantityToStock(e.target.value, availableStock))}
                              className="product-detail-quantity-input"
                            />
                            <button
                              type="button"
                              className="product-detail-quantity-button"
                              onClick={() => setQuantity(clampQuantityToStock(quantity + 1, availableStock))}
                              disabled={!canPurchase || quantity >= availableStock}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="product-detail-action-group">
                          <button
                            type="button"
                            onClick={handleAddToCart}
                            className="product-detail-action product-detail-action--secondary"
                            disabled={!canPurchase}
                          >
                            {!canPurchase ? 'Out of Stock' : 'Add to Cart'}
                          </button>
                          <button
                            type="button"
                            onClick={handleBuyNow}
                            className="product-detail-action product-detail-action--primary"
                            disabled={!canPurchase}
                          >
                            {!canPurchase ? 'Out of Stock' : 'Buy Now'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="product-detail-panel-section">
                    <div className="product-detail-section-header product-detail-section-header--compact">
                      <div>
                        <h2 className="product-detail-section-title">Delivery estimate</h2>
                        <p className="product-detail-section-copy">
                          Live shipping fee and ETA for this product selection.
                        </p>
                      </div>
                    </div>

                    <div className="product-detail-delivery-input-block">
                      <label htmlFor="productDeliveryPincode" className="product-detail-quantity-label">
                        Delivery pincode
                      </label>
                      <div className="product-detail-delivery-input-wrap">
                        <MapPinIcon className="product-detail-delivery-input-icon" />
                        <input
                          id="productDeliveryPincode"
                          type="text"
                          value={deliveryPincode}
                          onChange={(event) => setDeliveryPincode(normalizeDeliveryPincode(event.target.value))}
                          placeholder="Enter 6-digit pincode"
                          className="product-detail-delivery-input"
                        />
                      </div>
                      <p className="product-detail-delivery-helper">
                        Based on {quantity} selected unit{quantity > 1 ? 's' : ''} and the active pack.
                      </p>
                    </div>

                    <div className="product-detail-delivery-state">
                      {deliveryPincode.length < 6 ? (
                        <div className="product-detail-delivery-empty">
                          Enter a valid pincode to view normal and express delivery for this product.
                        </div>
                      ) : deliveryOptionsLoading ? (
                        <div className="product-detail-delivery-loading">
                          <span className="product-detail-delivery-spinner" />
                          Checking delivery options...
                        </div>
                      ) : deliveryOptionsError ? (
                        <div className="product-detail-delivery-alert product-detail-delivery-alert--danger">
                          {deliveryOptionsError}
                        </div>
                      ) : deliveryOptionsData?.serviceability_checked && !deliveryOptionsData?.serviceable ? (
                        <div className="product-detail-delivery-alert product-detail-delivery-alert--danger">
                          {deliveryOptionsData?.message || 'Delivery is not available for this pincode.'}
                        </div>
                      ) : deliveryOptionsData?.options?.length ? (
                        <div className="product-detail-delivery-results">
                          <div className="product-detail-delivery-location">
                            {deliveryOptionsData?.city
                              ? `Delivering to ${deliveryOptionsData.city}, ${deliveryOptionsData.state}`
                              : `Pincode ${deliveryOptionsData.pincode}`}
                          </div>

                          <div className="product-detail-delivery-options">
                            {deliveryOptionsData.options.map((option) => {
                              const isFeatured = featuredDeliveryOption?.mode === option.mode;

                              return (
                                <div
                                  key={option.mode}
                                  className={`product-detail-delivery-option ${
                                    isFeatured ? 'product-detail-delivery-option--featured' : ''
                                  }`}
                                >
                                  <div className="product-detail-delivery-option-row">
                                    <div>
                                      <p className="product-detail-delivery-option-title">{option.label}</p>
                                      <p className="product-detail-delivery-option-copy">{option.description}</p>
                                    </div>
                                    <div className="product-detail-delivery-option-meta">
                                      <span className="product-detail-delivery-option-fee">
                                        {formatDeliveryCurrency(option.fee)}
                                      </span>
                                      <span className="product-detail-delivery-option-eta">
                                        {formatDeliveryRange(
                                          option.estimated_delivery_start,
                                          option.estimated_delivery_end
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="product-detail-delivery-pills">
                                    <span className="product-detail-delivery-pill">
                                      Dispatch {option.estimated_dispatch_date}
                                    </span>
                                    <span className="product-detail-delivery-pill">
                                      {option.transit_min_days}-{option.transit_max_days} day transit
                                    </span>
                                    {option.free_shipping_applied && (
                                      <span className="product-detail-delivery-pill product-detail-delivery-pill--success">
                                        Free shipping applied
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="product-detail-delivery-empty">
                          No delivery options are available yet for this pincode.
                        </div>
                      )}
                    </div>

                    {featuredDeliveryOption && (
                      <div className="product-detail-delivery-summary">
                        <ClockIcon className="h-4 w-4" />
                        <p>
                          <span className="product-detail-delivery-summary-label">
                            {getDeliveryModeLabel(featuredDeliveryOption.mode)}:
                          </span>{' '}
                          arrives {formatDeliveryRange(
                            featuredDeliveryOption.estimated_delivery_start,
                            featuredDeliveryOption.estimated_delivery_end
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {productFacts.length > 0 && (
              <div className="product-detail-meta-strip">
                {productFacts.map((item) => (
                  <div key={item.label} className="product-detail-meta-card">
                    <p className="product-detail-meta-label">{item.label}</p>
                    <p className="product-detail-meta-value">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
        </section>
      </div>
      </div>

      {/* Size Selection Dialog */}
      <SizeSelectionDialog
        isOpen={showSizeDialog}
        onClose={() => {
          setShowSizeDialog(false);
          setPendingAction(null);
        }}
        product={product}
        onAddToCart={(productWithSize, qty) => {
          setShowSizeDialog(false);
          setSelectedSize(productWithSize.variant_id || '');
          setQuantity(qty);
          if (pendingAction === 'buyNow') {
            addToCart(productWithSize, qty);
            openCartPopup();
          } else {
            addToCart(productWithSize, qty);
          }
          setPendingAction(null);
        }}
      />
    </div>
  );
};

export default ProductDetail;
