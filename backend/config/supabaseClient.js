const { createClient } = require('@supabase/supabase-js');

const PLACEHOLDER_PATTERNS = [
  /^<[^>]+>$/,
  /^your[_-]/i,
  /^add[_-]/i,
  /^replace[_-]/i,
  /^changeme$/i,
  /^undefined$/i,
  /^null$/i,
  /^todo$/i
];

const normalizeEnvValue = (value) => (typeof value === 'string' ? value.trim() : '');

const isConfiguredValue = (value) => {
  const normalized = normalizeEnvValue(value);

  return Boolean(normalized) && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
};

const getSupabaseUrl = () => normalizeEnvValue(process.env.SUPABASE_URL);

const getSupabaseAnonKey = () => (
  isConfiguredValue(process.env.SUPABASE_ANON_KEY)
    ? normalizeEnvValue(process.env.SUPABASE_ANON_KEY)
    : ''
);

const getSupabaseServiceRoleKey = () => (
  isConfiguredValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
    : ''
);

const getPreferredSupabaseKey = ({ preferServiceRole = false, allowAnonFallback = true } = {}) => {
  if (preferServiceRole) {
    const serviceRoleKey = getSupabaseServiceRoleKey();

    if (serviceRoleKey) {
      return serviceRoleKey;
    }

    return allowAnonFallback ? getSupabaseAnonKey() : '';
  }

  return getSupabaseAnonKey();
};

const createBackendSupabaseClient = ({
  preferServiceRole = false,
  allowAnonFallback = true,
  options
} = {}) => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getPreferredSupabaseKey({ preferServiceRole, allowAnonFallback });

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required.');
  }

  if (!supabaseKey) {
    throw new Error(
      preferServiceRole && !allowAnonFallback
        ? 'SUPABASE_SERVICE_ROLE_KEY is required.'
        : 'A valid Supabase API key is required.'
    );
  }

  return createClient(supabaseUrl, supabaseKey, options);
};

module.exports = {
  createBackendSupabaseClient,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  getPreferredSupabaseKey
};
