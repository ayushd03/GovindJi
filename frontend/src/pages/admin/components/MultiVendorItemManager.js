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
    <div className="space-y-6">
      {/* Progress indicator for multi-vendor payments */}
      {showMultiVendorFeatures && items.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <CubeIcon className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-primary">
                Multi-vendor Payment Progress
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {getProgressText()}
            </span>
          </div>
          {uniqueVendorCount >= 2 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-green-700 font-medium">
                Multi-vendor ready
              </span>
            </div>
          )}
        </div>
      )}

      {/* Vendor Groups Summary */}
      {showMultiVendorFeatures && Object.keys(vendorGroups).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2">
              <BuildingOfficeIcon className="w-5 h-5" />
              <span>Vendor Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(vendorGroups).map(([vendorId, group]) => (
                <div key={vendorId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(group.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CubeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Items Added</h3>
                <p className="text-muted-foreground mb-4">
                  {showMultiVendorFeatures 
                    ? "Add items for your multi-vendor payment (supports up to 10 items across multiple vendors)"
                    : "Add items to create your purchase order or expense entry"
                  }
                </p>
                <Button onClick={addItem} className="btn-primary">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          items.map((item, index) => (
            <Card key={item.id} className="relative">
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleItemExpansion(item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {item.product_name || item.description || 'Untitled Item'}
                      </CardTitle>
                      <div className="flex items-center space-x-4">
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total)}
                        </p>
                        {showMultiVendorFeatures && item.vendor_name && (
                          <p className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                            {item.vendor_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                    {expandedItems.has(item.id) ? (
                      <ChevronUpIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedItems.has(item.id) && (
                <CardContent className="space-y-4">
                  {/* Vendor Selection (for multi-vendor payments) */}
                  {showMultiVendorFeatures && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Vendor for this item *
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
                        placeholder="Select vendor for this item..."
                      />
                    </div>
                  )}

                  {/* Product Selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Product (Optional)
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

                  {/* Item Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Description *
                      </label>
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="Describe the item..."
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Unit Price (₹) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Item Discount (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          value={item.discount_rate}
                          onChange={(e) => updateItem(item.id, { discount_rate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Item Total */}
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Item Total</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}

        {/* Add Item Button */}
        {items.length > 0 && items.length < 10 && (
          <Button onClick={addItem} variant="outline" className="w-full">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Another Item {showMultiVendorFeatures && `(${items.length}/10)`}
          </Button>
        )}

        {/* Max items reached warning */}
        {items.length >= 10 && (
          <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              Maximum of 10 items reached. Remove an item to add more.
            </p>
          </div>
        )}
      </div>

      {/* Simple Total */}
      {items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-lg font-bold">
              <span>Total Amount:</span>
              <span>{formatCurrency(totals.itemsSubtotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MultiVendorItemManager;