import {
  clearRecoverySession,
  getSessionExpiryMs,
  isRecoverySessionExpired,
  persistRecoverySession,
  readRecoverySession,
  resolveAuthCallbackIntent,
  shouldRefreshRecoverySession,
} from './authRecovery';

describe('authRecovery', () => {
  beforeEach(() => {
    clearRecoverySession();
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores and restores a recovery session in sessionStorage', () => {
    persistRecoverySession(
      {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 60,
      },
      {
        email: 'recover@example.com',
        intent: 'recovery',
        user: { id: 'user-1' },
      }
    );

    expect(readRecoverySession()).toEqual(
      expect.objectContaining({
        email: 'recover@example.com',
        intent: 'recovery',
        expires_at_ms: 61000,
        user: { id: 'user-1' },
        session: expect.objectContaining({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
        }),
      })
    );
  });

  it('resolves callback intent conservatively for password recovery links', () => {
    expect(resolveAuthCallbackIntent({ type: 'recovery' })).toBe('recovery');
    expect(resolveAuthCallbackIntent({ mode: 'reset-password' })).toBe('recovery');
    expect(resolveAuthCallbackIntent({ pendingIntent: 'recovery' })).toBe('recovery');
    expect(resolveAuthCallbackIntent({ type: 'signup' })).toBe('signup');
  });

  it('computes expiry and refresh windows consistently', () => {
    const record = persistRecoverySession({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 10,
    });

    expect(getSessionExpiryMs(record.session, 1000)).toBe(10000);
    expect(isRecoverySessionExpired(record, 9999)).toBe(false);
    expect(isRecoverySessionExpired(record, 10000)).toBe(true);
    expect(shouldRefreshRecoverySession(record, 1000, 9500)).toBe(true);
  });
});
