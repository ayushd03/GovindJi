import React from 'react';
import { useProductImage } from '../hooks/useProductImage';
import { handleImageError } from '../utils/imageUtils';

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
      <div className={`no-image ${className} bg-gray-100 flex items-center justify-center`}>
        <div className="text-gray-400 text-center">
          <div className="text-2xl mb-1">📦</div>
          <div className="text-xs">No image</div>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={primaryImage} 
      alt="Product preview"
      className={`product-preview-image ${className}`}
      onError={(e) => handleImageError(e, 'product')}
      style={{ display: 'block' }}
    />
  );
};

export default ProductImagePreview;