import React, { useState, useEffect } from 'react';
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
  CheckCircleIcon,
  CubeIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
    // New fields for enhanced product management
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

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const data = await response.json();
      setProducts(data);
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

  const handleProductAdded = (product) => {
    // Refresh the products list when a product is added/updated
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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
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

  const handleImagesUpdate = () => {
    fetchProducts();
  };

  const handleOpenVariantManager = (product) => {
    setSelectedProductForVariants(product);
    setShowVariantManager(true);
  };

  const handleCloseVariantManager = () => {
    setShowVariantManager(false);
    setSelectedProductForVariants(null);
  };

  const handleVariantsSaved = () => {
    fetchProducts();
  };

  // Handle unit selection save
  const handleUnitSave = (unitData) => {
    setFormData({
      ...formData,
      base_unit: unitData.base_unit,
      secondary_unit: unitData.secondary_unit,
      unit_conversion_value: unitData.unit_conversion_value
    });
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.item_hsn?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <PermissionGuard permission={ADMIN_PERMISSIONS.VIEW_PRODUCTS}>
      <div className="space-y-6">

      {/* Header & Search */}
      <div className="bg-card rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-lg font-semibold text-foreground">Product Management</h1>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingProduct(null);
              resetForm();
            }}
            className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Product
          </button>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field block w-full pl-10 pr-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
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
              {searchTerm ? 'Try adjusting your search' : 'Add your first product to get started!'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Image</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Manage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                          <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">{product.name}</div>
                          <div className="text-sm text-muted-foreground max-w-xs truncate">{product.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{product.sku || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">₹{product.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.stock_quantity <= product.min_stock_level ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                          }`}>
                            {product.stock_quantity || 0} {product.unit || 'kg'}
                          </span>
                          {product.stock_quantity <= product.min_stock_level && (
                            <ExclamationTriangleIcon className="w-4 h-4 text-destructive ml-2" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          {product.is_active ? (
                            <><CheckCircleIcon className="w-3 h-3 mr-1" />Active</>
                          ) : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleOpenImageGallery(product)}
                            className="btn-outline inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                          >
                            <PhotoIcon className="w-4 h-4 mr-1" />
                            Images
                          </button>
                          <button
                            onClick={() => handleOpenVariantManager(product)}
                            className="btn-outline inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                          >
                            <Squares2X2Icon className="w-4 h-4 mr-1" />
                            Variants
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="btn-secondary inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                        >
                          <PencilIcon className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="btn-destructive inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y">
              {filteredProducts.map((product) => (
                <div key={product.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors duration-200">
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      <ProductImagePreview productId={product.id} fallbackImageUrl={product.image_url} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-medium text-foreground leading-tight">{product.name}</h3>
                          {product.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
                        </div>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          {product.is_active ? <><CheckCircleIcon className="w-3 h-3 mr-1" />Active</> : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div><span className="text-muted-foreground">SKU:</span><span className="ml-1 text-foreground">{product.sku || '-'}</span></div>
                        <div><span className="text-muted-foreground">Price:</span><span className="ml-1 font-medium text-foreground">₹{product.price}</span></div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            product.stock_quantity <= product.min_stock_level ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                          }`}>
                            {product.stock_quantity || 0} {product.unit || 'kg'}
                            {product.stock_quantity <= product.min_stock_level && <ExclamationTriangleIcon className="w-3 h-3 ml-1" />}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => handleEdit(product)} className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <PencilIcon className="w-4 h-4 mr-2" />Edit
                        </button>
                        <button onClick={() => handleOpenImageGallery(product)} className="btn-outline inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <PhotoIcon className="w-4 h-4 mr-2" />Images
                        </button>
                        <button onClick={() => handleOpenVariantManager(product)} className="btn-outline inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <Squares2X2Icon className="w-4 h-4 mr-2" />Variants
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="btn-destructive inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg">
                          <TrashIcon className="w-4 h-4 mr-2" />Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Reusable AddProductModal Component */}
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
        onImagesUpdate={handleImagesUpdate}
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
        onSave={handleVariantsSaved}
      />
      </div>
    </PermissionGuard>
  );
};

export default ProductManagement;
