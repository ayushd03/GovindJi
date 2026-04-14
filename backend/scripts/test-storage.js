#!/usr/bin/env node
/**
 * Local check: loads .env, initializes StorageService, prints health.
 * Requires network. If unhealthy with RLS errors, set SUPABASE_SERVICE_ROLE_KEY
 * in .env (Project Settings → API) or add Storage policies for the anon role.
 */
require('dotenv').config();
const storageService = require('../services/StorageService');

(async () => {
  try {
    await storageService.initialize();
    const h = await storageService.healthCheck();
    console.log(JSON.stringify(h, null, 2));
    if (h.status !== 'healthy') {
      console.error(
        '\nTip: With STORAGE_PROVIDER=supabase, server uploads need either:\n' +
          '  • SUPABASE_SERVICE_ROLE_KEY in .env (recommended for backend), or\n' +
          '  • Storage RLS policies allowing insert/select/delete for role anon on your bucket.\n' +
          'See: https://supabase.com/docs/guides/storage/security/access-control\n'
      );
      process.exit(1);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
