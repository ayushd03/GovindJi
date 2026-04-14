import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FunnelIcon,
  ViewColumnsIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import ProductCard from '../components/ProductCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { productsAPI, categoriesAPI } from '../services/api';
import { getComparableProductPrice } from '../utils/productPricing';
import './Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Fuzzy search function
  const fuzzySearch = (searchTerm, text) => {
    if (!searchTerm || !text) return false;
    
    const search = searchTerm.toLowerCase().trim();
    const target = text.toLowerCase();
    
    // Exact match (highest priority)
    if (target.includes(search)) return true;
    
    // Split search term into words for multi-word matching
    const searchWords = search.split(/\s+/).filter(word => word.length > 0);
    
    // Check if all search words are present (word order independent)
    const allWordsMatch = searchWords.every(word => target.includes(word));
    if (allWordsMatch) return true;
    
    // Fuzzy character matching (allows for typos)
    // Remove spaces and check if most characters match in order
    const searchChars = search.replace(/\s/g, '');
    const targetChars = target.replace(/\s/g, '');
    
    if (searchChars.length <= 2) {
      // For short searches, require exact substring match
      return targetChars.includes(searchChars);
    }
    
    // For longer searches, allow some character mismatches
    let matchCount = 0;
    let targetIndex = 0;
    
    for (let i = 0; i < searchChars.length && targetIndex < targetChars.length; i++) {
      const char = searchChars[i];
      while (targetIndex < targetChars.length && targetChars[targetIndex] !== char) {
        targetIndex++;
      }
      if (targetIndex < targetChars.length) {
        matchCount++;
        targetIndex++;
      }
    }
    
    // Require at least 80% character match for fuzzy matching
    const matchRatio = matchCount / searchChars.length;
    return matchRatio >= 0.8;
  };
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    categories: [],
    priceRange: { min: '', max: '' },
    weightRange: { min: '', max: '' },
    sortBy: 'name'
  });
  
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  
  const sortOptions = [
    { id: 'name', name: 'Name (A-Z)' },
    { id: 'name-desc', name: 'Name (Z-A)' },
    { id: 'price', name: 'Price (Low to High)' },
    { id: 'price-desc', name: 'Price (High to Low)' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          productsAPI.getAll(),
          categoriesAPI.getAll()
        ]);
        
        setProducts(productsResponse.data);
        setCategories(categoriesResponse.data);
      } catch (err) {
        setError('Failed to load data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle URL search params initialization
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl && searchFromUrl !== filters.search) {
      setFilters(prev => ({
        ...prev,
        search: searchFromUrl
      }));
    }
  }, [searchParams, filters.search]);

  // Handle category auto-selection from navigation state
  useEffect(() => {
    if (location.state?.selectedCategoryId && categories.length > 0) {
      setFilters(prev => ({
        ...prev,
        categories: [location.state.selectedCategoryId]
      }));
    }
  }, [location.state, categories]);
  
  useEffect(() => {
    let result = [...products];
    
    // Apply search filter
    if (filters.search) {
      result = result.filter(product => {
        const searchableText = `${product.name} ${product.description || ''}`;
        return fuzzySearch(filters.search, searchableText);
      });
    }
    
    // Apply category filter (multiple selections)
    if (filters.categories.length > 0) {
      result = result.filter(product => 
        filters.categories.includes(product.category_id)
      );
    }
    
    // Apply price range filter
    if (filters.priceRange.min) {
      result = result.filter(product => (
        getComparableProductPrice(product) >= parseFloat(filters.priceRange.min)
      ));
    }
    if (filters.priceRange.max) {
      result = result.filter(product => (
        getComparableProductPrice(product) <= parseFloat(filters.priceRange.max)
      ));
    }
    
    // Apply weight range filter
    if (filters.weightRange.min) {
      result = result.filter(product => 
        product.weight && product.weight >= parseFloat(filters.weightRange.min)
      );
    }
    if (filters.weightRange.max) {
      result = result.filter(product => 
        product.weight && product.weight <= parseFloat(filters.weightRange.max)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price':
          return getComparableProductPrice(a) - getComparableProductPrice(b);
        case 'price-desc':
          return getComparableProductPrice(b) - getComparableProductPrice(a);
        default:
          return 0;
      }
    });
    
    setFilteredProducts(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [products, filters]);
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    if (key === 'search') {
      const newSearchParams = new URLSearchParams(searchParams);
      if (value) {
        newSearchParams.set('search', value);
      } else {
        newSearchParams.delete('search');
      }
      setSearchParams(newSearchParams);
    }
  };
  
  const toggleCategoryFilter = (categoryId) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      search: '',
      categories: [],
      priceRange: { min: '', max: '' },
      weightRange: { min: '', max: '' },
      sortBy: 'name'
    });
    setSearchParams({});
  };
  
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.categories.length > 0) count += filters.categories.length;
    if (filters.priceRange.min || filters.priceRange.max) count++;
    if (filters.weightRange.min || filters.weightRange.max) count++;
    return count;
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const activeFiltersCount = getActiveFiltersCount();
  const selectedSortOption = sortOptions.find((option) => option.id === filters.sortBy) || sortOptions[0];

  if (loading) {
    return (
      <div className="page-shell-soft py-6">
        <div className="page-container flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-10 w-10 rounded-full border-[3px] border-[#23442a]/20 border-t-[#23442a]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="products-layout page-shell-soft py-6 lg:h-[calc(100vh-5rem)] lg:overflow-hidden">
      <div className="page-container h-full">
        <div className="lg:grid lg:h-full lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-4 lg:overflow-hidden xl:grid-cols-[292px_minmax(0,1fr)] xl:gap-5">
          <div className="mb-3 lg:hidden">
            <Button
              variant="outline"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex h-10 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FunnelIcon className="mr-2 h-4 w-4" />
              {showMobileFilters ? 'Hide' : 'Show'} filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 rounded-full border-0 bg-[#23442a]/10 px-2 py-0.5 text-xs text-[#23442a] shadow-none">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          <motion.div 
            className={`${showMobileFilters ? 'block' : 'hidden'} mb-6 lg:mb-0 lg:block lg:self-start`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="sticky top-6 overflow-hidden rounded-[1.3rem] border border-slate-200/80 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.045)] lg:max-h-[var(--products-sidebar-max-height)]">
              <CardContent className="products-filter-panel p-0">
                <div className="space-y-3.5 px-2.5 py-3 sm:px-3 sm:py-3.5">
                  {activeFiltersCount > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <Badge className="shrink-0 rounded-full border-0 bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-none">
                        {activeFiltersCount} active
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto rounded-full px-2 py-1 text-xs text-[#23442a] hover:bg-[#23442a]/5 hover:text-[#23442a]">
                        Clear all
                      </Button>
                    </div>
                  )}

                  <div className="products-display-section">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold tracking-tight text-slate-900">
                        Layout
                      </label>
                      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-[inset_0_0_0_1px_rgba(226,232,240,1)]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode('grid')}
                          className={`h-8 rounded-xl px-3 text-xs ${
                            viewMode === 'grid'
                              ? 'bg-[#23442a] text-white hover:bg-[#1d3722] hover:text-white'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <ViewColumnsIcon className="mr-1.5 h-3.5 w-3.5" />
                          Grid
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode('list')}
                          className={`h-8 rounded-xl px-3 text-xs ${
                            viewMode === 'list'
                              ? 'bg-[#23442a] text-white hover:bg-[#1d3722] hover:text-white'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <ListBulletIcon className="mr-1.5 h-3.5 w-3.5" />
                          List
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold tracking-tight text-slate-900">
                        Sort by
                      </label>
                      <select
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.sortBy}
                        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      >
                        {sortOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">{selectedSortOption.name}</p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="block text-sm font-semibold tracking-tight text-slate-900">
                        Categories
                      </label>
                      <span className="text-[11px] font-medium text-slate-500">
                        {filters.categories.length}/{categories.length}
                      </span>
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5 lg:max-h-72">
                      {categories.map((category) => {
                        const isSelected = filters.categories.includes(category.id);
                        return (
                          <div 
                            key={category.id} 
                            className={`flex items-start gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-50 ${
                              isSelected ? 'bg-[#23442a]/[0.03]' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`category-${category.id}`}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-slate-300 text-[#23442a] shadow-sm focus:border-[#23442a] focus:ring-[#23442a]"
                              checked={isSelected}
                              onChange={() => toggleCategoryFilter(category.id)}
                            />
                            <label 
                              htmlFor={`category-${category.id}`}
                              title={category.name}
                              className={`min-w-0 cursor-pointer text-[13px] leading-5 transition-colors ${
                                isSelected 
                                  ? 'font-semibold text-slate-900'
                                  : 'text-slate-500'
                              }`}
                            >
                              {category.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold tracking-tight text-slate-900">
                      Price range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Min</span>
                        <div className="products-range-input">
                          <span className="products-range-prefix">₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            title={filters.priceRange.min || 'Minimum price'}
                            className="products-range-field"
                            value={filters.priceRange.min}
                            onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, min: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Max</span>
                        <div className="products-range-input">
                          <span className="products-range-prefix">₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="Any"
                            title={filters.priceRange.max || 'Maximum price'}
                            className="products-range-field"
                            value={filters.priceRange.max}
                            onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, max: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold tracking-tight text-slate-900">
                      Weight range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Min</span>
                        <div className="products-range-input">
                          <span className="products-range-prefix">kg</span>
                          <input
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            placeholder="0"
                            title={filters.weightRange.min || 'Minimum weight'}
                            className="products-range-field"
                            value={filters.weightRange.min}
                            onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, min: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Max</span>
                        <div className="products-range-input">
                          <span className="products-range-prefix">kg</span>
                          <input
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            placeholder="Any"
                            title={filters.weightRange.max || 'Maximum weight'}
                            className="products-range-field"
                            value={filters.weightRange.max}
                            onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, max: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="products-results-scroll min-h-0 lg:h-full lg:overflow-y-auto lg:pr-2">
            {error ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[1.6rem] border border-slate-200 bg-white p-10 text-center shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
              >
                <div className="mb-2 text-lg font-medium text-rose-600">{error}</div>
                <p className="text-slate-500">Please try again later or contact support.</p>
              </motion.div>
            ) : currentProducts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[1.6rem] border border-slate-200 bg-white p-10 text-center shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
              >
                <div className="mb-3 text-xl font-medium text-slate-700">No products found</div>
                <p className="mb-6 text-slate-500">
                  {activeFiltersCount > 0
                    ? "Try adjusting your filters to see more results."
                    : "Check back later for new products."
                  }
                </p>
                {activeFiltersCount > 0 && (
                  <Button
                    onClick={clearFilters}
                    className="rounded-full bg-[#23442a] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1d3722]"
                  >
                    Clear all filters
                  </Button>
                )}
              </motion.div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.2 }}
                >
                  {viewMode === 'list' ? (
                    <div className="space-y-3">
                      {currentProducts.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                        >
                          <ProductCard product={product} viewMode="list" />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {currentProducts.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                        >
                          <ProductCard product={product} viewMode="grid" />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <motion.div 
                    className="mt-6 border-t border-slate-200/80 pt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-500">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="rounded-full px-3 py-1.5 text-sm"
                        >
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pageNum)}
                                className={`min-w-[2.25rem] rounded-full px-3 py-1.5 text-sm ${
                                  currentPage === pageNum
                                    ? 'border-[#23442a] bg-[#23442a] text-white hover:bg-[#1d3722] hover:text-white'
                                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="rounded-full px-3 py-1.5 text-sm"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Products;
