import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productsAPI } from '../services/api';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './ProductImageGallery.css';

const ProductImageGallery = ({ productId, fallbackImageUrl = null }) => {
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadImages = async () => {
      if (!productId) {
        setImages([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await productsAPI.getImages(productId);
        const data = response.data;

        if (!isActive) {
          return;
        }

        if (data && data.length > 0) {
          const sortedImages = data
            .sort((a, b) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              return a.sort_order - b.sort_order;
            })
            .map((img) => ({
              ...img,
              image_url: getImageUrl(img.image_url, 'product'),
            }));
          setImages(sortedImages);
        } else if (fallbackImageUrl) {
          setImages([
            {
              id: 'fallback',
              image_url: getImageUrl(fallbackImageUrl, 'product'),
              alt_text: 'Product image',
              is_primary: true,
            },
          ]);
        } else {
          setImages([]);
        }
      } catch (error) {
        console.error('Error fetching images:', error);

        if (!isActive) {
          return;
        }

        if (fallbackImageUrl) {
          setImages([
            {
              id: 'fallback',
              image_url: getImageUrl(fallbackImageUrl, 'product'),
              alt_text: 'Product image',
              is_primary: true,
            },
          ]);
        } else {
          setImages([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadImages();

    return () => {
      isActive = false;
    };
  }, [fallbackImageUrl, productId]);

  useEffect(() => {
    setCurrentImageIndex((current) => (images.length > 0 && current < images.length ? current : 0));
  }, [images.length]);

  const handleThumbnailClick = (index) => {
    setCurrentImageIndex(index);
  };

  const handlePrevious = () => {
    setCurrentImageIndex(currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1);
  };

  const handleNext = () => {
    setCurrentImageIndex(currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1);
  };

  if (loading) {
    return (
      <div className="product-gallery product-gallery--loading">
        <div className="product-gallery__skeleton">
          <div className="product-gallery__skeleton-media"></div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="product-gallery product-gallery--empty">
        <div className="product-gallery__placeholder">
          <div className="product-gallery__placeholder-icon">📦</div>
          <p className="product-gallery__placeholder-copy">No image available</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];
  const hasMultipleImages = images.length > 1;

  return (
    <div className={`product-gallery ${hasMultipleImages ? 'product-gallery--multi' : 'product-gallery--single'}`}>
      <div className="product-gallery__frame">
        <div className="product-gallery__body">
          {hasMultipleImages && (
            <div className="product-gallery__thumbs" aria-label="Product image thumbnails">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  className={`product-gallery__thumb ${index === currentImageIndex ? 'product-gallery__thumb--active' : ''}`}
                  onClick={() => handleThumbnailClick(index)}
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || `Product image ${index + 1}`}
                    onError={(e) => handleImageError(e, 'product')}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="product-gallery__media-wrap">
            <div className="product-gallery__media">
              <img
                src={currentImage.image_url}
                alt={currentImage.alt_text || 'Product image'}
                className="product-gallery__image"
                onError={(e) => handleImageError(e, 'product')}
              />

              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    className="product-gallery__nav product-gallery__nav--prev"
                    onClick={handlePrevious}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="product-gallery__nav product-gallery__nav--next"
                    onClick={handleNext}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <div className="product-gallery__counter">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImageGallery;
