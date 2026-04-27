'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'

interface Props {
  // Real time-series data (preferred when available)
  series?: Array<{ label: string; headcount: number; ts: string }>
  // Back-calculated from growth percentages (fallback)
  currentHeadcount?: number
  growth30d?: number | null
  growth90d?: number | null
  growth6m?:  number | null
  lastFundingDate:   string | null
  lastFundingRound:  string | null
  lastFundingAmount: number | null
}

interface DataPoint {
  label: string
  headcount: number
}

function buildChartData(
  current: number,
  g30d: number | null,
  g90d: number | null,
  g6m:  number | null,
): DataPoint[] {
  const points: DataPoint[] = []

  if (g6m != null) {
    points.push({ label: '6mo ago', headcount: Math.round(current / (1 + g6m)) })
  }
  if (g90d != null) {
    points.push({ label: '3mo ago', headcount: Math.round(current / (1 + g90d)) })
  }
  if (g30d != null) {
    points.push({ label: '1mo ago', headcount: Math.round(current / (1 + g30d)) })
  }
  points.push({ label: 'Now', headcount: current })

  return points
}

function formatHeadcount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function fundingLabel(round: string | null, amount: number | null): string {
  const parts: string[] = []
  if (round) parts.push(round)
  if (amount) {
    if (amount >= 1_000_000_000) parts.push(`$${(amount / 1_000_000_000).toFixed(1)}B`)
    else if (amount >= 1_000_000) parts.push(`$${(amount / 1_000_000).toFixed(0)}M`)
    else if (amount >= 1_000) parts.push(`$${(amount / 1_000).toFixed(0)}K`)
  }
  return parts.join(' · ') || 'Funding'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900">{payload[0].value.toLocaleString()} employees</p>
    </div>
  )
}

export default function HeadcountChart({
  series,
  currentHeadcount,
  growth30d,
  growth90d,
  growth6m,
  lastFundingDate,
  lastFundingRound,
  lastFundingAmount,
}: Props) {
  const data: DataPoint[] = series && series.length >= 2
    ? series.map(({ label, headcount }) => ({ label, headcount }))
    : buildChartData(currentHeadcount ?? 0, growth30d ?? null, growth90d ?? null, growth6m ?? null)

  // Only render if we have at least 2 data points
  if (data.length < 2) return null

  const currentVal = series ? series[series.length - 1]?.headcount : currentHeadcount

  // Show funding marker if date is within our chart window
  const showFundingMarker = !!lastFundingDate && (growth30d != null || growth90d != null)
  // Map funding date to a label bucket (rough approximation)
  let fundingLabel30d = ''
  if (showFundingMarker) {
    const daysAgo = Math.round(
      (Date.now() - new Date(lastFundingDate!).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysAgo <= 45)       fundingLabel30d = '1mo ago'
    else if (daysAgo <= 120) fundingLabel30d = '3mo ago'
    else if (daysAgo <= 210) fundingLabel30d = '6mo ago'
  }

  const minVal = Math.min(...data.map((d) => d.headcount))
  const maxVal = Math.max(...data.map((d) => d.headcount))
  const padding = Math.round((maxVal - minVal) * 0.15) || Math.round(minVal * 0.05) || 10

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Headcount</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">
            {currentVal?.toLocaleString() ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          {growth30d != null && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">30d</p>
              <p className={`text-sm font-semibold ${growth30d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {growth30d > 0 ? '+' : ''}{(growth30d * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {growth90d != null && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">90d</p>
              <p className={`text-sm font-semibold ${growth90d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {growth90d > 0 ? '+' : ''}{(growth90d * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {growth6m != null && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">6mo</p>
              <p className={`text-sm font-semibold ${growth6m > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {growth6m > 0 ? '+' : ''}{(growth6m * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tickFormatter={formatHeadcount}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          {fundingLabel30d && (
            <ReferenceLine
              x={fundingLabel30d}
              stroke="#6366f1"
              strokeDasharray="4 3"
              label={{
                value: fundingLabel(lastFundingRound, lastFundingAmount),
                position: 'top',
                fontSize: 10,
                fill: '#6366f1',
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="headcount"
            stroke="#111827"
            strokeWidth={2}
            dot={{ r: 3, fill: '#111827', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#111827', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
