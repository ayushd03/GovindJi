import React, { useState, useEffect, Fragment } from 'react';
import {
  XMarkIcon,
  CubeIcon,
  CalculatorIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../../hooks/useToast';
import { Dialog, Transition, Tab } from '@headlessui/react';
import UnitSelectionDialog from '../../../components/UnitSelectionDialog';

const AddProductModal = ({
  isOpen,
  onClose,
  onProductAdded,
  defaultName = '',
  editingProduct = null, // For editing existing products
  mode = 'add', // 'add' or 'edit'
  apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001'
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  const [formData, setFormData] = useState({
    name: defaultName,
    description: '',
    price: '',
    category_id: '',
    stock_quantity: '',
    min_stock_level: '',
    sku: '',
    weight: '',
    unit: 'kg',
    item_hsn: '',
    is_service: false,
    // Additional fields from original modal
    sale_price_without_tax: false,
    discount_on_sale_price: '',
    discount_type: 'percentage',
    wholesale_prices: [],
    // Unit configuration fields
    base_unit: 'KILOGRAMS',
    secondary_unit: 'GRAMS',
    unit_conversion_value: 1000,
    // Tax fields
    tax_type: 'taxable',
    tax_rate: '',
    cgst_rate: '',
    sgst_rate: '',
    igst_rate: '',
    cess_rate: '',
    purchase_price: '',
    selling_price: '',
    // Stock fields
    opening_quantity_at_price: '',
    opening_quantity_as_of_date: '',
    stock_location: ''
  });

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [showUnitSelectionDialog, setShowUnitSelectionDialog] = useState(false);

  // Initialize form data when editing or when defaultName changes
  React.useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: editingProduct.price || '',
        category_id: editingProduct.category_id || '',
        stock_quantity: editingProduct.stock_quantity || '',
        min_stock_level: editingProduct.min_stock_level || '',
        sku: editingProduct.sku || '',
        weight: editingProduct.weight || '',
        unit: editingProduct.unit || 'kg',
        item_hsn: editingProduct.item_hsn || '',
        is_service: editingProduct.is_service || false,
        // Additional fields from original modal
        sale_price_without_tax: editingProduct.sale_price_without_tax || false,
        discount_on_sale_price: editingProduct.discount_on_sale_price || '',
        discount_type: editingProduct.discount_type || 'percentage',
        wholesale_prices: editingProduct.wholesale_prices || [],
        // Unit configuration fields
        base_unit: editingProduct.base_unit || 'KILOGRAMS',
        secondary_unit: editingProduct.secondary_unit || 'GRAMS',
        unit_conversion_value: editingProduct.unit_conversion_value || 1000,
        // Tax fields
        tax_type: editingProduct.tax_type || 'taxable',
        tax_rate: editingProduct.tax_rate || '',
        cgst_rate: editingProduct.cgst_rate || '',
        sgst_rate: editingProduct.sgst_rate || '',
        igst_rate: editingProduct.igst_rate || '',
        cess_rate: editingProduct.cess_rate || '',
        purchase_price: editingProduct.purchase_price || '',
        selling_price: editingProduct.selling_price || '',
        // Stock fields
        opening_quantity_at_price: editingProduct.opening_quantity_at_price || '',
        opening_quantity_as_of_date: editingProduct.opening_quantity_as_of_date || '',
        stock_location: editingProduct.stock_location || ''
      });
    } else {
      setFormData(prev => ({
        ...prev,
        name: defaultName
      }));
    }
  }, [editingProduct, defaultName]);

  const resetForm = () => {
    setFormData({
      name: defaultName,
      description: '',
      price: '',
      category_id: '',
      stock_quantity: '',
      min_stock_level: '',
      sku: '',
      weight: '',
      unit: 'kg',
      item_hsn: '',
      is_service: false,
      sale_price_without_tax: false,
      discount_on_sale_price: '',
      discount_type: 'percentage',
      wholesale_prices: [],
      base_unit: 'KILOGRAMS',
      secondary_unit: 'GRAMS',
      unit_conversion_value: 1000,
      tax_type: 'taxable',
      tax_rate: '',
      cgst_rate: '',
      sgst_rate: '',
      igst_rate: '',
      cess_rate: '',
      purchase_price: '',
      selling_price: '',
      opening_quantity_at_price: '',
      opening_quantity_as_of_date: '',
      stock_location: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Enhanced helper functions
  const generateSKU = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const sku = `SKU${timestamp}${random}`;
    setFormData(prev => ({ ...prev, sku }));
  };

  const addWholesalePrice = () => {
    setFormData(prev => ({
      ...prev,
      wholesale_prices: [...prev.wholesale_prices, { quantity: '', price: '' }]
    }));
  };

  const updateWholesalePrice = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      wholesale_prices: prev.wholesale_prices.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeWholesalePrice = (index) => {
    setFormData(prev => ({
      ...prev,
      wholesale_prices: prev.wholesale_prices.filter((_, i) => i !== index)
    }));
  };

  const getUnitDisplayText = () => {
    if (formData.base_unit && formData.secondary_unit && formData.unit_conversion_value) {
      return `1 ${formData.base_unit} = ${formData.unit_conversion_value} ${formData.secondary_unit}`;
    }
    return 'Click to configure units';
  };

  // Handle unit selection save
  const handleUnitSave = (unitData) => {
    setFormData(prev => ({
      ...prev,
      base_unit: unitData.base_unit,
      secondary_unit: unitData.secondary_unit,
      unit_conversion_value: unitData.unit_conversion_value
    }));
  };

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${apiBaseUrl}/api/admin/categories`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Tab configuration
  const tabs = [
    { name: 'Pricing', icon: CalculatorIcon },
    { name: 'Stock', icon: CubeIcon }
  ];

  function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const isEditing = mode === 'edit' && editingProduct;

      const url = isEditing
        ? `${apiBaseUrl}/api/admin/products/${editingProduct.id}`
        : `${apiBaseUrl}/api/admin/products`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price) || 0,
          stock_quantity: parseInt(formData.stock_quantity) || 0,
          min_stock_level: parseInt(formData.min_stock_level) || 0,
          weight: parseFloat(formData.weight) || 0
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: isEditing ? 'Product updated successfully' : 'Product added successfully',
          variant: 'success',
          duration: 3000
        });

        // Call the callback to refresh product lists
        if (onProductAdded) {
          onProductAdded(result.data || result);
        }

        handleClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditing ? 'update' : 'add'} product`);
      }
    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'adding'} product:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${mode === 'edit' ? 'update' : 'add'} product`,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl transform transition-all">
                {/* Modern Header with Gradient */}
                <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl">
                        <CubeIcon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <Dialog.Title as="h3" className="text-2xl font-bold text-white">
                          {mode === 'edit' ? 'Edit' : 'Add New'} {formData.is_service ? 'Service' : 'Product'}
                        </Dialog.Title>
                        <p className="text-blue-100 text-sm mt-0.5">
                          Fill in the details below to {mode === 'edit' ? 'update' : 'create'} your {formData.is_service ? 'service' : 'product'}
                        </p>
                      </div>
                    </div>

                    {/* Product/Service Toggle */}
                    <div className="flex items-center space-x-3">
                      <div className="flex bg-white/10 backdrop-blur-sm rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, is_service: false }))}
                          className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                            !formData.is_service
                              ? 'bg-white text-blue-700 shadow-md'
                              : 'text-white hover:bg-white/10'
                          }`}
                        >
                          Product
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, is_service: true }))}
                          className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                            formData.is_service
                              ? 'bg-white text-blue-700 shadow-md'
                              : 'text-white hover:bg-white/10'
                          }`}
                        >
                          Service
                        </button>
                      </div>

                      <button
                        onClick={handleClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      >
                        <XMarkIcon className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="overflow-y-auto bg-gray-50" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                  <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Basic Information Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center space-x-2 mb-5">
                        <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                        <h4 className="text-lg font-bold text-gray-900">Basic Information</h4>
                      </div>

                      <div className="space-y-5">
                        {/* Name & Category Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {formData.is_service ? 'Service' : 'Item'} Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder={`Enter ${formData.is_service ? 'service' : 'item'} name`}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                            <select
                              name="category_id"
                              value={formData.category_id}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                            >
                              <option value="">Select Category</option>
                              {categories.map(category => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* HSN & SKU Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                              HSN Code
                              <MagnifyingGlassIcon className="w-4 h-4 ml-1.5 text-gray-400" />
                            </label>
                            <input
                              type="text"
                              name="item_hsn"
                              value={formData.item_hsn}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="Enter HSN code"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">SKU Code</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                name="sku"
                                value={formData.sku}
                                onChange={handleInputChange}
                                className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Auto-generated or custom"
                              />
                              <button
                                type="button"
                                onClick={generateSKU}
                                className="px-5 py-3 text-sm font-medium bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all shadow-sm"
                              >
                                Generate
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Unit Configuration */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Unit Configuration</label>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 px-4 py-3 text-sm bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-gray-700 font-medium">
                              {getUnitDisplayText()}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowUnitSelectionDialog(true)}
                              className="px-5 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
                            >
                              <Cog6ToothIcon className="w-4 h-4" />
                              Configure
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                            placeholder={`Describe your ${formData.is_service ? 'service' : 'product'}...`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tabbed Sections - Pricing & Stock */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                        <Tab.List className="flex border-b border-gray-200 bg-gray-50">
                          {tabs.map((tab) => (
                            <Tab
                              key={tab.name}
                              className={({ selected }) =>
                                classNames(
                                  'flex-1 py-4 px-6 text-sm font-semibold transition-all focus:outline-none',
                                  selected
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                )
                              }
                            >
                              <div className="flex items-center justify-center gap-2">
                                <tab.icon className="w-5 h-5" />
                                <span>{tab.name}</span>
                              </div>
                            </Tab>
                          ))}
                        </Tab.List>

                        <Tab.Panels className="p-6">
                          {/* Pricing Tab */}
                          <Tab.Panel className="space-y-6">
                            {/* Main Pricing Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Sale Price <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  name="price"
                                  value={formData.price}
                                  onChange={handleInputChange}
                                  step="0.01"
                                  min="0"
                                  required
                                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  placeholder="0.00"
                                />
                                <div className="flex items-center mt-2">
                                  <input
                                    type="checkbox"
                                    name="sale_price_without_tax"
                                    checked={formData.sale_price_without_tax}
                                    onChange={handleInputChange}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <label className="ml-2 text-sm text-gray-600 font-medium">Price without tax</label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Amount</label>
                                <input
                                  type="number"
                                  name="discount_on_sale_price"
                                  value={formData.discount_on_sale_price}
                                  onChange={handleInputChange}
                                  step="0.01"
                                  min="0"
                                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  placeholder="0.00"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Type</label>
                                <select
                                  name="discount_type"
                                  value={formData.discount_type}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                                >
                                  <option value="percentage">Percentage (%)</option>
                                  <option value="amount">Fixed Amount (₹)</option>
                                </select>
                              </div>
                            </div>

                            {/* Wholesale Prices Section */}
                            <div className="pt-4 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-semibold text-gray-700">Wholesale Pricing Tiers</label>
                                <button
                                  type="button"
                                  onClick={addWholesalePrice}
                                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
                                >
                                  <PlusIcon className="w-4 h-4" />
                                  Add Tier
                                </button>
                              </div>

                              {formData.wholesale_prices.length > 0 ? (
                                <div className="space-y-3">
                                  {formData.wholesale_prices.map((wholesale, index) => (
                                    <div key={index} className="flex gap-3 items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                                      <div className="flex-1">
                                        <input
                                          type="number"
                                          placeholder="Minimum quantity"
                                          value={wholesale.quantity}
                                          onChange={(e) => updateWholesalePrice(index, 'quantity', e.target.value)}
                                          className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="Price per unit"
                                          value={wholesale.price}
                                          onChange={(e) => updateWholesalePrice(index, 'price', e.target.value)}
                                          className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeWholesalePrice(index)}
                                        className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                        <TrashIcon className="w-5 h-5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                  No wholesale pricing tiers added yet
                                </div>
                              )}
                            </div>
                          </Tab.Panel>

                          {/* Stock Tab */}
                          <Tab.Panel className="space-y-6">
                            {/* Current Stock Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Stock Quantity</label>
                                <input
                                  type="number"
                                  name="stock_quantity"
                                  value={formData.stock_quantity}
                                  onChange={handleInputChange}
                                  min="0"
                                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  placeholder="0"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Stock Level</label>
                                <input
                                  type="number"
                                  name="min_stock_level"
                                  value={formData.min_stock_level}
                                  onChange={handleInputChange}
                                  min="0"
                                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  placeholder="0"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Location</label>
                                <input
                                  type="text"
                                  name="stock_location"
                                  value={formData.stock_location}
                                  onChange={handleInputChange}
                                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  placeholder="e.g., Warehouse A, Store 1"
                                />
                              </div>
                            </div>

                            {/* Opening Stock Section */}
                            <div className="pt-4 border-t border-gray-200">
                              <h5 className="text-sm font-semibold text-gray-700 mb-4">Opening Stock Details</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Opening Quantity at Price</label>
                                  <input
                                    type="number"
                                    name="opening_quantity_at_price"
                                    value={formData.opening_quantity_at_price}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="0.00"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">As of Date</label>
                                  <input
                                    type="date"
                                    name="opening_quantity_as_of_date"
                                    value={formData.opening_quantity_as_of_date}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  />
                                </div>
                              </div>
                            </div>
                          </Tab.Panel>
                        </Tab.Panels>
                      </Tab.Group>
                    </div>
                  </form>
                </div>

                {/* Modern Footer with Actions */}
                <div className="px-8 py-5 bg-white border-t border-gray-200 rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      <span className="text-red-500">*</span> Required fields
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-8 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                      >
                        {isLoading
                          ? (mode === 'edit' ? 'Updating...' : 'Adding...')
                          : (mode === 'edit' ? `Update ${formData.is_service ? 'Service' : 'Product'}` : `Add ${formData.is_service ? 'Service' : 'Product'}`)
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

        {/* Unit Selection Dialog */}
        <UnitSelectionDialog
          isOpen={showUnitSelectionDialog}
          onClose={() => setShowUnitSelectionDialog(false)}
          onSave={handleUnitSave}
          baseUnit={formData.base_unit}
          secondaryUnit={formData.secondary_unit}
          unitConversionValue={formData.unit_conversion_value}
        />
      </Dialog>
    </Transition>
  );
};

export default AddProductModal;