export const AUTH_RECOVERY_SESSION_KEY = 'authRecoverySession';

export const getSessionExpiryMs = (session, now = Date.now()) => {
  if (!session || typeof session !== 'object') {
    return 0;
  }

  const expiresAt = Number(session.expires_at);
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt * 1000;
  }

  const expiresIn = Number(session.expires_in);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    return now + (expiresIn * 1000);
  }

  return 0;
};

export const resolveAuthCallbackIntent = ({ type = '', mode = '', pendingIntent = '' } = {}) => {
  if (type === 'recovery' || mode === 'reset-password' || pendingIntent === 'recovery') {
    return 'recovery';
  }

  return 'signup';
};

export const clearRecoverySession = () => {
  sessionStorage.removeItem(AUTH_RECOVERY_SESSION_KEY);
};

export const persistRecoverySession = (session, { user = null, email = '', intent = 'recovery' } = {}) => {
  if (!session?.access_token) {
    clearRecoverySession();
    return null;
  }

  const normalizedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || '',
    token_type: session.token_type || 'bearer',
    expires_in: session.expires_in !== undefined ? Number(session.expires_in) : undefined,
    expires_at: session.expires_at !== undefined ? Number(session.expires_at) : undefined,
  };

  const record = {
    session: normalizedSession,
    user: user && typeof user === 'object' ? user : null,
    email: email || '',
    intent,
    expires_at_ms: getSessionExpiryMs(normalizedSession),
    stored_at_ms: Date.now(),
  };

  sessionStorage.setItem(AUTH_RECOVERY_SESSION_KEY, JSON.stringify(record));
  return record;
};

export const readRecoverySession = () => {
  try {
    const raw = sessionStorage.getItem(AUTH_RECOVERY_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.session?.access_token) {
      return null;
    }

    return {
      ...parsed,
      email: parsed.email || '',
      intent: parsed.intent || 'recovery',
      user: parsed.user && typeof parsed.user === 'object' ? parsed.user : null,
      expires_at_ms: Number(parsed.expires_at_ms) || 0,
    };
  } catch (error) {
    return null;
  }
};

export const isRecoverySessionExpired = (record, now = Date.now()) => (
  Boolean(record?.expires_at_ms) && now >= record.expires_at_ms
);

export const shouldRefreshRecoverySession = (record, now = Date.now(), bufferMs = 30000) => (
  Boolean(record?.session?.refresh_token) &&
  Boolean(record?.expires_at_ms) &&
  now >= (record.expires_at_ms - bufferMs)
);
