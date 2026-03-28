import React, { useState, useEffect, useCallback } from 'react';
import {
  CubeIcon,
  CalculatorIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../../hooks/useToast';
import { Tab } from '@headlessui/react';
import UnitSelectionDialog from '../../../components/UnitSelectionDialog';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from '../../../components/AdminDialog';
import { API_BASE_URL } from '../../../config/apiBaseUrl';

const AddProductModal = ({
  isOpen,
  onClose,
  onProductAdded,
  defaultName = '',
  editingProduct = null, // For editing existing products
  mode = 'add', // 'add' or 'edit'
  apiBaseUrl = API_BASE_URL
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
  const fetchCategories = useCallback(async () => {
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
  }, [apiBaseUrl]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [fetchCategories, isOpen]);

  // Tab configuration
  const tabs = [
    { name: 'Pricing', icon: CalculatorIcon },
    { name: 'Stock', icon: CubeIcon }
  ];
  const sectionCardClass = 'admin-dialog-section';
  const fieldLabelClass = 'admin-dialog-label';
  const fieldClass = 'input-field';

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
    <AdminDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <AdminDialogContent size="lg">
        <AdminDialogHeader sticky className="bg-card/95 backdrop-blur-sm">
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <CubeIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <AdminDialogTitle>
                    {mode === 'edit' ? 'Edit' : 'Add New'} {formData.is_service ? 'Service' : 'Product'}
                  </AdminDialogTitle>
                  <AdminDialogDescription>
                    Keep the record tight: core product identity first, then pricing and stock details.
                  </AdminDialogDescription>
                </div>
              </div>
              <AdminDialogIconButton onClick={handleClose} />
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, is_service: false }))}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all ${
                    !formData.is_service
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-card/70'
                  }`}
                >
                  Product
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, is_service: true }))}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all ${
                    formData.is_service
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-card/70'
                  }`}
                >
                  Service
                </button>
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {mode === 'edit' ? 'Editing existing item' : 'New catalog item'}
              </p>
            </div>
          </div>
        </AdminDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <AdminDialogBody className="admin-dialog-stack bg-muted/20">
            <div className={sectionCardClass}>

              <div className="space-y-3.5">
                        {/* Name & Category Row */}
                        <div className="admin-dialog-grid-2">
                          <div>
                            <label className={fieldLabelClass}>
                              {formData.is_service ? 'Service' : 'Item'} Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleInputChange}
                              required
                              className={fieldClass}
                              placeholder={`Enter ${formData.is_service ? 'service' : 'item'} name`}
                            />
                          </div>

                          <div>
                            <label className={fieldLabelClass}>Category</label>
                            <select
                              name="category_id"
                              value={formData.category_id}
                              onChange={handleInputChange}
                              className={fieldClass}
                            >
                              <option value="">Select Category</option>
                              {categories.map(category => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* HSN & SKU Row */}
                        <div className="admin-dialog-grid-2">
                          <div>
                            <label className={`${fieldLabelClass} flex items-center`}>
                              HSN Code
                              <MagnifyingGlassIcon className="ml-1.5 h-4 w-4 text-muted-foreground/70" />
                            </label>
                            <input
                              type="text"
                              name="item_hsn"
                              value={formData.item_hsn}
                              onChange={handleInputChange}
                              className={fieldClass}
                              placeholder="Enter HSN code"
                            />
                          </div>

                          <div>
                            <label className={fieldLabelClass}>SKU Code</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                name="sku"
                                value={formData.sku}
                                onChange={handleInputChange}
                                className={`flex-1 ${fieldClass}`}
                                placeholder="Auto-generated or custom"
                              />
                              <button
                                type="button"
                                onClick={generateSKU}
                                className="btn-outline whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium"
                              >
                                Generate
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Unit Configuration */}
                        <div>
                          <label className={fieldLabelClass}>Unit Configuration</label>
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="flex-1 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-[13px] font-medium text-foreground">
                              {getUnitDisplayText()}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowUnitSelectionDialog(true)}
                              className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium"
                            >
                              <Cog6ToothIcon className="w-4 h-4" />
                              Configure
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className={fieldLabelClass}>Description</label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            rows={3}
                            className={`${fieldClass} resize-none`}
                            placeholder={`Describe your ${formData.is_service ? 'service' : 'product'}...`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tabbed Sections - Pricing & Stock */}
            <div className={classNames(sectionCardClass, 'overflow-hidden p-0')}>
              <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                <Tab.List className="flex border-b border-border/70 bg-muted/20">
                          {tabs.map((tab) => (
                            <Tab
                              key={tab.name}
                              className={({ selected }) =>
                                classNames(
                                  'flex-1 px-3 py-2.5 text-[13px] font-semibold transition-all focus:outline-none',
                                  selected
                                    ? 'border-b-2 border-primary bg-card text-foreground'
                                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
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

                <Tab.Panels className="p-3.5 sm:p-4">
                          {/* Pricing Tab */}
                  <Tab.Panel className="space-y-4">
                            {/* Main Pricing Row */}
                            <div className="admin-dialog-grid-3">
                              <div>
                                <label className={fieldLabelClass}>
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
                                  className={fieldClass}
                                  placeholder="0.00"
                                />
                                <div className="mt-2 flex items-center">
                                  <input
                                    type="checkbox"
                                    name="sale_price_without_tax"
                                    checked={formData.sale_price_without_tax}
                                    onChange={handleInputChange}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                  />
                                  <label className="ml-2 text-[13px] font-medium text-muted-foreground">Price without tax</label>
                                </div>
                              </div>

                              <div>
                                <label className={fieldLabelClass}>Discount Amount</label>
                                <input
                                  type="number"
                                  name="discount_on_sale_price"
                                  value={formData.discount_on_sale_price}
                                  onChange={handleInputChange}
                                  step="0.01"
                                  min="0"
                                  className={fieldClass}
                                  placeholder="0.00"
                                />
                              </div>

                              <div>
                                <label className={fieldLabelClass}>Discount Type</label>
                                <select
                                  name="discount_type"
                                  value={formData.discount_type}
                                  onChange={handleInputChange}
                                  className={fieldClass}
                                >
                                  <option value="percentage">Percentage (%)</option>
                                  <option value="amount">Fixed Amount (₹)</option>
                                </select>
                              </div>
                            </div>

                            {/* Wholesale Prices Section */}
                            <div className="border-t border-border/70 pt-4">
                              <div className="mb-3 flex items-center justify-between">
                                <label className="text-sm font-semibold text-foreground">Wholesale Pricing Tiers</label>
                                <button
                                  type="button"
                                  onClick={addWholesalePrice}
                                  className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium"
                                >
                                  <PlusIcon className="w-4 h-4" />
                                  Add Tier
                                </button>
                              </div>

                              {formData.wholesale_prices.length > 0 ? (
                                <div className="space-y-3">
                                  {formData.wholesale_prices.map((wholesale, index) => (
                                    <div key={index} className="grid gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                                      <div>
                                        <input
                                          type="number"
                                          placeholder="Minimum quantity"
                                          value={wholesale.quantity}
                                          onChange={(e) => updateWholesalePrice(index, 'quantity', e.target.value)}
                                          className={fieldClass}
                                        />
                                      </div>
                                      <div>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="Price per unit"
                                          value={wholesale.price}
                                          onChange={(e) => updateWholesalePrice(index, 'price', e.target.value)}
                                          className={fieldClass}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeWholesalePrice(index)}
                                        className="justify-self-start rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10 sm:justify-self-center"
                                      >
                                        <TrashIcon className="w-5 h-5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border-2 border-dashed border-border/70 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                                  No wholesale pricing tiers added yet
                                </div>
                              )}
                            </div>
                          </Tab.Panel>

                          {/* Stock Tab */}
                  <Tab.Panel className="space-y-4">
                            {/* Per-variant stock notice */}
                            {editingProduct?.variants?.length > 0 && (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                                This product uses per-variant stock. The total shown here is automatically computed as the sum of all variant stocks. To change individual variant stock, use the <strong>Variants</strong> tab.
                              </div>
                            )}
                            {/* Current Stock Info */}
                            <div className="admin-dialog-grid-3">
                              <div>
                                <label className={fieldLabelClass}>Current Stock Quantity</label>
                                <input
                                  type="number"
                                  name="stock_quantity"
                                  value={formData.stock_quantity}
                                  onChange={handleInputChange}
                                  min="0"
                                  className={fieldClass}
                                  placeholder="0"
                                  disabled={!!(editingProduct?.variants?.length > 0)}
                                  title={editingProduct?.variants?.length > 0 ? 'Managed automatically via variant stock' : undefined}
                                />
                              </div>

                              <div>
                                <label className={fieldLabelClass}>Minimum Stock Level</label>
                                <input
                                  type="number"
                                  name="min_stock_level"
                                  value={formData.min_stock_level}
                                  onChange={handleInputChange}
                                  min="0"
                                  className={fieldClass}
                                  placeholder="0"
                                />
                              </div>

                              <div>
                                <label className={fieldLabelClass}>Stock Location</label>
                                <input
                                  type="text"
                                  name="stock_location"
                                  value={formData.stock_location}
                                  onChange={handleInputChange}
                                  className={fieldClass}
                                  placeholder="e.g., Warehouse A, Store 1"
                                />
                              </div>
                            </div>

                            {/* Opening Stock Section */}
                            <div className="border-t border-border/70 pt-4">
                              <h5 className="mb-3 text-sm font-semibold text-foreground">Opening Stock Details</h5>
                              <div className="admin-dialog-grid-2">
                                <div>
                                  <label className={fieldLabelClass}>Opening Quantity at Price</label>
                                  <input
                                    type="number"
                                    name="opening_quantity_at_price"
                                    value={formData.opening_quantity_at_price}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    className={fieldClass}
                                    placeholder="0.00"
                                  />
                                </div>

                                <div>
                                  <label className={fieldLabelClass}>As of Date</label>
                                  <input
                                    type="date"
                                    name="opening_quantity_as_of_date"
                                    value={formData.opening_quantity_as_of_date}
                                    onChange={handleInputChange}
                                    className={fieldClass}
                                  />
                                </div>
                              </div>
                            </div>
                          </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </AdminDialogBody>

          <AdminDialogFooter sticky className="bg-card/95 backdrop-blur-sm">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-muted-foreground">
                <span className="text-red-500">*</span> Required fields
              </p>
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-outline rounded-lg px-3 py-1.5 text-[13px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary rounded-lg px-4 py-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading
                    ? (mode === 'edit' ? 'Updating...' : 'Adding...')
                    : (mode === 'edit' ? `Update ${formData.is_service ? 'Service' : 'Product'}` : `Add ${formData.is_service ? 'Service' : 'Product'}`)
                  }
                </button>
              </div>
            </div>
          </AdminDialogFooter>
        </form>

        {/* Unit Selection Dialog */}
        <UnitSelectionDialog
          isOpen={showUnitSelectionDialog}
          onClose={() => setShowUnitSelectionDialog(false)}
          onSave={handleUnitSave}
          baseUnit={formData.base_unit}
          secondaryUnit={formData.secondary_unit}
          unitConversionValue={formData.unit_conversion_value}
        />
      </AdminDialogContent>
    </AdminDialog>
  );
};

export default AddProductModal;
