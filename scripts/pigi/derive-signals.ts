#!/usr/bin/env node
/**
 * scripts/pigi/derive-signals.ts  —  Pigi v2 signal deriver
 *
 * For each company that has ≥ 2 snapshots in company_snapshots, diffs the
 * two most recent rows and inserts derived signal records.
 *
 * Usage:
 *   npm run pigi:derive
 *   node --experimental-strip-types --no-warnings scripts/pigi/derive-signals.ts
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config }       from 'dotenv'
import * as path        from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Type helpers ───────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>

function r(v: unknown): Raw {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return v as Raw
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function formatFundingType(type: string): string {
  return type
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function formatTraffic(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── Signal type ────────────────────────────────────────────────────────────────

type Signal = {
  company_id:    string
  signal_type:   string
  signal_source: 'pigi_diff'
  headline:      string
  detail:        string | null
  signal_date:   string
  strength:      'weak' | 'moderate' | 'strong'
}

// ── Diff: funding ──────────────────────────────────────────────────────────────

function diffFunding(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const signals: Signal[] = []
  const cf = r(curr.funding)
  const pf = r(prev.funding)

  const currRoundsCount = arr(curr.funding_rounds).length
  const prevRoundsCount = arr(prev.funding_rounds).length

  if (currRoundsCount > prevRoundsCount) {
    // New round: emit strong funding signal
    const latestRound = r(arr(curr.funding_rounds)[0])
    const typeSrc     = str(cf.last_funding_type) ?? str(latestRound.funding_type) ?? 'round'
    const roundName   = formatFundingType(typeSrc)
    const amtUsd      = num(latestRound.amount_usd) ?? num(latestRound.amount)
    const amtStr      = amtUsd ? ` (${formatAmount(amtUsd)})` : ''
    signals.push({
      company_id:    companyId,
      signal_type:   'funding',
      signal_source: 'pigi_diff',
      headline:      `${name} raised ${roundName}${amtStr}`,
      detail:        null,
      signal_date:   signalDate,
      strength:      'strong',
    })
    return signals
  }

  // Funding type changed without new round count (e.g. correction or update)
  const currType = str(cf.last_funding_type)
  const prevType = str(pf.last_funding_type)
  if (currType && prevType && currType !== prevType) {
    signals.push({
      company_id:    companyId,
      signal_type:   'funding',
      signal_source: 'pigi_diff',
      headline:      `${name} funding updated to ${formatFundingType(currType)}`,
      detail:        null,
      signal_date:   signalDate,
      strength:      'moderate',
    })
  }

  return signals
}

// ── Diff: valuation ────────────────────────────────────────────────────────────

function diffValuation(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const currVal = num(r(curr.funding).valuation)
  const prevVal = num(r(prev.funding).valuation)
  if (!currVal || !prevVal || currVal <= prevVal) return []

  const pct = pctChange(currVal, prevVal)
  if (!pct || pct < 25) return []

  return [{
    company_id:    companyId,
    signal_type:   'valuation',
    signal_source: 'pigi_diff',
    headline:      `${name} valuation rose from ${formatAmount(prevVal)} to ${formatAmount(currVal)}`,
    detail:        `${pct.toFixed(0)}% increase`,
    signal_date:   signalDate,
    strength:      'strong',
  }]
}

// ── Diff: headcount ────────────────────────────────────────────────────────────

function diffHeadcount(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const currHc = num(curr.headcount)
  const prevHc = num(prev.headcount)
  if (!currHc || !prevHc || currHc <= prevHc) return []

  const pct = pctChange(currHc, prevHc)
  if (!pct || pct < 5) return []

  let strength: 'weak' | 'moderate' | 'strong'
  if (pct >= 20)      strength = 'strong'
  else if (pct >= 10) strength = 'moderate'
  else                strength = 'weak'

  return [{
    company_id:    companyId,
    signal_type:   'team_growth',
    signal_source: 'pigi_diff',
    headline:      `${name} headcount grew ${pct.toFixed(0)}% over the last week`,
    detail:        `${prevHc} → ${currHc}`,
    signal_date:   signalDate,
    strength,
  }]
}

// ── Diff: web traffic ──────────────────────────────────────────────────────────

function diffWebTraffic(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const currW = num(curr.web_traffic)
  const prevW = num(prev.web_traffic)
  if (!currW || !prevW || currW <= prevW) return []

  const pct = pctChange(currW, prevW)
  if (!pct || pct < 50) return []

  const strength: 'moderate' | 'strong' = pct >= 100 ? 'strong' : 'moderate'
  const currFmt = formatTraffic(currW)

  return [{
    company_id:    companyId,
    signal_type:   'web_traffic',
    signal_source: 'pigi_diff',
    headline:      pct >= 100
      ? `${name} web traffic doubled to ${currFmt} monthly visitors`
      : `${name} web traffic grew ${pct.toFixed(0)}% to ${currFmt} monthly visitors`,
    detail:        `${formatTraffic(prevW)} → ${currFmt} monthly visitors`,
    signal_date:   signalDate,
    strength,
  }]
}

// ── Diff: tags ─────────────────────────────────────────────────────────────────

function diffTags(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const extractTags = (raw: Raw): Set<string> => {
    const out = new Set<string>()
    for (const t of arr(raw.tags_v2)) {
      const dv = str(r(t).display_value)
      if (dv) out.add(dv)
    }
    return out
  }

  const currTags = extractTags(curr)
  const prevTags = extractTags(prev)
  const signals: Signal[] = []

  for (const tag of currTags) {
    if (!prevTags.has(tag)) {
      signals.push({
        company_id:    companyId,
        signal_type:   'tag',
        signal_source: 'pigi_diff',
        headline:      `${name} tagged as ${tag}`,
        detail:        null,
        signal_date:   signalDate,
        strength:      'weak',
      })
    }
  }
  return signals
}

// ── Diff: highlights ───────────────────────────────────────────────────────────

const STRONG_HIGHLIGHT_KEYWORDS = [
  'forbes', 'y combinator', 'ycombinator', '30 under', '30u30',
  'thiel', 'sequoia', 'top companies', 'inc. 500', 'fast company',
]

function highlightStrength(h: Raw): 'strong' | 'moderate' {
  const text = `${h.text ?? ''} ${h.category ?? ''} ${h.title ?? ''}`.toLowerCase()
  return STRONG_HIGHLIGHT_KEYWORDS.some((k) => text.includes(k)) ? 'strong' : 'moderate'
}

function highlightKey(h: Raw): string | null {
  const k = `${str(h.text) ?? ''}_${str(h.category) ?? ''}`
  return k === '_' ? null : k
}

function diffHighlights(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const extractHighlights = (raw: Raw): Map<string, Raw> => {
    const out = new Map<string, Raw>()
    for (const h of [...arr(raw.highlights), ...arr(raw.employee_highlights)]) {
      const hr  = r(h)
      const key = highlightKey(hr)
      if (key) out.set(key, hr)
    }
    return out
  }

  const currH    = extractHighlights(curr)
  const prevH    = extractHighlights(prev)
  const signals: Signal[] = []

  for (const [key, h] of currH) {
    if (!prevH.has(key)) {
      const title = str(h.text) ?? str(h.category) ?? 'recognition'
      signals.push({
        company_id:    companyId,
        signal_type:   'highlight',
        signal_source: 'pigi_diff',
        headline:      `${name} now featured on ${title}`,
        detail:        null,
        signal_date:   signalDate,
        strength:      highlightStrength(h),
      })
    }
  }
  return signals
}

// ── Diff: people ───────────────────────────────────────────────────────────────

const KEY_ROLE_KEYWORDS = [
  'ceo', 'cto', 'coo', 'cfo', 'cpo', 'chief', 'president',
  'vp ', 'vice president', 'head of', 'director', 'general partner', 'managing partner',
]

function isKeyRole(title: string | null): boolean {
  if (!title) return false
  const t = title.toLowerCase()
  return KEY_ROLE_KEYWORDS.some((k) => t.includes(k))
}

type PersonEntry = { urn: string; name: string; title: string | null; isFounder: boolean }

function extractCurrentPeople(raw: Raw): Map<string, PersonEntry> {
  const out = new Map<string, PersonEntry>()
  for (const rel of arr(raw.people)) {
    const relObj = r(rel)
    if (relObj.is_current_position === false) continue
    const personRaw = r(relObj.person)
    const urn = str(relObj.entity_urn) ?? str(personRaw.entity_urn)
    if (!urn) continue
    const personName = str(personRaw.full_name) ?? str(personRaw.name) ?? ''
    const title = str(r(relObj.position).title) ?? str(relObj.title) ?? null
    const isFounder = !!(relObj.is_founder || relObj.founder || false)
    out.set(urn, { urn, name: personName, title, isFounder })
  }
  return out
}

function diffPeople(
  name:       string,
  companyId:  string,
  signalDate: string,
  curr:       Raw,
  prev:       Raw,
): Signal[] {
  const currPeople = extractCurrentPeople(curr)
  const prevPeople = extractCurrentPeople(prev)
  const signals: Signal[] = []

  // Additions
  for (const [urn, person] of currPeople) {
    if (prevPeople.has(urn)) continue
    const titleStr = person.title ? ` (${person.title})` : ''
    if (person.isFounder) {
      signals.push({
        company_id:    companyId,
        signal_type:   'team_change',
        signal_source: 'pigi_diff',
        headline:      `${name} added a new founder: ${person.name}${titleStr}`,
        detail:        null,
        signal_date:   signalDate,
        strength:      'strong',
      })
    } else if (isKeyRole(person.title)) {
      signals.push({
        company_id:    companyId,
        signal_type:   'team_change',
        signal_source: 'pigi_diff',
        headline:      `${name} added a key hire: ${person.name}${titleStr}`,
        detail:        null,
        signal_date:   signalDate,
        strength:      'moderate',
      })
    }
  }

  // Departures (founders only — key-role departures are noisy without confirmation)
  for (const [urn, person] of prevPeople) {
    if (currPeople.has(urn)) continue
    if (person.isFounder) {
      const titleStr = person.title ? ` (${person.title})` : ''
      signals.push({
        company_id:    companyId,
        signal_type:   'team_change',
        signal_source: 'pigi_diff',
        headline:      `${person.name} departed as founder at ${name}${titleStr}`,
        detail:        null,
        signal_date:   signalDate,
        strength:      'strong',
      })
    }
  }

  return signals
}

// ── Idempotency check + insert ─────────────────────────────────────────────────

async function insertSignalIfNew(signal: Signal): Promise<'inserted' | 'skipped'> {
  const { data, error: checkError } = await supabase
    .from('signals')
    .select('id')
    .eq('company_id',   signal.company_id)
    .eq('signal_type',  signal.signal_type)
    .eq('signal_date',  signal.signal_date)
    .eq('headline',     signal.headline)
    .maybeSingle()

  if (checkError) {
    console.error(`  ⚠️  idempotency check failed: ${checkError.message}`)
    return 'skipped'
  }
  if (data) return 'skipped'

  const { error: insertError } = await supabase.from('signals').insert(signal)
  if (insertError) {
    console.error(`  ⚠️  insert failed: ${insertError.message}`)
    return 'skipped'
  }
  return 'inserted'
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt  = Date.now()
  const signalDate = new Date().toISOString().split('T')[0]

  let analyzed = 0
  let skipped  = 0
  let emitted  = 0
  const strengthCounts = { strong: 0, moderate: 0, weak: 0 }

  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, name')
    .order('created_at', { ascending: true })

  if (companiesError || !companies) {
    console.error('❌  Failed to fetch companies:', companiesError?.message)
    process.exit(1)
  }

  console.log(`\n📡  Signal Deriver — analyzing ${companies.length} companies\n`)

  for (const company of companies as { id: string; name: string }[]) {
    const { data: snapshots, error: snapError } = await supabase
      .from('company_snapshots')
      .select('captured_at, harmonic_raw')
      .eq('company_id', company.id)
      .order('captured_at', { ascending: false })
      .limit(2)

    if (snapError) {
      console.error(`  ⚠️  [${company.name}] snapshot fetch failed: ${snapError.message}`)
      continue
    }

    if (!snapshots || snapshots.length < 2) {
      skipped++
      continue
    }

    analyzed++
    const snaps = snapshots as { captured_at: string; harmonic_raw: unknown }[]
    const curr  = r(snaps[0].harmonic_raw)
    const prev  = r(snaps[1].harmonic_raw)
    const id    = company.id
    const cname = company.name

    const candidates: Signal[] = [
      ...diffFunding(cname, id, signalDate, curr, prev),
      ...diffValuation(cname, id, signalDate, curr, prev),
      ...diffHeadcount(cname, id, signalDate, curr, prev),
      ...diffWebTraffic(cname, id, signalDate, curr, prev),
      ...diffTags(cname, id, signalDate, curr, prev),
      ...diffHighlights(cname, id, signalDate, curr, prev),
      ...diffPeople(cname, id, signalDate, curr, prev),
    ]

    for (const signal of candidates) {
      const result = await insertSignalIfNew(signal)
      if (result === 'inserted') {
        emitted++
        strengthCounts[signal.strength]++
        console.log(`  ✓  [${cname}] ${signal.signal_type} · ${signal.strength} · ${signal.headline}`)
      }
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)

  const pad  = (label: string, value: string) =>
    `  ${label.padEnd(22)} : ${value}`

  console.log(`
╔══ Signal Deriver Summary ═══════════════════════════╗
${pad('companies analyzed', String(analyzed))}
${pad('signals emitted', `${emitted}  (strong: ${strengthCounts.strong}, moderate: ${strengthCounts.moderate}, weak: ${strengthCounts.weak})`)}
${pad('skipped (1 snap)', String(skipped))}
${pad('elapsed', `${elapsed}s`)}
╚════════════════════════════════════════════════════╝`)
}

main().catch((err) => {
  console.error('❌  Fatal:', err)
  process.exit(1)
})
