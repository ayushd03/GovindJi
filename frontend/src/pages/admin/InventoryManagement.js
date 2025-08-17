import React, { useState, useEffect } from 'react';
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
  PlusIcon,
  MinusIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { Toaster } from '../../components/ui/toaster';

const InventoryManagement = () => {
  const { toast } = useToast();
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
  const [adjustmentData, setAdjustmentData] = useState({
    quantity: 0,
    type: 'in',
    reason: '',
    notes: ''
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const showSuccess = (message) => {
    toast({
      title: "Success",
      description: message,
      variant: "success",
      duration: 3000,
    });
  };

  const showError = (message) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
      duration: 5000,
    });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
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
  };

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

  const handleStockAdjustment = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${showAdjustment.id}/stock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quantity_change: adjustmentData.type === 'in' ? adjustmentData.quantity : -adjustmentData.quantity,
          reason: adjustmentData.reason || `Manual ${adjustmentData.type === 'in' ? 'increase' : 'decrease'}`,
          notes: adjustmentData.notes
        })
      });

      if (!response.ok) throw new Error('Failed to adjust stock');

      await fetchProducts();
      setShowAdjustment(null);
      setAdjustmentData({ quantity: 0, type: 'in', reason: '', notes: '' });
      showSuccess('Stock adjusted successfully');
    } catch (err) {
      showError('Failed to adjust stock');
    }
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
    const matchesLowStock = !showLowStock || product.stock_quantity <= product.min_stock_level;
    
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const categories = [...new Set(products.map(product => product.category_name).filter(Boolean))];
  const totalValue = products.reduce((sum, product) => sum + ((product.stock_quantity || 0) * (product.price || 0)), 0);
  const lowStockCount = products.filter(product => product.stock_quantity <= product.min_stock_level).length;
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
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
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
          
          <Card>
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
          
          <Card>
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
          
          <Card>
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

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg">Inventory Management</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden">
                  <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="text" placeholder="Search products..." className="input-field w-full pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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

        <Card>
          <CardContent className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardDocumentListIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product);
                  
                  return (
                    <div key={product.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 mb-3 sm:mb-0">
                          <div className="flex items-start justify-between sm:items-center sm:space-x-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base sm:text-lg font-medium text-foreground truncate">{product.name}</h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stockStatus.color}`}>
                                  {stockStatus.label}
                                </span>
                              </div>
                              <div className="mt-1 space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-sm text-muted-foreground">
                                <div><span className="font-medium">Stock:</span> {product.stock_quantity || 0} {product.unit}</div>
                                <div><span className="font-medium">Min Level:</span> {product.min_stock_level || 0}</div>
                                <div><span className="font-medium">Price:</span> {formatCurrency(product.price)}</div>
                                {product.sku && <div><span className="font-medium">SKU:</span> {product.sku}</div>}
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                <span className="font-medium">Value:</span> {formatCurrency((product.stock_quantity || 0) * (product.price || 0))}
                                {product.category_name && (
                                  <span className="ml-4"><span className="font-medium">Category:</span> {product.category_name}</span>
                                )}
                              </div>
                            </div>
                            <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_INVENTORY}>
                              <div className="hidden sm:flex items-center space-x-2 ml-4">
                                <Button variant="ghost" size="icon" onClick={() => { setShowMovements(product); fetchStockMovements(product.id); }} className="h-9 w-9 text-muted-foreground hover:text-primary">
                                  <EyeIcon className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setShowAdjustment(product)} className="h-9 w-9 text-muted-foreground hover:text-primary">
                                  <AdjustmentsHorizontalIcon className="w-4 h-4" />
                                </Button>
                              </div>
                            </PermissionGuard>
                          </div>
                        </div>
                        <PermissionGuard permission={ADMIN_PERMISSIONS.MANAGE_INVENTORY}>
                          <div className="flex sm:hidden space-x-2 mt-3 pt-3 border-t">
                            <Button variant="outline" size="sm" onClick={() => { setShowMovements(product); fetchStockMovements(product.id); }} className="flex-1">
                              <EyeIcon className="w-4 h-4 mr-2" />View History
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowAdjustment(product)} className="flex-1">
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

        {/* Stock Adjustment Modal */}
        {showAdjustment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Adjust Stock - {showAdjustment.name}
                  </h2>
                  <button onClick={() => setShowAdjustment(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Current Stock:</span> {showAdjustment.stock_quantity || 0} {showAdjustment.unit}</div>
                    <div><span className="font-medium">Min Level:</span> {showAdjustment.min_stock_level || 0}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Adjustment Type *</label>
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
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Quantity *</label>
                    <input 
                      type="number" 
                      step="0.001" 
                      required 
                      className="input-field" 
                      value={adjustmentData.quantity} 
                      onChange={(e) => setAdjustmentData({...adjustmentData, quantity: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Reason</label>
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                  <textarea 
                    rows={3} 
                    className="input-field" 
                    value={adjustmentData.notes} 
                    onChange={(e) => setAdjustmentData({...adjustmentData, notes: e.target.value})} 
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    Stock Movement History - {showMovements.name}
                  </h2>
                  <button onClick={() => setShowMovements(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="font-medium">Current Stock:</span> {showMovements.stock_quantity || 0} {showMovements.unit}</div>
                    <div><span className="font-medium">Min Level:</span> {showMovements.min_stock_level || 0}</div>
                    <div><span className="font-medium">Price:</span> {formatCurrency(showMovements.price)}</div>
                    <div><span className="font-medium">Total Value:</span> {formatCurrency((showMovements.stock_quantity || 0) * (showMovements.price || 0))}</div>
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
        
        <Toaster />
      </div>
    </PermissionGuard>
  );
};

export default InventoryManagement;