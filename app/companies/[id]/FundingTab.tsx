'use client'

import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CompanyWithRelations } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'

// ── Types for Harmonic funding_rounds_data shape ─────────────────────────────
// Harmonic returns a `funding_rounds` array. Field names vary across API
// versions / SDKs, so we accept several aliases.

interface RawInvestor {
  name?: string
  entity_urn?: string
  urn?: string
}

interface RawRound {
  // Round type / label
  funding_round_type?: string
  announced_round_type?: string
  round_type?: string
  type?: string

  // Date
  announced_date?: string
  funding_round_date?: string
  date?: string

  // Amount raised
  money_raised?: number | null
  funding_round_total_raised_usd?: number | null
  amount_raised?: number | null
  total_raised_usd?: number | null

  // Valuation
  post_money_valuation?: number | null
  post_money_valuation_usd?: number | null
  pre_money_valuation?: number | null
  pre_money_valuation_usd?: number | null

  // Investors
  investors?: Array<string | RawInvestor> | null
  lead_investors?: Array<string | RawInvestor> | null
  num_investors?: number | null

  // Source
  source_url?: string
  url?: string
}

interface ParsedRound {
  label: string
  date: string | null
  amount: number | null
  postMoneyValuation: number | null
  preMoneyValuation: number | null
  investors: string[]
  leadInvestors: string[]
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

function investorName(inv: unknown): string | null {
  if (typeof inv === 'string') return inv.trim() || null
  if (inv && typeof inv === 'object') {
    const o = inv as RawInvestor
    if (typeof o.name === 'string' && o.name.trim()) return o.name
  }
  return null
}

function parseInvestors(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const n = investorName(item)
    if (!n) continue
    if (seen.has(n.toLowerCase())) continue
    seen.add(n.toLowerCase())
    out.push(n)
  }
  return out
}

function parseRound(r: unknown): ParsedRound | null {
  if (!r || typeof r !== 'object') return null
  const raw = r as RawRound

  const label = firstString(
    raw.funding_round_type,
    raw.announced_round_type,
    raw.round_type,
    raw.type,
  ) ?? 'Funding Round'

  const date = firstString(
    raw.announced_date,
    raw.funding_round_date,
    raw.date,
  )
  // Normalize to YYYY-MM-DD if it's a full ISO timestamp
  const cleanDate = date ? date.split('T')[0] : null

  const amount = firstNumber(
    raw.money_raised,
    raw.funding_round_total_raised_usd,
    raw.amount_raised,
    raw.total_raised_usd,
  )

  const postMoneyValuation = firstNumber(
    raw.post_money_valuation,
    raw.post_money_valuation_usd,
  )

  const preMoneyValuation = firstNumber(
    raw.pre_money_valuation,
    raw.pre_money_valuation_usd,
  )

  const investors = parseInvestors(raw.investors)
  const leadInvestors = parseInvestors(raw.lead_investors)

  const sourceUrl = firstString(raw.source_url, raw.url)

  // Drop rows with nothing useful to show
  if (
    amount == null &&
    cleanDate == null &&
    investors.length === 0 &&
    leadInvestors.length === 0 &&
    label === 'Funding Round'
  ) {
    return null
  }

  return {
    label,
    date: cleanDate,
    amount,
    postMoneyValuation,
    preMoneyValuation,
    investors,
    leadInvestors,
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
                      {formatCurrency(r.amount)}
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

                {/* Valuation line */}
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

                {/* Investors */}
                {(r.leadInvestors.length > 0 || r.investors.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {r.leadInvestors.map((name) => (
                      <InvestorChip key={`lead-${name}`} name={name} lead />
                    ))}
                    {r.investors
                      .filter((n) => !r.leadInvestors.some((l) => l.toLowerCase() === n.toLowerCase()))
                      .map((name) => (
                        <InvestorChip key={`co-${name}`} name={name} />
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
