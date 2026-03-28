export const DEFAULT_AUTH_MODE = 'sign-in';
export const AUTH_PENDING_JOURNEY_KEY = 'authPendingJourney';

const VALID_AUTH_MODES = new Set([
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
  'check-email',
  'confirmed',
]);

export const normalizeAuthMode = (mode) => (
  VALID_AUTH_MODES.has(mode) ? mode : DEFAULT_AUTH_MODE
);

export const sanitizeNextPath = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return '';
  }

  return value;
};

export const getPostAuthDestination = (candidate, fallback = '/') => (
  sanitizeNextPath(candidate) || fallback
);

export const buildAuthPath = ({ mode = DEFAULT_AUTH_MODE, next, reason, email } = {}) => {
  const searchParams = new URLSearchParams();
  const normalizedMode = normalizeAuthMode(mode);
  const safeNext = sanitizeNextPath(next);

  if (normalizedMode !== DEFAULT_AUTH_MODE) {
    searchParams.set('mode', normalizedMode);
  }

  if (safeNext) {
    searchParams.set('next', safeNext);
  }

  if (reason) {
    searchParams.set('reason', reason);
  }

  if (email) {
    searchParams.set('email', email);
  }

  const query = searchParams.toString();
  return query ? `/auth?${query}` : '/auth';
};

export const persistPendingAuthJourney = ({ email = '', next = '', intent = '' } = {}) => {
  const payload = {
    email,
    next: sanitizeNextPath(next),
    intent,
  };

  sessionStorage.setItem(AUTH_PENDING_JOURNEY_KEY, JSON.stringify(payload));
};

export const readPendingAuthJourney = () => {
  try {
    const raw = sessionStorage.getItem(AUTH_PENDING_JOURNEY_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      email: parsed.email || '',
      next: sanitizeNextPath(parsed.next),
      intent: parsed.intent || '',
    };
  } catch (error) {
    return null;
  }
};

export const clearPendingAuthJourney = () => {
  sessionStorage.removeItem(AUTH_PENDING_JOURNEY_KEY);
};
