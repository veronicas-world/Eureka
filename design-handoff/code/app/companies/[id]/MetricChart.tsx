'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export interface MetricPoint {
  label: string
  value: number
  ts: string
}

interface Props {
  title: string
  unit?: string
  series: MetricPoint[]
  latest: number | null
  growth30d?: number | null
  growth90d?: number | null
  growth6m?: number | null
  stroke?: string
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900">
        {payload[0].value.toLocaleString()}{unit ? ` ${unit}` : ''}
      </p>
    </div>
  )
}

export default function MetricChart({
  title,
  unit,
  series,
  latest,
  growth30d,
  growth90d,
  growth6m,
  stroke = '#111827',
}: Props) {
  if (!series || series.length < 2) return null

  const minVal = Math.min(...series.map((d) => d.value))
  const maxVal = Math.max(...series.map((d) => d.value))
  const padding = Math.round((maxVal - minVal) * 0.15) || Math.round(minVal * 0.05) || 10

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">
            {latest != null ? latest.toLocaleString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          {growth30d != null && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">30d</p>
              <p className={`text-sm font-semibold ${growth30d > 0 ? 'text-emerald-600' : growth30d < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {growth30d > 0 ? '+' : ''}{(growth30d * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {growth90d != null && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">90d</p>
              <p className={`text-sm font-semibold ${growth90d > 0 ? 'text-emerald-600' : growth90d < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {growth90d > 0 ? '+' : ''}{(growth90d * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {growth6m != null && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">6mo</p>
              <p className={`text-sm font-semibold ${growth6m > 0 ? 'text-emerald-600' : growth6m < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {growth6m > 0 ? '+' : ''}{(growth6m * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tickFormatter={formatNumber}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: stroke, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
