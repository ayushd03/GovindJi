import React, { useState, useEffect } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import EnhancedImageGalleryManager from '../../components/EnhancedImageGalleryManager';
import ProductImagePreview from '../../components/ProductImagePreview';
import UnitSelectionDialog from '../../components/UnitSelectionDialog';
import { Dialog, Transition, Tab } from '@headlessui/react';
import {
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CubeIcon,
  Cog6ToothIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';
import { categoriesAPI } from '../../services/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnitSelectionDialog, setShowUnitSelectionDialog] = useState(false);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category_id: '',
    stock_quantity: '',
    min_stock_level: '',
    sku: '',
    weight: '',
    unit: 'kg',
    // New fields for enhanced product management
    item_hsn: '',
    is_service: false,
    base_unit: 'KILOGRAMS',
    secondary_unit: 'GRAMS',
    unit_conversion_value: 1000,
    sale_price_without_tax: false,
    discount_on_sale_price: '',
    discount_type: 'percentage',
    wholesale_prices: [],
    opening_quantity_at_price: '',
    opening_quantity_as_of_date: '',
    stock_location: ''
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

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

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll();
      const data = response.data;
      const activeCategories = data.filter(category => category.is_active !== false);
      setCategories(activeCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([
        { id: '1', name: 'Nuts' },
        { id: '2', name: 'Dried Fruits' },
        { id: '3', name: 'Seeds' },
        { id: '4', name: 'Spices' }
      ]);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    
    try {
      const url = editingProduct 
        ? `${API_BASE_URL}/api/admin/products/${editingProduct.id}`
        : `${API_BASE_URL}/api/admin/products`;
      
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchProducts();
        resetForm();
        setShowAddForm(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      image_url: product.image_url || '',
      category_id: product.category_id || '',
      stock_quantity: product.stock_quantity || '',
      min_stock_level: product.min_stock_level || '',
      sku: product.sku || '',
      weight: product.weight || '',
      unit: product.unit || 'kg',
      item_hsn: product.item_hsn || '',
      is_service: product.is_service || false,
      base_unit: product.base_unit || 'KILOGRAMS',
      secondary_unit: product.secondary_unit || 'GRAMS',
      unit_conversion_value: product.unit_conversion_value || 1000,
      sale_price_without_tax: product.sale_price_without_tax || false,
      discount_on_sale_price: product.discount_on_sale_price || '',
      discount_type: product.discount_type || 'percentage',
      wholesale_prices: product.wholesale_prices || [],
      opening_quantity_at_price: product.opening_quantity_at_price || '',
      opening_quantity_as_of_date: product.opening_quantity_as_of_date || '',
      stock_location: product.stock_location || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      image_url: '',
      category_id: '',
      stock_quantity: '',
      min_stock_level: '',
      sku: '',
      weight: '',
      unit: 'kg',
      item_hsn: '',
      is_service: false,
      base_unit: 'KILOGRAMS',
      secondary_unit: 'GRAMS',
      unit_conversion_value: 1000,
      sale_price_without_tax: false,
      discount_on_sale_price: '',
      discount_type: 'percentage',
      wholesale_prices: [],
      opening_quantity_at_price: '',
      opening_quantity_as_of_date: '',
      stock_location: ''
    });
    setSelectedTabIndex(0);
  };

  const handleOpenImageGallery = (product) => {
    setSelectedProductForImages(product);
    setShowImageGallery(true);
  };

  const handleCloseImageGallery = () => {
    setShowImageGallery(false);
    setSelectedProductForImages(null);
  };

  const handleImagesUpdate = () => {
    fetchProducts();
  };

  // Generate unique SKU
  const generateSKU = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const sku = `SKU${timestamp}${random}`;
    setFormData({ ...formData, sku });
  };

  // Handle unit selection save
  const handleUnitSave = (unitData) => {
    setFormData({
      ...formData,
      base_unit: unitData.base_unit,
      secondary_unit: unitData.secondary_unit,
      unit_conversion_value: unitData.unit_conversion_value
    });
  };

  // Add wholesale price tier
  const addWholesalePrice = () => {
    setFormData({
      ...formData,
      wholesale_prices: [...formData.wholesale_prices, { quantity: '', price: '' }]
    });
  };

  // Update wholesale price tier
  const updateWholesalePrice = (index, field, value) => {
    const updated = formData.wholesale_prices.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setFormData({ ...formData, wholesale_prices: updated });
  };

  // Remove wholesale price tier
  const removeWholesalePrice = (index) => {
    const updated = formData.wholesale_prices.filter((_, i) => i !== index);
    setFormData({ ...formData, wholesale_prices: updated });
  };

  // Handle save and new
  const handleSubmitAndNew = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    
    try {
      const url = editingProduct 
        ? `${API_BASE_URL}/api/admin/products/${editingProduct.id}`
        : `${API_BASE_URL}/api/admin/products`;
      
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchProducts();
        resetForm();
        // Keep modal open for new entry
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  // Get unit display text
  const getUnitDisplayText = () => {
    if (formData.base_unit && formData.secondary_unit && formData.unit_conversion_value) {
      return `1 ${formData.base_unit} = ${formData.unit_conversion_value} ${formData.secondary_unit}`;
    }
    return 'Click to configure units';
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.item_hsn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tab configuration
  const tabs = [
    { name: 'Pricing', icon: CalculatorIcon },
    { name: 'Stock', icon: CubeIcon }
  ];

  function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_PRODUCTS}>
      <div className="space-y-6">

      {/* Header & Search */}
      <div className="bg-card rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-lg font-semibold text-foreground">Product Management</h1>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingProduct(null);
              resetForm();
            }}
            className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Product
          </button>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field block w-full pl-10 pr-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading products...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CubeIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg">No products found</p>
            <p className="text-sm">
              {searchTerm ? 'Try adjusting your search' : 'Add your first product to get started!'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Image</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Images</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                          <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">{product.name}</div>
                          <div className="text-sm text-muted-foreground max-w-xs truncate">{product.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{product.sku || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">₹{product.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.stock_quantity <= product.min_stock_level ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                          }`}>
                            {product.stock_quantity || 0} {product.unit || 'kg'}
                          </span>
                          {product.stock_quantity <= product.min_stock_level && (
                            <ExclamationTriangleIcon className="w-4 h-4 text-destructive ml-2" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          {product.is_active ? (
                            <><CheckCircleIcon className="w-3 h-3 mr-1" />Active</>
                          ) : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenImageGallery(product)}
                          className="btn-outline inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                        >
                          <PhotoIcon className="w-4 h-4 mr-1" />
                          Manage
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="btn-secondary inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                        >
                          <PencilIcon className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="btn-destructive inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y">
              {filteredProducts.map((product) => (
                <div key={product.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors duration-200">
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-medium text-foreground leading-tight">{product.name}</h3>
                          {product.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
                        </div>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          {product.is_active ? <><CheckCircleIcon className="w-3 h-3 mr-1" />Active</> : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div><span className="text-muted-foreground">SKU:</span><span className="ml-1 text-foreground">{product.sku || '-'}</span></div>
                        <div><span className="text-muted-foreground">Price:</span><span className="ml-1 font-medium text-foreground">₹{product.price}</span></div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            product.stock_quantity <= product.min_stock_level ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                          }`}>
                            {product.stock_quantity || 0} {product.unit || 'kg'}
                            {product.stock_quantity <= product.min_stock_level && <ExclamationTriangleIcon className="w-3 h-3 ml-1" />}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => handleEdit(product)} className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <PencilIcon className="w-4 h-4 mr-2" />Edit
                        </button>
                        <button onClick={() => handleOpenImageGallery(product)} className="btn-outline inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <PhotoIcon className="w-4 h-4 mr-2" />Images
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="btn-destructive inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <TrashIcon className="w-4 h-4 mr-2" />Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <Transition show={showAddForm} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => { setShowAddForm(false); setEditingProduct(null); resetForm(); }}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
          </Transition.Child>
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-2 sm:p-4 text-center sm:items-center">
              <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all w-full max-w-sm sm:max-w-2xl lg:max-w-5xl sm:my-8 sm:p-6">
                  <div className="absolute right-0 top-0 pr-3 pt-3 sm:pr-4 sm:pt-4">
                    <button type="button" className="rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => { setShowAddForm(false); setEditingProduct(null); resetForm(); }}>
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="w-full">
                    {/* Product/Service Toggle */}
                    <div className="flex items-center justify-between mb-6">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-foreground">
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                      </Dialog.Title>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-muted-foreground">Type:</span>
                        <div className="flex rounded-lg border border-input p-1">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_service: false })}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                              !formData.is_service 
                                ? 'bg-primary text-primary-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Product
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_service: true })}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                              formData.is_service 
                                ? 'bg-primary text-primary-foreground' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Service
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Basic Product Information */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Item Name *</label>
                          <input 
                            type="text" 
                            name="name" 
                            value={formData.name} 
                            onChange={handleInputChange} 
                            required 
                            className="input-field" 
                            placeholder="Enter item name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Item HSN</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              name="item_hsn" 
                              value={formData.item_hsn} 
                              onChange={handleInputChange} 
                              className="input-field pr-10" 
                              placeholder="HSN code"
                            />
                            <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Item Code (SKU)</label>
                          <div className="flex space-x-2">
                            <input 
                              type="text" 
                              name="sku" 
                              value={formData.sku} 
                              onChange={handleInputChange} 
                              className="input-field flex-1" 
                              placeholder="Auto-generated or custom"
                            />
                            <button
                              type="button"
                              onClick={generateSKU}
                              className="btn-outline px-3 py-2 whitespace-nowrap"
                            >
                              Assign Code
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
                          <select name="category_id" value={formData.category_id} onChange={handleInputChange} className="input-field">
                            <option value="">Select Category</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Unit Configuration */}
                        <div className="col-span-full">
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Unit Configuration</label>
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 p-3 border rounded-lg bg-muted/50">
                              <span className="text-sm text-foreground">
                                {getUnitDisplayText()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowUnitSelectionDialog(true)}
                              className="btn-outline flex items-center space-x-2"
                            >
                              <Cog6ToothIcon className="w-4 h-4" />
                              <span>Edit Unit</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                        <textarea 
                          name="description" 
                          value={formData.description} 
                          onChange={handleInputChange} 
                          rows="3" 
                          className="input-field" 
                          placeholder="Item description..."
                        />
                      </div>

                      {/* Tabbed Interface */}
                      <div className="mt-8">
                        <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                          <Tab.List className="flex space-x-1 rounded-xl bg-muted p-1">
                            {tabs.map((tab) => (
                              <Tab
                                key={tab.name}
                                className={({ selected }) =>
                                  classNames(
                                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-foreground',
                                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-primary focus:outline-none focus:ring-2',
                                    selected
                                      ? 'bg-card shadow text-foreground'
                                      : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
                                  )
                                }
                              >
                                <div className="flex items-center justify-center space-x-2">
                                  <tab.icon className="w-4 h-4" />
                                  <span>{tab.name}</span>
                                </div>
                              </Tab>
                            ))}
                          </Tab.List>
                          <Tab.Panels className="mt-6">
                            {/* Pricing Tab */}
                            <Tab.Panel className="space-y-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Sale Price (₹) *</label>
                                  <div className="space-y-2">
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      name="price" 
                                      value={formData.price} 
                                      onChange={handleInputChange} 
                                      required 
                                      className="input-field" 
                                      placeholder="0.00"
                                    />
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="without-tax"
                                        checked={formData.sale_price_without_tax}
                                        onChange={(e) => setFormData({ ...formData, sale_price_without_tax: e.target.checked })}
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      />
                                      <label htmlFor="without-tax" className="text-sm text-muted-foreground">
                                        Without Tax
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Discount on Sale Price</label>
                                  <div className="flex space-x-2">
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      name="discount_on_sale_price" 
                                      value={formData.discount_on_sale_price} 
                                      onChange={handleInputChange} 
                                      className="input-field flex-1" 
                                      placeholder="0"
                                    />
                                    <select 
                                      name="discount_type" 
                                      value={formData.discount_type} 
                                      onChange={handleInputChange} 
                                      className="input-field w-32"
                                    >
                                      <option value="percentage">%</option>
                                      <option value="amount">₹</option>
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* Wholesale Prices */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <label className="block text-sm font-medium text-muted-foreground">Wholesale Prices</label>
                                  <button
                                    type="button"
                                    onClick={addWholesalePrice}
                                    className="btn-outline text-sm"
                                  >
                                    + Add Wholesale Price
                                  </button>
                                </div>
                                {formData.wholesale_prices.map((item, index) => (
                                  <div key={index} className="flex items-center space-x-3 mb-3">
                                    <div className="flex-1">
                                      <input
                                        type="number"
                                        placeholder="Min Quantity"
                                        value={item.quantity}
                                        onChange={(e) => updateWholesalePrice(index, 'quantity', e.target.value)}
                                        className="input-field"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Price per unit"
                                        value={item.price}
                                        onChange={(e) => updateWholesalePrice(index, 'price', e.target.value)}
                                        className="input-field"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeWholesalePrice(index)}
                                      className="text-destructive hover:text-destructive/80 p-2"
                                    >
                                      <XMarkIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                {formData.wholesale_prices.length === 0 && (
                                  <p className="text-sm text-muted-foreground italic">No wholesale prices configured</p>
                                )}
                              </div>
                            </Tab.Panel>

                            {/* Stock Tab */}
                            <Tab.Panel className="space-y-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Opening Quantity</label>
                                  <input 
                                    type="number" 
                                    name="stock_quantity" 
                                    value={formData.stock_quantity} 
                                    onChange={handleInputChange} 
                                    className="input-field" 
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">At Price (₹)</label>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    name="opening_quantity_at_price" 
                                    value={formData.opening_quantity_at_price} 
                                    onChange={handleInputChange} 
                                    className="input-field" 
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">As Of Date</label>
                                  <input 
                                    type="date" 
                                    name="opening_quantity_as_of_date" 
                                    value={formData.opening_quantity_as_of_date} 
                                    onChange={handleInputChange} 
                                    className="input-field"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Min Stock to Maintain</label>
                                  <input 
                                    type="number" 
                                    name="min_stock_level" 
                                    value={formData.min_stock_level} 
                                    onChange={handleInputChange} 
                                    className="input-field" 
                                    placeholder="10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Weight</label>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    name="weight" 
                                    value={formData.weight} 
                                    onChange={handleInputChange} 
                                    className="input-field" 
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-2">Location</label>
                                  <input 
                                    type="text" 
                                    name="stock_location" 
                                    value={formData.stock_location} 
                                    onChange={handleInputChange} 
                                    className="input-field" 
                                    placeholder="Warehouse, Aisle, etc."
                                  />
                                </div>
                              </div>
                            </Tab.Panel>
                          </Tab.Panels>
                        </Tab.Group>
                      </div>

                      {/* Legacy Image URL field - keeping for backward compatibility */}
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Image URL (Legacy)</label>
                        <input 
                          type="url" 
                          name="image_url" 
                          value={formData.image_url} 
                          onChange={handleInputChange} 
                          className="input-field" 
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 border-t">
                        <button 
                          type="button" 
                          onClick={() => { 
                            setShowAddForm(false); 
                            setEditingProduct(null); 
                            resetForm(); 
                          }} 
                          className="btn-outline"
                        >
                          Cancel
                        </button>
                        {!editingProduct && (
                          <button 
                            type="button" 
                            onClick={handleSubmitAndNew}
                            className="btn-secondary"
                          >
                            Save & New
                          </button>
                        )}
                        <button type="submit" className="btn-primary">
                          {editingProduct ? 'Update Product' : 'Add Product'}
                        </button>
                      </div>
                    </form>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <EnhancedImageGalleryManager
        productId={selectedProductForImages?.id}
        isOpen={showImageGallery}
        onClose={handleCloseImageGallery}
        onImagesUpdate={handleImagesUpdate}
      />

      <UnitSelectionDialog
        isOpen={showUnitSelectionDialog}
        onClose={() => setShowUnitSelectionDialog(false)}
        onSave={handleUnitSave}
        baseUnit={formData.base_unit}
        secondaryUnit={formData.secondary_unit}
        unitConversionValue={formData.unit_conversion_value}
      />
      </div>
    </PermissionGuard>
  );
};

export default ProductManagement;
