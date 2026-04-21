'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { SignalBadge, StatusBadge, StageBadge } from '@/components/ui/Badge'

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

type CompanyResult = { id: string; name: string; sector: string | null; stage: string | null; status: string | null; signal_score: number | null }
type PersonResult  = { id: string; company_id: string; name: string; title: string | null; companies: { name: string } | null }
type SignalResult  = { id: string; company_id: string; signal_type: string | null; headline: string | null; strength: string | null; signal_source: string | null; companies: { name: string } | null }
type SearchResults = { companies: CompanyResult[]; people: PersonResult[]; signals: SignalResult[] }

type Status = 'idle' | 'loading' | 'done'

async function searchAll(query: string): Promise<SearchResults> {
  const supabase = createClient()
  const q = `%${query}%`

  const [companiesRes, peopleRes, signalsRes] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, sector, stage, status, signal_score')
      .or(`name.ilike.${q},description.ilike.${q},sector.ilike.${q}`)
      .limit(20),
    supabase
      .from('people')
      .select('id, company_id, name, title, companies(name)')
      .or(`name.ilike.${q},title.ilike.${q},email.ilike.${q}`)
      .limit(20),
    supabase
      .from('signals')
      .select('id, company_id, signal_type, headline, strength, signal_source, companies(name)')
      .or(`headline.ilike.${q},detail.ilike.${q},signal_source.ilike.${q}`)
      .limit(20),
  ])

  return {
    companies: (companiesRes.data ?? []) as CompanyResult[],
    people:    (peopleRes.data    ?? []) as unknown as PersonResult[],
    signals:   (signalsRes.data   ?? []) as unknown as SignalResult[],
  }
}

export default function SearchPage() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [status, setStatus]   = useState<Status>('idle')
  const inputRef              = useRef<HTMLInputElement>(null)
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults(null)
      setStatus('idle')
      return
    }
    setStatus('loading')
    const data = await searchAll(q)
    setResults(data)
    setStatus('done')
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runSearch(val), 300)
  }

  const totalResults = results
    ? results.companies.length + results.people.length + results.signals.length
    : 0

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Search input */}
      <div className="relative mb-8">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search companies, people, and signals..."
          className="w-full h-12 pl-11 pr-4 text-base bg-white border border-gray-200 rounded-xl shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
        />
        {status === 'loading' && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* States */}
      {status === 'idle' && query.length < 3 && (
        <p className="text-sm text-center text-gray-400 mt-16">
          {query.length === 0
            ? 'Search companies, people, and signals...'
            : 'Keep typing — search starts at 3 characters'}
        </p>
      )}

      {status === 'done' && totalResults === 0 && (
        <p className="text-sm text-center text-gray-400 mt-16">
          No results for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Results */}
      {results && totalResults > 0 && (
        <div className="space-y-8">
          {/* Companies */}
          {results.companies.length > 0 && (
            <section>
              <SectionHeader label="Companies" count={results.companies.length} />
              <div className="space-y-2">
                {results.companies.map((c) => (
                  <Link
                    key={c.id}
                    href={`/companies/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors truncate">
                        {c.name}
                      </p>
                      {c.sector && (
                        <p className="text-xs text-gray-500 mt-0.5">{c.sector}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      {c.stage  && <StageBadge  stage={c.stage}   />}
                      {c.status && <StatusBadge status={c.status} />}
                      {c.signal_score != null && <SignalBadge score={c.signal_score} />}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* People */}
          {results.people.length > 0 && (
            <section>
              <SectionHeader label="People" count={results.people.length} />
              <div className="space-y-2">
                {results.people.map((p) => (
                  <Link
                    key={p.id}
                    href={`/companies/${p.company_id}`}
                    className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-gray-600">{p.name[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {[p.title, p.companies?.name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Signals */}
          {results.signals.length > 0 && (
            <section>
              <SectionHeader label="Signals" count={results.signals.length} />
              <div className="space-y-2">
                {results.signals.map((s) => (
                  <Link
                    key={s.id}
                    href={`/companies/${s.company_id}`}
                    className="block px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors leading-snug">
                        {s.headline ?? '(No headline)'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.signal_type && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${signalTypeColor[s.signal_type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {signalTypeLabel[s.signal_type] ?? s.signal_type}
                          </span>
                        )}
                        {s.strength && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${strengthColor[s.strength] ?? 'bg-gray-100 text-gray-500'}`}>
                            {s.strength.charAt(0).toUpperCase() + s.strength.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.companies?.name && (
                      <p className="text-xs text-gray-500 mt-1">{s.companies.name}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h2>
      <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 leading-none">
        {count}
      </span>
    </div>
  )
}
