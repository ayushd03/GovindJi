import {
  buildAuthPath,
  clearPendingAuthJourney,
  persistPendingAuthJourney,
  readPendingAuthJourney,
  sanitizeNextPath,
} from './authRouting';

describe('authRouting', () => {
  beforeEach(() => {
    clearPendingAuthJourney();
  });

  it('builds the canonical auth path with safe next values', () => {
    expect(buildAuthPath()).toBe('/auth');
    expect(buildAuthPath({ mode: 'sign-up', next: '/checkout', reason: 'session-expired' })).toBe(
      '/auth?mode=sign-up&next=%2Fcheckout&reason=session-expired'
    );
  });

  it('rejects unsafe next values', () => {
    expect(sanitizeNextPath('https://example.com')).toBe('');
    expect(sanitizeNextPath('//example.com')).toBe('');
    expect(sanitizeNextPath('/orders')).toBe('/orders');
  });

  it('persists and restores pending auth journey data', () => {
    persistPendingAuthJourney({
      email: 'hello@example.com',
      next: '/checkout',
      intent: 'signup',
    });

    expect(readPendingAuthJourney()).toEqual({
      email: 'hello@example.com',
      next: '/checkout',
      intent: 'signup',
    });

    clearPendingAuthJourney();
    expect(readPendingAuthJourney()).toBeNull();
  });
});
