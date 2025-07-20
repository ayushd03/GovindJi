import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import ProductImageGallery from '../components/ProductImageGallery';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/${id}`);
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
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    // Show success message or redirect to cart
    alert(`Added ${quantity} x ${product.name} to cart!`);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
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
              <span className="price">₹{parseFloat(product.price).toFixed(2)}</span>
              {product.unit && (
                <span className="unit">per {product.unit}</span>
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
    </div>
  );
};

export default ProductDetail;