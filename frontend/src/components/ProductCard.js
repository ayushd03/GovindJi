import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { primaryImage, loading: imageLoading } = useProductImage(product.id, product.image_url);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsAdding(true);
    addToCart(product);

    setTimeout(() => {
      setIsAdding(false);
    }, 600);
  };

  return (
    <div className="product-card">
      <Link to={`/products/${product.id}`} className="product-link">
        <div className="product-image">
          {imageLoading ? (
            <div className="image-skeleton"></div>
          ) : (
            <img
              src={primaryImage || '/placeholder-product.jpg'}
              alt={product.name}
              onError={(e) => {
                e.target.src = '/placeholder-product.jpg';
              }}
            />
          )}
        </div>
        
        <div className="product-info">
          <h3 className="product-name">{product.name}</h3>
          <p className="product-description">
            {product.description && product.description.length > 80
              ? `${product.description.substring(0, 80)}...`
              : product.description
            }
          </p>
          <div className="product-price">
            ₹{parseFloat(product.price).toFixed(2)}
          </div>
        </div>
      </Link>
      
      <button 
        className={`add-to-cart-btn ${isAdding ? 'adding' : ''}`}
        onClick={handleAddToCart}
        disabled={isAdding}
      >
        {isAdding ? '✓ Added!' : 'Add to Cart'}
      </button>
    </div>
  );
};

export default ProductCard;