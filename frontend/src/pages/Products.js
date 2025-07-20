import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon, MagnifyingGlassIcon, AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ProductCard from '../components/ProductCard';
import { productsAPI, categoriesAPI } from '../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    categories: [],
    priceRange: { min: '', max: '' },
    weightRange: { min: '', max: '' },
    sortBy: 'name'
  });
  
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-2">
            {filters.search ? `Search Results for "${filters.search}"` : 'All Products'}
          </h1>
          <p className="text-base lg:text-lg text-gray-600">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-lg mx-auto mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm lg:text-base"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
        </div>

        {/* Active Filters */}
        {getActiveFiltersCount() > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Active filters:</span>
              
              {filters.search && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Search: "{filters.search}"
                  <button
                    onClick={() => removeFilter('search')}
                    className="ml-1 inline-flex items-center p-0.5 rounded-full hover:bg-green-200"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {filters.categories.map(categoryId => {
                const category = categories.find(c => c.id === categoryId);
                return category ? (
                  <span key={categoryId} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {category.name}
                    <button
                      onClick={() => removeFilter('category', categoryId)}
                      className="ml-1 inline-flex items-center p-0.5 rounded-full hover:bg-blue-200"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ) : null;
              })}
              
              {(filters.priceRange.min || filters.priceRange.max) && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Price: ₹{filters.priceRange.min || '0'} - ₹{filters.priceRange.max || '∞'}
                  <button
                    onClick={() => removeFilter('price')}
                    className="ml-1 inline-flex items-center p-0.5 rounded-full hover:bg-purple-200"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {(filters.weightRange.min || filters.weightRange.max) && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Weight: {filters.weightRange.min || '0'} - {filters.weightRange.max || '∞'} kg
                  <button
                    onClick={() => removeFilter('weight')}
                    className="ml-1 inline-flex items-center p-0.5 rounded-full hover:bg-orange-200"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-4 lg:gap-x-6 xl:gap-x-8">
          {/* Mobile filter button */}
          <div className="lg:hidden mb-4">
            <button
              type="button"
              className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
              Filters {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
            </button>
          </div>

          {/* Filters Sidebar */}
          <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block mb-6 lg:mb-0`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                {getActiveFiltersCount() > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear all ({getActiveFiltersCount()})
                  </button>
                )}
              </div>

              <div className="space-y-8">
                {/* Categories Filter - Multiple Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Categories
                  </label>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-500 focus:ring-green-500"
                          checked={filters.categories.includes(category.id)}
                          onChange={() => toggleCategoryFilter(category.id)}
                        />
                        <span className="ml-2 text-sm text-gray-700">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Price Range (₹)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="number"
                        placeholder="Min price"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={filters.priceRange.min}
                        onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, min: e.target.value })}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Max price"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={filters.priceRange.max}
                        onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, max: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Weight Range Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Weight Range (kg)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Min weight"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={filters.weightRange.min}
                        onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, min: e.target.value })}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Max weight"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={filters.weightRange.max}
                        onChange={(e) => handleFilterChange('weightRange', { ...filters.weightRange, max: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Sort By
                  </label>
                  <select
                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
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
            </div>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {error ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-red-600 text-lg font-medium">{error}</div>
                <p className="text-gray-500 mt-2">Please try again later or contact support.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-500 text-xl font-medium mb-4">No products found</div>
                <p className="text-gray-400 mb-6">
                  {getActiveFiltersCount() > 0 
                    ? "Try adjusting your filters to see more results." 
                    : "Check back later for new products."
                  }
                </p>
                {getActiveFiltersCount() > 0 && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Results Summary */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{filteredProducts.length}</span> 
                      {filteredProducts.length === 1 ? ' product' : ' products'}
                      {getActiveFiltersCount() > 0 && (
                        <span className="text-green-600"> with {getActiveFiltersCount()} filter{getActiveFiltersCount() > 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="group">
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>

                {/* Load More / Pagination can be added here */}
                {filteredProducts.length > 12 && (
                  <div className="mt-12 text-center">
                    <p className="text-sm text-gray-500">
                      Showing all {filteredProducts.length} products
                    </p>
                  </div>
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