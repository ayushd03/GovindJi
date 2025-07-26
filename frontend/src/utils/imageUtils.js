/**
 * Image utility functions for handling product and category images
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Get the correct image URL for display
 * @param {string} imageUrl - The image URL from the database
 * @param {string} type - Type of image ('product' or 'category')
 * @returns {string|null} - Processed image URL or null if no valid image
 */
export const getImageUrl = (imageUrl, type = 'product') => {
  if (!imageUrl) {
    return null;
  }

  // If it's already a full URL (cloud storage), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's a relative path for local storage, prepend the API base URL
  if (imageUrl.startsWith('/') || imageUrl.startsWith('uploads/')) {
    const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    return `${API_BASE_URL}/${cleanPath}`;
  }

  // If it's a relative path without leading slash, treat as local storage
  return `${API_BASE_URL}/${imageUrl}`;
};

/**
 * Get the appropriate placeholder image
 * @param {string} type - Type of image ('product', 'category', or 'general')
 * @returns {string} - Placeholder image path
 */
export const getPlaceholderImage = (type = 'product') => {
  switch (type) {
    case 'category':
      return '/placeholder-image.png';
    case 'product':
    default:
      return '/placeholder-product.jpg';
  }
};

/**
 * Handle image load error by hiding the image
 * @param {Event} event - The error event
 * @param {string} type - Type of image ('product' or 'category')
 */
export const handleImageError = (event, type = 'product') => {
  const img = event.target;
  
  if (img) {
    // Hide the broken image
    img.style.display = 'none';
    
    // If there's a parent container, we can add a class to style it appropriately
    if (img.parentElement) {
      img.parentElement.classList.add('image-error');
    }
  }
};

/**
 * Get primary image from an array of images
 * @param {Array} images - Array of image objects
 * @param {string} fallbackUrl - Fallback URL if no images found
 * @param {string} type - Type of image for placeholder
 * @returns {string|null} - Primary image URL or null if no valid image
 */
export const getPrimaryImageUrl = (images, fallbackUrl = null, type = 'product') => {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return getImageUrl(fallbackUrl, type);
  }

  // Sort by primary flag and sort_order
  const sortedImages = images.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const primaryImage = sortedImages[0];
  return getImageUrl(primaryImage.image_url, type);
};

/**
 * Validate if an image URL is accessible
 * @param {string} url - Image URL to validate
 * @returns {Promise<boolean>} - Whether the image is accessible
 */
export const validateImageUrl = (url) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

/**
 * Preload multiple images
 * @param {Array<string>} urls - Array of image URLs to preload
 * @returns {Promise<Array<string>>} - Array of successfully loaded URLs
 */
export const preloadImages = async (urls) => {
  if (!urls || !Array.isArray(urls)) return [];

  const loadPromises = urls.map(async (url) => {
    const isValid = await validateImageUrl(url);
    return isValid ? url : null;
  });

  const results = await Promise.all(loadPromises);
  return results.filter(Boolean);
};

/**
 * Get optimized image URL with size parameters (if supported by storage service)
 * @param {string} imageUrl - Original image URL
 * @param {Object} options - Size options { width, height, quality }
 * @returns {string} - Optimized image URL
 */
export const getOptimizedImageUrl = (imageUrl, options = {}) => {
  const processedUrl = getImageUrl(imageUrl);
  
  // If it's a placeholder, return as-is
  if (processedUrl.includes('placeholder')) {
    return processedUrl;
  }

  // For cloud storage URLs, we could add optimization parameters
  // This would depend on the cloud storage service being used
  const { width, height, quality } = options;
  
  if (width || height || quality) {
    // This is a placeholder for future optimization implementation
    // Different cloud providers have different URL structures for optimization
    console.log('Image optimization parameters:', { width, height, quality });
  }

  return processedUrl;
};

export default {
  getImageUrl,
  getPlaceholderImage,
  handleImageError,
  getPrimaryImageUrl,
  validateImageUrl,
  preloadImages,
  getOptimizedImageUrl
};