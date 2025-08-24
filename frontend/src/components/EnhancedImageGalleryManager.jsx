import React, { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import ImageUploadManager from './ImageUploadManager';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import './EnhancedImageGalleryManager.css';

const EnhancedImageGalleryManager = ({ productId, isOpen, onClose, onImagesUpdate }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    if (isOpen && productId) {
      fetchImages();
    }
  }, [isOpen, productId]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await productsAPI.getImages(productId);
      const data = response.data;
      setImages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilesSelected = async (files, settings) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const token = localStorage.getItem('authToken');

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('alt_text', file.name);
        formData.append('is_primary', Array.isArray(images) && images.length === 0); // First image is primary
        
        // Add processing settings
        if (settings && Object.keys(settings).length > 0) {
          formData.append('processing_settings', JSON.stringify(settings));
        }

        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }
      }

      await fetchImages();
      onImagesUpdate && onImagesUpdate();
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error uploading images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (urlData) => {
    const token = localStorage.getItem('authToken');

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: urlData.url,
          alt_text: urlData.altText || 'Product image',
          is_primary: urlData.isPrimary || (Array.isArray(images) && images.length === 0),
          processing_settings: urlData.settings
        })
      });

      if (response.ok) {
        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      }
    } catch (error) {
      console.error('Error adding URL image:', error);
    }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    const token = localStorage.getItem('authToken');
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const handleSetPrimary = async (imageId) => {
    const token = localStorage.getItem('authToken');
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/${imageId}/primary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      }
    } catch (error) {
      console.error('Error setting primary image:', error);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === dropIndex) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedItem];
    
    // Remove dragged item
    newImages.splice(draggedItem, 1);
    
    // Insert at new position
    newImages.splice(dropIndex, 0, draggedImage);
    
    // Update sort orders
    const imageOrders = newImages.map((img, index) => ({
      id: img.id,
      sort_order: index
    }));

    setImages(newImages);
    setDraggedItem(null);

    // Update backend
    const token = localStorage.getItem('authToken');
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/reorder`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageOrders })
      });
      
      onImagesUpdate && onImagesUpdate();
    } catch (error) {
      console.error('Error reordering images:', error);
      // Revert on error
      await fetchImages();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="enhanced-image-gallery-modal">
      <div className="enhanced-image-gallery-content">
        <div className="gallery-header">
          <h2 className="text-xl font-bold text-gray-900">Manage Product Images</h2>
          <button 
            className="close-btn p-2 text-gray-400 hover:text-gray-600 rounded-md" 
            onClick={onClose}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="upload-section">
          <ImageUploadManager
            onFilesSelected={handleFilesSelected}
            onUrlSubmit={handleUrlSubmit}
            multiple={true}
            maxFiles={10}
            showAdvancedSettings={true}
            defaultSettings={{
              compression: {
                enabled: true,
                quality: 85,
                maxWidth: 1920,
                maxHeight: 1080
              },
              format: {
                outputFormat: 'webp'
              },
              optimization: {
                removeMetadata: true,
                progressive: true,
                autoOrient: true
              }
            }}
          />
          
          {uploading && (
            <div className="uploading-indicator">
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Processing and uploading images...</span>
              </div>
            </div>
          )}
        </div>

        <div className="images-grid">
          {loading ? (
            <div className="loading flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading images...</span>
            </div>
          ) : !Array.isArray(images) || images.length === 0 ? (
            <div className="no-images text-center p-8">
              <div className="text-gray-400 text-6xl mb-4">📸</div>
              <p className="text-gray-500 text-lg mb-2">No images uploaded yet.</p>
              <p className="text-gray-400 text-sm">Upload your first image to get started!</p>
            </div>
          ) : (
            <div className="image-list">
              <p className="drag-instruction text-sm text-gray-600 mb-4">
                💡 Drag and drop images to reorder them
              </p>
              <div className="images-grid-container">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`image-item ${image.is_primary ? 'primary' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="image-preview">
                      {image.image_url ? (
                        <img 
                          src={getImageUrl(image.image_url, 'product')} 
                          alt={image.alt_text || 'Product image'}
                          onError={(e) => handleImageError(e, 'product')}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="no-image-placeholder bg-gray-100 flex items-center justify-center w-full h-full">
                          <div className="text-gray-400 text-center">
                            <div className="text-2xl mb-1">📦</div>
                            <div className="text-xs">No image</div>
                          </div>
                        </div>
                      )}
                      {image.is_primary && (
                        <div className="primary-badge">Primary</div>
                      )}
                    </div>
                    
                    <div className="image-info">
                      <p className="image-type text-xs text-gray-600">
                        {image.image_type === 'file' ? '📁 Uploaded' : '🔗 URL'}
                      </p>
                      <p className="sort-order text-xs text-gray-500">Position: {index + 1}</p>
                    </div>

                    <div className="image-actions">
                      {!image.is_primary && (
                        <button 
                          className="primary-btn"
                          onClick={() => handleSetPrimary(image.id)}
                          title="Set as primary image"
                        >
                          ⭐ Set Primary
                        </button>
                      )}
                      <button 
                        className="delete-btn"
                        onClick={() => handleDelete(image.id)}
                        title="Delete image"
                      >
                        <TrashIcon className="w-4 h-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="gallery-footer">
          <button 
            className="close-footer-btn px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedImageGalleryManager;