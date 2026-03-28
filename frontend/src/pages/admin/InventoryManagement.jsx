import React, { useState, useEffect, useCallback } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import {
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  TruckIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/useToast';
import { Toaster } from '../../components/ui/toaster';
import { usePermissions } from '../../context/PermissionContext';
import { API_BASE_URL } from '../../config/apiBaseUrl';

const InventoryManagement = () => {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [showMovements, setShowMovements] = useState(null);
  const [showAdjustment, setShowAdjustment] = useState(null);
  const [showPOBreakdown, setShowPOBreakdown] = useState(null);
  const [showReceiveItem, setShowReceiveItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [adjustmentData, setAdjustmentData] = useState({
    quantity: 0,
    type: 'in',
    reason: '',
    notes: '',
    variant_id: '',
  });
  const PRODUCTS_PER_PAGE = 10;
  const canManageInventory = hasPermission(ADMIN_PERMISSIONS.MANAGE_INVENTORY);
  const [receiveData, setReceiveData] = useState({
    receive_quantity: 0,
    notes: ''
  });
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const showSuccess = useCallback((message) => {
    toast({
      title: "Success",
      description: message,
      variant: "success",
      duration: 3000,
    });
  }, [toast]);

  const showError = useCallback((message) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
      duration: 5000,
    });
  }, [toast]);

  const fetchProducts = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      setProducts(data.products || data || []);
    } catch (err) {
      setError(err.message);
      showError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const fetchStockMovements = async (productId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/inventory/movements?product_id=${productId}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch stock movements');

      const data = await response.json();
      setStockMovements(data.movements || data || []);
    } catch (err) {
      showError('Failed to load stock movements');
    }
  };

  const fetchPurchaseOrders = async (productId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch purchase orders');

      const data = await response.json();
      setPurchaseOrders(data.purchase_orders || []);
    } catch (err) {
      showError('Failed to load purchase orders');
    }
  };

  const handleReceiveItem = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/inventory/receive-item`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          purchase_order_item_id: showReceiveItem.purchase_order_item_id,
          receive_quantity: receiveData.receive_quantity,
          notes: receiveData.notes
        })
      });

      if (!response.ok) throw new Error('Failed to receive item');

      await fetchProducts();
      await fetchPurchaseOrders(showReceiveItem.product_id); // Refresh PO data
      setShowReceiveItem(null);
      setReceiveData({ receive_quantity: 0, notes: '' });
      showSuccess('Item received successfully');
    } catch (err) {
      showError('Failed to receive item');
    }
  };

  const handleStockAdjustment = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const body = {
        quantity: adjustmentData.quantity,
        movement_type: adjustmentData.type,
        reason: adjustmentData.reason || `Manual ${adjustmentData.type === 'in' ? 'increase' : 'decrease'}`,
      };
      if (adjustmentData.variant_id) {
        body.variant_id = adjustmentData.variant_id;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/products/${showAdjustment.id}/stock`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to adjust stock');
      }

      await fetchProducts();
      setShowAdjustment(null);
      setAdjustmentData({ quantity: 0, type: 'in', reason: '', notes: '', variant_id: '' });
      showSuccess('Stock adjusted successfully');
    } catch (err) {
      showError(err.message || 'Failed to adjust stock');
    }
  };

  const openAdjustmentModal = (product) => {
    setShowAdjustment(product);
    // Pre-select the default variant (if any) so the admin doesn't have to pick one every time
    const defaultVariant = product.variants?.find(v => v.is_default) || product.variants?.[0];
    setAdjustmentData({
      quantity: 0,
      type: 'in',
      reason: '',
      notes: '',
      variant_id: defaultVariant?.id || '',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStockStatus = (product) => {
    const currentStock = product.stock_quantity || 0;
    const minStock = product.min_stock_level || 0;
    
    if (currentStock <= 0) {
      return { status: 'out', color: 'bg-red-100 text-red-800', label: 'Out of Stock' };
    } else if (currentStock <= minStock) {
      return { status: 'low', color: 'bg-yellow-100 text-yellow-800', label: 'Low Stock' };
    } else {
      return { status: 'good', color: 'bg-green-100 text-green-800', label: 'In Stock' };
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || product.category_name === selectedCategory;
    // Low stock: some stock exists but is at or below the minimum. Out-of-stock is excluded.
    const matchesLowStock = !showLowStock || (
      product.stock_quantity > 0 && product.stock_quantity <= (product.min_stock_level || 0)
    );
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, showLowStock]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(pageStartIndex, pageStartIndex + PRODUCTS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const categories = [...new Set(products.map(product => product.category_name).filter(Boolean))];

  // For variant products use sum(variant.stock × variant.price) for accuracy.
  const totalValue = products.reduce((sum, product) => {
    if (product.variants && product.variants.length > 0) {
      return sum + product.variants.reduce(
        (vSum, v) => vSum + (v.stock_quantity || 0) * (parseFloat(v.price) || 0), 0
      );
    }
    return sum + (product.stock_quantity || 0) * (product.price || 0);
  }, 0);

  // Low stock: stock is positive but at or below min level (out-of-stock is separate)
  const lowStockCount = products.filter(
    p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 0)
  ).length;
  const outOfStockCount = products.filter(product => product.stock_quantity <= 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-3 text-lg text-muted-foreground">Loading inventory...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_INVENTORY}>
      <div className="admin-page">
        <div className="admin-page-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="admin-page-title">Inventory Management</h1>
              <p className="admin-page-description">Track stock levels, adjustments, receipts, and purchase-order intake.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
              <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="admin-stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold text-foreground">{products.length}</p>
                </div>
                <CubeIcon className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="admin-stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
                </div>
                <CubeIcon className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="admin-stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-foreground">{lowStockCount}</p>
                </div>
                <ExclamationTriangleIcon className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="admin-stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-foreground">{outOfStockCount}</p>
                </div>
                <ExclamationTriangleIcon className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="admin-section">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Inventory Overview</CardTitle>
                <p className="text-sm text-muted-foreground">Use filters to find stock issues quickly and review recent movement details.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="input-icon-left" />
                  <input type="text" placeholder="Search products..." className="input-field input-with-left-icon w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="input-field" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(category => (<option key={category} value={category}>{category}</option>))}
                </select>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="lowStock" 
                    checked={showLowStock} 
                    onChange={(e) => setShowLowStock(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="lowStock" className="text-sm font-medium">Low Stock Only</label>
                </div>
                <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory(''); setShowLowStock(false); }}>Clear</Button>
                <Button onClick={fetchProducts} variant="outline">
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"><p className="text-destructive-foreground">{error}</p></div>)}

        <Card className="admin-section overflow-hidden">
          <CardContent className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardDocumentListIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            ) : (
              <div className="divide-y">
                {paginatedProducts.map((product) => {
                  const stockStatus = getStockStatus(product);
                  
                  return (
                    <div key={product.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 mb-3 sm:mb-0">
                          <div className="flex items-start justify-between sm:items-center sm:space-x-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {canManageInventory ? (
                                  <button
                                    type="button"
                                    onClick={() => openAdjustmentModal(product)}
                                    className="text-left text-base sm:text-lg font-medium text-foreground truncate hover:text-primary transition-colors"
                                    title="Adjust stock"
                                  >
                                    {product.name}
                                  </button>
                                ) : (
                                  <h3 className="text-base sm:text-lg font-medium text-foreground truncate">{product.name}</h3>
                                )}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stockStatus.color}`}>
                                  {stockStatus.label}
                                </span>
                                {product.variants && product.variants.length > 0 && (() => {
                                  const outCount = product.variants.filter(v => v.is_active && (v.stock_quantity ?? 0) === 0).length;
                                  return outCount > 0 ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                      {outCount} variant{outCount > 1 ? 's' : ''} out
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <div className="mt-1 space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-sm text-muted-foreground">
                                <div><span className="font-medium">Stock:</span> {product.stock_quantity || 0} {product.unit}</div>
                                <div><span className="font-medium">Min Level:</span> {product.min_stock_level || 0}</div>
                                {(!product.variants || product.variants.length === 0) && (
                                  <div><span className="font-medium">Price:</span> {formatCurrency(product.price)}</div>
                                )}
                                {product.sku && <div><span className="font-medium">SKU:</span> {product.sku}</div>}
                              </div>
                              {product.variants && product.variants.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  {product.variants.map(v => (
                                    <span key={v.id}>
                                      <span className="font-medium">{v.variant_name}:</span>{' '}
                                      {v.stock_quantity ?? 0} units @ {formatCurrency(v.price)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 text-sm text-muted-foreground">
                                <span className="font-medium">Value:</span>{' '}
                                {product.variants && product.variants.length > 0
                                  ? formatCurrency(product.variants.reduce(
                                      (s, v) => s + (v.stock_quantity || 0) * (parseFloat(v.price) || 0), 0
                                    ))
                                  : formatCurrency((product.stock_quantity || 0) * (product.price || 0))
                                }
                                {product.category_name && (
                                  <span className="ml-4"><span className="font-medium">Category:</span> {product.category_name}</span>
                                )}
                              </div>
                            </div>
                            <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_INVENTORY}>
                              <div className="hidden sm:flex items-center space-x-2 ml-4">
                                <Button variant="ghost" size="icon" onClick={() => { setShowMovements(product); fetchStockMovements(product.id); }} className="h-9 w-9 text-muted-foreground hover:text-primary" title="View Stock History">
                                  <EyeIcon className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setShowPOBreakdown(product); fetchPurchaseOrders(product.id); }} className="h-9 w-9 text-muted-foreground hover:text-blue-600" title="View Purchase Orders">
                                  <ClipboardDocumentListIcon className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openAdjustmentModal(product)} className="h-9 w-9 text-muted-foreground hover:text-primary" title="Adjust Stock">
                                  <AdjustmentsHorizontalIcon className="w-4 h-4" />
                                </Button>
                              </div>
                            </PermissionGuard>
                          </div>
                        </div>
                        <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_INVENTORY}>
                          <div className="flex sm:hidden space-x-2 mt-3 pt-3 border-t">
                            <Button variant="outline" size="sm" onClick={() => { setShowMovements(product); fetchStockMovements(product.id); }} className="flex-1">
                              <EyeIcon className="w-4 h-4 mr-2" />History
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setShowPOBreakdown(product); fetchPurchaseOrders(product.id); }} className="flex-1">
                              <ClipboardDocumentListIcon className="w-4 h-4 mr-2" />POs
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openAdjustmentModal(product)} className="flex-1">
                              <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />Adjust
                            </Button>
                          </div>
                        </PermissionGuard>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        {filteredProducts.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {pageStartIndex + 1}-{Math.min(pageStartIndex + PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {showAdjustment && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-2xl rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Adjust Stock - {showAdjustment.name}
                  </h2>
                  <button onClick={() => setShowAdjustment(null)} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="admin-dialog-body space-y-6">
                <div className="admin-dialog-section-muted">
                  <div className="admin-dialog-grid-2 text-sm">
                    <div><span className="font-medium">Total Stock:</span> {showAdjustment.stock_quantity || 0} {showAdjustment.unit}</div>
                    <div><span className="font-medium">Min Level:</span> {showAdjustment.min_stock_level || 0}</div>
                  </div>
                </div>

                {showAdjustment.variants && showAdjustment.variants.length > 0 && (
                  <div>
                    <label className="admin-dialog-label">Variant *</label>
                    <select
                      required
                      className="input-field"
                      value={adjustmentData.variant_id}
                      onChange={(e) => setAdjustmentData({...adjustmentData, variant_id: e.target.value})}
                    >
                      {showAdjustment.variants.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.variant_name} — {v.stock_quantity ?? 0} in stock
                        </option>
                      ))}
                    </select>
                    {adjustmentData.variant_id && (() => {
                      const selectedVariant = showAdjustment.variants.find(v => v.id === adjustmentData.variant_id);
                      return selectedVariant ? (
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          Current stock for <span className="font-medium">{selectedVariant.variant_name}</span>: <span className="font-semibold text-foreground">{selectedVariant.stock_quantity ?? 0}</span>
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                <div className="admin-dialog-grid-2">
                  <div>
                    <label className="admin-dialog-label">Adjustment Type *</label>
                    <select
                      required
                      className="input-field"
                      value={adjustmentData.type}
                      onChange={(e) => setAdjustmentData({...adjustmentData, type: e.target.value})}
                    >
                      <option value="in">Increase Stock</option>
                      <option value="out">Decrease Stock</option>
                    </select>
                  </div>
                  <div>
                    <label className="admin-dialog-label">Quantity *</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      className="input-field"
                      value={adjustmentData.quantity}
                      onChange={(e) => setAdjustmentData({...adjustmentData, quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div>
                  <label className="admin-dialog-label">Reason</label>
                  <select 
                    className="input-field" 
                    value={adjustmentData.reason} 
                    onChange={(e) => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                  >
                    <option value="">Select Reason</option>
                    <option value="Stock Take Adjustment">Stock Take Adjustment</option>
                    <option value="Damaged Goods">Damaged Goods</option>
                    <option value="Return from Customer">Return from Customer</option>
                    <option value="Manual Correction">Manual Correction</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="admin-dialog-label">Notes</label>
                  <textarea 
                    rows={3} 
                    className="input-field" 
                    value={adjustmentData.notes} 
                    onChange={(e) => setAdjustmentData({...adjustmentData, notes: e.target.value})} 
                  />
                </div>

                <div className="admin-dialog-footer admin-dialog-footer-sticky">
                  <Button type="button" variant="outline" onClick={() => setShowAdjustment(null)}>Cancel</Button>
                  <Button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleStockAdjustment}
                    disabled={adjustmentData.quantity <= 0}
                  >
                    Adjust Stock
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Movements Modal */}
        {showMovements && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Stock Movement History - {showMovements.name}
                  </h2>
                  <button onClick={() => setShowMovements(null)} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="admin-dialog-body space-y-6">
                <div className="admin-dialog-section-muted">
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div><span className="font-medium">Current Stock:</span> {showMovements.stock_quantity || 0} {showMovements.variants?.length > 0 ? 'units' : showMovements.unit}</div>
                    <div><span className="font-medium">Min Level:</span> {showMovements.min_stock_level || 0}</div>
                    {(!showMovements.variants || showMovements.variants.length === 0) && (
                      <div><span className="font-medium">Price:</span> {formatCurrency(showMovements.price)}</div>
                    )}
                    <div>
                      <span className="font-medium">Total Value:</span>{' '}
                      {showMovements.variants && showMovements.variants.length > 0
                        ? formatCurrency(showMovements.variants.reduce((s, v) => s + (v.stock_quantity || 0) * (parseFloat(v.price) || 0), 0))
                        : formatCurrency((showMovements.stock_quantity || 0) * (showMovements.price || 0))
                      }
                    </div>
                  </div>
                </div>

                {stockMovements.length === 0 ? (
                  <div className="text-center py-8">
                    <TruckIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No stock movements found for this product</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stockMovements.map((movement, index) => (
                      <div key={index} className="flex justify-between items-center py-3 px-4 border border-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          {movement.movement_type === 'in' ? (
                            <ArrowUpIcon className="w-5 h-5 text-green-600" />
                          ) : (
                            <ArrowDownIcon className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium">
                              {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity} {showMovements.unit}
                              {movement.variant?.variant_name && (
                                <span className="ml-1.5 text-sm font-normal text-muted-foreground">({movement.variant.variant_name})</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">{movement.reason}</p>
                            {movement.party_name && (
                              <p className="text-sm text-muted-foreground">Party: {movement.party_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {new Date(movement.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(movement.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Purchase Orders Breakdown Modal */}
        {showPOBreakdown && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Purchase Orders - {showPOBreakdown.name}
                  </h2>
                  <button onClick={() => setShowPOBreakdown(null)} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="admin-dialog-body space-y-6">
                <div className="admin-dialog-section-muted">
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div><span className="font-medium">Current Stock:</span> {showPOBreakdown.stock_quantity || 0} {showPOBreakdown.unit}</div>
                    <div><span className="font-medium">Min Level:</span> {showPOBreakdown.min_stock_level || 0}</div>
                    <div><span className="font-medium">Price:</span> {formatCurrency(showPOBreakdown.price)}</div>
                    <div><span className="font-medium">Total POs:</span> {purchaseOrders.length}</div>
                  </div>
                </div>

                {purchaseOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardDocumentListIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No purchase orders found for this product</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchaseOrders.map((po, index) => (
                      <div key={index} className="border border-muted rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium text-foreground">{po.po_number}</h3>
                            <div className="text-sm text-muted-foreground">
                              <span>Party: {po.party?.name}</span> • 
                              <span className="ml-1">Date: {new Date(po.order_date).toLocaleDateString()}</span> •
                              <span className="ml-1 capitalize">{po.status}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            po.status === 'received' ? 'bg-green-100 text-green-800' :
                            po.status === 'partial_received' ? 'bg-yellow-100 text-yellow-800' :
                            po.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {po.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {po.items?.map((item, itemIndex) => (
                            <div key={itemIndex} className="bg-muted/30 p-3 rounded border-l-4 border-primary/30">
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-4 text-sm">
                                    <span><strong>Qty:</strong> {item.quantity} {item.unit}</span>
                                    <span><strong>Received:</strong> {item.received_quantity || 0}</span>
                                    <span><strong>Pending:</strong> {item.pending_quantity || item.quantity}</span>
                                    <span><strong>Rate:</strong> {formatCurrency(item.price_per_unit)}</span>
                                  </div>
                                  {item.pending_quantity > 0 && po.status === 'confirmed' && (
                                    <div className="mt-2">
                                      <span className="text-xs text-orange-600 font-medium">⏳ Pending Receipt</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  {item.pending_quantity > 0 && ['confirmed', 'partial_received'].includes(po.status) && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                        setShowReceiveItem({
                                          product_id: showPOBreakdown.id,
                                          purchase_order_item_id: item.id,
                                          item_name: item.item_name,
                                          pending_quantity: item.pending_quantity,
                                          unit: item.unit,
                                          po_number: po.po_number
                                        });
                                      }}
                                      className="text-xs"
                                    >
                                      <TruckIcon className="w-3 h-3 mr-1" />
                                      Receive
                                    </Button>
                                  )}
                                  {item.is_fully_received && (
                                    <span className="text-xs text-green-600 font-medium">✅ Fully Received</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Receive Item Modal */}
        {showReceiveItem && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-2xl rounded-3xl border bg-card shadow-2xl">
              <div className="admin-dialog-header admin-dialog-header-sticky">
                <div className="flex items-center justify-between">
                  <h2 className="admin-dialog-title">
                    Receive Item - {showReceiveItem.item_name}
                  </h2>
                  <button onClick={() => setShowReceiveItem(null)} className="admin-dialog-close">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="admin-dialog-body space-y-6">
                <div className="admin-dialog-section-muted">
                  <div className="admin-dialog-grid-2 text-sm">
                    <div><span className="font-medium">PO Number:</span> {showReceiveItem.po_number}</div>
                    <div><span className="font-medium">Pending Quantity:</span> {showReceiveItem.pending_quantity} {showReceiveItem.unit}</div>
                  </div>
                </div>

                <div>
                  <label className="admin-dialog-label">Receive Quantity *</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    max={showReceiveItem.pending_quantity}
                    required 
                    className="input-field" 
                    placeholder="0"
                    value={receiveData.receive_quantity} 
                    onChange={(e) => setReceiveData({...receiveData, receive_quantity: parseFloat(e.target.value) || 0})} 
                  />
                </div>

                <div>
                  <label className="admin-dialog-label">Notes</label>
                  <textarea 
                    rows={3} 
                    className="input-field" 
                    placeholder="Optional notes about this receipt..."
                    value={receiveData.notes} 
                    onChange={(e) => setReceiveData({...receiveData, notes: e.target.value})} 
                  />
                </div>

                <div className="admin-dialog-footer admin-dialog-footer-sticky">
                  <Button type="button" variant="outline" onClick={() => setShowReceiveItem(null)}>Cancel</Button>
                  <Button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleReceiveItem}
                    disabled={receiveData.receive_quantity <= 0 || receiveData.receive_quantity > showReceiveItem.pending_quantity}
                  >
                    <TruckIcon className="w-4 h-4 mr-2" />
                    Receive {receiveData.receive_quantity} {showReceiveItem.unit}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default InventoryManagement;
