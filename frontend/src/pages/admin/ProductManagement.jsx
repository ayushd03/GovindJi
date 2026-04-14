import React, { useEffect, useMemo, useState } from 'react';
import { PermissionGuard } from '../../components/PermissionGuard';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from '../../components/AdminDialog';
import { ADMIN_PERMISSIONS } from '../../enums/roles';
import EnhancedImageGalleryManager from '../../components/EnhancedImageGalleryManager';
import ProductImagePreview from '../../components/ProductImagePreview';
import AddProductModal from './components/AddProductModal';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import { getProductPricing } from '../../utils/productPricing';
import { ITEMS_PER_PAGE } from '../../constants/adminConstants';

const SORT_FIELD_LABELS = {
  name: 'Name',
  price: 'Price',
  stock: 'Stock',
  status: 'Visibility',
};

const getVariantAttentionCount = (product, pricing) => {
  if (!pricing.hasVariants) {
    return 0;
  }

  const fallbackThreshold = Number(product.min_stock_level) || 0;

  return pricing.variants.filter((variant) => {
    const variantStock = Number(variant.stock_quantity) || 0;
    const variantThreshold = Number(variant.min_stock_level ?? fallbackThreshold) || 0;
    return variantStock <= variantThreshold;
  }).length;
};

const isProductLowStock = (product, pricing = getProductPricing(product)) => {
  if (!pricing.hasVariants) {
    return (Number(product.stock_quantity) || 0) <= (Number(product.min_stock_level) || 0);
  }

  return getVariantAttentionCount(product, pricing) > 0;
};

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [productPendingDelete, setProductPendingDelete] = useState(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

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
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : (data.products || []));
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

  const handleDelete = async () => {
    if (!productPendingDelete) {
      return;
    }

    try {
      setIsDeletingProduct(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productPendingDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setProductPendingDelete(null);
        await fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleOpenDeleteDialog = (product) => {
    setProductPendingDelete(product);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeletingProduct) {
      return;
    }

    setProductPendingDelete(null);
  };

  const handleStatusChange = async (productId, isActive) => {
    try {
      setStatusUpdatingId(productId);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (response.ok) {
        setProducts((currentProducts) => currentProducts.map((product) => (
          product.id === productId ? { ...product, is_active: isActive } : product
        )));
      }
    } catch (error) {
      console.error('Error updating product status:', error);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleOpenImageGallery = (product) => {
    setSelectedProductForImages(product);
    setShowImageGallery(true);
  };

  const handleCloseImageGallery = () => {
    setShowImageGallery(false);
    setSelectedProductForImages(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((currentSortDir) => (currentSortDir === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDir('asc');
    setCurrentPage(1);
  };

  const productStats = useMemo(() => products.reduce((summary, product) => {
    const pricing = getProductPricing(product);

    if (product.is_active) {
      summary.active += 1;
    } else {
      summary.inactive += 1;
    }

    if (pricing.hasVariants) {
      summary.withVariants += 1;
    }

    if (isProductLowStock(product, pricing)) {
      summary.needsAttention += 1;
    }

    return summary;
  }, {
    total: products.length,
    active: 0,
    inactive: 0,
    withVariants: 0,
    needsAttention: 0,
  }), [products]);

  const statusOptions = useMemo(() => ([
    {
      key: 'all',
      label: 'All',
      count: productStats.total,
    },
    {
      key: 'active',
      label: 'Visible',
      count: productStats.active,
    },
    {
      key: 'inactive',
      label: 'Hidden',
      count: productStats.inactive,
    },
  ]), [productStats]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    if (statusFilter === 'active' && !product.is_active) return false;
    if (statusFilter === 'inactive' && product.is_active) return false;

    const query = searchTerm.trim().toLowerCase();
    return !query
      || product.name.toLowerCase().includes(query)
      || product.sku?.toLowerCase().includes(query)
      || product.item_hsn?.toLowerCase().includes(query);
  }), [products, searchTerm, statusFilter]);

  const sortedProducts = useMemo(() => (
    [...filteredProducts].sort((left, right) => {
      let leftValue;
      let rightValue;
      const leftPricing = (sortField === 'price' || sortField === 'stock')
        ? getProductPricing(left)
        : null;
      const rightPricing = (sortField === 'price' || sortField === 'stock')
        ? getProductPricing(right)
        : null;

      switch (sortField) {
        case 'name':
          leftValue = (left.name || '').toLowerCase();
          rightValue = (right.name || '').toLowerCase();
          break;
        case 'price':
          leftValue = leftPricing?.hasVariants ? leftPricing.minPrice : (leftPricing?.selectedPrice || 0);
          rightValue = rightPricing?.hasVariants ? rightPricing.minPrice : (rightPricing?.selectedPrice || 0);
          break;
        case 'stock':
          leftValue = leftPricing?.hasVariants ? leftPricing.totalStock : (Number(left.stock_quantity) || 0);
          rightValue = rightPricing?.hasVariants ? rightPricing.totalStock : (Number(right.stock_quantity) || 0);
          break;
        case 'status':
          leftValue = left.is_active ? 1 : 0;
          rightValue = right.is_active ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (leftValue < rightValue) return sortDir === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortDir === 'asc' ? 1 : -1;
      return 0;
    })
  ), [filteredProducts, sortDir, sortField]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ChevronUpDownIcon className="ml-1 h-3.5 w-3.5 text-muted-foreground/40" />;
    }

    return sortDir === 'asc'
      ? <ChevronUpIcon className="ml-1 h-3.5 w-3.5 text-primary" />
      : <ChevronDownIcon className="ml-1 h-3.5 w-3.5 text-primary" />;
  };

  const Pagination = () => {
    if (totalPages <= 1) {
      return null;
    }

    const getPageWindow = () => {
      if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
      }

      if (currentPage <= 3) {
        return [1, 2, 3, 4, 5];
      }

      if (currentPage >= totalPages - 2) {
        return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      }

      return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    };

    return (
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedProducts.length)} of {sortedProducts.length} products
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="admin-icon-button disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          {getPageWindow().map((page) => (
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
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="admin-icon-button disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderVisibilityControl = (product) => {
    const isVisible = product.is_active;
    const isUpdating = statusUpdatingId === product.id;

    return (
      <button
        type="button"
        onClick={() => handleStatusChange(product.id, !isVisible)}
        disabled={isUpdating}
        aria-pressed={isVisible}
        title={isVisible ? 'Hide from storefront' : 'Show on storefront'}
        className={`inline-flex h-9 min-w-[108px] items-center justify-between rounded-full border px-2 py-1 text-[12px] font-medium transition-all ${
          isVisible
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
        } ${isUpdating ? 'cursor-wait opacity-70' : 'shadow-sm'}`}
      >
        <span className="pl-1 text-left">{isUpdating ? 'Updating' : (isVisible ? 'Visible' : 'Hidden')}</span>
        <span
          className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
            isVisible ? 'bg-emerald-200/80' : 'bg-slate-200'
          }`}
          aria-hidden="true"
        >
          <span
            className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              isVisible ? 'translate-x-4' : 'translate-x-0'
            } ${isUpdating ? 'animate-pulse' : ''}`}
          />
        </span>
      </button>
    );
  };

  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_PRODUCTS}>
      <div className="admin-page">
        <div className="admin-page-header border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Catalog</p>
                <h1 className="admin-page-title mt-1 text-slate-950">Products</h1>
                <p className="admin-page-description mt-1.5 max-w-2xl text-slate-600">
                  Manage product details, pricing, stock, images, and storefront visibility from one catalog view.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowAddForm(true);
                }}
                className="btn-primary inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl px-4"
              >
                <PlusIcon className="h-4 w-4" />
                Add product
              </button>
            </div>

            <div className="border-t border-slate-200/80 pt-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="product-search"
                    type="text"
                    placeholder="Search by product name, SKU, or HSN"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-white pl-11 pr-3.5 text-[14px] text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:max-w-xl"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setStatusFilter(option.key)}
                      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                        statusFilter === option.key
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-xs ${
                        statusFilter === option.key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {option.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  {loading ? (
                    <span>Loading catalog...</span>
                  ) : (
                    <>
                      <span className="font-medium text-slate-950">{filteredProducts.length}</span>
                      <span>shown</span>
                      <span className="text-slate-300">•</span>
                      <span>{productStats.active} visible</span>
                      <span className="text-slate-300">•</span>
                      <span>{productStats.inactive} hidden</span>
                      <span className="text-slate-300">•</span>
                      <span>{productStats.withVariants} with variants</span>
                      {productStats.needsAttention > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-700">
                            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                            {productStats.needsAttention} {productStats.needsAttention === 1 ? 'needs' : 'need'} stock review
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                  <span>Sorted by {SORT_FIELD_LABELS[sortField]} ({sortDir === 'asc' ? 'asc' : 'desc'})</span>
                  <span className="text-slate-300">•</span>
                  <span>{ITEMS_PER_PAGE} per page</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-section overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_18px_38px_rgba(15,23,42,0.05)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              <span className="ml-3 text-muted-foreground">Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="px-6 py-16">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-muted/60 text-muted-foreground">
                  <CubeIcon className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">No products found</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {searchTerm
                    ? 'Try a broader search term or clear the current filter to see more products.'
                    : statusFilter === 'inactive'
                      ? 'There are no hidden products right now. Everything in the catalog is currently live.'
                      : 'Start by adding your first product to build out the storefront catalog.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="admin-table-wrap hidden xl:block">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="w-[38%]">
                        <button onClick={() => handleSort('name')} className="inline-flex items-center transition-colors hover:text-foreground">
                          Product <SortIcon field="name" />
                        </button>
                      </th>
                      <th className="w-[12%]">SKU / HSN</th>
                      <th className="w-[14%]">
                        <button onClick={() => handleSort('price')} className="inline-flex items-center transition-colors hover:text-foreground">
                          Pricing <SortIcon field="price" />
                        </button>
                      </th>
                      <th className="w-[14%]">
                        <button onClick={() => handleSort('stock')} className="inline-flex items-center transition-colors hover:text-foreground">
                          Inventory <SortIcon field="stock" />
                        </button>
                      </th>
                      <th className="w-[10%]">
                        <button onClick={() => handleSort('status')} className="inline-flex items-center transition-colors hover:text-foreground">
                          Visibility <SortIcon field="status" />
                        </button>
                      </th>
                      <th className="w-[12%] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 bg-card">
                    {paginatedProducts.map((product) => {
                      const pricing = getProductPricing(product);
                      const isLowStock = isProductLowStock(product, pricing);
                      const variantAttentionCount = getVariantAttentionCount(product, pricing);

                      return (
                        <tr key={product.id} className="transition-colors duration-200 hover:bg-slate-50/80">
                          <td>
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-muted">
                                <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(product)}
                                  className="group inline-flex max-w-full items-center gap-1 text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
                                >
                                  <span className="truncate">{product.name}</span>
                                  <PencilIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                                </button>
                                {product.description && (
                                  <p className="mt-0.5 max-w-[320px] truncate text-[12px] text-muted-foreground">
                                    {product.description}
                                  </p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  <span>
                                    {pricing.hasVariants
                                      ? `${pricing.variants.length} variant${pricing.variants.length === 1 ? '' : 's'}`
                                      : 'Simple product'}
                                  </span>
                                  {isLowStock && (
                                    <span className="font-medium text-amber-700">Needs restock</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="text-[13px] text-foreground">{product.sku || '—'}</div>
                            {product.item_hsn && (
                              <div className="text-[11px] text-muted-foreground">HSN {product.item_hsn}</div>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="text-sm font-semibold text-foreground">
                              {pricing.hasPriceRange
                                ? `₹${pricing.minPrice.toFixed(2)} - ₹${pricing.maxPrice.toFixed(2)}`
                                : `₹${pricing.selectedPrice.toFixed(2)}`}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {pricing.hasVariants
                                ? 'Variant pricing'
                                : pricing.hasMrp
                                  ? `MRP ₹${pricing.selectedMrp.toFixed(2)}`
                                  : 'No MRP set'}
                            </div>
                          </td>
                          <td className="whitespace-nowrap">
                            {pricing.hasVariants ? (
                              <div className="space-y-0.5">
                                <div className="text-sm font-semibold text-foreground">{pricing.totalStock} in stock</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {pricing.inStockVariants.length}/{pricing.variants.length} variants available
                                </div>
                                {isLowStock && (
                                  <div className="text-[11px] font-medium text-amber-700">
                                    {variantAttentionCount} variant{variantAttentionCount === 1 ? '' : 's'} {variantAttentionCount === 1 ? 'needs' : 'need'} restocking
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  isLowStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                                }`}>
                                  {product.stock_quantity || 0}
                                </span>
                                <div className="mt-0.5 text-[11px] text-muted-foreground">min {product.min_stock_level || 0}</div>
                              </>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="flex items-center justify-end">
                              {renderVisibilityControl(product)}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenImageGallery(product)}
                                className="admin-icon-button"
                                aria-label={`Manage images for ${product.name}`}
                                title="Manage images"
                              >
                                <PhotoIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(product)}
                                className="admin-icon-button"
                                aria-label={`Edit ${product.name}`}
                                title="Edit product"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteDialog(product)}
                                className="admin-icon-button border-rose-200/80 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                aria-label={`Delete ${product.name}`}
                                title="Delete product"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-200/70 xl:hidden">
                {paginatedProducts.map((product) => {
                  const pricing = getProductPricing(product);
                  const isLowStock = isProductLowStock(product, pricing);
                  const variantAttentionCount = getVariantAttentionCount(product, pricing);

                  return (
                    <div key={product.id} className="p-4 transition-colors duration-200 hover:bg-slate-50/75">
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-muted">
                          <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(product)}
                              className="group inline-flex max-w-full items-center gap-1 text-left text-sm font-semibold leading-tight text-foreground transition-colors hover:text-primary"
                            >
                              <span className="truncate">{product.name}</span>
                              <PencilIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                            </button>
                            <div className="flex-shrink-0">
                              {renderVisibilityControl(product)}
                            </div>
                          </div>
                          {product.description && (
                            <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">{product.description}</p>
                          )}
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                            <div><span className="text-muted-foreground">SKU:</span><span className="ml-1 text-foreground">{product.sku || '—'}</span></div>
                            <div>
                              <span className="text-muted-foreground">Price:</span>
                              <span className="ml-1 font-semibold text-foreground">
                                {pricing.hasPriceRange
                                  ? `₹${pricing.minPrice.toFixed(0)} - ₹${pricing.maxPrice.toFixed(0)}`
                                  : `₹${pricing.selectedPrice.toFixed(0)}`}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">{pricing.hasVariants ? 'Inventory:' : 'Stock:'}</span>
                              <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                isLowStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                              }`}>
                                {pricing.hasVariants
                                  ? `${pricing.totalStock} in stock`
                                  : (product.stock_quantity || 0)}
                                {isLowStock && <ExclamationTriangleIcon className="ml-1 h-3 w-3" />}
                              </span>
                            </div>
                            <div className="col-span-2 text-[12px] text-muted-foreground">
                              {pricing.hasVariants
                                ? (
                                  isLowStock
                                    ? `${pricing.inStockVariants.length}/${pricing.variants.length} variants available, ${variantAttentionCount} variant${variantAttentionCount === 1 ? '' : 's'} ${variantAttentionCount === 1 ? 'needs' : 'need'} restocking`
                                    : `${pricing.inStockVariants.length}/${pricing.variants.length} variants available`
                                )
                                : pricing.hasMrp
                                  ? `MRP ₹${pricing.selectedMrp.toFixed(0)}`
                                  : 'No MRP set'}
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleOpenImageGallery(product)}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              <PhotoIcon className="mr-1 h-3.5 w-3.5" />
                              Images
                            </button>
                            <button
                              onClick={() => handleEdit(product)}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              <PencilIcon className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleOpenDeleteDialog(product)}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50 px-2 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100"
                            >
                              <TrashIcon className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination />
            </>
          )}
        </div>

        <AddProductModal
          isOpen={showAddForm}
          onClose={() => {
            setShowAddForm(false);
            setEditingProduct(null);
          }}
          onProductAdded={fetchProducts}
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

        <AdminDialog open={Boolean(productPendingDelete)} onOpenChange={(open) => { if (!open) handleCloseDeleteDialog(); }}>
          <AdminDialogContent size="sm" className="p-0">
            <AdminDialogHeader className="border-b border-border/70 px-5 py-4">
              <div className="flex w-full items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/30 text-muted-foreground">
                    <TrashIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <AdminDialogTitle>Delete product</AdminDialogTitle>
                    <AdminDialogDescription>
                      This action permanently removes the product from your catalog.
                    </AdminDialogDescription>
                  </div>
                </div>
                <AdminDialogIconButton onClick={handleCloseDeleteDialog} />
              </div>
            </AdminDialogHeader>

            <AdminDialogBody className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3.5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Product
                </p>
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {productPendingDelete?.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>SKU: {productPendingDelete?.sku || 'Not set'}</span>
                  {productPendingDelete?.item_hsn && (
                    <span>HSN: {productPendingDelete.item_hsn}</span>
                  )}
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                Are you sure you want to continue? This action cannot be undone.
              </p>
            </AdminDialogBody>

            <AdminDialogFooter className="border-t border-border/70 px-5 py-4 sm:justify-end">
              <button
                type="button"
                onClick={handleCloseDeleteDialog}
                disabled={isDeletingProduct}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeletingProduct}
                className="btn-destructive"
              >
                {isDeletingProduct ? 'Deleting...' : 'Delete product'}
              </button>
            </AdminDialogFooter>
          </AdminDialogContent>
        </AdminDialog>
      </div>
    </PermissionGuard>
  );
};

export default ProductManagement;
