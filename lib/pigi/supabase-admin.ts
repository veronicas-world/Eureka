/**
 * lib/pigi/supabase-admin.ts
 *
 * Creates a Supabase client that bypasses Row Level Security.
 * Used exclusively by Pigi scripts (never browser / Next.js routes).
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← Supabase dashboard → Settings → API → service_role
 */

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL not set in .env.local')
    process.exit(1)
  }
  if (!key) {
    console.error('❌  SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
    console.error('    Find it: Supabase dashboard → Settings → API → service_role secret')
    process.exit(1)
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
