import React, { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  ChevronDownIcon, 
  CubeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../../lib/utils';
import { useApiSearch } from '../../../hooks/useApiSearch';

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
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Use API search for products
  const { 
    results: searchResults, 
    loading, 
    error: searchError 
  } = useApiSearch(
    '/api/admin/expenses/search/products',
    searchTerm,
    {
      debounceDelay: 300,
      minSearchLength: 1,
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
          "w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary",
          error ? "border-red-500" : "border-border hover:border-primary/50",
          isOpen && "ring-2 ring-primary"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          <MagnifyingGlassIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 bg-transparent outline-none"
            placeholder={selectedProduct ? selectedProduct.name : placeholder}
            value={isOpen ? searchTerm : (selectedProduct?.name || '')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />
          <div className="flex items-center space-x-2">
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
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-hidden">
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

          {/* Products list */}
          <div className="max-h-60 overflow-y-auto">
            {!loading && !searchError && searchResults.length > 0 ? (
              searchResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex items-center space-x-3">
                    <CubeIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{product.name}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        {product.sku && (
                          <span className="text-sm text-muted-foreground">
                            SKU: {product.sku}
                          </span>
                        )}
                        {product.unit && (
                          <span className="text-sm text-muted-foreground">
                            Unit: {product.unit}
                          </span>
                        )}
                      </div>
                      
                      {/* Price and description */}
                      <div className="flex items-center justify-between mt-2">
                        {product.description && (
                          <p className="text-xs text-muted-foreground truncate flex-1 mr-2">
                            {product.description}
                          </p>
                        )}
                        {product.price !== undefined && (
                          <span className="text-sm font-medium text-primary">
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

            {!loading && !searchError && !searchTerm && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Type to search for products...</p>
              </div>
            )}
          </div>

          {/* Add new product option */}
          {searchTerm && !loading && searchResults.length === 0 && (
            <div className="p-3 border-t border-border">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                onClick={() => {
                  // This could trigger a modal to add a new product
                  // Add new product functionality
                  setIsOpen(false);
                }}
              >
                + Add new product "{searchTerm}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSelector;