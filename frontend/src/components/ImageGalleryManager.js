import React, { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
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

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('alt_text', file.name);
        formData.append('is_primary', Array.isArray(images) && images.length === 0); // First image is primary

        const response = await fetch(`/api/admin/products/${productId}/images/upload`, {
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

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`/api/admin/products/${productId}/images/url`, {
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
      const response = await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
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
      const response = await fetch(`/api/admin/products/${productId}/images/${imageId}/primary`, {
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
      await fetch(`/api/admin/products/${productId}/images/reorder`, {
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
          <div className="upload-options">
            <div 
              className="upload-dropzone"
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
                  <div className="uploading">Uploading...</div>
                ) : (
                  <>
                    <div className="upload-icon">📸</div>
                    <p>Click to upload or drag & drop images here</p>
                    <small>Supports: JPG, PNG, GIF (Max 5MB each)</small>
                  </>
                )}
              </label>
            </div>

            <button 
              className="url-btn"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              {showUrlInput ? 'Cancel' : 'Add by URL'}
            </button>
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
            <div className="loading">Loading images...</div>
          ) : !Array.isArray(images) || images.length === 0 ? (
            <div className="no-images">
              <p>No images uploaded yet.</p>
              <p>Upload your first image to get started!</p>
            </div>
          ) : (
            <div className="image-list">
              <p className="drag-instruction">
                Drag and drop images to reorder them
              </p>
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
                    <img 
                      src={image.image_url} 
                      alt={image.alt_text || 'Product image'}
                      onError={(e) => {
                        if (e.target && e.target.src !== '/placeholder-product.jpg') {
                          e.target.src = '/placeholder-product.jpg';
                        }
                      }}
                    />
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