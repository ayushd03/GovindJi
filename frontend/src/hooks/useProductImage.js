import { useState, useEffect } from 'react';

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
        const response = await fetch(`/api/products/${productId}/images`);
        const images = await response.json();
        
        if (images && images.length > 0) {
          // Find primary image or use first image
          const primary = images.find(img => img.is_primary) || images[0];
          setPrimaryImage(primary.image_url);
        } else if (fallbackImageUrl) {
          setPrimaryImage(fallbackImageUrl);
        } else {
          setPrimaryImage(null);
        }
      } catch (error) {
        console.error('Error fetching product image:', error);
        setPrimaryImage(fallbackImageUrl);
      } finally {
        setLoading(false);
      }
    };

    fetchPrimaryImage();
  }, [productId, fallbackImageUrl]);

  return { primaryImage, loading };
};

export default useProductImage;