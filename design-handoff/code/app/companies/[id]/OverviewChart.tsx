'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Label as RLabel,
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

// Generate roughly-even tick positions (6 ticks) across the time domain.
function generateTicks(firstMs: number, lastMs: number, count = 6): number[] {
  if (lastMs <= firstMs || count < 2) return [firstMs, lastMs]
  const ticks: number[] = []
  const step = (lastMs - firstMs) / (count - 1)
  for (let i = 0; i < count; i++) {
    ticks.push(Math.round(firstMs + step * i))
  }
  return ticks
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

  // Only plot funding events whose date falls within the chart's time range.
  type PlottableEvent = FundingEvent & { tsMs: number }
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
            <span className="inline-block w-3 h-[2px] bg-amber-500" />
            <span>Funding round</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 28, right: 20, bottom: 4, left: 0 }}>
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

          {plottable.map((ev, i) => {
            const labelParts: string[] = []
            if (ev.roundType) labelParts.push(formatFundingRound(ev.roundType))
            if (ev.amountUsd && ev.amountUsd > 0) labelParts.push(formatCurrency(ev.amountUsd))
            const text = labelParts.join(' · ') || 'Funding'
            return (
              <ReferenceLine
                key={`${ev.date}-${i}`}
                x={ev.tsMs}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                ifOverflow="visible"
              >
                <RLabel
                  value={text}
                  position="top"
                  offset={8}
                  style={{
                    fontSize: 10,
                    fill: '#b45309',
                    fontWeight: 600,
                  }}
                />
              </ReferenceLine>
            )
          })}

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
    </div>
  )
}
