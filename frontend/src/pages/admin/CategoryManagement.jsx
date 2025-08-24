import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import ImageUploadManager from '../../components/ImageUploadManager';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
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
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const imageFormData = new FormData();
          imageFormData.append('image', file);
          imageFormData.append('alt_text', `${savedCategory.name} category image`);
          imageFormData.append('is_primary', i === 0 ? 'true' : 'false');
          if (Object.keys(imageProcessingSettings).length > 0) {
            imageFormData.append('processing_settings', JSON.stringify(imageProcessingSettings));
          }
          await fetch(`${API_BASE_URL}/api/admin/categories/${savedCategory.id}/images`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: imageFormData
          });
        }
      }
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
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
        body: JSON.stringify({ is_active: !category.is_active })
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete image');
      await fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <span className="ml-3 text-lg text-muted-foreground">Loading categories...</span>
    </div>
  );

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_CATEGORIES}>
      <div className="space-y-6">
        <div className="bg-card rounded-xl shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg font-semibold text-foreground">Category Management</h1>
            <button
              onClick={() => openModal('create')}
              className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Category
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center">
              <XMarkIcon className="w-5 h-5 text-destructive mr-3" />
              <span className="text-destructive-foreground">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-destructive hover:text-destructive/80">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div key={category.id} className="bg-card rounded-xl shadow-sm border overflow-hidden">
              <div 
                className={`h-32 bg-gradient-to-r ${category.gradient_colors} relative`}
                style={category.primary_image ? {
                  backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.5)), url('${category.primary_image}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : {}}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="text-white font-bold text-xl text-center drop-shadow-lg">{category.name}</h3>
                </div>
                <div className="absolute top-2 right-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    category.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {category.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{category.description || 'No description available'}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>Order: {category.display_order}</span>
                  <span>{category.category_images?.length || 0} images</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button onClick={() => openModal('edit', category)} className="text-secondary-foreground hover:text-primary" title="Edit category"><PencilIcon className="w-4 h-4" /></button>
                    <button onClick={() => openModal('images', category)} className="text-secondary-foreground hover:text-primary" title="Manage images"><PhotoIcon className="w-4 h-4" /></button>
                    <button onClick={() => toggleStatus(category)} className={`${category.is_active ? 'text-warning' : 'text-success'} hover:opacity-80`} title={category.is_active ? 'Deactivate' : 'Activate'}>
                      {category.is_active ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="text-destructive hover:opacity-80" title="Delete category"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {modalType === 'create' && 'Create New Category'}
                  {modalType === 'edit' && 'Edit Category'}
                  {modalType === 'images' && `Manage Images - ${selectedCategory?.name}`}
                </h2>
                <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><XMarkIcon className="w-6 h-6" /></button>
              </div>
              {modalType !== 'images' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Category Name *</label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="Enter category name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="input-field" placeholder="Enter category description" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Display Order</label>
                    <input type="number" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Background Color</label>
                    <select value={formData.gradient_colors} onChange={(e) => setFormData({ ...formData, gradient_colors: e.target.value })} className="input-field">
                      {gradientOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="h-4 w-4 text-primary border-muted rounded focus:ring-primary" />
                    <label htmlFor="is_active" className="ml-2 text-sm text-muted-foreground">Active (visible to customers)</label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Category Images</label>
                    <ImageUploadManager
                      onFilesSelected={(files, settings) => { setImageFiles(files); setImageProcessingSettings(settings); }}
                      onUrlSubmit={(urlData) => { setUrlImages(prev => [...prev, urlData]); }}
                      multiple={true}
                      maxFiles={5}
                      showAdvancedSettings={true}
                      defaultSettings={{ compression: { enabled: true, quality: 90, maxWidth: 1200, maxHeight: 800 }, format: { outputFormat: 'webp' } }}
                    />
                    {imageFiles.length > 0 && (<p className="text-xs text-primary mt-2">First image will be set as primary display image.</p>)}
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={closeModal} className="btn-outline px-4 py-2">Cancel</button>
                    <button type="submit" disabled={uploading} className="btn-primary px-4 py-2 disabled:opacity-50">
                      {uploading ? 'Saving...' : (modalType === 'edit' ? 'Update' : 'Create')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {selectedCategory?.category_images?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedCategory.category_images.map((image) => (
                        <div key={image.id} className="relative">
                          <img src={image.image_url} alt={image.alt_text} className="w-full h-32 object-cover rounded-lg" />
                          {image.is_primary && (<span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">Primary</span>)}
                          <button onClick={() => handleImageDelete(selectedCategory.id, image.id)} className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/80">
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No images uploaded for this category.</p>
                  )}
                  <div className="flex justify-end">
                    <button onClick={closeModal} className="btn-secondary px-4 py-2">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
};

export default CategoryManagement;
