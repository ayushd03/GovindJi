import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CubeIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CalendarIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import PartySelector from './PartySelector';
import ProductSelector from './ProductSelector';

/**
 * Unified Vendor Order Form Component
 * Used in both Expense Management (Vendor Order tab) and Purchase Order Management
 *
 * Features:
 * - Multi-vendor support: Different vendors for different items
 * - Bulk PO creation: Create multiple POs from one form
 * - Clean, compact UI
 * - Reusable across tabs
 */
const UnifiedVendorOrderForm = ({
  mode = 'create', // 'create' or 'edit'
  initialData = null,
  onSubmit,
  onCancel,
  preSelectedVendor = null // For when vendor is pre-selected (from Expenses tab)
}) => {
  // Form state
  const [formData, setFormData] = useState({
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    payment_terms: '',
    delivery_address: '',
    notes: '',
    items: []
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with initial data or pre-selected vendor
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else if (preSelectedVendor) {
      // When vendor is pre-selected, add first item with that vendor
      addItem(preSelectedVendor);
    }
  }, [initialData, preSelectedVendor]);

  // Create empty item
  const createEmptyItem = (vendor = null) => ({
    id: Date.now() + Math.random(),
    vendor_id: vendor?.id || '',
    vendor_name: vendor?.name || '',
    product_id: '',
    product_name: '',
    item_name: '',
    description: '',
    category_id: '',
    item_hsn: '',
    sku: '',
    quantity: 1,
    unit: 'kg',
    price_per_unit: 0,
    discount_percentage: 0,
    tax_percentage: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    has_miscellaneous_expenses: false,
    miscellaneous_amount: 0,
    miscellaneous_note: ''
  });

  // Add new item
  const addItem = (vendor = null) => {
    const newItem = createEmptyItem(vendor);
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove item
  const removeItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  // Update item
  const updateItem = (itemId, updates) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };

          // Recalculate totals
          const subtotal = updatedItem.quantity * updatedItem.price_per_unit;
          const discount = (subtotal * updatedItem.discount_percentage) / 100;
          const afterDiscount = subtotal - discount;
          const tax = (afterDiscount * updatedItem.tax_percentage) / 100;
          const miscellaneousAmount = updatedItem.has_miscellaneous_expenses ? (updatedItem.miscellaneous_amount || 0) : 0;

          updatedItem.discount_amount = discount;
          updatedItem.tax_amount = tax;
          updatedItem.total_amount = afterDiscount + tax + miscellaneousAmount;

          return updatedItem;
        }
        return item;
      })
    }));
  };

  // Handle vendor selection
  const handleVendorChange = (itemId, vendor) => {
    updateItem(itemId, {
      vendor_id: vendor?.id || '',
      vendor_name: vendor?.name || ''
    });
  };

  // Handle product selection
  const handleProductSelect = (itemId, product) => {
    if (product) {
      updateItem(itemId, {
        product_id: product.id,
        product_name: product.name,
        item_name: product.name,
        description: product.description || '',
        price_per_unit: product.price || 0,
        sku: product.sku || '',
        unit: product.unit || 'kg'
      });
    } else {
      updateItem(itemId, {
        product_id: '',
        product_name: '',
        price_per_unit: 0
      });
    }
  };

  // Group items by vendor for PO creation
  const groupItemsByVendor = () => {
    const groups = {};
    formData.items.forEach(item => {
      const vendorId = item.vendor_id || 'unassigned';
      if (!groups[vendorId]) {
        groups[vendorId] = {
          vendor_id: item.vendor_id,
          vendor_name: item.vendor_name,
          items: [],
          total: 0
        };
      }
      groups[vendorId].items.push(item);
      groups[vendorId].total += item.total_amount || 0;
    });
    return groups;
  };

  // Calculate totals
  const calculateTotals = () => {
    const itemsSubtotal = formData.items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    const vendorGroups = groupItemsByVendor();
    const uniqueVendorCount = Object.keys(vendorGroups).filter(id => id !== 'unassigned').length;

    return {
      itemsSubtotal,
      grandTotal: itemsSubtotal,
      vendorGroups,
      uniqueVendorCount
    };
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.order_date) {
      errors.order_date = 'Order date is required';
    }

    if (formData.items.length === 0) {
      errors.items = 'At least one item is required';
    }

    formData.items.forEach((item, index) => {
      if (!item.vendor_id) {
        errors[`item_${item.id}_vendor`] = 'Vendor is required';
      }
      if (!item.item_name && !item.description) {
        errors[`item_${item.id}_description`] = 'Item description is required';
      }
      if (item.quantity <= 0) {
        errors[`item_${item.id}_quantity`] = 'Quantity must be greater than 0';
      }
      if (item.price_per_unit <= 0) {
        errors[`item_${item.id}_price`] = 'Price must be greater than 0';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header Section - Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <DocumentTextIcon className="w-5 h-5" />
            <span>Order Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Order Date *
              </label>
              <input
                type="date"
                required
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm",
                  validationErrors.order_date ? "border-red-500" : "border-border"
                )}
                value={formData.order_date}
                onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
              />
              {validationErrors.order_date && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.order_date}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Payment Terms
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="e.g., Net 30 days"
                value={formData.payment_terms}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Delivery Address
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="Delivery location"
                value={formData.delivery_address}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base">
              <CubeIcon className="w-5 h-5" />
              <span>Order Items</span>
              <span className="text-xs text-muted-foreground font-normal">
                ({formData.items.length} item{formData.items.length !== 1 ? 's' : ''}, {totals.uniqueVendorCount} vendor{totals.uniqueVendorCount !== 1 ? 's' : ''})
              </span>
            </CardTitle>
            <Button
              type="button"
              onClick={() => addItem()}
              size="sm"
              variant="outline"
              className="border-dashed"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.items.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <CubeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium text-foreground mb-2">No items added</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Add items from different vendors to create multiple POs
              </p>
              <Button
                type="button"
                onClick={() => addItem()}
                size="sm"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add First Item
              </Button>
            </div>
          ) : (
            formData.items.map((item, index) => (
              <div
                key={item.id}
                className="border border-border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
              >
                {/* Item Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {index + 1}
                    </span>
                    <h4 className="text-sm font-medium">
                      {item.item_name || item.description || 'New Item'}
                    </h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-primary">
                      {formatCurrency(item.total_amount)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Vendor and Product Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Vendor * {item.vendor_name && <span className="text-primary">({item.vendor_name})</span>}
                    </label>
                    <PartySelector
                      selectedParty={item.vendor_id ? {
                        id: item.vendor_id,
                        name: item.vendor_name,
                        party_type: 'vendor'
                      } : null}
                      onPartyChange={(vendor) => handleVendorChange(item.id, vendor)}
                      partyType="vendor"
                      error={validationErrors[`item_${item.id}_vendor`]}
                      placeholder="Select vendor..."
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Product (optional)
                    </label>
                    <ProductSelector
                      selectedProduct={item.product_id ? {
                        id: item.product_id,
                        name: item.product_name,
                        price: item.price_per_unit
                      } : null}
                      onProductChange={(product) => handleProductSelect(item.id, product)}
                      placeholder="Search products..."
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Item Description */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Item Description *
                  </label>
                  <input
                    type="text"
                    required
                    className={cn(
                      "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm",
                      validationErrors[`item_${item.id}_description`] ? "border-red-500" : "border-border"
                    )}
                    placeholder="What are you ordering?"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value, item_name: e.target.value })}
                  />
                </div>

                {/* Quantity, Price, Discount, Tax */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className="w-full px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Unit
                    </label>
                    <select
                      className="w-full px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="pcs">pcs</option>
                      <option value="box">box</option>
                      <option value="pack">pack</option>
                      <option value="ltr">ltr</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className="w-full px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.price_per_unit}
                      onChange={(e) => updateItem(item.id, { price_per_unit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Disc %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-2 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.discount_percentage}
                      onChange={(e) => updateItem(item.id, { discount_percentage: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Tax and Miscellaneous */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Tax %
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.tax_percentage}
                      onChange={(e) => updateItem(item.id, { tax_percentage: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center space-x-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary bg-card border-border rounded focus:ring-primary"
                        checked={item.has_miscellaneous_expenses || false}
                        onChange={(e) => {
                          updateItem(item.id, {
                            has_miscellaneous_expenses: e.target.checked,
                            miscellaneous_amount: e.target.checked ? item.miscellaneous_amount : 0
                          });
                        }}
                      />
                      <span className="text-muted-foreground">Add miscellaneous expenses</span>
                    </label>
                  </div>
                </div>

                {/* Miscellaneous Expenses */}
                {item.has_miscellaneous_expenses && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Misc. Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        value={item.miscellaneous_amount || 0}
                        onChange={(e) => updateItem(item.id, { miscellaneous_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Note
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        placeholder="Reason..."
                        value={item.miscellaneous_note || ''}
                        onChange={(e) => updateItem(item.id, { miscellaneous_note: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Item Total Breakdown */}
                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <div className="flex items-center space-x-4 text-muted-foreground">
                    <span>Subtotal: {formatCurrency(item.quantity * item.price_per_unit)}</span>
                    {item.discount_amount > 0 && <span>Disc: -{formatCurrency(item.discount_amount)}</span>}
                    {item.tax_amount > 0 && <span>Tax: +{formatCurrency(item.tax_amount)}</span>}
                    {item.has_miscellaneous_expenses && item.miscellaneous_amount > 0 && (
                      <span>Misc: +{formatCurrency(item.miscellaneous_amount)}</span>
                    )}
                  </div>
                  <span className="font-semibold text-primary">Total: {formatCurrency(item.total_amount)}</span>
                </div>
              </div>
            ))
          )}

          {/* Add Item Button (always visible) */}
          {formData.items.length > 0 && (
            <Button
              type="button"
              onClick={() => addItem()}
              variant="outline"
              className="w-full border-dashed"
              size="sm"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Another Item
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary Section */}
      {formData.items.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Vendor Breakdown */}
            {totals.uniqueVendorCount > 1 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">By Vendor:</h4>
                {Object.values(totals.vendorGroups)
                  .filter(group => group.vendor_id)
                  .map(group => (
                    <div key={group.vendor_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-primary" />
                        <span>{group.vendor_name}</span>
                        <span className="text-xs text-muted-foreground">({group.items.length} items)</span>
                      </div>
                      <span className="font-medium">{formatCurrency(group.total)}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Grand Total */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="font-semibold text-base">Grand Total:</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(totals.grandTotal)}</span>
            </div>

            {/* PO Creation Info */}
            {totals.uniqueVendorCount > 1 && (
              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>
                    This will create <span className="font-semibold text-blue-700">{totals.uniqueVendorCount} separate Purchase Orders</span> (one for each vendor).
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || formData.items.length === 0}
          className="min-w-32"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating PO{totals.uniqueVendorCount > 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              Create PO{totals.uniqueVendorCount > 1 ? 's' : ''} ({totals.uniqueVendorCount})
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default UnifiedVendorOrderForm;
