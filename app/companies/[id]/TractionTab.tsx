'use client'

import { useMemo } from 'react'
import { Users, Globe, Building2, AtSign, type LucideIcon } from 'lucide-react'
import type { CompanyWithRelations } from '@/lib/queries'
import HeadcountChart from './HeadcountChart'
import MetricChart, { type MetricPoint } from './MetricChart'

// ── Types for Harmonic traction_metrics shape ────────────────────────────────

interface RawTimePoint {
  timestamp?: string
  metric_value?: number
  metricValue?: number // GraphQL camelCase, just in case
}

interface RawAgoStat {
  value?: number | null
  change?: number | null
  percent_change?: number | null
  percentChange?: number | null
}

interface RawMetric {
  metrics?: RawTimePoint[]
  latest_metric_value?: number | null
  latestMetricValue?: number | null
  '14d_ago'?: RawAgoStat
  '30d_ago'?: RawAgoStat
  '90d_ago'?: RawAgoStat
  '180d_ago'?: RawAgoStat
  '365d_ago'?: RawAgoStat
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up a metric by either snake_case or camelCase key on the raw
 * traction_metrics jsonb. Harmonic REST returns snake_case, but the same
 * object is sometimes received as GraphQL camelCase.
 */
function getMetric(tm: unknown, ...keys: string[]): RawMetric | null {
  if (!tm || typeof tm !== 'object') return null
  const obj = tm as Record<string, unknown>
  for (const k of keys) {
    const v = obj[k]
    if (v && typeof v === 'object') return v as RawMetric
  }
  return null
}

function extractLatest(m: RawMetric | null): number | null {
  if (!m) return null
  const v = m.latest_metric_value ?? m.latestMetricValue
  if (typeof v === 'number') return v
  // Fall back to last point in metrics array
  const series = m.metrics ?? []
  if (series.length === 0) return null
  const last = series[series.length - 1]
  const lv = last?.metric_value ?? last?.metricValue
  return typeof lv === 'number' ? lv : null
}

function extractGrowthPct(m: RawMetric | null, agoKey: '30d_ago' | '90d_ago' | '180d_ago'): number | null {
  if (!m) return null
  const entry = m[agoKey]
  if (!entry) return null
  const pct = entry.percent_change ?? entry.percentChange
  return typeof pct === 'number' ? pct : null
}

function extractSeries(m: RawMetric | null): MetricPoint[] {
  if (!m?.metrics || !Array.isArray(m.metrics)) return []
  const rows = m.metrics
    .map((p) => {
      const ts = typeof p?.timestamp === 'string' ? p.timestamp : null
      const val = typeof p?.metric_value === 'number'
        ? p.metric_value
        : typeof p?.metricValue === 'number'
          ? p.metricValue
          : null
      if (!ts || val == null) return null
      return { ts, value: val }
    })
    .filter((x): x is { ts: string; value: number } => x !== null)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  // Dedupe same-day timestamps (keep latest) to avoid overdrawn x-axis
  const byDay = new Map<string, { ts: string; value: number }>()
  for (const r of rows) {
    const day = r.ts.slice(0, 10)
    byDay.set(day, r)
  }
  const deduped = Array.from(byDay.values())

  return deduped.map((p) => ({
    label: new Date(p.ts).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    value: p.value,
    ts: p.ts,
  }))
}

/** Build series in the shape HeadcountChart expects ({label, headcount, ts}). */
function toHeadcountSeries(pts: MetricPoint[]): Array<{ label: string; headcount: number; ts: string }> {
  return pts.map((p) => ({ label: p.label, headcount: p.value, ts: p.ts }))
}

// ── Small cards ──────────────────────────────────────────────────────────────

function GrowthPill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-gray-400">—</span>
  const up = pct > 0
  const color = up ? 'text-emerald-600' : pct < 0 ? 'text-red-500' : 'text-gray-500'
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {up ? '+' : ''}{(pct * 100).toFixed(1)}%
    </span>
  )
}

function SocialStatCard({
  icon: Icon,
  label,
  value,
  growth30d,
  growth90d,
}: {
  icon: LucideIcon
  label: string
  value: number | null
  growth30d: number | null
  growth90d: number | null
}) {
  if (value == null && growth30d == null && growth90d == null) return null

  const display =
    value == null ? '—' :
    value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` :
    value >= 1_000 ? `${(value / 1_000).toFixed(1)}k` :
    value.toLocaleString()

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <Icon size={14} className="shrink-0" />
        <p className="text-[10px] font-semibold uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900 mb-1">{display}</p>
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">30d</p>
          <GrowthPill pct={growth30d} />
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">90d</p>
          <GrowthPill pct={growth90d} />
        </div>
      </div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TractionTab({ company }: { company: CompanyWithRelations }) {
  const tm = company.traction_metrics

  const { headcountMetric, webTrafficMetric, linkedinMetric, twitterMetric, facebookMetric, instagramMetric } = useMemo(() => ({
    headcountMetric: getMetric(tm, 'headcount'),
    webTrafficMetric: getMetric(tm, 'web_traffic', 'webTraffic'),
    linkedinMetric: getMetric(tm, 'linkedin_follower_count', 'linkedinFollowerCount'),
    twitterMetric: getMetric(tm, 'twitter_follower_count', 'twitterFollowerCount'),
    facebookMetric: getMetric(tm, 'facebook_follower_count', 'facebookFollowerCount'),
    instagramMetric: getMetric(tm, 'instagram_follower_count', 'instagramFollowerCount'),
  }), [tm])

  const headcountSeries = useMemo(() => extractSeries(headcountMetric), [headcountMetric])
  const webTrafficSeries = useMemo(() => extractSeries(webTrafficMetric), [webTrafficMetric])

  // Growth percentages fallback to flat column values from enrich route
  const hc30 = extractGrowthPct(headcountMetric, '30d_ago') ?? company.headcount_30d_growth ?? null
  const hc90 = extractGrowthPct(headcountMetric, '90d_ago') ?? company.headcount_90d_growth ?? null
  const hc6m = extractGrowthPct(headcountMetric, '180d_ago') ?? company.headcount_6m_growth ?? null

  const webLatest = extractLatest(webTrafficMetric)
  const web30 = extractGrowthPct(webTrafficMetric, '30d_ago')
  const web90 = extractGrowthPct(webTrafficMetric, '90d_ago')
  const web6m = extractGrowthPct(webTrafficMetric, '180d_ago')

  const liLatest = extractLatest(linkedinMetric)
  const li30 = extractGrowthPct(linkedinMetric, '30d_ago')
  const li90 = extractGrowthPct(linkedinMetric, '90d_ago')

  const twLatest = extractLatest(twitterMetric)
  const tw30 = extractGrowthPct(twitterMetric, '30d_ago')
  const tw90 = extractGrowthPct(twitterMetric, '90d_ago')

  const fbLatest = extractLatest(facebookMetric)
  const fb30 = extractGrowthPct(facebookMetric, '30d_ago')
  const fb90 = extractGrowthPct(facebookMetric, '90d_ago')

  const igLatest = extractLatest(instagramMetric)
  const ig30 = extractGrowthPct(instagramMetric, '30d_ago')
  const ig90 = extractGrowthPct(instagramMetric, '90d_ago')

  const hasAnyHeadcount = company.employee_count != null || headcountSeries.length >= 2
  const hasAnySocial = liLatest != null || twLatest != null || fbLatest != null || igLatest != null || webLatest != null
  const hasAnything = hasAnyHeadcount || hasAnySocial

  if (!hasAnything) {
    return <EmptyState message="Enrich this company to see traction metrics." />
  }

  // Build stat cells for the top summary strip.
  const summaryCells: Array<{ label: string; value: string; sub?: string; subColor?: 'green' | 'red' }> = []
  if (company.employee_count != null) {
    summaryCells.push({ label: 'Headcount', value: company.employee_count.toLocaleString() })
  }
  if (hc30 != null) {
    summaryCells.push({
      label: '30-Day Growth',
      value: (hc30 * 100).toFixed(1) + '%',
      sub: hc30 > 0 ? 'growing' : hc30 < 0 ? 'declining' : 'flat',
      subColor: hc30 > 0 ? 'green' : hc30 < 0 ? 'red' : undefined,
    })
  }
  if (hc90 != null) {
    summaryCells.push({
      label: '90-Day Growth',
      value: (hc90 * 100).toFixed(1) + '%',
      sub: hc90 > 0 ? 'growing' : hc90 < 0 ? 'declining' : 'flat',
      subColor: hc90 > 0 ? 'green' : hc90 < 0 ? 'red' : undefined,
    })
  }
  if (hc6m != null) {
    summaryCells.push({
      label: '6-Month Growth',
      value: (hc6m * 100).toFixed(1) + '%',
      sub: hc6m > 0 ? 'growing' : hc6m < 0 ? 'declining' : 'flat',
      subColor: hc6m > 0 ? 'green' : hc6m < 0 ? 'red' : undefined,
    })
  }

  return (
    <div className="divide-y divide-gray-100">
      {/* Growth stat cards ─────────────────────────────── */}
      {summaryCells.length > 0 && (
        <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
          {summaryCells.map((c) => (
            <div key={c.label} className="min-w-0">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">{c.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">{c.value}</p>
              {c.sub && (
                <p className={`text-xs font-medium mt-0.5 ${
                  c.subColor === 'green' ? 'text-emerald-600' : c.subColor === 'red' ? 'text-red-500' : 'text-gray-400'
                }`}>{c.sub}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Headcount chart ─────────────────────────────── */}
      {(headcountSeries.length >= 2 || company.employee_count != null) && (
        <div className="px-6 py-5">
          <HeadcountChart
            series={headcountSeries.length >= 2 ? toHeadcountSeries(headcountSeries) : undefined}
            currentHeadcount={company.employee_count ?? undefined}
            growth30d={hc30}
            growth90d={hc90}
            growth6m={hc6m}
            lastFundingDate={company.last_funding_date}
            lastFundingRound={company.last_funding_round}
            lastFundingAmount={company.last_funding_amount_usd}
          />
        </div>
      )}

      {/* Social metrics cards ─────────────────────────── */}
      {hasAnySocial && (
        <div className="px-6 py-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Social &amp; Web Metrics</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SocialStatCard
              icon={Globe}
              label="Web Traffic"
              value={webLatest}
              growth30d={web30}
              growth90d={web90}
            />
            <SocialStatCard
              icon={Building2}
              label="LinkedIn Followers"
              value={liLatest}
              growth30d={li30}
              growth90d={li90}
            />
            <SocialStatCard
              icon={AtSign}
              label="Twitter Followers"
              value={twLatest}
              growth30d={tw30}
              growth90d={tw90}
            />
            {fbLatest != null && (
              <SocialStatCard
                icon={Users}
                label="Facebook Followers"
                value={fbLatest}
                growth30d={fb30}
                growth90d={fb90}
              />
            )}
            {igLatest != null && (
              <SocialStatCard
                icon={Users}
                label="Instagram Followers"
                value={igLatest}
                growth30d={ig30}
                growth90d={ig90}
              />
            )}
          </div>
        </div>
      )}

      {/* Web traffic chart ───────────────────────────── */}
      {webTrafficSeries.length >= 2 && (
        <div className="px-6 py-5">
          <MetricChart
            title="Web Traffic"
            unit="visits"
            series={webTrafficSeries}
            latest={webLatest}
            growth30d={web30}
            growth90d={web90}
            growth6m={web6m}
            stroke="#2563eb"
          />
        </div>
      )}
    </div>
  )
}
