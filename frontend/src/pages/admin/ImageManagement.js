import React, { useState, useEffect } from 'react';
import ImageGalleryManager from '../../components/ImageGalleryManager';
import ProductImagePreview from '../../components/ProductImagePreview';
import {
  PhotoIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  TagIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ImageManagement = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // all, no-images, few-images

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, filterStatus]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply status filter
    switch (filterStatus) {
      case 'no-images':
        filtered = filtered.filter(product => !product.image_url);
        break;
      case 'few-images':
        // This would need backend support to check actual image count
        // For now, we'll filter based on missing image_url
        filtered = filtered.filter(product => product.image_url);
        break;
      default:
        // Show all products
        break;
    }

    setFilteredProducts(filtered);
  };

  const handleOpenImageGallery = (product) => {
    setSelectedProduct(product);
    setShowImageGallery(true);
  };

  const handleCloseImageGallery = () => {
    setShowImageGallery(false);
    setSelectedProduct(null);
  };

  const handleImagesUpdate = () => {
    fetchProducts();
  };

  const getImageStatus = (product) => {
    if (!product.image_url) {
      return { status: 'none', color: 'red', text: 'No Images' };
    }
    // In a real implementation, you'd check the actual image count from the backend
    return { status: 'has-images', color: 'green', text: 'Has Images' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading products...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🖼️ Image Management</h1>
            <p className="mt-1 text-gray-500">
              Manage product images across your entire catalog
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{products.length}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg 
                         focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Filter by image status */}
          <div className="sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg 
                       focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Products</option>
              <option value="no-images">No Images</option>
              <option value="few-images">Has Images</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Products with Images</p>
              <p className="text-2xl font-bold text-green-600">
                {products.filter(p => p.image_url).length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-100">
              <PhotoIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Products without Images</p>
              <p className="text-2xl font-bold text-red-600">
                {products.filter(p => !p.image_url).length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-100">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {products.length > 0 
                  ? Math.round((products.filter(p => p.image_url).length / products.length) * 100)
                  : 0}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100">
              <CubeIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Product Catalog</h2>
          <p className="text-sm text-gray-500">
            Click "Manage Images" to add or organize product photos
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">No products found</p>
            <p className="text-gray-400 text-sm">
              {searchTerm ? 'Try adjusting your search terms' : 'No products match your filter criteria'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredProducts.map((product) => {
              const imageStatus = getImageStatus(product);
              return (
                <div
                  key={product.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                >
                  {/* Product Image */}
                  <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden mb-4">
                    <ProductImagePreview 
                      productId={product.id} 
                      fallbackImageUrl={product.image_url} 
                    />
                  </div>

                  {/* Product Info */}
                  <div className="space-y-2 mb-4">
                    <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900">₹{product.price}</span>
                      <span className="text-sm text-gray-500">{product.sku || 'No SKU'}</span>
                    </div>
                  </div>

                  {/* Image Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      imageStatus.color === 'red' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {imageStatus.text}
                    </span>
                    {product.category_name && (
                      <span className="inline-flex items-center text-xs text-gray-500">
                        <TagIcon className="w-3 h-3 mr-1" />
                        {product.category_name}
                      </span>
                    )}
                  </div>

                  {/* Manage Images Button */}
                  <button
                    onClick={() => handleOpenImageGallery(product)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 
                             text-sm font-medium rounded-lg text-blue-700 bg-blue-50 
                             hover:bg-blue-100 hover:border-blue-400 focus:outline-none focus:ring-2 
                             focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                  >
                    <PhotoIcon className="w-4 h-4 mr-2" />
                    Manage Images
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Gallery Manager Modal */}
      <ImageGalleryManager
        productId={selectedProduct?.id}
        isOpen={showImageGallery}
        onClose={handleCloseImageGallery}
        onImagesUpdate={handleImagesUpdate}
      />
    </div>
  );
};

export default ImageManagement;