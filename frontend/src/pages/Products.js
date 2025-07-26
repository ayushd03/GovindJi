import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon, ViewColumnsIcon, ListBulletIcon, FunnelIcon } from '@heroicons/react/24/outline';
import ProductCardGrid from '../components/ProductCardGrid';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { productsAPI, categoriesAPI } from '../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    categories: [],
    priceRange: { min: '', max: '' },
    weightRange: { min: '', max: '' },
    sortBy: 'name'
  });
  
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
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
      result = result.filter(product =>
        product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    
    // Apply category filter (multiple selections)
    if (filters.categories.length > 0) {
      result = result.filter(product => 
        filters.categories.includes(product.category_id)
      );
    }
    
    // Apply price range filter
    if (filters.priceRange.min) {
      result = result.filter(product => product.price >= parseFloat(filters.priceRange.min));
    }
    if (filters.priceRange.max) {
      result = result.filter(product => product.price <= parseFloat(filters.priceRange.max));
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
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        default:
          return 0;
      }
    });
    
    setFilteredProducts(result);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Simple Results Bar */}
        {filteredProducts.length > 0 && (
          <motion.div 
            className="mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center">
              <p className="text-sm text-gray-600">
                {filters.search ? (
                  <>Showing {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''} for "{filters.search}"</>
                ) : (
                  <>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available</>
                )}
                {getActiveFiltersCount() > 0 && (
                  <span className="text-blue-600 ml-1">• {getActiveFiltersCount()} filter{getActiveFiltersCount() > 1 ? 's' : ''} applied</span>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* Enhanced Active Filters */}
        {getActiveFiltersCount() > 0 && (
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex flex-wrap items-center gap-3 justify-center">
              <span className="text-sm font-medium text-gray-700 font-heading">Active filters:</span>
              
              {filters.search && (
                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors">
                  Search: "{filters.search}"
                  <button
                    onClick={() => removeFilter('search')}
                    className="ml-2 inline-flex items-center p-0.5 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {filters.categories.map(categoryId => {
                const category = categories.find(c => c.id === categoryId);
                return category ? (
                  <Badge key={categoryId} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors">
                    {category.name}
                    <button
                      onClick={() => removeFilter('category', categoryId)}
                      className="ml-2 inline-flex items-center p-0.5 rounded-full hover:bg-emerald-200 transition-colors"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
              
              {(filters.priceRange.min || filters.priceRange.max) && (
                <Badge className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors">
                  Price: ₹{filters.priceRange.min || '0'} - ₹{filters.priceRange.max || '∞'}
                  <button
                    onClick={() => removeFilter('price')}
                    className="ml-2 inline-flex items-center p-0.5 rounded-full hover:bg-purple-200 transition-colors"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {(filters.weightRange.min || filters.weightRange.max) && (
                <Badge className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-orange-100 transition-colors">
                  Weight: {filters.weightRange.min || '0'} - {filters.weightRange.max || '∞'} kg
                  <button
                    onClick={() => removeFilter('weight')}
                    className="ml-2 inline-flex items-center p-0.5 rounded-full hover:bg-orange-200 transition-colors"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Clear all
              </Button>
            </div>
          </motion.div>
        )}

        <div className="lg:grid lg:grid-cols-4 lg:gap-x-8 xl:gap-x-10">
          {/* Mobile filter toggle */}
          <div className="lg:hidden mb-3">
            <Button
              variant="outline"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-all duration-200"
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              {showMobileFilters ? 'Hide' : 'Show'} Filters & View {getActiveFiltersCount() > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 text-xs rounded-full">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
          </div>

          {/* Premium Filters Sidebar */}
          <motion.div 
            className={`${showMobileFilters ? 'block' : 'hidden'} lg:block mb-8 lg:mb-0`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg sticky top-8">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* View Toggle */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-heading font-semibold text-gray-900">View</h3>
                    <div className="bg-gray-100 border border-gray-200 rounded-md p-0.5">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="px-2 py-1.5 rounded-sm transition-all duration-200 h-auto text-xs"
                      >
                        <ViewColumnsIcon className="w-3.5 h-3.5 mr-1" />
                        Grid
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="px-2 py-1.5 rounded-sm transition-all duration-200 h-auto text-xs"
                      >
                        <ListBulletIcon className="w-3.5 h-3.5 mr-1" />
                        List
                      </Button>
                    </div>
                  </div>
                  
                  {/* Filters Header */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <h3 className="text-lg font-heading font-semibold text-gray-900">Filters</h3>
                    {getActiveFiltersCount() > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-medium px-2 py-1 rounded-md transition-colors"
                      >
                        Clear ({getActiveFiltersCount()})
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Categories Filter - Multiple Selection */}
                  <div>
                    <label className="block text-sm font-heading font-semibold text-gray-900 mb-4 tracking-tight">
                      Categories
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {categories.map((category) => {
                        const isSelected = filters.categories.includes(category.id);
                        return (
                          <div 
                            key={category.id} 
                            className="flex items-center group cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              id={`category-${category.id}`}
                              className="w-4 h-4 rounded border-2 border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleCategoryFilter(category.id)}
                            />
                            <label 
                              htmlFor={`category-${category.id}`}
                              className={`ml-3 text-sm cursor-pointer leading-tight transition-colors ${
                                isSelected 
                                  ? 'text-gray-900 font-semibold' 
                                  : 'text-gray-500 font-light'
                              }`}
                            >
                              {category.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price Range Filter */}
                  <div>
                    <label className="block text-sm font-heading font-semibold text-gray-900 mb-4 tracking-tight">
                      Price Range (₹)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        placeholder="Min price"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg shadow-sm bg-gray-50/50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white transition-all duration-200 font-body"
                        value={filters.priceRange.min}
                        onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, min: e.target.value })}
                      />
                      <input
                        type="number"
                        placeholder="Max price"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg shadow-sm bg-gray-50/50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white transition-all duration-200 font-body"
                        value={filters.priceRange.max}
                        onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, max: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Weight Range Filter */}
                  <div>
                    <label className="block text-sm font-heading font-semibold text-gray-900 mb-4 tracking-tight">
                      Weight Range (kg)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min weight"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg shadow-sm bg-gray-50/50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white transition-all duration-200 font-body"
                        value={filters.weightRange.min}
                        onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, min: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max weight"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg shadow-sm bg-gray-50/50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white transition-all duration-200 font-body"
                        value={filters.weightRange.max}
                        onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, max: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-heading font-semibold text-gray-900 mb-4 tracking-tight">
                      Sort By
                    </label>
                    <select
                      className="block w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg shadow-sm bg-gray-50/50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white transition-all duration-200 font-body"
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    >
                      {sortOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Products Section */}
          <div className="lg:col-span-3">
            {error ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-12 text-center"
              >
                <div className="text-red-600 text-lg font-medium mb-2">{error}</div>
                <p className="text-gray-500">Please try again later or contact support.</p>
              </motion.div>
            ) : filteredProducts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-12 text-center"
              >
                <div className="text-gray-500 text-xl font-medium mb-4">No products found</div>
                <p className="text-gray-400 mb-6 font-body">
                  {getActiveFiltersCount() > 0 
                    ? "Try adjusting your filters to see more results." 
                    : "Check back later for new products."
                  }
                </p>
                {getActiveFiltersCount() > 0 && (
                  <Button
                    onClick={clearFilters}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    Clear all filters
                  </Button>
                )}
              </motion.div>
            ) : (
              <>

                {/* Premium Products Grid */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  {viewMode === 'list' ? (
                    <div className="space-y-4">
                      {filteredProducts.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                        >
                          <ProductCardGrid product={product} viewMode="list" />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {filteredProducts.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                        >
                          <ProductCardGrid product={product} viewMode="grid" />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Enhanced Footer */}
                {filteredProducts.length > 12 && (
                  <motion.div 
                    className="mt-12 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.7 }}
                  >
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50">
                      <p className="text-sm text-gray-500 font-body">
                        Showing all <span className="font-semibold text-gray-700">{filteredProducts.length}</span> premium products
                      </p>
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