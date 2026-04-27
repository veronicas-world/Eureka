'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { formatCurrency, formatFundingRound } from '@/lib/utils'

export interface HeadcountPoint {
  label: string     // "Jan '24" — kept for compatibility with CompanyTabs
  value: number     // headcount
  ts: string        // ISO date
}

export interface FundingEvent {
  date: string               // ISO date
  roundType: string | null   // raw Harmonic enum (e.g. "SERIES_A")
  amountUsd: number | null
  leadInvestor?: string | null
}

interface Props {
  series: HeadcountPoint[]
  events: FundingEvent[]
}

interface ChartPoint {
  tsMs: number
  value: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

function formatTick(tsMs: number): string {
  return new Date(tsMs).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function generateTicks(firstMs: number, lastMs: number, count = 6): number[] {
  if (lastMs <= firstMs || count < 2) return [firstMs, lastMs]
  const ticks: number[] = []
  const step = (lastMs - firstMs) / (count - 1)
  for (let i = 0; i < count; i++) {
    ticks.push(Math.round(firstMs + step * i))
  }
  return ticks
}

function abbrevRound(roundType: string | null): string {
  if (!roundType) return '?'
  const t = roundType.toUpperCase().replace(/\s+/g, '_')
  const seriesMatch = t.match(/SERIES_?([A-H])/)
  if (seriesMatch) return `S ${seriesMatch[1]}`
  if (t.includes('PRE_SEED') || t.includes('PRESEED')) return 'Pre'
  if (t === 'SEED') return 'Seed'
  if (t === 'GROWTH' || t.includes('LATE_STAGE')) return 'Grw'
  if (t.includes('PRIVATE_EQUITY')) return 'PE'
  if (t === 'ANGEL') return 'Ang'
  if (t.includes('CONVERTIBLE')) return 'Cvt'
  if (t.includes('STRATEGIC')) return 'Strat'
  if (t.includes('SECONDARY')) return 'Sec'
  if (t.includes('DEBT')) return 'Dbt'
  if (t === 'IPO' || t.includes('POST_IPO')) return 'IPO'
  return t.slice(0, 3)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const ts = payload[0].payload?.tsMs as number | undefined
  const labelText = ts != null
    ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-500 mb-0.5">{labelText}</p>
      <p className="font-semibold text-gray-900">
        {payload[0].value.toLocaleString()} employees
      </p>
    </div>
  )
}

type PlottableEvent = FundingEvent & { tsMs: number }

function FundingTimeline({
  plottable,
  firstMs,
  lastMs,
}: {
  plottable: PlottableEvent[]
  firstMs: number
  lastMs: number
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (plottable.length === 0) return null

  const isScrollable = plottable.length > 15
  const timeSpan = lastMs - firstMs

  return (
    // margin-left matches YAxis width (40px); margin-right matches chart right margin (20px)
    <div
      style={{
        marginLeft: 40,
        marginRight: 20,
        overflowX: isScrollable ? 'auto' : 'visible',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 48,
          minWidth: isScrollable ? `${plottable.length * 44}px` : undefined,
        }}
      >
        {plottable.map((ev, i) => {
          const pct = timeSpan > 0
            ? ((ev.tsMs - firstMs) / timeSpan) * 100
            : 0
          const isHovered = hoveredIdx === i

          return (
            <div
              key={`${ev.date}-${i}`}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                transform: 'translateX(-50%)',
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'default',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Dot */}
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              {/* Abbreviated label */}
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 600,
                  color: '#92400e',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                }}
              >
                {abbrevRound(ev.roundType)}
              </span>

              {/* Hover tooltip — floats above the dot */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    background: '#111827',
                    color: '#f9fafb',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 11.5,
                    whiteSpace: 'nowrap',
                    zIndex: 40,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{ fontWeight: 600, marginBottom: 2 }}>
                    {ev.roundType ? formatFundingRound(ev.roundType) : 'Funding'}
                  </p>
                  {ev.amountUsd != null && ev.amountUsd > 0 && (
                    <p style={{ color: '#d1d5db' }}>{formatCurrency(ev.amountUsd)}</p>
                  )}
                  <p style={{ color: '#9ca3af', fontSize: 10.5 }}>{ev.date}</p>
                  {ev.leadInvestor && (
                    <p style={{ color: '#d1d5db', marginTop: 3 }}>
                      Lead: {ev.leadInvestor}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OverviewChart({ series, events }: Props) {
  if (!series || series.length < 2) return null

  const chartData: ChartPoint[] = series
    .map((p) => ({ tsMs: new Date(p.ts).getTime(), value: p.value }))
    .filter((p) => !isNaN(p.tsMs))
    .sort((a, b) => a.tsMs - b.tsMs)

  if (chartData.length < 2) return null

  const minVal = Math.min(...chartData.map((d) => d.value))
  const maxVal = Math.max(...chartData.map((d) => d.value))
  const padding = Math.round((maxVal - minVal) * 0.2) || Math.round(minVal * 0.1) || 10

  const firstMs = chartData[0].tsMs
  const lastMs  = chartData[chartData.length - 1].tsMs

  const plottable: PlottableEvent[] = []
  for (const ev of events) {
    const ms = new Date(ev.date).getTime()
    if (isNaN(ms) || ms < firstMs || ms > lastMs) continue
    plottable.push({ ...ev, tsMs: ms })
  }
  plottable.sort((a, b) => a.tsMs - b.tsMs)

  const ticks = generateTicks(firstMs, lastMs, 6)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      {/* Header: title + legend */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Headcount &amp; Funding
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Team growth with funding rounds overlaid
          </p>
        </div>
        {plottable.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
              }}
            />
            <span>Funding round</span>
          </div>
        )}
      </div>

      {/* Line chart — reference lines are unlabeled, subtle markers only */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="tsMs"
            type="number"
            domain={[firstMs, lastMs]}
            ticks={ticks}
            tickFormatter={formatTick}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            allowDataOverflow={false}
          />
          <YAxis
            domain={[Math.max(0, minVal - padding), maxVal + padding]}
            tickFormatter={formatNumber}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />

          {plottable.map((ev, i) => (
            <ReferenceLine
              key={`${ev.date}-${i}`}
              x={ev.tsMs}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              ifOverflow="visible"
            />
          ))}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#111827"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: '#111827', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Timeline strip — round dots aligned with the chart x-axis */}
      {plottable.length > 0 && (
        <FundingTimeline
          plottable={plottable}
          firstMs={firstMs}
          lastMs={lastMs}
        />
      )}
    </div>
  )
}
