import React, { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  ChevronDownIcon, 
  CubeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../../lib/utils';
import { useApiSearch, prefetchApiSearch } from '../../../hooks/useApiSearch';
import AddProductModal from './AddProductModal';

const ProductSelector = ({ 
  selectedProduct, 
  onProductChange, 
  categoryId = '', // Optional category filter
  error, 
  placeholder = "Search products...",
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Prefetch initial product list on mount for instant dropdown open
  useEffect(() => {
    prefetchApiSearch('/api/admin/expenses/search/products', {
      limit: 20,
      filters: categoryId ? { category_id: categoryId } : {}
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // Use API search for products
  const {
    results: searchResults,
    loading,
    error: searchError,
    hasMore,
    loadMore,
    loadingMore
  } = useApiSearch(
    '/api/admin/expenses/search/products',
    searchTerm,
    {
      debounceDelay: 300,
      minSearchLength: 0, // Changed from 1 to 0 to show results by default
      limit: 20,
      filters: categoryId ? { category_id: categoryId } : {},
      enabled: isOpen // Only search when dropdown is open
    }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleProductSelect = (product) => {
    onProductChange(product);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClearSelection = () => {
    onProductChange(null);
    setSearchTerm('');
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setIsOpen(false); // Close the dropdown
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleProductAdded = (product) => {
    // Refresh search results by clearing and re-setting search term
    // This will trigger the useApiSearch hook to refetch data
    const currentSearch = searchTerm;
    setSearchTerm('');
    setTimeout(() => setSearchTerm(currentSearch), 100);

    // Auto-select the newly added product if it matches the search
    if (product && product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      handleProductSelect(product);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 2 
    }).format(amount);
  };

  // Initialize search term with selected product name
  useEffect(() => {
    if (selectedProduct && !isOpen) {
      setSearchTerm(selectedProduct.name || '');
    }
  }, [selectedProduct, isOpen]);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Selected Product Display / Search Input */}
      <div
        className={cn(
          "w-full px-2 py-1.5 border rounded-md cursor-pointer transition-colors text-sm",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary",
          error ? "border-red-500" : "border-border hover:border-primary/50",
          isOpen && "ring-2 ring-primary"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder={selectedProduct ? selectedProduct.name : placeholder}
            value={isOpen ? searchTerm : (selectedProduct?.name || '')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />
          {selectedProduct && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearSelection();
              }}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              ×
            </button>
          )}
          <ChevronDownIcon 
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isOpen && "transform rotate-180"
            )} 
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-72 overflow-hidden">
          {/* Loading state */}
          {loading && (
            <div className="p-4 flex items-center justify-center">
              <ArrowPathIcon className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Searching products...</span>
            </div>
          )}

          {/* Error state */}
          {!loading && searchError && (
            <div className="p-4 text-center text-red-500">
              <p className="text-sm">Error loading products: {searchError}</p>
            </div>
          )}

          {/* Products list with infinite scroll */}
          <div 
            className="max-h-60 overflow-y-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
                if (hasMore && !loading && !loadingMore) {
                  loadMore();
                }
              }
            }}
          >
            {!loading && !searchError && searchResults.length > 0 ? (
              searchResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0 text-sm"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex items-center space-x-3">
                    <CubeIcon className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{product.name}</p>
                      <div className="flex items-center space-x-3 mt-0.5 text-xs text-muted-foreground">
                        {product.sku && (
                          <span>
                            SKU: {product.sku}
                          </span>
                        )}
                        {product.unit && (
                          <span>
                            Unit: {product.unit}
                          </span>
                        )}
                      </div>
                      
                      {/* Price and description */}
                      <div className="flex items-center justify-between mt-1">
                        {product.description && (
                          <p className="text-xs text-muted-foreground truncate flex-1 mr-2">
                            {product.description}
                          </p>
                        )}
                        {product.price !== undefined && (
                          <span className="text-xs font-medium text-primary">
                            {formatCurrency(product.price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : !loading && !searchError && searchTerm && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">
                  {searchTerm.length < 1 ? 'Type to search products...' : 'No products found matching your search.'}
                </p>
              </div>
            )}
            {loadingMore && (
              <div className="p-3 flex items-center justify-center text-xs text-muted-foreground">Loading more…</div>
            )}
            {/* Removed the "Type to search" message when no search term - now shows all products by default */}
          </div>

          {/* Add new product option */}
          {searchTerm && !loading && searchResults.length === 0 && (
            <div className="p-3 border-t border-border">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                onClick={handleOpenModal}
              >
                + Add new product "{searchTerm}"
              </button>
            </div>
          )}
        </div>
      )}

      {/* AddProductModal for adding new products */}
      <AddProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onProductAdded={handleProductAdded}
        defaultName={searchTerm}
        mode="add"
        apiBaseUrl={API_BASE_URL}
      />
    </div>
  );
};

export default ProductSelector;