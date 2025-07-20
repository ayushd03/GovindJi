import React from 'react';
import { useProductImage } from '../hooks/useProductImage';

const ProductImagePreview = ({ productId, fallbackImageUrl = null, className = '' }) => {
  const { primaryImage, loading } = useProductImage(productId, fallbackImageUrl);

  if (loading) {
    return (
      <div className={`image-preview-skeleton ${className}`}>
        <div className="skeleton-shimmer"></div>
      </div>
    );
  }

  if (!primaryImage) {
    return (
      <div className={`no-image ${className}`}>
        📦
      </div>
    );
  }

  return (
    <img 
      src={primaryImage} 
      alt="Product preview"
      className={`product-preview-image ${className}`}
      onError={(e) => {
        if (e.target) {
          e.target.style.display = 'none';
          if (e.target.nextElementSibling) {
            e.target.nextElementSibling.style.display = 'flex';
          }
        }
      }}
      style={{ display: 'block' }}
    />
  );
};

export default ProductImagePreview;