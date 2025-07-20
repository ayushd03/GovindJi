import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../hooks/useProductImage';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { primaryImage, loading: imageLoading } = useProductImage(product.id, product.image_url);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
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
        className="add-to-cart-btn"
        onClick={handleAddToCart}
      >
        Add to Cart
      </button>
    </div>
  );
};

export default ProductCard;