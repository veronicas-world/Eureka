'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CompanyRow, SignalRow } from '@/lib/queries'
import CompanyLogo from '@/components/CompanyLogo'
import { formatCurrency } from '@/lib/utils'
import { STAGE_OPTIONS } from '@/lib/stages'

interface Props {
  companies: CompanyRow[]
  signals: SignalRow[]
}

// ── Glyph constants ───────────────────────────────────────────────────────────

const G = {
  star:  '⋆',
  cross: '₊',
  small: '˚',
  moon:  '☾',
  dot:   '·',
}

// ── Today's date string ───────────────────────────────────────────────────────

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).toLowerCase()
}

// ── Palette refs ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string }> = {
  tracking:        { label: 'tracking'       },
  outreached:      { label: 'outreached'     },
  'meeting booked':{ label: 'meeting booked' },
  passed:          { label: 'passed'         },
  portfolio:       { label: 'portfolio'      },
}

// ── Bar list row ──────────────────────────────────────────────────────────────

function BarRow({
  label,
  value,
  max,
  onClick,
}: {
  label: string
  value: number
  max: number
  onClick?: () => void
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0

  return (
    <div
      className="grid items-center gap-3 py-1.5 cursor-pointer group"
      style={{ gridTemplateColumns: '120px 1fr 28px' }}
      onClick={onClick}
    >
      <div
        className="text-right truncate"
        style={{
          fontSize: 12,
          color: 'var(--ink-soft)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div
        className="relative"
        style={{ height: 12, borderBottom: '1px dotted var(--hairline-2)' }}
      >
        {pct > 0 && (
          <div
            className="absolute left-0 rounded-[1px]"
            style={{
              top: 1, bottom: 1,
              width: `${pct}%`,
              background: 'var(--accent)',
              opacity: 0.85,
              minWidth: 2,
            }}
          />
        )}
      </div>
      <div
        className="text-right tabular-nums"
        style={{ fontSize: 11, color: value === 0 ? 'var(--ink-ghost)' : 'var(--ink-soft)' }}
      >
        {value}
      </div>
    </div>
  )
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function KPITile({
  label,
  value,
  sub,
  glyph,
}: {
  label: string
  value: string | number
  sub?: string
  glyph?: string
}) {
  return (
    <div
      className="relative rounded-md p-[18px]"
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
    >
      <div style={{ fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 600 }}>
        {label}
      </div>
      <div
        className="mt-2 tabular-nums leading-none"
        style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-2" style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.02em' }}>
          {sub}
        </div>
      )}
      {glyph && (
        <div className="absolute top-3 right-3.5" style={{ color: 'var(--ink-ghost)', fontSize: 12 }}>
          {glyph}
        </div>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({
  glyph,
  title,
  href,
}: {
  glyph?: string
  title: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div
        className="flex items-center gap-1.5"
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          fontWeight: 600,
        }}
      >
        {glyph && <span style={{ color: 'var(--ink-ghost)', fontWeight: 400, letterSpacing: 0 }}>{glyph}</span>}
        {title}
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1"
          style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}
        >
          view all
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  )
}

// ── Signal score chip ─────────────────────────────────────────────────────────

function SignalScore({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: 'var(--ink-ghost)', fontSize: 12 }}>—</span>
  const color = score >= 70 ? 'var(--accent-deep)' : score >= 40 ? 'var(--ink-soft)' : 'var(--ink-faint)'
  return (
    <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color }}>
      <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6 }}>{G.star}</span>{score}
    </span>
  )
}

// ── Stage badge ───────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  const label = STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '0.04em',
        padding: '2px 7px',
        borderRadius: 3,
        border: '1px solid var(--hairline-2)',
        background: 'rgba(91,115,184,0.05)',
        color: 'var(--ink-2)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const label = STATUS_CONFIG[status]?.label ?? status
  const styleMap: Record<string, React.CSSProperties> = {
    tracking:         { color: 'var(--accent-deep)',  background: 'var(--accent-bg)',              border: '1px solid rgba(91,115,184,0.20)' },
    outreached:       { color: '#6E5A9C',              background: 'rgba(156,144,191,0.10)',         border: '1px solid rgba(156,144,191,0.25)' },
    'meeting booked': { color: '#87674A',              background: 'rgba(184,155,110,0.10)',         border: '1px solid rgba(184,155,110,0.30)' },
    passed:           { color: 'var(--ink-faint)',     background: 'transparent',                   border: '1px solid var(--hairline-2)' },
    portfolio:        { color: '#4A6B61',              background: 'rgba(111,142,131,0.10)',         border: '1px solid rgba(111,142,131,0.30)' },
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '0.04em',
        padding: '2px 7px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        ...(styleMap[status] ?? { color: 'var(--ink-soft)', border: '1px solid var(--hairline-2)', background: 'transparent' }),
      }}
    >
      {label}
    </span>
  )
}

// ── Compact company row ───────────────────────────────────────────────────────

function CompactRow({ c, rank }: { c: CompanyRow; rank?: number }) {
  return (
    <Link
      href={`/companies/${c.id}`}
      className="grid items-center gap-2.5 py-2.5 px-1 -mx-1 rounded transition-colors"
      style={{
        gridTemplateColumns: rank != null ? '18px 28px 1fr auto' : '28px 1fr auto',
        fontSize: 12.5,
        borderBottom: '1px dotted var(--hairline)',
      }}
    >
      {rank != null && (
        <span className="tabular-nums text-right" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
          {rank}
        </span>
      )}
      <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.website} size={24} shape="square" />
      <div className="min-w-0">
        <div className="truncate" style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
        <div className="truncate" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
          {c.sector}
          {c.total_funding_usd ? ` ${G.dot} ${formatCurrency(c.total_funding_usd)}` : ''}
        </div>
      </div>
      <SignalScore score={c.signal_score} />
    </Link>
  )
}

// ── Mini company card ─────────────────────────────────────────────────────────

function MiniCard({ c }: { c: CompanyRow }) {
  return (
    <Link
      href={`/companies/${c.id}`}
      className="flex flex-col gap-2 rounded p-3 cursor-pointer"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 5,
      }}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.website} size={28} shape="square" />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {c.name}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
        <span>{c.sector ?? '—'}</span>
        {c.stage && <><span>{G.dot}</span><StageBadge stage={c.stage} /></>}
      </div>
      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
        {c.employee_count != null && <span>{c.employee_count.toLocaleString()} ppl</span>}
        {c.total_funding_usd != null && c.total_funding_usd > 0 && (
          <><span>{G.dot}</span><span>{formatCurrency(c.total_funding_usd)}</span></>
        )}
        {c.status && <span style={{ marginLeft: 'auto' }}><StatusBadge status={c.status} /></span>}
      </div>
    </Link>
  )
}

// ── Signal item ───────────────────────────────────────────────────────────────

function SignalItem({ s }: { s: SignalRow }) {
  const typeLabel: Record<string, string> = {
    funding: 'funding', hiring_spike: 'hiring', news: 'news',
    founder_move: 'founder move', product_launch: 'launch',
  }

  function relDate(iso: string | null | undefined) {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const days = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000))
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7)  return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Link
      href={`/companies/${s.company_id}`}
      className="grid gap-6 py-3 cursor-pointer"
      style={{
        gridTemplateColumns: '70px 1fr',
        borderBottom: '1px dotted var(--hairline)',
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.06em' }}>
          {relDate(s.signal_date)}
        </div>
        {s.signal_source && (
          <div style={{ display: 'block', color: 'var(--ink-ghost)', marginTop: 4, fontSize: 10.5, letterSpacing: '0.02em' }}>
            {s.signal_source}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {s.companies?.name}
          </span>
          {s.signal_type && (
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {typeLabel[s.signal_type] ?? s.signal_type}
            </span>
          )}
          {s.strength && (
            <span
              style={{
                fontSize: 10.5, fontWeight: 500, letterSpacing: '0.04em',
                padding: '1px 6px', borderRadius: 3,
                border: '1px solid var(--hairline-2)',
                color: s.strength === 'strong' ? 'var(--ink)' : s.strength === 'weak' ? 'var(--ink-faint)' : 'var(--ink-soft)',
                background: s.strength === 'strong' ? 'rgba(27,34,64,0.04)' : 'transparent',
              }}
            >
              {s.strength}
            </span>
          )}
        </div>
        {s.headline && (
          <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>{s.headline}</div>
        )}
      </div>
    </Link>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 6,
        padding: '18px 20px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardClient({ companies, signals }: Props) {
  const router = useRouter()

  const total = companies.length

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    const byStage:  Record<string, number> = {}
    for (const c of companies) {
      if (c.status) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
      if (c.stage)  byStage[c.stage]   = (byStage[c.stage]   ?? 0) + 1
    }
    return { byStatus, byStage }
  }, [companies])

  const trackingCount  = counts.byStatus['tracking']  ?? 0
  const portfolioCount = counts.byStatus['portfolio'] ?? 0

  const last7dCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return companies.filter((c) => !isNaN(new Date(c.created_at).getTime()) && new Date(c.created_at).getTime() >= cutoff).length
  }, [companies])

  const statusRows = Object.entries(STATUS_CONFIG).map(([id, { label }]) => ({
    id, label, value: counts.byStatus[id] ?? 0,
  }))
  const statusMax = Math.max(1, ...statusRows.map((r) => r.value))

  const stageRows = STAGE_OPTIONS.map((s) => ({
    id: s.value, label: s.label, value: counts.byStage[s.value] ?? 0,
  }))
  const stageMax = Math.max(1, ...stageRows.map((r) => r.value))

  const topBySignal = useMemo(() =>
    [...companies].filter((c) => c.signal_score != null)
      .sort((a, b) => (b.signal_score ?? 0) - (a.signal_score ?? 0))
      .slice(0, 5),
    [companies]
  )

  const recentlyAdded = useMemo(() =>
    [...companies].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [companies]
  )

  const recentSignals = signals.slice(0, 5)

  return (
    <div style={{ padding: '36px 44px 80px', maxWidth: 1180 }}>
      {/* Page header */}
      <header className="flex items-end justify-between gap-5 mb-7">
        <div>
          <h1 className="flex items-baseline gap-2.5 m-0" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
            <span>dashboard</span>
            <span style={{ color: 'var(--ink-faint)', fontSize: 14, fontWeight: 400 }}>⋆˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺</span>
          </h1>
          <p className="mt-1.5" style={{ fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.02em' }}>
            {todayLabel()}
          </p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        <KPITile label="total companies" value={total} sub="across all statuses" glyph={G.star} />
        <KPITile label="tracking"        value={trackingCount}  sub="in active watch" />
        <KPITile label="portfolio"       value={portfolioCount} sub="held positions" />
        <KPITile label="added (7d)"      value={last7dCount}
          sub={last7dCount === 1 ? 'one new entry' : `${last7dCount} new entries`}
          glyph={G.cross}
        />
      </div>

      {/* Bar panels */}
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <Card>
          <SectionHead glyph={G.star} title="pipeline by status" />
          {statusRows.map((r) => (
            <BarRow key={r.id} label={r.label} value={r.value} max={statusMax}
              onClick={() => router.push(`/database?status=${encodeURIComponent(r.id)}`)} />
          ))}
        </Card>
        <Card>
          <SectionHead glyph={G.star} title="companies by stage" />
          <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
            {stageRows.map((r) => (
              <BarRow key={r.id} label={r.label} value={r.value} max={stageMax}
                onClick={() => router.push(`/database?stage=${encodeURIComponent(r.id)}`)} />
            ))}
          </div>
        </Card>
      </div>

      {/* Top signal + Recent signals */}
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <Card>
          <SectionHead glyph="✦" title="top by signal score" />
          {topBySignal.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12.5 }}>
              <span className="twinkle">{G.star}</span> no signal scores yet
            </div>
          ) : (
            topBySignal.map((c, i) => <CompactRow key={c.id} c={c} rank={i + 1} />)
          )}
        </Card>
        <Card>
          <SectionHead glyph={G.cross} title="recent signals" href="/signals" />
          {recentSignals.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12.5 }}>
              <span className="twinkle">{G.star}</span> no signals yet
            </div>
          ) : (
            recentSignals.map((s) => <SignalItem key={s.id} s={s} />)
          )}
        </Card>
      </div>

      {/* Recently added */}
      <Card>
        <SectionHead glyph={G.star} title="recently added" href="/database" />
        {recentlyAdded.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12.5 }}>
            <span className="twinkle">{G.star}</span>{' '}
            <span className="twinkle twinkle-d2">{G.cross}</span>{' '}
            no companies yet
          </div>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
            {recentlyAdded.map((c) => <MiniCard key={c.id} c={c} />)}
          </div>
        )}
      </Card>
    </div>
  )
}
