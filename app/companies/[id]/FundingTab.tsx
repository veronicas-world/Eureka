'use client'

import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CompanyWithRelations } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'

// ── Types for Harmonic funding_rounds_data shape ─────────────────────────────
// Harmonic returns a `funding_rounds` array. Field names vary across API
// versions / SDKs, so we accept several aliases.

interface RawInvestor {
  // Harmonic shape
  is_lead?: boolean
  investor_name?: string
  investor_urn?: string
  // Legacy / alternate shapes
  name?: string
  entity_urn?: string
  urn?: string
}

interface RawValuationInfo {
  post_money_valuation?: number | null
  post_money_valuation_usd?: number | null
  pre_money_valuation?: number | null
  pre_money_valuation_usd?: number | null
  valuation?: number | null
}

interface RawRound {
  // Round type / label
  funding_round_type?: string
  announced_round_type?: string
  round_type?: string
  type?: string
  investment_type?: string

  // Date
  announcement_date?: string
  announced_date?: string
  funding_round_date?: string
  date?: string

  // Amount raised (Harmonic uses funding_amount + funding_currency)
  funding_amount?: number | null
  funding_currency?: string
  money_raised?: number | null
  funding_round_total_raised_usd?: number | null
  amount?: number | null
  amount_usd?: number | null
  total_raised?: number | null
  total_raised_usd?: number | null

  // Valuation
  post_money_valuation?: number | null
  post_money_valuation_usd?: number | null
  pre_money_valuation?: number | null
  pre_money_valuation_usd?: number | null
  valuation_info?: RawValuationInfo | null

  // Investors — Harmonic returns objects with {is_lead, investor_name, investor_urn}
  investors?: Array<string | RawInvestor> | null

  // Source
  source_url?: string
  url?: string
  announcement_url?: string
  additional_sources?: string[]
}

interface ParsedInvestor {
  name: string
  isLead: boolean
}

interface ParsedRound {
  label: string
  date: string | null
  amount: number | null
  currency: string | null
  postMoneyValuation: number | null
  preMoneyValuation: number | null
  investors: ParsedInvestor[]
  sourceUrl: string | null
}

// ── Parse helpers ────────────────────────────────────────────────────────────

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

function parseInvestor(inv: unknown): ParsedInvestor | null {
  if (typeof inv === 'string') {
    const n = inv.trim()
    return n ? { name: n, isLead: false } : null
  }
  if (inv && typeof inv === 'object') {
    const o = inv as RawInvestor
    const name = (typeof o.investor_name === 'string' && o.investor_name.trim())
      ? o.investor_name.trim()
      : (typeof o.name === 'string' && o.name.trim())
        ? o.name.trim()
        : null
    if (!name) return null
    return { name, isLead: o.is_lead === true }
  }
  return null
}

function parseInvestors(list: unknown): ParsedInvestor[] {
  if (!Array.isArray(list)) return []
  const out: ParsedInvestor[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const parsed = parseInvestor(item)
    if (!parsed) continue
    const key = parsed.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
  }
  // Lead investors first
  out.sort((a, b) => Number(b.isLead) - Number(a.isLead))
  return out
}

/** Prettify Harmonic's funding_round_type enum into a human label. */
function prettifyRoundLabel(raw: string): string {
  const map: Record<string, string> = {
    PRE_SEED: 'Pre-Seed',
    SEED: 'Seed',
    SERIES_A: 'Series A',
    SERIES_A_EXTENSION: 'Series A Extension',
    SERIES_B: 'Series B',
    SERIES_B_EXTENSION: 'Series B Extension',
    SERIES_C: 'Series C',
    SERIES_C_EXTENSION: 'Series C Extension',
    SERIES_D: 'Series D',
    SERIES_E: 'Series E',
    SERIES_F: 'Series F',
    SERIES_G: 'Series G',
    SERIES_H: 'Series H',
    SERIES_I: 'Series I',
    SERIES_J: 'Series J',
    GROWTH: 'Growth',
    STRATEGIC: 'Strategic',
    DEBT: 'Debt',
    CONVERTIBLE_NOTE: 'Convertible Note',
    POST_IPO_EQUITY: 'Post-IPO Equity',
    POST_IPO_DEBT: 'Post-IPO Debt',
    POST_IPO_SECONDARY: 'Post-IPO Secondary',
    SECONDARY: 'Secondary',
    PRIVATE_EQUITY: 'Private Equity',
    CROWDFUNDING: 'Crowdfunding',
    GRANT: 'Grant',
    ACCELERATOR_INCUBATOR: 'Accelerator / Incubator',
    ANGEL: 'Angel',
    CORPORATE: 'Corporate',
    EQUITY_CROWDFUNDING: 'Equity Crowdfunding',
    PRODUCT_CROWDFUNDING: 'Product Crowdfunding',
    UNDISCLOSED: 'Undisclosed',
    OTHER: 'Other',
  }
  if (map[raw]) return map[raw]
  // Generic fallback: SERIES_X_Y → Series X Y
  return raw
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Treat zero as "unknown" for valuation / amount fields (Harmonic uses 0 as a sentinel). */
function positiveOrNull(n: number | null): number | null {
  return n != null && n > 0 ? n : null
}

function parseRound(r: unknown): ParsedRound | null {
  if (!r || typeof r !== 'object') return null
  const raw = r as RawRound

  const rawLabel = firstString(
    raw.funding_round_type,
    raw.announced_round_type,
    raw.round_type,
    raw.type,
    raw.investment_type,
  )
  const label = rawLabel ? prettifyRoundLabel(rawLabel) : 'Funding Round'

  const date = firstString(
    raw.announcement_date,
    raw.announced_date,
    raw.funding_round_date,
    raw.date,
  )
  // Normalize to YYYY-MM-DD if it's a full ISO timestamp
  const cleanDate = date ? date.split('T')[0] : null

  const amount = positiveOrNull(firstNumber(
    raw.funding_amount,
    raw.money_raised,
    raw.funding_round_total_raised_usd,
    raw.amount,
    raw.amount_usd,
    raw.total_raised,
    raw.total_raised_usd,
  ))

  const currency = firstString(raw.funding_currency)

  // Valuation may live directly on the round or inside valuation_info
  const vi = (raw.valuation_info && typeof raw.valuation_info === 'object')
    ? raw.valuation_info
    : null

  const postMoneyValuation = positiveOrNull(firstNumber(
    raw.post_money_valuation,
    raw.post_money_valuation_usd,
    vi?.post_money_valuation,
    vi?.post_money_valuation_usd,
    vi?.valuation,
  ))

  const preMoneyValuation = positiveOrNull(firstNumber(
    raw.pre_money_valuation,
    raw.pre_money_valuation_usd,
    vi?.pre_money_valuation,
    vi?.pre_money_valuation_usd,
  ))

  const investors = parseInvestors(raw.investors)

  const sourceUrl = firstString(raw.source_url, raw.url, raw.announcement_url)

  // Drop rows with nothing useful to show
  if (
    amount == null &&
    cleanDate == null &&
    investors.length === 0 &&
    rawLabel == null
  ) {
    return null
  }

  return {
    label,
    date: cleanDate,
    amount,
    currency,
    postMoneyValuation,
    preMoneyValuation,
    investors,
    sourceUrl,
  }
}

function parseRounds(data: unknown): ParsedRound[] {
  if (!Array.isArray(data)) return []
  const rows = data
    .map(parseRound)
    .filter((x): x is ParsedRound => x !== null)

  // Sort by date desc (newest first); rounds without a date go to the bottom.
  rows.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
  return rows
}

function formatFullDate(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return d
  }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

// ── Small cells ──────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function RoundBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center h-5 px-2 text-[11px] font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full">
      {label}
    </span>
  )
}

function InvestorChip({ name, lead }: { name: string; lead?: boolean }) {
  return (
    <span
      className={
        'inline-flex items-center h-7 px-3 text-sm border rounded-full ' +
        (lead
          ? 'text-gray-900 bg-amber-50 border-amber-200 font-medium'
          : 'text-gray-700 bg-gray-50 border-gray-200')
      }
      title={lead ? `${name} (lead)` : name}
    >
      {lead && <span className="text-[9px] mr-1 font-bold uppercase tracking-wider text-amber-700">Lead</span>}
      {name}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function FundingTab({ company }: { company: CompanyWithRelations }) {
  const rounds = useMemo(() => parseRounds(company.funding_rounds_data), [company.funding_rounds_data])

  const hasSummary =
    company.total_funding_usd != null ||
    company.last_funding_round != null ||
    company.last_funding_amount_usd != null ||
    company.latest_valuation_usd != null ||
    company.funding_rounds_count != null

  const hasRounds = rounds.length > 0
  const fundingSignals = (company.signals ?? []).filter((s) => s.signal_type === 'funding')

  if (!hasSummary && !hasRounds && fundingSignals.length === 0) {
    return <EmptyState message="No funding data yet. Enrich this company to pull in funding details." />
  }

  // Latest round for "headline" summary (most recent by date)
  const latestRound = rounds[0] ?? null

  return (
    <div className="divide-y divide-gray-100">
      {/* ── Summary grid ──────────────────────────────────── */}
      <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
        <StatCell
          label="Total Raised"
          value={formatCurrency(company.total_funding_usd ?? undefined)}
        />
        <StatCell
          label="Latest Valuation"
          value={formatCurrency(company.latest_valuation_usd ?? undefined)}
          sub={
            latestRound?.preMoneyValuation != null
              ? `Pre-money: ${formatCurrency(latestRound.preMoneyValuation)}`
              : undefined
          }
        />
        <StatCell
          label="Rounds"
          value={company.funding_rounds_count != null ? company.funding_rounds_count.toString() : '—'}
        />
        <StatCell
          label="Last Round"
          value={company.last_funding_round ?? latestRound?.label ?? '—'}
        />
        <StatCell
          label="Round Amount"
          value={formatCurrency(
            company.last_funding_amount_usd ?? latestRound?.amount ?? undefined,
          )}
        />
        <StatCell
          label="Round Date"
          value={formatDate(company.last_funding_date ?? latestRound?.date ?? null)}
        />
      </div>

      {/* ── Investors (aggregate) ─────────────────────────── */}
      {company.investors && company.investors.length > 0 && (
        <div className="px-6 py-5">
          <SectionLabel>All Investors</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {company.investors.map((inv) => (
              <InvestorChip key={inv} name={inv} />
            ))}
          </div>
        </div>
      )}

      {/* ── Funding events timeline (rich) ────────────────── */}
      {hasRounds && (
        <div className="px-6 py-5">
          <SectionLabel>Funding Events</SectionLabel>
          <div className="relative pl-4">
            <div className="absolute left-0 top-2 bottom-2 w-px bg-gray-200" />
            {rounds.map((r, idx) => (
              <div key={`${r.date ?? 'no-date'}-${r.label}-${idx}`} className="relative mb-6 last:mb-0 pl-5">
                <div className="absolute -left-[5px] top-2 w-[9px] h-[9px] rounded-full bg-gray-900 border-2 border-white shadow" />

                {/* Header row: date + round type + amount */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <p className="text-xs font-medium text-gray-500">{formatFullDate(r.date)}</p>
                  <RoundBadge label={r.label} />
                  {r.amount != null && (
                    <p className="text-sm font-bold text-gray-900">
                      {r.currency && r.currency !== 'USD'
                        ? `${r.currency} ${r.amount.toLocaleString()}`
                        : formatCurrency(r.amount)}
                    </p>
                  )}
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-gray-400 hover:text-gray-700 transition-colors"
                      title="Source"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Valuation line — only render when at least one positive value */}
                {(r.postMoneyValuation != null || r.preMoneyValuation != null) && (
                  <p className="text-xs text-gray-500 mb-2">
                    {r.postMoneyValuation != null && (
                      <>Post-money: <span className="text-gray-700 font-medium">{formatCurrency(r.postMoneyValuation)}</span></>
                    )}
                    {r.postMoneyValuation != null && r.preMoneyValuation != null && <span className="mx-2 text-gray-300">·</span>}
                    {r.preMoneyValuation != null && (
                      <>Pre-money: <span className="text-gray-700 font-medium">{formatCurrency(r.preMoneyValuation)}</span></>
                    )}
                  </p>
                )}

                {/* Investors (leads first, de-duped) */}
                {r.investors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {r.investors.map((inv) => (
                      <InvestorChip key={inv.name} name={inv.name} lead={inv.isLead} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fallback: signals-based timeline if we have no funding_rounds_data ── */}
      {!hasRounds && fundingSignals.length > 0 && (
        <div className="px-6 py-5">
          <SectionLabel>Funding Events</SectionLabel>
          <div className="relative pl-4">
            <div className="absolute left-0 top-1.5 bottom-1.5 w-px bg-gray-200" />
            {fundingSignals.map((s) => (
              <div key={s.id} className="relative mb-4 last:mb-0 pl-4">
                <div className="absolute -left-[9px] top-1.5 w-[7px] h-[7px] rounded-full bg-gray-300 border-2 border-white" />
                <p className="text-xs text-gray-400 mb-0.5">{s.signal_date ?? '—'}</p>
                <p className="text-sm font-medium text-gray-900">{s.headline}</p>
                {s.detail && <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
