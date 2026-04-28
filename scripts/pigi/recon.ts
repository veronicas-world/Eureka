#!/usr/bin/env tsx
/**
 * scripts/pigi/recon.ts
 *
 * Runs every Harmonic API probe from design-handoff/PIGI-API-RECON.md and
 * writes the raw JSON responses to design-handoff/pigi-recon/.
 *
 * Usage:
 *   npm run pigi:recon                    # uses .env.local + default domain
 *   npm run pigi:recon stripe.com         # override test domain
 *   HARMONIC_API_KEY=xxx npm run pigi:recon
 *
 * Sections covered: A B C D(1-4) E(1-2) F(1-3) G H(1-2) I(1-2) J K
 * All files land in design-handoff/pigi-recon/.
 */

import { config } from 'dotenv'
import * as fs   from 'fs'
import * as path from 'path'

// Load .env.local before anything else reads process.env
config({ path: path.resolve(process.cwd(), '.env.local') })

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY     = process.env.HARMONIC_API_KEY
const BASE        = 'https://api.harmonic.ai'
const TEST_DOMAIN = process.argv[2] ?? 'anthropic.com'
const OUT_DIR     = path.resolve(process.cwd(), 'design-handoff/pigi-recon')

if (!API_KEY) {
  console.error('\n❌  HARMONIC_API_KEY not found.')
  console.error('    Add it to .env.local:  HARMONIC_API_KEY=your-key-here')
  console.error('    Or export it:          export HARMONIC_API_KEY=your-key-here\n')
  process.exit(1)
}

fs.mkdirSync(OUT_DIR, { recursive: true })

// ── Helpers ───────────────────────────────────────────────────────────────────

// Accumulate rate-limit headers across all responses for section K.
const rateLimitHeaders: Record<string, string> = {}

function outPath(filename: string): string {
  return path.join(OUT_DIR, filename)
}

function save(filename: string, data: unknown): void {
  fs.writeFileSync(outPath(filename), JSON.stringify(data, null, 2) + '\n')
}

function saveTxt(filename: string, text: string): void {
  fs.writeFileSync(outPath(filename), text + '\n')
}

type CallResult = {
  status:  number
  ok:      boolean
  json:    unknown
  headers: Record<string, string>
}

async function call(
  method:  'GET' | 'POST',
  endpoint: string,
  body?:   unknown,
): Promise<CallResult> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`

  const res = await fetch(url, {
    method,
    headers: {
      apikey: API_KEY!,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  // Harvest rate-limit headers from every response.
  const headers: Record<string, string> = {}
  for (const [k, v] of res.headers.entries()) {
    headers[k] = v
    const kl = k.toLowerCase()
    if (
      kl.startsWith('x-ratelimit') ||
      kl === 'retry-after'         ||
      kl === 'x-quota-limit'       ||
      kl === 'x-quota-remaining'
    ) {
      rateLimitHeaders[k] = v
    }
  }

  let json: unknown
  const text = await res.text()
  try { json = JSON.parse(text) } catch { json = { _raw_text: text } }

  return { status: res.status, ok: res.status >= 200 && res.status < 300, json, headers }
}

function tick(label: string, file: string, status: number): void {
  const icon = status >= 200 && status < 300 ? '✓' : '✗'
  const pad  = label.padEnd(5)
  console.log(`    ${icon}  [${status}]  ${pad}  ${file}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n╔══ Pigi API recon ════════════════════════════════════════╗`)
  console.log(`  test domain : ${TEST_DOMAIN}`)
  console.log(`  output dir  : ${OUT_DIR}`)
  console.log(`╚══════════════════════════════════════════════════════════╝\n`)

  // ── A: Company by domain ─────────────────────────────────────────────────────
  console.log('A  Company by domain')

  const a = await call('POST', `/companies?website_domain=${encodeURIComponent(TEST_DOMAIN)}`, {})
  save('A-company-by-domain.json', a.json)
  tick('A', 'A-company-by-domain.json', a.status)

  const co = (a.ok && typeof a.json === 'object' && a.json !== null)
    ? (a.json as Record<string, unknown>)
    : {}

  const companyUrn: string = ((co.entity_urn ?? co.urn ?? '') as string).trim()
  console.log(`       urn: ${companyUrn || '(not found — check A-company-by-domain.json)'}`)

  // Person URN extraction: c.people[] items have shape { person: "urn:harmonic:...", is_current_position, ... }
  const peopleRels = (co.people ?? []) as Record<string, unknown>[]
  const personUrns: string[] = peopleRels
    .slice(0, 5)
    .map((p) => ((p.person ?? p.entity_urn ?? p.urn ?? '') as string).trim())
    .filter(Boolean)
  console.log(`       ${personUrns.length} person URNs extracted for section B`)

  // First investor name for section I (from funding.investors[] or top-level investors[])
  const funding     = ((co.funding    ?? {}) as Record<string, unknown>)
  const investorArr = (Array.isArray(co.investors)         ? co.investors         :
                       Array.isArray(funding.investors)    ? funding.investors    : []) as unknown[]
  const firstInvestorRaw = investorArr[0]
  const firstInvestor: string =
    typeof firstInvestorRaw === 'string'
      ? firstInvestorRaw
      : typeof firstInvestorRaw === 'object' && firstInvestorRaw !== null
        ? (((firstInvestorRaw as Record<string, unknown>).name ??
            (firstInvestorRaw as Record<string, unknown>).full_name ?? '') as string).trim() ||
          'Sequoia Capital'
        : 'Sequoia Capital'
  console.log(`       investor sample for I: ${firstInvestor}`)


  // ── B: Person batch ──────────────────────────────────────────────────────────
  console.log('\nB  Person batch')

  if (personUrns.length > 0) {
    const q = personUrns.map((u) => `urns=${encodeURIComponent(u)}`).join('&')
    const b = await call('GET', `/persons?${q}`)
    save('B-persons-batch.json', b.json)
    tick('B', 'B-persons-batch.json', b.status)
  } else {
    const stub = {
      _note: 'No person URNs found in section A response. ' +
             'Check A-company-by-domain.json → .people[].person for the right path.',
    }
    save('B-persons-batch.json', stub)
    console.log('    ⚠  No URNs from A — stub written to B-persons-batch.json')
  }


  // ── C: Similar companies (try 4 endpoint variants) ───────────────────────────
  console.log('\nC  Similar companies')

  if (!companyUrn) {
    save('C-similar-companies.json', { _note: 'Skipped — no company URN from section A' })
    console.log('    ⚠  Skipped (no URN)')
  } else {
    const cVariants = [
      `/companies/${companyUrn}/similar`,
      `/companies/${companyUrn}/similar_companies`,
      `/companies/${companyUrn}/recommendations`,
      `/companies/similar?urn=${encodeURIComponent(companyUrn)}`,
    ]
    let cDone = false
    for (const endpoint of cVariants) {
      const c = await call('GET', endpoint)
      if (c.ok) {
        save('C-similar-companies.json', c.json)
        tick('C', 'C-similar-companies.json', c.status)
        cDone = true
        break
      }
      // Write every error body — Harmonic sometimes puts useful info in 4xx
      const slug = endpoint.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').slice(-30)
      save(`C-err-${slug}.json`, { endpoint, status: c.status, body: c.json })
      console.log(`    ✗  [${c.status}]  ${endpoint}`)
    }
    if (!cDone) {
      console.log('    ⚠  All 4 similar-company variants 4xx\'d — error bodies saved as C-err-*.json')
    }
  }


  // ── D: Company signals (4 variants — run all, don't stop on first success) ───
  console.log('\nD  Company signals (4 variants)')

  const dVariants: [string, string][] = [
    [`/companies/${companyUrn}/signals`,    'D1-company-signals.json'],
    [`/companies/${companyUrn}/events`,     'D2-company-events.json'],
    [`/companies/${companyUrn}/timeline`,   'D3-company-timeline.json'],
    [`/companies/${companyUrn}/highlights`, 'D4-company-highlights.json'],
  ]

  for (const [endpoint, filename] of dVariants) {
    if (!companyUrn) {
      save(filename, { _note: 'Skipped — no company URN from section A' })
      continue
    }
    const d = await call('GET', endpoint)
    save(filename, d.json)
    tick('D', filename, d.status)
  }


  // ── E: Saved searches ────────────────────────────────────────────────────────
  console.log('\nE  Saved searches')

  const e1 = await call('GET', '/saved_searches')
  save('E1-saved-searches.json', e1.json)
  tick('E1', 'E1-saved-searches.json', e1.status)

  // Always try E2 regardless — endpoint name might differ per org
  const e2 = await call('GET', '/users/me/saved_searches')
  save('E2-my-saved-searches.json', e2.json)
  tick('E2', 'E2-my-saved-searches.json', e2.status)


  // ── F: Watchlists / lists ────────────────────────────────────────────────────
  console.log('\nF  Watchlists')

  const f1 = await call('GET', '/watchlists')
  save('F1-watchlists.json', f1.json)
  tick('F1', 'F1-watchlists.json', f1.status)

  const f2 = await call('GET', '/lists')
  save('F2-lists.json', f2.json)
  tick('F2', 'F2-lists.json', f2.status)

  const f3 = await call('GET', '/users/me/watchlists')
  save('F3-my-watchlists.json', f3.json)
  tick('F3', 'F3-my-watchlists.json', f3.status)


  // ── G: Web traffic ───────────────────────────────────────────────────────────
  console.log('\nG  Web traffic')

  // Check if traction_metrics from section A already contains web/traffic data.
  const traction = co.traction_metrics as Record<string, unknown> | null | undefined
  const webKeys  = traction
    ? Object.keys(traction).filter((k) => /web|traffic|visit/i.test(k))
    : []

  if (webKeys.length > 0) {
    const inline = Object.fromEntries(webKeys.map((k) => [k, traction![k]]))
    save('G2-web-traffic-inline.json', {
      _source: 'traction_metrics subtree from section A (no separate endpoint needed)',
      ...inline,
    })
    console.log(`    ✓  web traffic found inline in traction_metrics → G2-web-traffic-inline.json`)
    console.log(`       keys: ${webKeys.join(', ')}`)
  } else if (!companyUrn) {
    save('G1-web-traffic.json', { _note: 'Skipped — no company URN from section A' })
    console.log('    ⚠  Skipped (no URN)')
  } else {
    const g = await call('GET', `/companies/${companyUrn}/web_traffic`)
    save('G1-web-traffic.json', g.json)
    tick('G1', 'G1-web-traffic.json', g.status)
  }


  // ── H: People search ─────────────────────────────────────────────────────────
  console.log('\nH  People search (stealth + founder prediction)')

  const h1 = await call('POST', '/persons/search', {
    filters: { is_stealth_founder: true },
    size: 5,
  })
  save('H1-stealth-search.json', h1.json)
  tick('H1', 'H1-stealth-search.json', h1.status)

  const h2 = await call('POST', '/persons/search', {
    filters: { founder_prediction_score: { gte: 0.7 } },
    size: 5,
  })
  save('H2-soon-to-be-founder.json', h2.json)
  tick('H2', 'H2-soon-to-be-founder.json', h2.status)


  // ── I: Investor intelligence ─────────────────────────────────────────────────
  console.log('\nI  Investor intelligence')

  const i1 = await call('GET', `/investors?name=${encodeURIComponent(firstInvestor)}`)
  save('I1-investor-by-name.json', i1.json)
  tick('I1', 'I1-investor-by-name.json', i1.status)

  // Try URN-based portfolio only if I1 returned an investor with an URN.
  const i1Body = i1.json
  const investorUrn: string = (() => {
    if (!i1Body || typeof i1Body !== 'object') return ''
    const candidates = Array.isArray(i1Body) ? i1Body : [i1Body]
    const first = candidates[0] as Record<string, unknown> | undefined
    return ((first?.entity_urn ?? first?.urn ?? '') as string).trim()
  })()

  if (investorUrn) {
    const i2 = await call('GET', `/investors/${investorUrn}/portfolio`)
    save('I2-investor-portfolio.json', i2.json)
    tick('I2', 'I2-investor-portfolio.json', i2.status)
  } else {
    save('I2-investor-portfolio.json', {
      _note: 'Skipped — no investor URN returned by I1. Check I1-investor-by-name.json for the right URN path.',
    })
    console.log('    ⚠  I2 skipped (no investor URN in I1 response)')
  }


  // ── J: Scout / AI surface (manual step) ──────────────────────────────────────
  console.log('\nJ  Scout / AI surface  (manual capture)')

  save('J-scout-from-network-tab.json', {
    _section:      'J — Scout / AI surface',
    _status:       'AWAITING MANUAL CAPTURE',
    _instructions: [
      '1. Open Harmonic in Chrome (or Firefox).',
      '2. Open DevTools → Network tab. Check "Preserve log". Clear existing entries.',
      '3. Type any query into the Scout AI chat (the 4-dot icon in the left rail).',
      '4. In DevTools, find the request that carried your query. It will be a POST or WS frame.',
      '5. Right-click → Copy → Copy as cURL, then paste the curl command below.',
      '6. Also paste the full response JSON.',
      '7. Replace this entire file with the captured data.',
    ],
    _captured_curl:     null,
    _captured_response: null,
  })
  console.log('    ℹ  Placeholder written — fill in after manual devtools capture.')


  // ── K: Rate-limit headers ────────────────────────────────────────────────────
  console.log('\nK  Rate-limit headers')

  const rlLines = Object.entries(rateLimitHeaders)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${v}`)

  const kBody = [
    '# Rate-limit headers captured across all recon calls',
    `# Test domain : ${TEST_DOMAIN}`,
    `# Captured at : ${new Date().toISOString()}`,
    '#',
    '# Relevant headers to check:',
    '#   x-ratelimit-limit     — requests allowed per window',
    '#   x-ratelimit-remaining — requests left in current window',
    '#   x-ratelimit-reset     — UTC epoch when window resets',
    '#   retry-after           — seconds to wait after a 429',
    '#',
    '# Pigi concurrency guide:',
    '#   limit ≥ 1000/min → concurrency 16',
    '#   limit 300–999/min → concurrency 8',
    '#   limit < 300/min  → concurrency 4 (conservative default)',
    '',
    rlLines.length > 0
      ? rlLines.join('\n')
      : '(no rate-limit headers observed — Harmonic may not expose them on this tier)',
  ].join('\n')

  saveTxt('K-rate-limit-headers.txt', kBody)
  tick('K', 'K-rate-limit-headers.txt', 200)


  // ── Summary ───────────────────────────────────────────────────────────────────
  const files = fs.readdirSync(OUT_DIR).sort()
  console.log(`\n╔══ Done ══════════════════════════════════════════════════╗`)
  console.log(`  ${files.length} file(s) in ${OUT_DIR}:`)
  for (const f of files) console.log(`    ${f}`)
  console.log(`╚══════════════════════════════════════════════════════════╝`)
  console.log()
  console.log('Next steps:')
  console.log('  1. git add design-handoff/pigi-recon/ && git commit')
  console.log('  2. Fill in J-scout-from-network-tab.json manually')
  console.log('  3. Hand the folder back — parsers + pigi/run.ts get written from these shapes\n')
}

run().catch((err: unknown) => {
  console.error('\n❌  Recon crashed:', err)
  process.exit(1)
})
