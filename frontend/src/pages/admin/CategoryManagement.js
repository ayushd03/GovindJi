import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ImageUploadManager from '../../components/ImageUploadManager';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const CategoryManagement = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'images'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0,
    gradient_colors: 'from-gray-400 to-gray-600',
    is_active: true
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [urlImages, setUrlImages] = useState([]);
  const [imageProcessingSettings, setImageProcessingSettings] = useState({});
  const [uploading, setUploading] = useState(false);

  const gradientOptions = [
    { value: 'from-amber-400 to-orange-500', label: 'Amber to Orange', preview: 'bg-gradient-to-r from-amber-400 to-orange-500' },
    { value: 'from-red-400 to-pink-500', label: 'Red to Pink', preview: 'bg-gradient-to-r from-red-400 to-pink-500' },
    { value: 'from-green-400 to-emerald-500', label: 'Green to Emerald', preview: 'bg-gradient-to-r from-green-400 to-emerald-500' },
    { value: 'from-yellow-400 to-amber-500', label: 'Yellow to Amber', preview: 'bg-gradient-to-r from-yellow-400 to-amber-500' },
    { value: 'from-purple-400 to-indigo-500', label: 'Purple to Indigo', preview: 'bg-gradient-to-r from-purple-400 to-indigo-500' },
    { value: 'from-blue-400 to-cyan-500', label: 'Blue to Cyan', preview: 'bg-gradient-to-r from-blue-400 to-cyan-500' },
    { value: 'from-pink-400 to-rose-500', label: 'Pink to Rose', preview: 'bg-gradient-to-r from-pink-400 to-rose-500' },
    { value: 'from-gray-400 to-gray-600', label: 'Gray', preview: 'bg-gradient-to-r from-gray-400 to-gray-600' }
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch categories');
      
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, category = null) => {
    setModalType(type);
    setSelectedCategory(category);
    
    if (type === 'edit' && category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        display_order: category.display_order || 0,
        gradient_colors: category.gradient_colors || 'from-gray-400 to-gray-600',
        is_active: category.is_active !== false
      });
    } else if (type === 'create') {
      setFormData({
        name: '',
        description: '',
        display_order: categories.length,
        gradient_colors: 'from-gray-400 to-gray-600',
        is_active: true
      });
    }
    
    setShowModal(true);
    setImageFiles([]);
    setUrlImages([]);
    setImageProcessingSettings({});
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCategory(null);
    setFormData({
      name: '',
      description: '',
      display_order: 0,
      gradient_colors: 'from-gray-400 to-gray-600',
      is_active: true
    });
    setImageFiles([]);
    setUrlImages([]);
    setImageProcessingSettings({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const url = modalType === 'edit' 
        ? `${API_BASE_URL}/api/admin/categories/${selectedCategory.id}`
        : `${API_BASE_URL}/api/admin/categories`;
      
      const method = modalType === 'edit' ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to save category');
      
      const savedCategory = await response.json();
      
      // Upload images if any
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const imageFormData = new FormData();
          imageFormData.append('image', file);
          imageFormData.append('alt_text', `${savedCategory.name} category image`);
          imageFormData.append('is_primary', i === 0 ? 'true' : 'false');
          
          // Add processing settings
          if (Object.keys(imageProcessingSettings).length > 0) {
            imageFormData.append('processing_settings', JSON.stringify(imageProcessingSettings));
          }
          
          await fetch(`${API_BASE_URL}/api/admin/categories/${savedCategory.id}/images`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: imageFormData
          });
        }
      }
      
      // Add URL images if any
      if (urlImages.length > 0) {
        for (let i = 0; i < urlImages.length; i++) {
          const urlImage = urlImages[i];
          await fetch(`${API_BASE_URL}/api/admin/categories/${savedCategory.id}/images/url`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image_url: urlImage.url,
              alt_text: urlImage.altText || `${savedCategory.name} category image`,
              is_primary: urlImage.isPrimary || (imageFiles.length === 0 && i === 0),
              processing_settings: urlImage.settings || imageProcessingSettings
            })
          });
        }
      }
      
      await fetchCategories();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }
      
      await fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleStatus = async (category) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/categories/${category.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: !category.is_active
        })
      });
      
      if (!response.ok) throw new Error('Failed to update category status');
      
      await fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImageDelete = async (categoryId, imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/categories/${categoryId}/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete image');
      
      await fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-lg text-gray-600">Loading categories...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
            <p className="mt-1 text-gray-500">Manage product categories with images and ordering</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => openModal('create')}
              className="inline-flex items-center px-4 py-2 border border-transparent 
                       text-sm font-medium rounded-lg text-white bg-blue-600 
                       hover:bg-blue-700 focus:outline-none focus:ring-2 
                       focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Category
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XMarkIcon className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Category Header with Gradient */}
            <div 
              className={`h-32 bg-gradient-to-r ${category.gradient_colors} relative`}
              style={category.primary_image ? {
                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.5)), url('${category.primary_image}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-white font-bold text-xl text-center drop-shadow-lg">
                  {category.name}
                </h3>
              </div>
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  category.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {category.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Category Info */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {category.description || 'No description available'}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>Order: {category.display_order}</span>
                <span>{category.category_images?.length || 0} images</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => openModal('edit', category)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit category"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => openModal('images', category)}
                    className="text-purple-600 hover:text-purple-800"
                    title="Manage images"
                  >
                    <PhotoIcon className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => toggleStatus(category)}
                    className={`${category.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}`}
                    title={category.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {category.is_active ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete category"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {modalType === 'create' && 'Create New Category'}
                  {modalType === 'edit' && 'Edit Category'}
                  {modalType === 'images' && `Manage Images - ${selectedCategory?.name}`}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              {modalType !== 'images' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter category name"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter category description"
                    />
                  </div>

                  {/* Display Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>

                  {/* Gradient Colors */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Color
                    </label>
                    <select
                      value={formData.gradient_colors}
                      onChange={(e) => setFormData({ ...formData, gradient_colors: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {gradientOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                      Active (visible to customers)
                    </label>
                  </div>

                  {/* Images Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category Images
                    </label>
                    <ImageUploadManager
                      onFilesSelected={(files, settings) => {
                        setImageFiles(files);
                        setImageProcessingSettings(settings);
                      }}
                      onUrlSubmit={(urlData) => {
                        setUrlImages(prev => [...prev, urlData]);
                      }}
                      multiple={true}
                      maxFiles={5}
                      showAdvancedSettings={true}
                      defaultSettings={{
                        compression: {
                          enabled: true,
                          quality: 90,
                          maxWidth: 1200,
                          maxHeight: 800
                        },
                        format: {
                          outputFormat: 'webp'
                        }
                      }}
                    />
                    {imageFiles.length > 0 && (
                      <p className="text-xs text-blue-600 mt-2">
                        First image will be set as primary display image.
                      </p>
                    )}
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploading ? 'Saving...' : (modalType === 'edit' ? 'Update' : 'Create')}
                    </button>
                  </div>
                </form>
              ) : (
                // Image Management View
                <div className="space-y-4">
                  {selectedCategory?.category_images?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedCategory.category_images.map((image) => (
                        <div key={image.id} className="relative">
                          <img
                            src={image.image_url}
                            alt={image.alt_text}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          {image.is_primary && (
                            <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                              Primary
                            </span>
                          )}
                          <button
                            onClick={() => handleImageDelete(selectedCategory.id, image.id)}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No images uploaded for this category.</p>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;