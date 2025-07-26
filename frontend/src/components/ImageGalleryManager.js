import React, { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './ImageGalleryManager.css';

const ImageGalleryManager = ({ productId, isOpen, onClose, onImagesUpdate }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlForm, setUrlForm] = useState({
    image_url: '',
    alt_text: '',
    is_primary: false
  });

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

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const token = localStorage.getItem('authToken');
    const uploadProgress = { current: 0, total: files.length };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        uploadProgress.current = i + 1;
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('alt_text', file.name.replace(/\.[^/.]+$/, ''));
        formData.append('is_primary', Array.isArray(images) && images.length === 0 && i === 0); // First image is primary

        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}`);
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

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
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
          ...urlForm,
          is_primary: urlForm.is_primary || (Array.isArray(images) && images.length === 0)
        })
      });

      if (response.ok) {
        setUrlForm({ image_url: '', alt_text: '', is_primary: false });
        setShowUrlInput(false);
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

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
    e.target.value = ''; // Reset input
  };

  const handleDragDropUpload = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    handleFileUpload(files);
  };

  if (!isOpen) return null;

  return (
    <div className="image-gallery-modal">
      <div className="image-gallery-content">
        <div className="gallery-header">
          <h2>Manage Product Images</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="upload-section">
          <div className="upload-header">
            <h3>📷 Product Image Management</h3>
            <p>Add multiple high-quality images to showcase your products effectively</p>
          </div>
          
          <div className="upload-stats">
            <div className="stat-item">
              <span className="stat-number">{Array.isArray(images) ? images.length : 0}</span>
              <span className="stat-label">Images Uploaded</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{Array.isArray(images) ? images.filter(img => img.is_primary).length : 0}</span>
              <span className="stat-label">Primary Image</span>
            </div>
          </div>

          <div className="upload-options">
            <div 
              className="upload-dropzone enhanced"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDragDropUpload}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                id="imageUpload"
              />
              <label htmlFor="imageUpload" className="upload-label">
                {uploading ? (
                  <div className="uploading">
                    <div className="upload-spinner"></div>
                    <p>Uploading images...</p>
                    <small>Please wait while we process your images</small>
                  </div>
                ) : (
                  <>
                    <div className="upload-icon">🖼️</div>
                    <p className="upload-title">Upload Product Images</p>
                    <p className="upload-subtitle">Drag & drop multiple images or click to browse</p>
                    <div className="upload-formats">
                      <span className="format-tag">JPG</span>
                      <span className="format-tag">PNG</span>
                      <span className="format-tag">GIF</span>
                      <span className="format-tag">Max 5MB each</span>
                    </div>
                  </>
                )}
              </label>
            </div>

            <div className="upload-actions">
              <button 
                className="url-btn"
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={uploading}
              >
                🔗 {showUrlInput ? 'Cancel URL' : 'Add by URL'}
              </button>
            </div>
          </div>

          {showUrlInput && (
            <form onSubmit={handleUrlSubmit} className="url-form">
              <div className="form-group">
                <input
                  type="url"
                  placeholder="Enter image URL"
                  value={urlForm.image_url}
                  onChange={(e) => setUrlForm({...urlForm, image_url: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Alt text (optional)"
                  value={urlForm.alt_text}
                  onChange={(e) => setUrlForm({...urlForm, alt_text: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={urlForm.is_primary}
                    onChange={(e) => setUrlForm({...urlForm, is_primary: e.target.checked})}
                  />
                  Set as primary image
                </label>
              </div>
              <button type="submit" className="add-url-btn">Add Image</button>
            </form>
          )}
        </div>

        <div className="images-grid">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Loading your product images...</p>
            </div>
          ) : !Array.isArray(images) || images.length === 0 ? (
            <div className="no-images">
              <div className="no-images-icon">🖼️</div>
              <h3>No Product Images Yet</h3>
              <p>Start by uploading high-quality images of your product</p>
              <div className="tips">
                <p><strong>💡 Tips for great product photos:</strong></p>
                <ul>
                  <li>Use good lighting and clear backgrounds</li>
                  <li>Show multiple angles of your product</li>
                  <li>Include close-up details</li>
                  <li>Set the best image as primary</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="image-list">
              <div className="images-header">
                <h3>📦 Product Image Gallery</h3>
                <p className="drag-instruction">
                  💫 Drag and drop to reorder • The first image is your primary display image
                </p>
              </div>
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
                      />
                    ) : (
                      <div className="no-image-placeholder bg-gray-100 flex items-center justify-center">
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
                    <p className="image-type">
                      {image.image_type === 'file' ? '📁 Uploaded' : '🔗 URL'}
                    </p>
                    <p className="sort-order">Position: {index + 1}</p>
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
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="gallery-footer">
          <button className="close-footer-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryManager;