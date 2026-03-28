import { shouldAutoRefreshAfterAuthError } from '../utils/authInterceptorPolicy';

describe('api auth error handling policy', () => {
  it('only auto-refreshes session-aware routes', () => {
    expect(shouldAutoRefreshAfterAuthError('/api/orders')).toBe(true);
    expect(shouldAutoRefreshAfterAuthError('/api/auth/profile')).toBe(true);
    expect(shouldAutoRefreshAfterAuthError('/api/auth/validate')).toBe(true);
    expect(shouldAutoRefreshAfterAuthError('/api/auth/update-password')).toBe(false);
    expect(shouldAutoRefreshAfterAuthError('/api/auth/session-from-link')).toBe(false);
    expect(shouldAutoRefreshAfterAuthError('/api/auth/forgot-password')).toBe(false);
  });
});
