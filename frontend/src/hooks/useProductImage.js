import { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { getPrimaryImageUrl, getImageUrl } from '../utils/imageUtils';

export const useProductImage = (productId, fallbackImageUrl = null) => {
  const [primaryImage, setPrimaryImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const fetchPrimaryImage = async () => {
      setLoading(true);
      try {
        const response = await productsAPI.getImages(productId);
        const images = response.data;
        
        if (Array.isArray(images) && images.length > 0) {
          // Use utility function to get primary image URL
          const primaryImageUrl = getPrimaryImageUrl(images, fallbackImageUrl, 'product');
          setPrimaryImage(primaryImageUrl);
        } else {
          // Use fallback or null if no fallback
          const fallbackUrl = getImageUrl(fallbackImageUrl, 'product');
          setPrimaryImage(fallbackUrl);
        }
      } catch (error) {
        console.error('Error fetching product image:', error);
        const fallbackUrl = getImageUrl(fallbackImageUrl, 'product');
        setPrimaryImage(fallbackUrl);
      } finally {
        setLoading(false);
      }
    };

    fetchPrimaryImage();
  }, [productId, fallbackImageUrl]);

  return { primaryImage, loading };
};

export default useProductImage;