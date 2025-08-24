import React, { useState, useRef, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';

const ItemManager = ({
  items = [],
  onItemsChange,
  products = [],
  taxRate = 0,
  discountRate = 0,
  onTaxRateChange,
  onDiscountRateChange,
  validationErrors = {}
}) => {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [productSearch, setProductSearch] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});
  const dropdownRefs = useRef({});

  // Default empty item
  const createEmptyItem = () => ({
    id: Date.now() + Math.random(),
    product_id: '',
    product_name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_rate: 0,
    total: 0
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

  // Handle product selection
  const selectProduct = (itemId, product) => {
    updateItem(itemId, {
      product_id: product.id,
      product_name: product.name,
      description: product.description || '',
      unit_price: product.selling_price || 0
    });
    setShowProductDropdown(prev => ({ ...prev, [itemId]: false }));
    setProductSearch(prev => ({ ...prev, [itemId]: '' }));
  };

  // Filter products based on search
  const getFilteredProducts = (searchTerm) => {
    if (!searchTerm) return products.slice(0, 10); // Show first 10 if no search
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  };

  // Calculate totals
  const calculateTotals = () => {
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const taxAmount = itemsSubtotal * (taxRate / 100);
    const globalDiscountAmount = itemsSubtotal * (discountRate / 100);
    const grandTotal = itemsSubtotal + taxAmount - globalDiscountAmount;

    return {
      itemsSubtotal,
      taxAmount,
      globalDiscountAmount,
      grandTotal
    };
  };

  const totals = calculateTotals();

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.entries(dropdownRefs.current).forEach(([itemId, ref]) => {
        if (ref && !ref.contains(event.target)) {
          setShowProductDropdown(prev => ({ ...prev, [itemId]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Items List */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CubeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Items Added</h3>
                <p className="text-muted-foreground mb-4">
                  Add items to create your purchase order or expense entry
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
                    <div>
                      <CardTitle className="text-base">
                        {item.product_name || item.description || 'Untitled Item'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total)}
                      </p>
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
                  {/* Product Selection */}
                  <div className="relative" ref={el => dropdownRefs.current[item.id] = el}>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Product (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full pl-10 pr-10 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Search products..."
                        value={productSearch[item.id] || item.product_name || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProductSearch(prev => ({ ...prev, [item.id]: value }));
                          setShowProductDropdown(prev => ({ ...prev, [item.id]: true }));
                          if (!value) {
                            updateItem(item.id, { 
                              product_id: '', 
                              product_name: '',
                              unit_price: 0 
                            });
                          }
                        }}
                        onFocus={() => setShowProductDropdown(prev => ({ ...prev, [item.id]: true }))}
                      />
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>

                    {/* Product Dropdown */}
                    {showProductDropdown[item.id] && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {getFilteredProducts(productSearch[item.id] || '').map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
                            onClick={() => selectProduct(item.id, product)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{product.name}</p>
                                {product.sku && (
                                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                                )}
                              </div>
                              <p className="text-sm font-medium">
                                {formatCurrency(product.selling_price)}
                              </p>
                            </div>
                          </button>
                        ))}
                        {getFilteredProducts(productSearch[item.id] || '').length === 0 && (
                          <div className="p-4 text-center text-muted-foreground">
                            No products found
                          </div>
                        )}
                      </div>
                    )}
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
        {items.length > 0 && (
          <Button onClick={addItem} variant="outline" className="w-full">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Another Item
          </Button>
        )}
      </div>

      {/* Tax and Discount Settings */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tax & Discount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tax Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={taxRate}
                    onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Global Discount (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    value={discountRate}
                    onChange={(e) => onDiscountRateChange(parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Subtotal:</span>
                <span>{formatCurrency(totals.itemsSubtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                  <span>{formatCurrency(totals.taxAmount)}</span>
                </div>
              )}
              {discountRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount ({discountRate}%):</span>
                  <span className="text-red-600">-{formatCurrency(totals.globalDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Grand Total:</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ItemManager;