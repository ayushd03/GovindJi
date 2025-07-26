import { useState, useEffect } from 'react';
import { getPrimaryImageUrl, getImageUrl } from '../utils/imageUtils';

export const useCategoryImage = (category, fallbackImageUrl = null) => {
  const [primaryImage, setPrimaryImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) {
      setLoading(false);
      return;
    }

    const processCategoryImage = () => {
      setLoading(true);
      try {
        let imageUrl = null;

        // Check for category images array
        if (category.category_images && Array.isArray(category.category_images) && category.category_images.length > 0) {
          imageUrl = getPrimaryImageUrl(category.category_images, fallbackImageUrl, 'category');
        }
        // Check for primary_image field
        else if (category.primary_image) {
          imageUrl = getImageUrl(category.primary_image, 'category');
        }
        // Check for image_url field (if categories have direct image_url)
        else if (category.image_url) {
          imageUrl = getImageUrl(category.image_url, 'category');
        }
        // Use fallback
        else if (fallbackImageUrl) {
          imageUrl = getImageUrl(fallbackImageUrl, 'category');
        }

        setPrimaryImage(imageUrl);
      } catch (error) {
        console.error('Error processing category image:', error);
        const fallbackUrl = getImageUrl(fallbackImageUrl, 'category');
        setPrimaryImage(fallbackUrl);
      } finally {
        setLoading(false);
      }
    };

    processCategoryImage();
  }, [category, fallbackImageUrl]);

  return { primaryImage, loading };
};

export default useCategoryImage;