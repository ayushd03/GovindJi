/**
 * API origin for Express. In production, empty string means same origin (nginx proxies /api).
 * For local dev, .env sets REACT_APP_API_URL=http://localhost:3001
 */
export function getApiBaseUrl() {
  const v = process.env.REACT_APP_API_URL;
  if (v !== undefined && v !== null && v !== '') {
    return v;
  }
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
}

export const API_BASE_URL = getApiBaseUrl();
