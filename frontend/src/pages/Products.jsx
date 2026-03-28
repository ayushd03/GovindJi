import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ViewColumnsIcon,
  ListBulletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import ProductCard from '../components/ProductCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { productsAPI, categoriesAPI } from '../services/api';
import { getComparableProductPrice } from '../utils/productPricing';

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
  
  const removeFilter = (filterType, value = null) => {
    setFilters(prev => {
      switch (filterType) {
        case 'search':
          setSearchParams({});
          return { ...prev, search: '' };
        case 'category':
          return { ...prev, categories: prev.categories.filter(id => id !== value) };
        case 'price':
          return { ...prev, priceRange: { min: '', max: '' } };
        case 'weight':
          return { ...prev, weightRange: { min: '', max: '' } };
        default:
          return prev;
      }
    });
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
  const resultsSummary = filters.search
    ? `Showing ${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''} for "${filters.search}"`
    : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''} available`;

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
    <div className="page-shell-soft py-6">
      <div className="page-container">
        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-4 xl:gap-5">
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
            className={`${showMobileFilters ? 'block' : 'hidden'} mb-6 lg:mb-0 lg:block`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="sticky top-6 overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.045)]">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filters</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">Search, categories, price and weight.</p>
                      </div>
                      {activeFiltersCount > 0 && (
                        <Badge className="rounded-full border-0 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-none">
                          {activeFiltersCount} active
                        </Badge>
                      )}
                    </div>
                    {activeFiltersCount > 0 && (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                          {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} applied
                        </p>
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto rounded-full px-2 py-1 text-xs text-[#23442a] hover:bg-[#23442a]/5 hover:text-[#23442a]">
                          Clear all
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2.5 block text-sm font-semibold tracking-tight text-slate-900">
                      Search Products
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by name or description..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-10 pr-10 text-sm text-slate-700 shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                      />
                      {filters.search && (
                        <button
                          type="button"
                          onClick={() => handleFilterChange('search', '')}
                          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2.5 block text-sm font-semibold tracking-tight text-slate-900">
                      Categories
                    </label>
                    <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                      {categories.map((category) => {
                        const isSelected = filters.categories.includes(category.id);
                        return (
                          <div 
                            key={category.id} 
                            className="flex items-center rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              id={`category-${category.id}`}
                              className="h-4 w-4 cursor-pointer rounded border-2 border-slate-300 text-[#23442a] shadow-sm focus:border-[#23442a] focus:ring-[#23442a]"
                              checked={isSelected}
                              onChange={() => toggleCategoryFilter(category.id)}
                            />
                            <label 
                              htmlFor={`category-${category.id}`}
                              className={`ml-3 cursor-pointer text-sm leading-tight transition-colors ${
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
                    <label className="mb-2.5 block text-sm font-semibold tracking-tight text-slate-900">
                      Price Range (₹)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        placeholder="Min price"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.priceRange.min}
                        onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, min: e.target.value })}
                      />
                      <input
                        type="number"
                        placeholder="Max price"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.priceRange.max}
                        onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, max: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2.5 block text-sm font-semibold tracking-tight text-slate-900">
                      Weight Range (kg)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min weight"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.weightRange.min}
                        onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, min: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max weight"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.weightRange.max}
                        onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, max: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div>
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
                <div className="mb-4 rounded-[1.4rem] border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Catalogue</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{resultsSummary}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Page {currentPage} of {Math.max(totalPages, 1)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        className="h-10 rounded-full border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-700 shadow-sm transition-all duration-200 focus:border-[#23442a]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#23442a]/15"
                        value={filters.sortBy}
                        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      >
                        {sortOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>

                      <div className="rounded-full border border-slate-200 bg-slate-100 p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode('grid')}
                          className={`h-auto rounded-full px-3 py-1.5 text-xs ${
                            viewMode === 'grid'
                              ? 'bg-[#23442a] text-white hover:bg-[#1d3722] hover:text-white'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <ViewColumnsIcon className="mr-1 h-3.5 w-3.5" />
                          Grid
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode('list')}
                          className={`h-auto rounded-full px-3 py-1.5 text-xs ${
                            viewMode === 'list'
                              ? 'bg-[#23442a] text-white hover:bg-[#1d3722] hover:text-white'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <ListBulletIcon className="mr-1 h-3.5 w-3.5" />
                          List
                        </Button>
                      </div>
                    </div>
                  </div>

                  {activeFiltersCount > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      {filters.search && (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                          Search: "{filters.search}"
                          <button onClick={() => removeFilter('search')} className="ml-1">
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {filters.categories.map(categoryId => {
                        const category = categories.find(c => c.id === categoryId);
                        return category ? (
                          <Badge key={categoryId} variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                            {category.name}
                            <button onClick={() => removeFilter('category', categoryId)} className="ml-1">
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                      {(filters.priceRange.min || filters.priceRange.max) && (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                          Price: ₹{filters.priceRange.min || '0'} - ₹{filters.priceRange.max || '∞'}
                          <button onClick={() => removeFilter('price')} className="ml-1">
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {(filters.weightRange.min || filters.weightRange.max) && (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                          Weight: {filters.weightRange.min || '0'} - {filters.weightRange.max || '∞'} kg
                          <button onClick={() => removeFilter('weight')} className="ml-1">
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-auto rounded-full px-2 py-1 text-xs text-[#23442a] hover:bg-[#23442a]/5 hover:text-[#23442a]"
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </div>

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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
