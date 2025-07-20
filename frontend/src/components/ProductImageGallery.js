import React, { useState, useEffect, useRef } from 'react';
import { productsAPI } from '../services/api';
import './ProductImageGallery.css';

const ProductImageGallery = ({ productId, fallbackImageUrl = null }) => {
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (productId) {
      fetchImages();
    }
  }, [productId]);

  useEffect(() => {
    // Start automatic slideshow if there are multiple images
    if (images.length > 1 && !isHovered) {
      startSlideshow();
    } else {
      stopSlideshow();
    }

    return () => stopSlideshow();
  }, [images.length, isHovered]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await productsAPI.getImages(productId);
      const data = response.data;
      
      if (data && data.length > 0) {
        // Sort by sort_order and prioritize primary image
        const sortedImages = data.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.sort_order - b.sort_order;
        });
        setImages(sortedImages);
      } else if (fallbackImageUrl) {
        // Use fallback image if no images found
        setImages([{ 
          id: 'fallback', 
          image_url: fallbackImageUrl, 
          alt_text: 'Product image',
          is_primary: true 
        }]);
      } else {
        setImages([]);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      if (fallbackImageUrl) {
        setImages([{ 
          id: 'fallback', 
          image_url: fallbackImageUrl, 
          alt_text: 'Product image',
          is_primary: true 
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const startSlideshow = () => {
    stopSlideshow(); // Clear any existing interval
    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === images.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000); // 3 seconds transition
  };

  const stopSlideshow = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

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
      <div className="product-image-gallery loading">
        <div className="gallery-skeleton">
          <div className="main-image-skeleton"></div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="product-image-gallery no-images">
        <div className="no-image-placeholder">
          <span>📦</span>
          <p>No image available</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];

  return (
    <div className="product-image-gallery">
      <div 
        className="main-image-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="main-image-wrapper">
          <img
            src={currentImage.image_url}
            alt={currentImage.alt_text || 'Product image'}
            className="main-image"
            onError={(e) => {
              e.target.src = '/placeholder-image.png';
            }}
          />
          
          {/* Overlay indicators */}
          <div className="image-overlay">
            {images.length > 1 && (
              <>
                <button 
                  className="nav-button prev-button"
                  onClick={handlePrevious}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button 
                  className="nav-button next-button"
                  onClick={handleNext}
                  aria-label="Next image"
                >
                  ›
                </button>
                
                <div className="image-counter">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}
            
            {isHovered && images.length > 1 && (
              <div className="pause-indicator">
                ⏸️ Paused
              </div>
            )}
          </div>

          {/* Image transition indicator */}
          {images.length > 1 && !isHovered && (
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{
                  animationDuration: '3s',
                  animationPlayState: isHovered ? 'paused' : 'running'
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Thumbnail navigation for multiple images */}
        {images.length > 1 && (
          <div className="thumbnails-container">
            <div className="thumbnails-scroll">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                  onClick={() => handleThumbnailClick(index)}
                  onMouseEnter={() => setCurrentImageIndex(index)}
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || `Product image ${index + 1}`}
                    onError={(e) => {
                      e.target.src = '/placeholder-image.png';
                    }}
                  />
                  {image.is_primary && (
                    <div className="primary-badge">★</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image metadata */}
      {currentImage.alt_text && (
        <div className="image-info">
          <p className="image-description">{currentImage.alt_text}</p>
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;