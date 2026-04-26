'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import { ArrowRight, TrendingUp, Flame, Building2, type LucideIcon } from 'lucide-react'
import type { CompanyRow, SignalRow } from '@/lib/queries'
import { Badge, SignalBadge, StageBadge, StatusBadge } from '@/components/ui/Badge'
import CompanyLogo from '@/components/CompanyLogo'
import { formatCurrency } from '@/lib/utils'
import { STAGE_OPTIONS } from '@/lib/stages'

interface Props {
  companies: CompanyRow[]
  signals: SignalRow[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUSES: { id: string; label: string; color: string }[] = [
  { id: 'tracking',       label: 'Tracking',       color: '#60a5fa' }, // blue-400
  { id: 'outreached',     label: 'Outreached',     color: '#a78bfa' }, // violet-400
  { id: 'meeting booked', label: 'Meeting Booked', color: '#fbbf24' }, // amber-400
  { id: 'passed',         label: 'Passed',         color: '#d1d5db' }, // gray-300
  { id: 'portfolio',      label: 'Portfolio',      color: '#34d399' }, // emerald-400
]

const STAGES: { id: string; label: string; color: string }[] =
  STAGE_OPTIONS.map((s) => ({ id: s.value, label: s.label, color: s.color }))

// ── Small building blocks ────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'emerald' | 'blue' | 'amber' | 'gray'
}) {
  const accentColor = {
    emerald: 'text-emerald-600',
    blue:    'text-blue-600',
    amber:   'text-amber-600',
    gray:    'text-gray-900',
  }[accent ?? 'gray']

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-2 tabular-nums ${accentColor}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({
  title,
  href,
  icon: Icon,
}: {
  title: string
  href?: string
  icon?: LucideIcon
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={14} className="text-gray-400" />}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          View all <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-1.5 text-xs">
      <p className="font-semibold text-gray-900">{p.payload.label}</p>
      <p className="text-gray-500">{p.value} {p.value === 1 ? 'company' : 'companies'}</p>
    </div>
  )
}

type BarDatum = { id: string; label: string; value: number; color: string }

function BarPanel({
  title,
  data,
  href,
  filterKey,
  height,
}: {
  title: string
  data: BarDatum[]
  href?: string
  filterKey?: 'stage' | 'status'
  height?: number
}) {
  const router = useRouter()
  const hasData = data.some((d) => d.value > 0)

  const handleBarClick = filterKey
    ? (entry: BarDatum) => {
        if (entry.value === 0) return
        router.push(`/database?${filterKey}=${encodeURIComponent(entry.id)}`)
      }
    : undefined

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <SectionHeader title={title} href={href} />
      {hasData ? (
        <ResponsiveContainer width="100%" height={height ?? 180}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
            barCategoryGap="25%"
          >
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={130}
              interval={0}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              onClick={handleBarClick as ((data: unknown) => void) | undefined}
              style={handleBarClick ? { cursor: 'pointer' } : undefined}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-400 py-6 text-center">No data yet.</p>
      )}
    </div>
  )
}

function CompactCompanyRow({ c, rank }: { c: CompanyRow; rank?: number }) {
  return (
    <Link
      href={`/companies/${c.id}`}
      className="flex items-center gap-3 py-2.5 hover:bg-gray-50 rounded-md px-2 -mx-2 transition-colors"
    >
      {rank != null && (
        <span className="text-xs font-semibold text-gray-400 tabular-nums w-5 text-right shrink-0">
          {rank}
        </span>
      )}
      <CompanyLogo
        name={c.name}
        logoUrl={c.logo_url}
        domain={c.website}
        size={28}
        shape="square"
        className="border border-gray-100 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {c.sector ?? '—'}
          {c.total_funding_usd && c.total_funding_usd > 0 && (
            <> · {formatCurrency(c.total_funding_usd)}</>
          )}
        </p>
      </div>
      {c.signal_score != null && <SignalBadge score={c.signal_score} />}
    </Link>
  )
}

function RecentCompanyCard({ c }: { c: CompanyRow }) {
  return (
    <Link
      href={`/companies/${c.id}`}
      className="group block rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all p-3"
    >
      <div className="flex items-start gap-3">
        <CompanyLogo
          name={c.name}
          logoUrl={c.logo_url}
          domain={c.website}
          size={36}
          shape="square"
          className="border border-gray-100 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700">
              {c.name}
            </p>
            {c.stage && <StageBadge stage={c.stage} />}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {c.sector ?? '—'}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
            {c.employee_count != null && (
              <span>{c.employee_count.toLocaleString()} ppl</span>
            )}
            {c.total_funding_usd != null && c.total_funding_usd > 0 && (
              <span>{formatCurrency(c.total_funding_usd)}</span>
            )}
            {c.status && <StatusBadge status={c.status} />}
          </div>
        </div>
      </div>
    </Link>
  )
}

function SignalItem({ s }: { s: SignalRow }) {
  const companyName = s.companies?.name ?? null
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {s.signal_type && <Badge variant="gray">{s.signal_type}</Badge>}
        {s.strength && (
          <Badge
            variant={s.strength === 'strong' ? 'green' : s.strength === 'weak' ? 'gray' : 'amber'}
          >
            {s.strength}
          </Badge>
        )}
        {companyName && (
          <Link
            href={`/companies/${s.company_id}`}
            className="text-xs font-medium text-gray-900 hover:text-gray-700 truncate"
          >
            {companyName}
          </Link>
        )}
        <span className="text-[11px] text-gray-400 ml-auto">
          {s.signal_date
            ? new Date(s.signal_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : ''}
        </span>
      </div>
      {s.headline && (
        <p className="text-sm text-gray-700 leading-snug line-clamp-2">{s.headline}</p>
      )}
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardClient({ companies, signals }: Props) {
  const total = companies.length

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    const byStage: Record<string, number> = {}
    for (const c of companies) {
      if (c.status) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
      if (c.stage)  byStage[c.stage]   = (byStage[c.stage]   ?? 0) + 1
    }
    return { byStatus, byStage }
  }, [companies])

  const portfolioCount = counts.byStatus['portfolio'] ?? 0
  const trackingCount  = counts.byStatus['tracking']  ?? 0

  const last7dCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return companies.filter((c) => {
      const t = new Date(c.created_at).getTime()
      return !isNaN(t) && t >= cutoff
    }).length
  }, [companies])

  // Statuses are a small fixed set, show them all so empty buckets are visible.
  const statusData: BarDatum[] = STATUSES.map((s) => ({
    id:    s.id,
    label: s.label,
    value: counts.byStatus[s.id] ?? 0,
    color: s.color,
  }))

  // Stages: only show stages that have at least one company so the chart
  // doesn't look sparse with 15 mostly-empty rows. Companies whose stage isn't
  // in the canonical STAGES list (e.g. legacy/null) are silently ignored.
  const stageData: BarDatum[] = STAGES.map((s) => ({
    id:    s.id,
    label: s.label,
    value: counts.byStage[s.id] ?? 0,
    color: s.color,
  })).filter((d) => d.value > 0)

  const topBySignal = useMemo(() => {
    return [...companies]
      .filter((c) => c.signal_score != null)
      .sort((a, b) => (b.signal_score ?? 0) - (a.signal_score ?? 0))
      .slice(0, 5)
  }, [companies])

  const recentlyAdded = useMemo(() => {
    return [...companies]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
  }, [companies])

  const recentSignals = signals.slice(0, 5)

  return (
    <div className="px-8 py-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your pipeline and activity.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Companies" value={total} />
        <KPICard label="Tracking" value={trackingCount} accent="blue" />
        <KPICard label="Portfolio" value={portfolioCount} accent="emerald" />
        <KPICard
          label="Added (7d)"
          value={last7dCount}
          sub={last7dCount > 0 ? `out of ${total} total` : undefined}
          accent="amber"
        />
      </div>

      {/* Pipeline + Stage. items-start so each panel sizes to its own content
          (otherwise grid stretches the shorter card to match the taller one,
          which leaves the Stage panel with empty space when only 1-2 stages
          have data). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-start">
        <BarPanel
          title="Pipeline by Status"
          data={statusData}
          filterKey="status"
        />
        <BarPanel
          title="Companies by Stage"
          data={stageData}
          filterKey="stage"
          // Stage list is dynamic (only non-empty stages render). Height
          // should scale with row count, not be locked to 180px — otherwise a
          // single stage produces a tall box with one tiny floating bar.
          height={Math.max(stageData.length * 44, 64)}
        />
      </div>

      {/* Signal leaderboard + Recent signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <SectionHeader title="Top by Signal Score" icon={Flame} />
          {topBySignal.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No signal scores yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {topBySignal.map((c, i) => (
                <CompactCompanyRow key={c.id} c={c} rank={i + 1} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <SectionHeader title="Recent Signals" href="/signals" icon={TrendingUp} />
          {recentSignals.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No signals yet.</p>
          ) : (
            recentSignals.map((s) => <SignalItem key={s.id} s={s} />)
          )}
        </div>
      </div>

      {/* Recently added */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <SectionHeader title="Recently Added" href="/database" icon={Building2} />
        {recentlyAdded.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No companies yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recentlyAdded.map((c) => (
              <RecentCompanyCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
