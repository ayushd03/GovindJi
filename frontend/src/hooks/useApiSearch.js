import { useState, useEffect, useRef } from 'react';
import { useDebounced } from './useDebounced';

/**
 * Custom hook for API-based search with debouncing
 * Handles loading states, errors, and simple caching
 */
export const useApiSearch = (searchEndpoint, searchTerm, options = {}) => {
  const {
    debounceDelay = 300,
    minSearchLength = 1,
    limit = 10,
    filters = {},
    enabled = true
  } = options;

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Use useRef for cache to avoid dependency cycles
  const cacheRef = useRef(new Map());

  const debouncedSearchTerm = useDebounced(searchTerm, debounceDelay);

  // API call function
  const apiCall = async (endpoint, queryParams = {}) => {
    const token = localStorage.getItem('authToken');
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    
    const searchParams = new URLSearchParams(queryParams);
    const url = `${API_BASE_URL}${endpoint}?${searchParams}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || data; // Handle wrapped responses
  };

  // Effect to trigger search when debounced term changes
  useEffect(() => {
    const performSearch = async () => {
      if (!enabled || !debouncedSearchTerm || debouncedSearchTerm.length < minSearchLength) {
        setResults([]);
        setLoading(false);
        setError(null);
        setHasMore(false);
        setTotal(0);
        return;
      }

      // Create cache key
      const cacheKey = JSON.stringify({ 
        endpoint: searchEndpoint, 
        term: debouncedSearchTerm, 
        filters, 
        limit
      });

      // Check cache first
      if (cacheRef.current.has(cacheKey)) {
        const cachedResult = cacheRef.current.get(cacheKey);
        setResults(cachedResult.results);
        setHasMore(cachedResult.hasMore);
        setTotal(cachedResult.total);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queryParams = {
          q: debouncedSearchTerm,
          limit: limit.toString(),
          offset: '0',
          ...filters
        };

        const response = await apiCall(searchEndpoint, queryParams);
        
        const results = response.parties || response.products || [];
        const pagination = response.pagination || {};

        // Cache the result
        const resultToCache = {
          results,
          hasMore: pagination.hasMore || false,
          total: pagination.total || 0,
          timestamp: Date.now()
        };

        // Limit cache size to prevent memory leaks
        if (cacheRef.current.size >= 100) {
          const oldestKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(oldestKey);
        }
        cacheRef.current.set(cacheKey, resultToCache);

        setResults(results);
        setHasMore(pagination.hasMore || false);
        setTotal(pagination.total || 0);
      } catch (err) {
        console.error('Search API error:', err);
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, searchEndpoint, enabled, minSearchLength, limit, JSON.stringify(filters)]);

  // Clear cache periodically (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const cache = cacheRef.current;
      
      for (const [key, value] of cache.entries()) {
        if (value.timestamp < fiveMinutesAgo) {
          cache.delete(key);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Clear results when search term is cleared
  useEffect(() => {
    if (!searchTerm || searchTerm.length < minSearchLength) {
      setResults([]);
      setError(null);
      setHasMore(false);
      setTotal(0);
    }
  }, [searchTerm, minSearchLength]);

  return {
    results,
    loading,
    error,
    hasMore,
    total
  };
};