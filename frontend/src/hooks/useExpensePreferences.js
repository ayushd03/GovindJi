import { useCallback, useEffect, useMemo, useState } from 'react';

// Lightweight per-user localStorage-backed preferences for Expenses screen
// Keys are namespaced by user id to support multi-user devices

const getUserId = () => {
  try {
    const userDataStr = localStorage.getItem('userData');
    if (!userDataStr) return 'anon';
    const user = JSON.parse(userDataStr);
    return user?.id || user?.user?.id || 'anon';
  } catch (e) {
    return 'anon';
  }
};

const buildKey = (userId) => `expenses:preferences:${userId}`;

export const useExpensePreferences = () => {
  const userId = useMemo(getUserId, []);
  const storageKey = useMemo(() => buildKey(userId), [userId]);

  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      defaultView: 'list', // 'list' | 'calendar'
      defaultScope: 'month', // 'week' | 'month'
      filters: {
        categories: [],
        paymentMethods: [],
        vendors: []
      },
      lastDateRange: null
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {}
  }, [storageKey, prefs]);

  const updatePrefs = useCallback((updates) => {
    setPrefs((prev) => ({ ...prev, ...updates }));
  }, []);

  const setDefaultView = useCallback((view) => {
    updatePrefs({ defaultView: view });
  }, [updatePrefs]);

  const setDefaultScope = useCallback((scope) => {
    updatePrefs({ defaultScope: scope });
  }, [updatePrefs]);

  const setFilters = useCallback((filters) => {
    updatePrefs({ filters: { ...prefs.filters, ...filters } });
  }, [prefs.filters, updatePrefs]);

  const setLastDateRange = useCallback((range) => {
    updatePrefs({ lastDateRange: range });
  }, [updatePrefs]);

  return {
    prefs,
    setDefaultView,
    setDefaultScope,
    setFilters,
    setLastDateRange
  };
};


