#!/usr/bin/env node
/**
 * scripts/pigi/import-saved-searches.ts
 *
 * One-shot importer: pulls your 41 Harmonic saved searches and
 * upserts them into the saved_searches table (source = 'harmonic').
 *
 * Run once after applying migration 003.
 * Safe to re-run — harmonic_id is a unique key so duplicates are skipped.
 *
 * Usage:
 *   npm run pigi:import-saved-searches
 */

import { config }       from 'dotenv'
import * as path        from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: path.resolve(process.cwd(), '.env.local') })

const HARMONIC_API_KEY = process.env.HARMONIC_API_KEY
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!HARMONIC_API_KEY) {
  console.error('❌  HARMONIC_API_KEY not set in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type HarmonicSavedSearch = {
  id:                   string
  entity_urn:           string
  name:                 string
  type:                 string
  query:                unknown
  column_view_settings: unknown
  is_private:           boolean
  created_at:           string
  updated_at:           string
}

async function run(): Promise<void> {
  console.log('\n╔══ Pigi: import saved searches ═══════════════════════════╗')

  const res = await fetch('https://api.harmonic.ai/saved_searches', {
    headers: { apikey: HARMONIC_API_KEY! },
  })

  if (!res.ok) {
    console.error(`❌  Harmonic returned ${res.status}`)
    const body = await res.text().catch(() => '(no body)')
    console.error(body)
    process.exit(1)
  }

  const searches = (await res.json()) as HarmonicSavedSearch[]
  if (!Array.isArray(searches)) {
    console.error('❌  Unexpected response shape — expected array')
    console.error(JSON.stringify(searches).slice(0, 300))
    process.exit(1)
  }

  console.log(`  Fetched ${searches.length} saved searches from Harmonic.`)

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const s of searches) {
    const harmonic_id = s.id ?? s.entity_urn
    if (!harmonic_id) { skipped++; continue }

    // Check if already present
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('harmonic_id', harmonic_id)
      .maybeSingle()

    if (existing) { skipped++; continue }

    const { error } = await supabase.from('saved_searches').insert({
      harmonic_id,
      name:                 s.name           ?? null,
      query:                s.query          ?? null,
      filters:              null,             // Eureka-native filters populated separately
      column_view_settings: s.column_view_settings ?? null,
      source:               'harmonic',
      created_at:           s.created_at     ?? new Date().toISOString(),
    })

    if (error) {
      errors.push(`${s.name ?? harmonic_id}: ${error.message}`)
    } else {
      imported++
    }
  }

  console.log(`\n  imported : ${imported}`)
  console.log(`  skipped  : ${skipped} (already present)`)
  if (errors.length > 0) {
    console.log(`  errors   : ${errors.length}`)
    for (const e of errors) console.log(`    • ${e}`)
  }
  console.log(`╚══════════════════════════════════════════════════════════╝\n`)
}

run().catch((err: unknown) => {
  console.error('\n❌  Import crashed:', err)
  process.exit(1)
})
