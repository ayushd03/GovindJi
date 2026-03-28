const { createClient } = require('@supabase/supabase-js');

const extractAuthToken = (req) => {
  const authorizationHeader = req.headers.authorization || req.headers.Authorization;

  if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.slice('Bearer '.length).trim();
  }

  const bodyToken = req.body?.access_token || req.body?.token;
  if (typeof bodyToken === 'string' && bodyToken.trim()) {
    return bodyToken.trim();
  }

  const queryToken = req.query?.access_token || req.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return '';
};

// Lightweight authenticateToken for use in standalone route files.
// Mirrors the logic in server.js but is self-contained so route files
// don't need a circular reference back to server.js.
const authenticateToken = async (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    if (!token) return res.status(401).json({ success: false, error: 'No token provided' });

    // Attach a user-scoped supabase client to req if not already present
    if (!req.supabase) {
      req.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      );
    }

    const { data: { user }, error } = await req.supabase.auth.getUser();
    if (error || !user) return res.status(401).json({ success: false, error: 'Invalid token' });

    req.user = user;
    next();
  } catch (err) {
    console.error('[authMiddleware] authenticateToken error:', err);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

module.exports = { authenticateToken, extractAuthToken };
