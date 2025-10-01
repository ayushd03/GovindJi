import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import ProductImageGallery from '../components/ProductImageGallery';
import SizeSelectionDialog from '../components/SizeSelectionDialog';
import './ProductDetail.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

  useEffect(() => {
    fetchProduct();
  }, [id]);

  // Set default size when product loads (only if variants are configured)
  useEffect(() => {
    if (product && !selectedSize && product.variants && product.variants.length > 0) {
      // Set the default variant or first variant
      const defaultVariant = product.variants.find(v => v.is_default) || product.variants[0];
      setSelectedSize(defaultVariant.id);
    }
  }, [product]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
      } else if (response.status === 404) {
        setError('Product not found');
      } else {
        setError('Failed to load product');
      }
    } catch (err) {
      setError('Failed to load product');
      console.error('Error fetching product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    // If product has variants and none selected, show dialog
    if (product.variants && product.variants.length > 0 && !selectedSize) {
      setPendingAction('addToCart');
      setShowSizeDialog(true);
      return;
    }

    // If product has variants, add with variant details
    if (product.variants && product.variants.length > 0 && selectedSize) {
      const selectedVariant = product.variants.find(v => v.id === selectedSize);
      const productWithSize = {
        ...product,
        size: selectedVariant.variant_name,
        size_value: selectedVariant.size_value,
        size_unit: selectedVariant.size_unit,
        variant_id: selectedVariant.id,
        price: parseFloat(selectedVariant.price),
        originalId: product.id,
        id: `${product.id}-${selectedSize}`
      };
      addToCart(productWithSize, quantity);
    } else {
      // Product without variants - add directly
      addToCart(product, quantity);
    }
  };

  const handleBuyNow = () => {
    // If product has variants and none selected, show dialog
    if (product.variants && product.variants.length > 0 && !selectedSize) {
      setPendingAction('buyNow');
      setShowSizeDialog(true);
      return;
    }

    // If product has variants, add with variant details
    if (product.variants && product.variants.length > 0 && selectedSize) {
      const selectedVariant = product.variants.find(v => v.id === selectedSize);
      const productWithSize = {
        ...product,
        size: selectedVariant.variant_name,
        size_value: selectedVariant.size_value,
        size_unit: selectedVariant.size_unit,
        variant_id: selectedVariant.id,
        price: parseFloat(selectedVariant.price),
        originalId: product.id,
        id: `${product.id}-${selectedSize}`
      };
      addToCart(productWithSize, quantity);
    } else {
      // Product without variants - add directly
      addToCart(product, quantity);
    }
    openCartPopup();
  };

  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="product-detail-skeleton">
          <div className="image-skeleton-large"></div>
          <div className="content-skeleton">
            <div className="title-skeleton"></div>
            <div className="price-skeleton"></div>
            <div className="description-skeleton"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-detail-container">
        <div className="error-state">
          <h2>😔 {error}</h2>
          <p>The product you're looking for doesn't exist or couldn't be loaded.</p>
          <button onClick={() => navigate('/products')} className="back-to-products-btn">
            ← Back to Products
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-container">
        <div className="error-state">
          <h2>Product not found</h2>
          <button onClick={() => navigate('/products')} className="back-to-products-btn">
            ← Back to Products
          </button>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity <= product.min_stock_level && product.stock_quantity > 0;

  // Use product variants if available
  const hasVariants = product.variants && product.variants.length > 0;
  const variants = hasVariants ? product.variants : [];

  const getVariantPrice = (variantId) => {
    if (!hasVariants) return product?.price || 0;
    const variant = variants.find(v => v.id === variantId);
    return variant ? parseFloat(variant.price) : product?.price || 0;
  };

  const handleSizeSelect = (variantId) => {
    setSelectedSize(variantId);
  };

  return (
    <div className="product-detail-container">
      <div className="product-detail">
        <button 
          onClick={() => navigate('/products')} 
          className="back-button"
        >
          ← Back to Products
        </button>

        <div className="product-detail-grid">
          {/* Image Gallery */}
          <div className="product-images">
            <ProductImageGallery 
              productId={product.id} 
              fallbackImageUrl={product.image_url}
            />
          </div>

          {/* Product Information */}
          <div className="product-info">
            <div className="product-header">
              <h1 className="product-title">{product.name}</h1>
              {product.sku && (
                <span className="product-sku">SKU: {product.sku}</span>
              )}
            </div>

            <div className="product-price">
              {hasVariants && selectedSize ? (
                <>
                  <span className="price">₹{getVariantPrice(selectedSize).toFixed(2)}</span>
                  <span className="unit">
                    for {variants.find(v => v.id === selectedSize)?.variant_name}
                  </span>
                </>
              ) : (
                <>
                  <span className="price">₹{parseFloat(product.price).toFixed(2)}</span>
                  {product.unit && (
                    <span className="unit">per {product.unit}</span>
                  )}
                </>
              )}
            </div>

            <div className="stock-info">
              {isOutOfStock ? (
                <span className="stock-status out-of-stock">Out of Stock</span>
              ) : isLowStock ? (
                <span className="stock-status low-stock">
                  Only {product.stock_quantity} left in stock
                </span>
              ) : (
                <span className="stock-status in-stock">
                  {product.stock_quantity} in stock
                </span>
              )}
            </div>

            {product.description && (
              <div className="product-description">
                <h3>Description</h3>
                <p>{product.description}</p>
              </div>
            )}

            {product.weight && (
              <div className="product-details">
                <h3>Product Details</h3>
                <ul>
                  <li>Weight: {product.weight} {product.unit || 'kg'}</li>
                  {product.category_id && (
                    <li>Category: {product.category_name || 'General'}</li>
                  )}
                </ul>
              </div>
            )}

            {!isOutOfStock && (
              <div className="purchase-section">
                {/* Size Selection - Only show if variants are configured */}
                {hasVariants && (
                  <div className="size-selection">
                    <label>Choose Size:</label>
                    <div className="size-options">
                      {variants.slice(0, 3).map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => handleSizeSelect(variant.id)}
                          className={`size-option ${
                            selectedSize === variant.id ? 'selected' : ''
                          } ${variant.is_default ? 'popular' : ''}`}
                        >
                          {variant.is_default && <span className="popular-badge">Default</span>}
                          <span className="size-label">{variant.variant_name}</span>
                          <span className="size-price">₹{parseFloat(variant.price).toFixed(0)}</span>
                        </button>
                      ))}
                    </div>
                    {variants.length > 3 && (
                      <div className="size-options-row">
                        {variants.slice(3).map((variant) => (
                          <button
                            key={variant.id}
                            onClick={() => handleSizeSelect(variant.id)}
                            className={`size-option ${selectedSize === variant.id ? 'selected' : ''}`}
                          >
                            <span className="size-label">{variant.variant_name}</span>
                            <span className="size-price">₹{parseFloat(variant.price).toFixed(0)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="quantity-selector">
                  <label htmlFor="quantity">Quantity:</label>
                  <div className="quantity-controls">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      -
                    </button>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      max={product.stock_quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(product.stock_quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                    <button 
                      onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      disabled={quantity >= product.stock_quantity}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="action-buttons">
                  <button 
                    onClick={handleAddToCart}
                    className="add-to-cart-btn"
                  >
                    Add to Cart
                  </button>
                  <button 
                    onClick={handleBuyNow}
                    className="buy-now-btn"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            )}
          </div>
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