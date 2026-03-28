export const shouldAutoRefreshAfterAuthError = (url = '') => {
  const normalizedUrl = String(url || '');

  if (!normalizedUrl.includes('/api/auth/')) {
    return true;
  }

  return normalizedUrl.includes('/api/auth/validate') || normalizedUrl.includes('/api/auth/profile');
};
