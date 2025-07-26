import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getImageUrl, handleImageError, validateImageUrl } from '../utils/imageUtils';

/**
 * SmartImage Component
 * Handles image loading with fallbacks, loading states, and error handling
 */
const SmartImage = ({
  src,
  alt = '',
  className = '',
  type = 'product', // 'product' or 'category'
  fallbackSrc = null,
  showLoader = true,
  loadingComponent = null,
  errorComponent = null,
  onLoad = null,
  onError = null,
  style = {},
  ...props
}) => {
  const [imageState, setImageState] = useState('loading'); // 'loading', 'loaded', 'error'
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      setImageState('loading');
      
      // Get the processed image URL
      const processedSrc = getImageUrl(src || fallbackSrc, type);
      
      // Validate the image URL
      const isValid = await validateImageUrl(processedSrc);
      
      if (isValid) {
        setImageSrc(processedSrc);
        setImageState('loaded');
      } else {
        // Try fallback if provided
        if (fallbackSrc && fallbackSrc !== src) {
          const fallbackProcessed = getImageUrl(fallbackSrc, type);
          const isFallbackValid = await validateImageUrl(fallbackProcessed);
          
          if (isFallbackValid) {
            setImageSrc(fallbackProcessed);
            setImageState('loaded');
          } else {
            setImageState('error');
          }
        } else {
          setImageState('error');
        }
      }
    };

    loadImage();
  }, [src, fallbackSrc, type]);

  const handleImageLoad = () => {
    setImageState('loaded');
    if (onLoad) onLoad();
  };

  const handleImageError = (e) => {
    setImageState('error');
    handleImageError(e, type);
    if (onError) onError(e);
  };

  // Loading component
  if (imageState === 'loading' && showLoader) {
    if (loadingComponent) {
      return loadingComponent;
    }
    
    return (
      <motion.div
        className={`image-loader ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          ...style
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="loading-spinner"
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    );
  }

  // Error component
  if (imageState === 'error') {
    if (errorComponent) {
      return errorComponent;
    }
    
    return (
      <motion.div
        className={`image-error ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          color: '#6b7280',
          fontSize: '14px',
          border: '1px dashed #d1d5db',
          ...style
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>
            {type === 'category' ? '🏷️' : '📦'}
          </div>
          <div>Image not available</div>
        </div>
      </motion.div>
    );
  }

  // Loaded image
  return (
    <motion.img
      src={imageSrc}
      alt={alt}
      className={className}
      style={style}
      onLoad={handleImageLoad}
      onError={handleImageError}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      {...props}
    />
  );
};

export default SmartImage;