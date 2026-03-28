import React, { useState, useEffect, useMemo } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import EnhancedImageGalleryManager from '../../components/EnhancedImageGalleryManager';
import ProductImagePreview from '../../components/ProductImagePreview';
import UnitSelectionDialog from '../../components/UnitSelectionDialog';
import AddProductModal from './components/AddProductModal';
import ProductVariantManager from './components/ProductVariantManager';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  Squares2X2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../config/apiBaseUrl';
const ITEMS_PER_PAGE = 15;

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnitSelectionDialog, setShowUnitSelectionDialog] = useState(false);
  const [showVariantManager, setShowVariantManager] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
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
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowAddForm(true);
  };

  const handleProductAdded = () => {
    fetchProducts();
  };

  const handleCloseModal = () => {
    setShowAddForm(false);
    setEditingProduct(null);
    resetForm();
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleStatusChange = async (productId, isActive) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (response.ok) {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: isActive } : p));
      }
    } catch (error) {
      console.error('Error updating product status:', error);
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
  };

  const handleOpenImageGallery = (product) => {
    setSelectedProductForImages(product);
    setShowImageGallery(true);
  };

  const handleCloseImageGallery = () => {
    setShowImageGallery(false);
    setSelectedProductForImages(null);
  };

  const handleOpenVariantManager = (product) => {
    setSelectedProductForVariants(product);
    setShowVariantManager(true);
  };

  const handleCloseVariantManager = () => {
    setShowVariantManager(false);
    setSelectedProductForVariants(null);
  };

  const handleUnitSave = (unitData) => {
    setFormData({
      ...formData,
      base_unit: unitData.base_unit,
      secondary_unit: unitData.secondary_unit,
      unit_conversion_value: unitData.unit_conversion_value
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const filteredProducts = useMemo(() => products.filter(product => {
    if (statusFilter === 'active' && !product.is_active) return false;
    if (statusFilter === 'inactive' && product.is_active) return false;
    const q = searchTerm.toLowerCase();
    return !q ||
      product.name.toLowerCase().includes(q) ||
      product.sku?.toLowerCase().includes(q) ||
      product.item_hsn?.toLowerCase().includes(q);
  }), [products, searchTerm, statusFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
        case 'price': aVal = Number(a.price) || 0; bVal = Number(b.price) || 0; break;
        case 'stock': aVal = Number(a.stock_quantity) || 0; bVal = Number(b.stock_quantity) || 0; break;
        case 'status': aVal = a.is_active ? 1 : 0; bVal = b.is_active ? 1 : 0; break;
        default: return 0;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortDir]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUpDownIcon className="h-3.5 w-3.5 ml-1 text-muted-foreground/40" />;
    return sortDir === 'asc'
      ? <ChevronUpIcon className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ChevronDownIcon className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;
    const pageWindow = () => {
      if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
      if (currentPage <= 3) return [1, 2, 3, 4, 5];
      if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    };
    return (
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length)} of {sortedProducts.length} products
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="admin-icon-button disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          {pageWindow().map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="admin-icon-button disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_PRODUCTS}>
      <div className="admin-page">

      {/* Header & Search */}
      <div className="admin-page-header">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="admin-page-title">Product Management</h1>
            <p className="admin-page-description">Manage products, inventory visibility, images, and variants.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { key: 'all',      label: 'All',      count: products.length },
                { key: 'active',   label: 'Active',   count: products.filter(p => p.is_active).length },
                { key: 'inactive', label: 'Inactive', count: products.filter(p => !p.is_active).length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    statusFilter === key ? 'bg-primary/20' : 'bg-muted'
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingProduct(null);
              resetForm();
            }}
            className="btn-primary inline-flex items-center justify-center gap-2 self-start rounded-lg"
          >
            <PlusIcon className="h-4 w-4" />
            Add Product
          </button>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="input-icon-left" />
          <input
            type="text"
            placeholder="Search products by name, SKU or HSN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field input-with-left-icon block w-full"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="admin-section overflow-hidden">
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
              {searchTerm ? 'Try adjusting your search' : statusFilter === 'inactive' ? 'No inactive products — all products are active.' : 'Add your first product to get started!'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="admin-table-wrap hidden xl:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="w-[11%]">Media</th>
                    <th className="w-[27%]">
                      <button onClick={() => handleSort('name')} className="inline-flex items-center hover:text-foreground transition-colors">
                        Product <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="w-[10%]">SKU / HSN</th>
                    <th className="w-[10%]">
                      <button onClick={() => handleSort('price')} className="inline-flex items-center hover:text-foreground transition-colors">
                        Price <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="w-[12%]">
                      <button onClick={() => handleSort('stock')} className="inline-flex items-center hover:text-foreground transition-colors">
                        Stock <SortIcon field="stock" />
                      </button>
                    </th>
                    <th className="w-[12%]">
                      <button onClick={() => handleSort('status')} className="inline-flex items-center hover:text-foreground transition-colors">
                        Status <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="w-[8%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50 transition-colors duration-200">
                      {/* Media column: thumbnail + Images/Variants buttons */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                            <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenImageGallery(product)}
                              className="inline-flex h-6 items-center rounded-md border border-border/70 bg-muted/30 px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                              title="Manage Images"
                            >
                              <PhotoIcon className="h-3 w-3 mr-0.5" />
                              Images
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenVariantManager(product)}
                              className="inline-flex h-6 items-center rounded-md border border-border/70 bg-muted/30 px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                              title="Manage Variants"
                            >
                              <Squares2X2Icon className="h-3 w-3 mr-0.5" />
                              Variants
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* Product name + description */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleEdit(product)}
                          className="group inline-flex max-w-full items-center gap-1 text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          <span className="truncate">{product.name}</span>
                          <PencilIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </button>
                        {product.description && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground max-w-[220px]">
                            {product.description}
                          </p>
                        )}
                      </td>
                      {/* SKU / HSN */}
                      <td className="whitespace-nowrap">
                        <div className="text-[13px] text-foreground">{product.sku || '—'}</div>
                        {product.item_hsn && (
                          <div className="text-[11px] text-muted-foreground">HSN {product.item_hsn}</div>
                        )}
                      </td>
                      {/* Price */}
                      <td className="whitespace-nowrap">
                        <div className="text-sm font-semibold text-foreground">₹{product.price}</div>
                        <div className="text-[11px] text-muted-foreground">per {product.unit || 'kg'}</div>
                      </td>
                      {/* Stock */}
                      <td className="whitespace-nowrap">
                        {product.variants && product.variants.length > 0 ? (
                          <div className="space-y-0.5">
                            {product.variants.map(v => (
                              <div key={v.id} className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  v.stock_quantity <= 0
                                    ? 'bg-destructive/10 text-destructive'
                                    : 'bg-success/10 text-success'
                                }`}>
                                  {v.stock_quantity ?? 0}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{v.variant_name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              product.stock_quantity <= product.min_stock_level
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-success/10 text-success'
                            }`}>
                              {product.stock_quantity || 0} {product.unit || 'kg'}
                            </span>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">min {product.min_stock_level || 0}</div>
                          </>
                        )}
                      </td>
                      {/* Status dropdown */}
                      <td className="whitespace-nowrap">
                        <select
                          value={product.is_active ? 'active' : 'inactive'}
                          onChange={(e) => handleStatusChange(product.id, e.target.value === 'active')}
                          className={`inline-flex h-7 cursor-pointer items-center rounded-full border-0 px-2.5 py-1 text-[11px] font-medium focus:ring-2 focus:ring-primary ${
                            product.is_active
                              ? 'bg-success/10 text-success'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      {/* Actions */}
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {product.stock_quantity <= product.min_stock_level && (
                            <ExclamationTriangleIcon
                              className="h-4 w-4 text-destructive flex-shrink-0"
                              title="Low stock"
                            />
                          )}
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="admin-icon-button border-rose-200/80 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            aria-label={`Delete ${product.name}`}
                            title="Delete product"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="xl:hidden divide-y">
              {paginatedProducts.map((product) => (
                <div key={product.id} className="p-4 hover:bg-muted/40 transition-colors duration-200 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                      <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(product)}
                          className="group inline-flex max-w-full items-center gap-1 text-left text-sm font-semibold leading-tight text-foreground transition-colors hover:text-primary"
                        >
                          <span className="truncate">{product.name}</span>
                          <PencilIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </button>
                        <select
                          value={product.is_active ? 'active' : 'inactive'}
                          onChange={(e) => handleStatusChange(product.id, e.target.value === 'active')}
                          className={`flex-shrink-0 h-7 cursor-pointer rounded-full border-0 px-2.5 py-1 text-[11px] font-medium focus:ring-2 focus:ring-primary ${
                            product.is_active
                              ? 'bg-success/10 text-success'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      {product.description && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-1">{product.description}</p>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                        <div><span className="text-muted-foreground">SKU:</span><span className="ml-1 text-foreground">{product.sku || '—'}</span></div>
                        <div><span className="text-muted-foreground">Price:</span><span className="ml-1 font-semibold text-foreground">₹{product.price}</span></div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            product.stock_quantity <= product.min_stock_level ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                          }`}>
                            {product.stock_quantity || 0} {product.unit || 'kg'}
                            {product.stock_quantity <= product.min_stock_level && <ExclamationTriangleIcon className="w-3 h-3 ml-1" />}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleOpenImageGallery(product)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-card px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        >
                          <PhotoIcon className="mr-1 h-3.5 w-3.5" />
                          Images
                        </button>
                        <button
                          onClick={() => handleOpenVariantManager(product)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-card px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        >
                          <Squares2X2Icon className="mr-1 h-3.5 w-3.5" />
                          Variants
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50 px-2 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          <TrashIcon className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination />
          </>
        )}
      </div>

      <AddProductModal
        isOpen={showAddForm}
        onClose={handleCloseModal}
        onProductAdded={handleProductAdded}
        editingProduct={editingProduct}
        mode={editingProduct ? 'edit' : 'add'}
        apiBaseUrl={API_BASE_URL}
      />

      <EnhancedImageGalleryManager
        productId={selectedProductForImages?.id}
        isOpen={showImageGallery}
        onClose={handleCloseImageGallery}
        onImagesUpdate={fetchProducts}
      />

      <UnitSelectionDialog
        isOpen={showUnitSelectionDialog}
        onClose={() => setShowUnitSelectionDialog(false)}
        onSave={handleUnitSave}
        baseUnit={formData.base_unit}
        secondaryUnit={formData.secondary_unit}
        unitConversionValue={formData.unit_conversion_value}
      />

      <ProductVariantManager
        isOpen={showVariantManager}
        onClose={handleCloseVariantManager}
        product={selectedProductForVariants}
        onSave={fetchProducts}
      />
      </div>
    </PermissionGuard>
  );
};

export default ProductManagement;
