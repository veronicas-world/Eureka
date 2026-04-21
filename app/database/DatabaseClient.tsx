'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, ExternalLink, Pencil } from 'lucide-react'
import type { CompanyRow } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { SignalBadge, StatusBadge, StageBadge } from '@/components/ui/Badge'

const ALL = 'All'

const stageOptions = [ALL, 'pre-seed', 'seed', 'series-a', 'series-b', 'growth']
const statusOptions = [ALL, 'tracking', 'outreached', 'passed', 'portfolio']

const stageLabels: Record<string, string> = {
  'pre-seed': 'Pre-Seed',
  'seed':     'Seed',
  'series-a': 'Series A',
  'series-b': 'Series B',
  'growth':   'Growth',
}

interface Props {
  companies: CompanyRow[]
  sectors: string[]
}

export default function DatabaseClient({ companies, sectors }: Props) {
  const [query, setQuery]   = useState('')
  const [stage, setStage]   = useState(ALL)
  const [sector, setSector] = useState(ALL)
  const [status, setStatus] = useState(ALL)

  const sectorOptions = [ALL, ...sectors]

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const q = query.toLowerCase()
      if (q && !c.name.toLowerCase().includes(q) && !(c.sector ?? '').toLowerCase().includes(q)) return false
      if (stage  !== ALL && c.stage  !== stage)  return false
      if (sector !== ALL && c.sector !== sector) return false
      if (status !== ALL && c.status !== status) return false
      return true
    })
  }, [companies, query, stage, sector, status])

  return (
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} companies</p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 transition-colors shadow-sm"
        >
          <Plus size={14} />
          Add Company
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <FilterSelect
          value={stage}
          onChange={setStage}
          options={stageOptions}
          formatter={(v) => v === ALL ? 'All Stages' : stageLabels[v] ?? v}
        />
        <FilterSelect
          value={sector}
          onChange={setSector}
          options={sectorOptions}
          formatter={(v) => v === ALL ? 'All Sectors' : v}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={statusOptions}
          formatter={(v) => v === ALL ? 'All Statuses' : capitalize(v)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              <Th>Company</Th>
              <Th>Sector</Th>
              <Th>Stage</Th>
              <Th>Country</Th>
              <Th>Signal</Th>
              <Th>Status</Th>
              <Th>Total Funding</Th>
              <Th>Last Round</Th>
              <Th>Founded</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-sm text-gray-400">
                  {companies.length === 0
                    ? 'No companies in your database yet.'
                    : 'No companies match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((company) => (
                <tr
                  key={company.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-semibold text-gray-600">
                          {company.name[0]}
                        </span>
                      </div>
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-medium text-gray-900 hover:text-gray-600 transition-colors"
                      >
                        {company.name}
                      </Link>
                      {company.website && (
                        <a
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{company.sector ?? '—'}</td>
                  <td className="px-4 py-3">
                    {company.stage ? <StageBadge stage={company.stage} /> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{company.country ?? '—'}</td>
                  <td className="px-4 py-3">
                    {company.signal_score != null
                      ? <SignalBadge score={company.signal_score} />
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {company.status ? <StatusBadge status={company.status} /> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    {formatCurrency(company.total_funding_usd ?? undefined)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{company.last_funding_round ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{company.founded_year ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/companies/${company.id}/edit`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 inline-flex"
                    >
                      <Pencil size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${className}`}>
      {children}
    </th>
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
