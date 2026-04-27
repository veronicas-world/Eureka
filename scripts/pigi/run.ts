#!/usr/bin/env node
/**
 * scripts/pigi/run.ts  —  Pigi v1 bulk extractor
 *
 * Walks every company in the DB that has a website, calls Harmonic,
 * stores harmonic_raw + typed columns + person records + snapshots.
 *
 * Usage:
 *   npm run pigi            # run once (--once is the default)
 *   npm run pigi:watch      # run forever on a 24-hour loop
 *   node --experimental-strip-types --no-warnings scripts/pigi/run.ts [--watch]
 *
 * Requires in .env.local:
 *   HARMONIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config }        from 'dotenv'
import * as fs           from 'fs'
import * as path         from 'path'
import { createClient }  from '@supabase/supabase-js'
import {
  parseCompany,
  parsePerson,
  extractRoles,
  type PersonRole,
} from '../../lib/pigi/parsers.ts'

config({ path: path.resolve(process.cwd(), '.env.local') })

// ── Config ────────────────────────────────────────────────────────────────────

const HARMONIC_API_KEY = process.env.HARMONIC_API_KEY
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const CONCURRENCY      = 4
const PERSON_BATCH     = 50          // URNs per /persons request
const WATCH_INTERVAL   = 24 * 60 * 60 * 1000  // 24 hours

const WATCH_MODE = process.argv.includes('--watch')
const LOG_DIR    = path.resolve(process.cwd(), 'scripts/pigi/log')

// ── Guards ────────────────────────────────────────────────────────────────────

if (!HARMONIC_API_KEY) {
  console.error('❌  HARMONIC_API_KEY not set in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
  console.error('    SUPABASE_SERVICE_ROLE_KEY: Supabase dashboard → Settings → API → service_role')
  process.exit(1)
}

// ── Supabase admin client (bypasses RLS) ─────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Utilities ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function extractDomain(website: string): string {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number, total: number) => Promise<void>,
): Promise<void> {
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx, items.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

type FetchResult = { status: number; ok: boolean; json: unknown }

async function fetchWithRetry(
  url:     string,
  opts:    RequestInit,
  retries: number = 3,
): Promise<FetchResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, opts)

    if (res.status === 429) {
      const wait = (parseInt(res.headers.get('retry-after') ?? '30', 10) || 30) * 1000
      console.log(`    ⏳  rate-limited — waiting ${wait / 1000}s`)
      await sleep(wait)
      continue
    }

    if (res.status >= 500 && attempt < retries) {
      const wait = Math.pow(2, attempt) * 1000
      console.log(`    ⏳  ${res.status} on attempt ${attempt + 1} — retrying in ${wait / 1000}s`)
      await sleep(wait)
      continue
    }

    let json: unknown = null
    try { json = await res.json() } catch { /* non-JSON body */ }
    return { status: res.status, ok: res.ok, json }
  }
  throw new Error('max retries exceeded')
}

function harmonicHeaders(): HeadersInit {
  return { apikey: HARMONIC_API_KEY! }
}

// ── Logbook ───────────────────────────────────────────────────────────────────

type FailedCompany = { domain: string; status: number; error: string }

type RunLog = {
  started_at:           string
  ended_at:             string
  companies_attempted:  number
  companies_succeeded:  number
  companies_failed:     FailedCompany[]
  persons_attempted:    number
  persons_succeeded:    number
  persons_failed:       number
}

function writeLog(log: RunLog): void {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const filename = path.join(LOG_DIR, `${log.started_at.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(filename, JSON.stringify(log, null, 2) + '\n')
  console.log(`\n📋  Log written → ${filename}`)
}

// ── Person batch processor ────────────────────────────────────────────────────

async function processPersonBatch(
  roleMap:    Map<string, PersonRole>,
  companyId:  string,
  log:        RunLog,
): Promise<{ added: number; updated: number }> {
  if (roleMap.size === 0) return { added: 0, updated: 0 }

  const urns        = [...roleMap.keys()]
  const urnChunks   = chunk(urns, PERSON_BATCH)
  let added = 0; let updated = 0

  for (const batch of urnChunks) {
    const q   = batch.map((u) => `urns=${encodeURIComponent(u)}`).join('&')
    const url = `https://api.harmonic.ai/persons?${q}`

    let result: FetchResult
    try {
      result = await fetchWithRetry(url, { headers: harmonicHeaders() })
      log.persons_attempted += batch.length
    } catch (err) {
      console.error(`    ⚠️  /persons batch failed: ${String(err)}`)
      log.persons_failed += batch.length
      continue
    }

    if (!result.ok || !Array.isArray(result.json)) {
      log.persons_failed += batch.length
      continue
    }

    const personObjects = result.json as Record<string, unknown>[]
    for (const personRaw of personObjects) {
      const urn  = (personRaw.entity_urn as string | undefined)?.trim() ?? ''
      const role = roleMap.get(urn)
      if (!role) continue

      const record = parsePerson(personRaw, role, companyId)
      if (!record.name) continue

      // Upsert strategy: match by harmonic_urn, fall back to name
      let existingId: string | null = null

      if (urn) {
        const { data } = await supabase
          .from('people')
          .select('id')
          .eq('company_id', companyId)
          .eq('harmonic_urn', urn)
          .maybeSingle()
        if (data) existingId = data.id
      }
      if (!existingId) {
        const { data } = await supabase
          .from('people')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', record.name)
          .maybeSingle()
        if (data) existingId = data.id
      }

      const upsertRecord = { ...record, harmonic_raw: personRaw }

      if (existingId) {
        const { error } = await supabase.from('people').update(upsertRecord).eq('id', existingId)
        if (!error) updated++
        else log.persons_failed++
      } else {
        const { error } = await supabase.from('people').insert(upsertRecord)
        if (!error) added++
        else log.persons_failed++
      }

      log.persons_succeeded++
    }
  }

  return { added, updated }
}

// ── Single company extractor ──────────────────────────────────────────────────

async function processCompany(
  company: { id: string; name: string; website: string; harmonic_urn: string | null },
  idx:     number,
  total:   number,
  log:     RunLog,
): Promise<void> {
  const domain = extractDomain(company.website)
  const label  = `[${String(idx + 1).padStart(String(total).length)}/${total}] ${domain}`
  log.companies_attempted++

  let result: FetchResult
  try {
    result = await fetchWithRetry(
      `https://api.harmonic.ai/companies?website_domain=${encodeURIComponent(domain)}`,
      { method: 'POST', headers: { ...harmonicHeaders(), 'content-type': 'application/json' }, body: '{}' },
    )
  } catch (err) {
    console.log(`${label}  ✗  network error: ${String(err)}`)
    log.companies_failed.push({ domain, status: 0, error: String(err) })
    return
  }

  // 404 = Harmonic queued enrichment; skip this run
  if (result.status === 404) {
    const enrichUrn = (result.json as Record<string, unknown> | null)?.entity_urn as string | undefined
    console.log(`${label}  ⏳  queued (404)${enrichUrn ? ` urn=${enrichUrn}` : ''}`)
    log.companies_failed.push({ domain, status: 404, error: 'queued' })
    return
  }

  // 201 = stale data returned + refresh queued — treat as success
  if (!result.ok && result.status !== 201) {
    console.log(`${label}  ✗  status ${result.status}`)
    log.companies_failed.push({ domain, status: result.status, error: `HTTP ${result.status}` })
    return
  }

  if (!result.json || typeof result.json !== 'object') {
    console.log(`${label}  ✗  empty body`)
    log.companies_failed.push({ domain, status: result.status, error: 'empty body' })
    return
  }

  const raw = result.json as Record<string, unknown>

  // ── Update companies table ─────────────────────────────────────────────────
  const parsed = parseCompany(raw)
  const companyUpdate = {
    ...Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined),
    ),
    harmonic_raw: raw,
  }

  const { error: updateErr } = await supabase
    .from('companies')
    .update(companyUpdate)
    .eq('id', company.id)

  if (updateErr) {
    console.log(`${label}  ✗  DB update: ${updateErr.message}`)
    log.companies_failed.push({ domain, status: result.status, error: updateErr.message })
    return
  }

  // ── Insert snapshot (immutable history) ────────────────────────────────────
  try {
    await supabase.from('company_snapshots').insert({
      company_id:   company.id,
      harmonic_urn: parsed.harmonic_urn ?? company.harmonic_urn,
      harmonic_raw: raw,
    })
  } catch {
    // unique(company_id, captured_at) collision — sub-second re-run, safe to ignore
  }

  // ── Collect current-position person URNs ───────────────────────────────────
  const peopleRels = (raw.people ?? []) as unknown[]
  const roles      = extractRoles(peopleRels)
  const roleMap    = new Map<string, PersonRole>(roles.map((r) => [r.urn, r]))

  const { added: pAdded, updated: pUpdated } =
    await processPersonBatch(roleMap, company.id, log)

  log.companies_succeeded++
  console.log(
    `${label}  ✔  ` +
    `${peopleRels.length} people (${pAdded} added / ${pUpdated} updated)  ` +
    `${(raw.funding_rounds as unknown[] | undefined)?.length ?? 0} rounds`,
  )
}

// ── Main run ──────────────────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
  const startedAt = new Date().toISOString()
  console.log(`\n╔══ Pigi run ══════════════════════════════════════════════╗`)
  console.log(`  mode      : ${WATCH_MODE ? 'watch (24h loop)' : 'once'}`)
  console.log(`  started   : ${startedAt}`)
  console.log(`  concurrency: ${CONCURRENCY}`)
  console.log(`╚══════════════════════════════════════════════════════════╝\n`)

  // Load company list
  const { data: companies, error: fetchErr } = await supabase
    .from('companies')
    .select('id, name, website, harmonic_urn')
    .not('website', 'is', null)
    .order('display_order', { ascending: true, nullsFirst: false })

  if (fetchErr || !companies) {
    console.error('❌  Could not fetch companies:', fetchErr?.message)
    process.exit(1)
  }

  console.log(`Loaded ${companies.length} companies with websites.\n`)

  const log: RunLog = {
    started_at:          startedAt,
    ended_at:            '',
    companies_attempted: 0,
    companies_succeeded: 0,
    companies_failed:    [],
    persons_attempted:   0,
    persons_succeeded:   0,
    persons_failed:      0,
  }

  await withConcurrency(
    companies as { id: string; name: string; website: string; harmonic_urn: string | null }[],
    CONCURRENCY,
    (company, idx, total) => processCompany(company, idx, total, log),
  )

  log.ended_at = new Date().toISOString()
  const elapsed = Math.round(
    (new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 1000,
  )

  console.log(`\n╔══ Summary ════════════════════════════════════════════════╗`)
  console.log(`  companies : ${log.companies_succeeded} / ${log.companies_attempted} succeeded`)
  console.log(`  persons   : ${log.persons_succeeded} processed  (${log.persons_failed} failed)`)
  console.log(`  elapsed   : ${elapsed}s`)
  if (log.companies_failed.length > 0) {
    console.log(`  failures  :`)
    for (const f of log.companies_failed) {
      console.log(`    [${f.status}] ${f.domain} — ${f.error}`)
    }
  }
  console.log(`╚══════════════════════════════════════════════════════════╝`)

  writeLog(log)
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (WATCH_MODE) {
    while (true) {
      await runOnce()
      console.log(`\n⏰  Next run in 24 hours. Sleeping...\n`)
      await sleep(WATCH_INTERVAL)
    }
  } else {
    await runOnce()
  }
}

main().catch((err: unknown) => {
  console.error('\n❌  Pigi crashed:', err)
  process.exit(1)
})
