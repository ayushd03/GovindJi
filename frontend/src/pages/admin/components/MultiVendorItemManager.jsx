import React, { useState, useRef, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CubeIcon,
  UserIcon,
  BuildingOfficeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import PartySelector from './PartySelector';
import ProductSelector from './ProductSelector';

const MultiVendorItemManager = ({
  items = [],
  onItemsChange,
  validationErrors = {},
  showMultiVendorFeatures = false
}) => {
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Default empty item
  const createEmptyItem = () => ({
    id: Date.now() + Math.random(),
    product_id: '',
    product_name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_rate: 0,
    total: 0,
    vendor_id: '',
    vendor_name: ''
  });

  // Add new item
  const addItem = () => {
    const newItem = createEmptyItem();
    onItemsChange([...items, newItem]);
    setExpandedItems(prev => new Set([...prev, newItem.id]));
  };

  // Remove item
  const removeItem = (itemId) => {
    onItemsChange(items.filter(item => item.id !== itemId));
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  };

  // Update item
  const updateItem = (itemId, updates) => {
    onItemsChange(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates };
        // Recalculate total
        const subtotal = updatedItem.quantity * updatedItem.unit_price;
        const discountAmount = subtotal * (updatedItem.discount_rate / 100);
        updatedItem.total = subtotal - discountAmount;
        return updatedItem;
      }
      return item;
    }));
  };

  // Toggle item expansion
  const toggleItemExpansion = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Handle vendor selection
  const handleVendorChange = (itemId, vendor) => {
    updateItem(itemId, {
      vendor_id: vendor?.id || '',
      vendor_name: vendor?.name || ''
    });
  };

  // Handle product selection from API search
  const handleProductSelect = (itemId, product) => {
    if (product) {
      updateItem(itemId, {
        product_id: product.id,
        product_name: product.name,
        description: product.description || '',
        unit_price: product.price || 0
      });
    } else {
      // Clear product selection
      updateItem(itemId, {
        product_id: '',
        product_name: '',
        unit_price: 0
      });
    }
  };

  // Group items by vendor
  const getVendorGroups = () => {
    if (!showMultiVendorFeatures) return {};
    
    const groups = {};
    items.forEach(item => {
      const vendorId = item.vendor_id || 'unassigned';
      const vendorName = item.vendor_name || 'Unassigned';
      
      if (!groups[vendorId]) {
        groups[vendorId] = {
          name: vendorName,
          items: [],
          total: 0
        };
      }
      
      groups[vendorId].items.push(item);
      groups[vendorId].total += item.total || 0;
    });
    
    return groups;
  };

  // Calculate totals
  const calculateTotals = () => {
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);

    return {
      itemsSubtotal,
      grandTotal: itemsSubtotal
    };
  };

  const totals = calculateTotals();
  const vendorGroups = getVendorGroups();
  const uniqueVendorCount = Object.keys(vendorGroups).filter(id => id !== 'unassigned').length;


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Get progress indicator text
  const getProgressText = () => {
    if (!showMultiVendorFeatures || items.length === 0) return '';
    
    const vendorText = uniqueVendorCount > 0 
      ? `${uniqueVendorCount} vendor${uniqueVendorCount > 1 ? 's' : ''}`
      : 'no vendors assigned';
    
    return `${items.length}/10 items, ${vendorText}`;
  };

  return (
    <div className="space-y-4">

      {/* Items List */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
            <CubeIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-medium text-foreground mb-2">No items yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add items to get started
            </p>
            <Button onClick={addItem} size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
              {/* Item Header - Always Visible */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">
                      {item.description || item.product_name || 'New Item'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Compact Item Form */}
              <div className="space-y-3">
                {/* Vendor and Product Selection Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Vendor Selection (compact) */}
                  {showMultiVendorFeatures && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Vendor *
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
                      />
                    </div>
                  )}

                  {/* Product Selection */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Product (optional)
                    </label>
                    <ProductSelector
                      selectedProduct={item.product_id ? { 
                        id: item.product_id, 
                        name: item.product_name,
                        price: item.unit_price
                      } : null}
                      onProductChange={(product) => handleProductSelect(item.id, product)}
                      placeholder="Search products..."
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    placeholder="Item description..."
                  />
                </div>

                {/* Quantity, Price, Discount - Compact Row */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Qty *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
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
                      className="w-full px-2 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={item.discount_rate}
                      onChange={(e) => updateItem(item.id, { discount_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Add Item Button */}
        {items.length < 10 && (
          <Button 
            onClick={addItem} 
            variant="outline" 
            className="w-full border-dashed"
            size="sm"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Item {items.length > 0 && `(${items.length}/10)`}
          </Button>
        )}

        {/* Total - Simple and Clean */}
        {items.length > 0 && (
          <div className="flex justify-between items-center pt-3 border-t">
            <span className="font-medium">Total:</span>
            <span className="text-lg font-bold">{formatCurrency(totals.itemsSubtotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiVendorItemManager;