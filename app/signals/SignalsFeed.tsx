'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink, Search } from 'lucide-react'
import type { SignalRow } from '@/lib/queries'

const ALL = 'All'

const SIGNAL_TYPES = [ALL, 'funding', 'hiring_spike', 'news', 'founder_move', 'product_launch']
const STRENGTHS = [ALL, 'strong', 'moderate', 'weak']

const signalTypeLabel: Record<string, string> = {
  funding:        'Funding',
  hiring_spike:   'Hiring Spike',
  news:           'News',
  founder_move:   'Founder Move',
  product_launch: 'Product Launch',
}

const signalTypeColor: Record<string, string> = {
  funding:        'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  hiring_spike:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  news:           'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  founder_move:   'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  product_launch: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
}

const strengthColor: Record<string, string> = {
  strong:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  moderate: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  weak:     'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
}

function formatDate(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  signals: SignalRow[]
}

export default function SignalsFeed({ signals }: Props) {
  const [query, setQuery]           = useState('')
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [strength, setStrength]     = useState(ALL)

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (typeFilter !== ALL && s.signal_type !== typeFilter) return false
      if (strength !== ALL && s.strength !== strength) return false
      if (query) {
        const q = query.toLowerCase()
        const companyName = s.companies?.name?.toLowerCase() ?? ''
        if (!companyName.includes(q)) return false
      }
      return true
    })
  }, [signals, query, typeFilter, strength])

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Signal Feed</h1>
        <p className="text-sm text-gray-500 mt-0.5">Latest signals across all tracked companies</p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={SIGNAL_TYPES}
          formatter={(v) => v === ALL ? 'All Types' : (signalTypeLabel[v] ?? v)}
        />
        <FilterSelect
          value={strength}
          onChange={setStrength}
          options={STRENGTHS}
          formatter={(v) => v === ALL ? 'All Strengths' : capitalize(v)}
        />
      </div>

      {/* Feed */}
      {signals.length === 0 ? (
        <EmptyState message="No signals yet — add signals from individual company pages" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No signals match your filters" />
      ) : (
        <div className="space-y-3">
          {filtered.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  )
}

function SignalCard({ signal }: { signal: SignalRow }) {
  const companyName = signal.companies?.name
  const typeKey = signal.signal_type ?? ''
  const strengthKey = signal.strength ?? ''

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      {/* Top row: company + badges */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {companyName ? (
            <Link
              href={`/companies/${signal.company_id}`}
              className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors shrink-0"
            >
              {companyName}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-gray-400">Unknown company</span>
          )}
          {typeKey && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${signalTypeColor[typeKey] ?? 'bg-gray-100 text-gray-600'}`}>
              {signalTypeLabel[typeKey] ?? typeKey}
            </span>
          )}
          {strengthKey && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${strengthColor[strengthKey] ?? 'bg-gray-100 text-gray-500'}`}>
              {capitalize(strengthKey)}
            </span>
          )}
        </div>

        {/* Source + date */}
        <div className="text-xs text-gray-400 shrink-0 text-right space-y-0.5">
          {signal.signal_source && (
            <p>{signal.signal_source}</p>
          )}
          {signal.signal_date && (
            <p>{formatDate(signal.signal_date)}</p>
          )}
        </div>
      </div>

      {/* Headline */}
      {signal.headline && (
        <p className="text-sm font-medium text-gray-900 mb-1">{signal.headline}</p>
      )}

      {/* Detail */}
      {signal.detail && (
        <p className="text-sm text-gray-500 leading-relaxed">{signal.detail}</p>
      )}

      {/* View source link */}
      {signal.url && (
        <div className="mt-3">
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            View Source
            <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-24 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
  formatter,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  formatter: (v: string) => string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 pl-3 pr-7 text-sm bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent appearance-none cursor-pointer"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{formatter(opt)}</option>
      ))}
    </select>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
