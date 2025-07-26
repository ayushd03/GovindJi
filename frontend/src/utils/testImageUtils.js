/**
 * Test utilities for image handling
 * This file can be used to test image functionality in development
 */

import { getImageUrl, getPlaceholderImage, handleImageError, getPrimaryImageUrl } from './imageUtils';

// Test data
const testImages = [
  {
    id: 1,
    image_url: 'https://example.com/test-image.jpg',
    is_primary: false,
    sort_order: 1
  },
  {
    id: 2,
    image_url: '/uploads/product-images/test-local.jpg',
    is_primary: true,
    sort_order: 0
  },
  {
    id: 3,
    image_url: 'test-relative.jpg',
    is_primary: false,
    sort_order: 2
  }
];

const testCategory = {
  id: 1,
  name: 'Test Category',
  category_images: [
    {
      id: 1,
      image_url: 'https://example.com/category.jpg',
      is_primary: true,
      sort_order: 0
    }
  ]
};

// Test functions
export const testImageUtils = () => {
  console.log('Testing Image Utils...');
  
  // Test getImageUrl
  console.log('Test getImageUrl:');
  console.log('Cloud URL:', getImageUrl('https://example.com/test.jpg', 'product'));
  console.log('Local URL:', getImageUrl('/uploads/test.jpg', 'product'));
  console.log('Relative URL:', getImageUrl('test.jpg', 'product'));
  console.log('Null URL:', getImageUrl(null, 'product'));
  
  // Test getPlaceholderImage
  console.log('\nTest getPlaceholderImage:');
  console.log('Product placeholder:', getPlaceholderImage('product'));
  console.log('Category placeholder:', getPlaceholderImage('category'));
  console.log('Default placeholder:', getPlaceholderImage());
  
  // Test getPrimaryImageUrl
  console.log('\nTest getPrimaryImageUrl:');
  console.log('Primary from images:', getPrimaryImageUrl(testImages));
  console.log('With fallback:', getPrimaryImageUrl([], '/fallback.jpg'));
  console.log('Empty array:', getPrimaryImageUrl([]));
  
  console.log('Image Utils tests completed!');
};

// Component for testing image error handling
export const TestImageComponent = () => {
  const testUrls = [
    'https://via.placeholder.com/150/0000FF/808080?text=Valid',
    'https://invalid-url-that-should-fail.jpg',
    '/placeholder-product.jpg'
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h3>Image Error Handling Test</h3>
      {testUrls.map((url, index) => (
        <div key={index} style={{ margin: '10px 0' }}>
          <p>Testing: {url}</p>
          <img
            src={getImageUrl(url, 'product')}
            alt={`Test ${index + 1}`}
            style={{ width: '150px', height: '150px', objectFit: 'cover' }}
            onError={(e) => handleImageError(e, 'product')}
          />
        </div>
      ))}
    </div>
  );
};

export default {
  testImageUtils,
  TestImageComponent
};