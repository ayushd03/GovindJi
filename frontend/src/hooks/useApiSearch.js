import { useState, useEffect, useRef } from 'react';
import { useDebounced } from './useDebounced';

/**
 * Custom hook for API-based search with debouncing
 * Handles loading states, errors, and simple caching
 */
// Module-scoped global cache and in-flight registry for deduplication across components
const globalCache = new Map();
const globalInflight = new Map();

const buildCacheKey = ({ endpoint, term = '', filters = {}, limit = 10, offset = 0 }) => {
  return JSON.stringify({ endpoint, term, filters, limit, offset });
};

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

export const prefetchApiSearch = async (endpoint, { limit = 20, filters = {} } = {}) => {
  const cacheKey = buildCacheKey({ endpoint, term: '', filters, limit, offset: 0 });
  if (globalCache.has(cacheKey)) {
    return globalCache.get(cacheKey);
  }
  if (globalInflight.has(cacheKey)) {
    return globalInflight.get(cacheKey);
  }

  const promise = (async () => {
    const queryParams = { q: '', limit: String(limit), offset: '0', ...filters };
    const response = await apiCall(endpoint, queryParams);
    const results = response.parties || response.products || [];
    const pagination = response.pagination || {};
    const resultToCache = {
      results,
      hasMore: pagination.hasMore || false,
      total: pagination.total || 0,
      timestamp: Date.now()
    };
    globalCache.set(cacheKey, resultToCache);
    return resultToCache;
  })();

  globalInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    globalInflight.delete(cacheKey);
  }
};

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
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Use useRef for cache to avoid dependency cycles
  const cacheRef = useRef(new Map());

  const debouncedSearchTerm = useDebounced(searchTerm, debounceDelay);

  // API call function moved to module scope (apiCall)

  // Effect to trigger search when debounced term or dependencies change
  useEffect(() => {
    const performSearch = async () => {
      if (!enabled) {
        return;
      }

      // If minSearchLength > 0, enforce it. If 0, allow empty string to fetch initial results
      if (minSearchLength > 0 && (!debouncedSearchTerm || debouncedSearchTerm.length < minSearchLength)) {
        setResults([]);
        setLoading(false);
        setError(null);
        setHasMore(false);
        setTotal(0);
        setOffset(0);
        return;
      }

      // Create cache key (first page)
      const cacheKey = buildCacheKey({
        endpoint: searchEndpoint,
        term: debouncedSearchTerm || '',
        filters,
        limit,
        offset: 0
      });

      // Check global cache first for instant display
      if (globalCache.has(cacheKey)) {
        const cachedResult = globalCache.get(cacheKey);
        setResults(cachedResult.results);
        setHasMore(cachedResult.hasMore);
        setTotal(cachedResult.total);
        setLoading(false);
        setError(null);
        setOffset(cachedResult.results?.length || 0);
        return;
      }

      // Check local cache next
      if (cacheRef.current.has(cacheKey)) {
        const cachedResult = cacheRef.current.get(cacheKey);
        setResults(cachedResult.results);
        setHasMore(cachedResult.hasMore);
        setTotal(cachedResult.total);
        setLoading(false);
        setError(null);
        setOffset(cachedResult.results?.length || 0);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queryParams = {
          q: debouncedSearchTerm || '',
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
        globalCache.set(cacheKey, resultToCache);

        setResults(results);
        setHasMore(pagination.hasMore || false);
        setTotal(pagination.total || 0);
        setOffset(results.length || 0);
      } catch (err) {
        console.error('Search API error:', err);
        setError(err.message);
        setResults([]);
        setOffset(0);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, searchEndpoint, enabled, minSearchLength, limit, JSON.stringify(filters)]);

  // Load more results for infinite scrolling
  const loadMore = async () => {
    if (!enabled || loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextOffset = offset;
      const queryParams = {
        q: (debouncedSearchTerm || ''),
        limit: limit.toString(),
        offset: nextOffset.toString(),
        ...filters
      };

      const response = await apiCall(searchEndpoint, queryParams);
      const nextResults = response.parties || response.products || [];
      const pagination = response.pagination || {};

      setResults(prev => [...prev, ...nextResults]);
      setHasMore(pagination.hasMore || false);
      setTotal(pagination.total || total);
      setOffset(prev => prev + (nextResults.length || 0));

      // Update global cache for this page as well
      const moreKey = buildCacheKey({
        endpoint: searchEndpoint,
        term: debouncedSearchTerm || '',
        filters,
        limit,
        offset: nextOffset
      });
      globalCache.set(moreKey, {
        results: nextResults,
        hasMore: pagination.hasMore || false,
        total: pagination.total || total,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Search API loadMore error:', err);
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

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

  // Clear results when search term is cleared (only when minSearchLength > 0)
  useEffect(() => {
    if (minSearchLength > 0 && (!searchTerm || searchTerm.length < minSearchLength)) {
      setResults([]);
      setError(null);
      setHasMore(false);
      setTotal(0);
      setOffset(0);
    }
  }, [searchTerm, minSearchLength]);

  return {
    results,
    loading,
    error,
    hasMore,
    total,
    loadMore,
    loadingMore
  };
};