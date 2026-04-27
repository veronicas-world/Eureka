'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { SignalBadge, StatusBadge, StageBadge } from '@/components/ui/Badge'
import { STAGE_OPTIONS } from '@/lib/stages'
import { mergeCountries } from '@/lib/countries'
import { mergeSectors } from '@/lib/sectors'

// --------------------------------------------------------------
// Constants
// --------------------------------------------------------------

const STAGES = STAGE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))

const STATUSES = [
  { value: 'tracking',       label: 'Tracking' },
  { value: 'outreached',     label: 'Outreached' },
  { value: 'meeting booked', label: 'Meeting Booked' },
  { value: 'passed',         label: 'Passed' },
  { value: 'portfolio',      label: 'Portfolio' },
] as const

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

// --------------------------------------------------------------
// Types
// --------------------------------------------------------------

type CompanyResult = {
  id: string
  name: string
  sector: string | null
  stage: string | null
  status: string | null
  country: string | null
  employee_count: number | null
  total_funding_usd: number | null
  founded_year: number | null
  signal_score: number | null
}
type PersonResult = {
  id: string
  company_id: string
  name: string
  title: string | null
  companies: { name: string } | null
}
type SignalResult = {
  id: string
  company_id: string
  signal_type: string | null
  headline: string | null
  strength: string | null
  signal_source: string | null
  companies: { name: string } | null
}
type SearchResults = {
  companies: CompanyResult[]
  people: PersonResult[]
  signals: SignalResult[]
}

type Status = 'idle' | 'loading' | 'done'

type Filters = {
  sectors: string[]
  stages: string[]
  statuses: string[]
  countries: string[]
  investors: string[]
  minHeadcount: string
  maxHeadcount: string
  minFunding: string
  maxFunding: string
  minFoundedYear: string
  maxFoundedYear: string
}

const EMPTY_FILTERS: Filters = {
  sectors: [],
  stages: [],
  statuses: [],
  countries: [],
  investors: [],
  minHeadcount: '',
  maxHeadcount: '',
  minFunding: '',
  maxFunding: '',
  minFoundedYear: '',
  maxFoundedYear: '',
}

// --------------------------------------------------------------
// URL helpers
// --------------------------------------------------------------

function filtersFromParams(params: URLSearchParams): { query: string; filters: Filters } {
  const getList = (key: string): string[] => {
    const v = params.get(key)
    return v ? v.split(',').filter(Boolean) : []
  }
  return {
    query: params.get('q') ?? '',
    filters: {
      sectors:        getList('sectors'),
      stages:         getList('stages'),
      statuses:       getList('statuses'),
      countries:      getList('countries'),
      investors:      getList('investors'),
      minHeadcount:   params.get('minHc')   ?? '',
      maxHeadcount:   params.get('maxHc')   ?? '',
      minFunding:     params.get('minFund') ?? '',
      maxFunding:     params.get('maxFund') ?? '',
      minFoundedYear: params.get('minYr')   ?? '',
      maxFoundedYear: params.get('maxYr')   ?? '',
    },
  }
}

function paramsFromState(query: string, filters: Filters): string {
  const sp = new URLSearchParams()
  if (query) sp.set('q', query)
  if (filters.sectors.length)   sp.set('sectors',   filters.sectors.join(','))
  if (filters.stages.length)    sp.set('stages',    filters.stages.join(','))
  if (filters.statuses.length)  sp.set('statuses',  filters.statuses.join(','))
  if (filters.countries.length) sp.set('countries', filters.countries.join(','))
  if (filters.investors.length) sp.set('investors', filters.investors.join(','))
  if (filters.minHeadcount)     sp.set('minHc',   filters.minHeadcount)
  if (filters.maxHeadcount)     sp.set('maxHc',   filters.maxHeadcount)
  if (filters.minFunding)       sp.set('minFund', filters.minFunding)
  if (filters.maxFunding)       sp.set('maxFund', filters.maxFunding)
  if (filters.minFoundedYear)   sp.set('minYr',   filters.minFoundedYear)
  if (filters.maxFoundedYear)   sp.set('maxYr',   filters.maxFoundedYear)
  return sp.toString()
}

function hasActiveFilters(f: Filters): boolean {
  return (
    f.sectors.length > 0 ||
    f.stages.length > 0 ||
    f.statuses.length > 0 ||
    f.countries.length > 0 ||
    f.investors.length > 0 ||
    f.minHeadcount !== '' ||
    f.maxHeadcount !== '' ||
    f.minFunding !== '' ||
    f.maxFunding !== '' ||
    f.minFoundedYear !== '' ||
    f.maxFoundedYear !== ''
  )
}

// --------------------------------------------------------------
// Search query
// --------------------------------------------------------------

async function runQuery(
  query: string,
  filters: Filters
): Promise<SearchResults> {
  const supabase = createClient()
  const hasText = query.length >= 3
  const hasFilters = hasActiveFilters(filters)

  // Companies: supports filter-only searches
  let companiesQ = supabase
    .from('companies')
    .select('id, name, sector, stage, status, country, employee_count, total_funding_usd, founded_year, signal_score')
    .order('signal_score', { ascending: false, nullsFirst: false })
    .limit(50)

  if (hasText) {
    const q = `%${query}%`
    companiesQ = companiesQ.or(`name.ilike.${q},description.ilike.${q},sector.ilike.${q}`)
  }
  if (filters.sectors.length)   companiesQ = companiesQ.in('sector', filters.sectors)
  if (filters.stages.length)    companiesQ = companiesQ.in('stage', filters.stages)
  if (filters.statuses.length)  companiesQ = companiesQ.in('status', filters.statuses)
  if (filters.countries.length) companiesQ = companiesQ.in('country', filters.countries)
  if (filters.minHeadcount)     companiesQ = companiesQ.gte('employee_count', Number(filters.minHeadcount))
  if (filters.maxHeadcount)     companiesQ = companiesQ.lte('employee_count', Number(filters.maxHeadcount))
  if (filters.minFunding)       companiesQ = companiesQ.gte('total_funding_usd', Number(filters.minFunding))
  if (filters.maxFunding)       companiesQ = companiesQ.lte('total_funding_usd', Number(filters.maxFunding))
  if (filters.minFoundedYear)   companiesQ = companiesQ.gte('founded_year', Number(filters.minFoundedYear))
  if (filters.maxFoundedYear)   companiesQ = companiesQ.lte('founded_year', Number(filters.maxFoundedYear))
  // .overlaps means "share any element" — finds companies whose investors array
  // contains AT LEAST ONE of the selected investors (OR, not AND)
  if (filters.investors.length) companiesQ = companiesQ.overlaps('investors', filters.investors)

  // People and signals only run on text queries (filters here are company-specific)
  const peoplePromise = hasText
    ? supabase
        .from('people')
        .select('id, company_id, name, title, companies(name)')
        .or(`name.ilike.%${query}%,title.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20)
    : Promise.resolve({ data: [] as unknown })

  const signalsPromise = hasText
    ? supabase
        .from('signals')
        .select('id, company_id, signal_type, headline, strength, signal_source, companies(name)')
        .or(`headline.ilike.%${query}%,detail.ilike.%${query}%,signal_source.ilike.%${query}%`)
        .limit(20)
    : Promise.resolve({ data: [] as unknown })

  // Don't fire companies query if nothing selected at all
  const companiesPromise = hasText || hasFilters
    ? companiesQ
    : Promise.resolve({ data: [] as unknown })

  const [companiesRes, peopleRes, signalsRes] = await Promise.all([
    companiesPromise,
    peoplePromise,
    signalsPromise,
  ])

  return {
    companies: ((companiesRes as { data: unknown }).data ?? []) as CompanyResult[],
    people:    ((peopleRes    as { data: unknown }).data ?? []) as PersonResult[],
    signals:   ((signalsRes   as { data: unknown }).data ?? []) as SignalResult[],
  }
}

// --------------------------------------------------------------
// Main component
// --------------------------------------------------------------

export default function SearchClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Hydrate initial state from URL
  const initial = useMemo(
    () => filtersFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const [query, setQuery]       = useState(initial.query)
  const [filters, setFilters]   = useState<Filters>(initial.filters)
  const [results, setResults]   = useState<SearchResults | null>(null)
  const [status, setStatus]     = useState<Status>('idle')
  const [showFilters, setShowFilters] = useState(hasActiveFilters(initial.filters))

  // Filter options pulled from DB
  const [sectorOptions, setSectorOptions]     = useState<string[]>([])
  const [countryOptions, setCountryOptions]   = useState<string[]>([])
  const [investorOptions, setInvestorOptions] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Fetch distinct sectors + countries + investors once
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from('companies')
        .select('sector, country, investors')
        .limit(1000)

      if (cancelled || !data) return
      const rows = data as {
        sector: string | null
        country: string | null
        investors: string[] | null
      }[]

      const dbSectors = Array.from(new Set(
        rows.map((r) => r.sector).filter((v): v is string => !!v)
      ))

      const dbCountries = Array.from(new Set(
        rows.map((r) => r.country).filter((v): v is string => !!v)
      ))

      const investors = Array.from(new Set(
        rows.flatMap((r) => r.investors ?? []).filter((v): v is string => !!v)
      )).sort()

      // Merge DB values with curated baseline lists so the dropdown is useful
      // even when the DB has very few rows.
      setSectorOptions(mergeSectors(dbSectors))
      setCountryOptions(mergeCountries(dbCountries))
      setInvestorOptions(investors)
    })()
    return () => { cancelled = true }
  }, [])

  // Runs a search and syncs URL
  const doSearch = useCallback(async (q: string, f: Filters) => {
    const qs = paramsFromState(q, f)
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })

    const canSearch = q.length >= 3 || hasActiveFilters(f)
    if (!canSearch) {
      setResults(null)
      setStatus('idle')
      return
    }
    setStatus('loading')
    const data = await runQuery(q, f)
    setResults(data)
    setStatus('done')
  }, [router, pathname])

  // Debounce text changes
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val, filters), 300)
  }

  // Filters change: run immediately
  const updateFilters = useCallback((next: Filters) => {
    setFilters(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    doSearch(query, next)
  }, [query, doSearch])

  // Run initial search if URL had params
  useEffect(() => {
    if (initial.query || hasActiveFilters(initial.filters)) {
      doSearch(initial.query, initial.filters)
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalResults = results
    ? results.companies.length + results.people.length + results.signals.length
    : 0

  const activeFilterCount =
    filters.sectors.length +
    filters.stages.length +
    filters.statuses.length +
    filters.countries.length +
    filters.investors.length +
    (filters.minHeadcount ? 1 : 0) +
    (filters.maxHeadcount ? 1 : 0) +
    (filters.minFunding   ? 1 : 0) +
    (filters.maxFunding   ? 1 : 0) +
    (filters.minFoundedYear ? 1 : 0) +
    (filters.maxFoundedYear ? 1 : 0)

  return (
    <div style={{ padding: '36px 44px 80px', maxWidth: 1100 }}>
      {/* Page header */}
      <header className="mb-7">
        <h1 className="flex items-baseline gap-2.5 m-0" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
          <span>search</span>
          <span style={{ color: 'var(--ink-faint)', fontSize: 14, fontWeight: 400 }}>⋆˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺</span>
        </h1>
      </header>

      {/* Search input */}
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ink-faint)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="search companies, people, signals…"
          className="w-full h-12 pl-11 pr-12 rounded-md outline-none transition-shadow"
          style={{
            fontSize: 14,
            background: 'var(--surface)',
            border: '1px solid var(--hairline-2)',
            color: 'var(--ink)',
          }}
        />
        {status === 'loading' && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Filter toggle + active filter count */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-semibold text-white bg-gray-900 rounded-full">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => updateFilters(EMPTY_FILTERS)}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          sectorOptions={sectorOptions}
          countryOptions={countryOptions}
          investorOptions={investorOptions}
          onChange={updateFilters}
          onClearAll={() => updateFilters(EMPTY_FILTERS)}
          activeFilterCount={activeFilterCount}
        />
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <ActiveFilterChips filters={filters} onChange={updateFilters} />
      )}

      {/* States */}
      {status === 'idle' && query.length < 3 && !hasActiveFilters(filters) && (
        <p className="text-sm text-center text-gray-400 mt-16">
          {query.length === 0
            ? 'Search companies, people, and signals — or apply filters to browse'
            : 'Keep typing — search starts at 3 characters'}
        </p>
      )}

      {status === 'done' && totalResults === 0 && (
        <p className="text-sm text-center text-gray-400 mt-16">
          No results{query ? ` for "${query}"` : ''}{activeFilterCount > 0 ? ' with these filters' : ''}
        </p>
      )}

      {/* Results */}
      {results && totalResults > 0 && (
        <div className="space-y-8 mt-6">
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
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {[c.sector, c.country].filter(Boolean).join(' · ') || '—'}
                      </p>
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

// --------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------

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

function FilterPanel({
  filters,
  sectorOptions,
  countryOptions,
  investorOptions,
  onChange,
  onClearAll,
  activeFilterCount,
}: {
  filters: Filters
  sectorOptions: string[]
  countryOptions: string[]
  investorOptions: string[]
  onChange: (next: Filters) => void
  onClearAll: () => void
  activeFilterCount: number
}) {
  const toggleList = (
    key: 'sectors' | 'stages' | 'statuses' | 'countries' | 'investors',
    value: string,
  ) => {
    const current = filters[key]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const setField = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="mb-4 p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-5">
      {/* Header with Clear all */}
      <div className="flex items-center justify-between -mb-1">
        <h3 className="text-sm font-semibold text-gray-900">Filter results</h3>
        <button
          type="button"
          onClick={onClearAll}
          disabled={activeFilterCount === 0}
          className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear all filters
        </button>
      </div>

      {/* Stage + Status (enum multi-select) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FilterGroup label="Stage">
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <Chip
                key={s.value}
                active={filters.stages.includes(s.value)}
                onClick={() => toggleList('stages', s.value)}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup label="Status">
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Chip
                key={s.value}
                active={filters.statuses.includes(s.value)}
                onClick={() => toggleList('statuses', s.value)}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      </div>

      {/* Sector + Country (searchable dropdowns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FilterGroup label={`Sector${sectorOptions.length ? '' : ' (no data yet)'}`}>
          <SearchablePicker
            options={sectorOptions}
            selected={filters.sectors}
            onToggle={(v) => toggleList('sectors', v)}
            placeholder="Search sectors…"
            emptyHint="Sectors will populate once companies have data."
          />
        </FilterGroup>
        <FilterGroup label={`Country${countryOptions.length ? '' : ' (no data yet)'}`}>
          <SearchablePicker
            options={countryOptions}
            selected={filters.countries}
            onToggle={(v) => toggleList('countries', v)}
            placeholder="Search countries…"
            emptyHint="Countries will populate once companies have data."
          />
        </FilterGroup>
      </div>

      {/* Range filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <FilterGroup label="Headcount">
          <RangeInputs
            minValue={filters.minHeadcount}
            maxValue={filters.maxHeadcount}
            onMinChange={(v) => setField('minHeadcount', v)}
            onMaxChange={(v) => setField('maxHeadcount', v)}
            placeholder="10"
          />
        </FilterGroup>
        <FilterGroup label="Total funding (USD)">
          <RangeInputs
            minValue={filters.minFunding}
            maxValue={filters.maxFunding}
            onMinChange={(v) => setField('minFunding', v)}
            onMaxChange={(v) => setField('maxFunding', v)}
            placeholder="1000000"
          />
        </FilterGroup>
        <FilterGroup label="Founded year">
          <RangeInputs
            minValue={filters.minFoundedYear}
            maxValue={filters.maxFoundedYear}
            onMinChange={(v) => setField('minFoundedYear', v)}
            onMaxChange={(v) => setField('maxFoundedYear', v)}
            placeholder="2020"
          />
        </FilterGroup>
      </div>

      {/* Investor */}
      <FilterGroup label={`Investors${investorOptions.length ? '' : ' (none in DB yet)'}`}>
        <InvestorPicker
          options={investorOptions}
          selected={filters.investors}
          onToggle={(v) => toggleList('investors', v)}
        />
      </FilterGroup>
    </div>
  )
}

/**
 * Heuristic classification of investor names into "fund" vs "angel".
 *
 * We don't have explicit type metadata on the investors array (it's just a
 * list of strings from Harmonic), so this uses a name-pattern heuristic:
 *   - If the name contains common fund/firm keywords → fund
 *   - Otherwise (typically a person's name, 2 words, no firm suffix) → angel
 *
 * This will misclassify edge cases (e.g. "Naval Ravikant" → angel ✓, but
 * "Sequoia Heritage" → fund ✓, "First Round" → fund ✓ via "round" keyword).
 * It's intentionally over-inclusive on the fund side since most institutional
 * investors have a recognizable suffix.
 */
const FUND_KEYWORDS = [
  'capital', 'ventures', 'venture', 'partners', 'partner',
  'fund', 'funds', 'vc', 'investments', 'investment',
  'holdings', 'equity', 'group', 'corp', 'inc', 'llc',
  'lp', 'limited', 'asset', 'management', 'family office',
  'accelerator', 'incubator', 'labs', 'lab', 'studio',
  'collective', 'network', 'syndicate', 'round',
]

function classifyInvestor(name: string): 'fund' | 'angel' {
  const lower = name.toLowerCase()
  for (const kw of FUND_KEYWORDS) {
    // Use word-boundary check so "lab" doesn't match "Slab".
    const re = new RegExp(`\\b${kw}\\b`, 'i')
    if (re.test(lower)) return 'fund'
  }
  return 'angel'
}

/**
 * Investor multi-select with All / Funds / Angels tabs.
 *
 * Built on top of SearchablePicker semantics but with an extra category tab
 * row. Selected investors always remain selected even when switching tabs.
 */
function InvestorPicker({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'fund' | 'angel'>('all')

  // Pre-classify all options once per option list change.
  const classified = useMemo(() => {
    const map = new Map<string, 'fund' | 'angel'>()
    for (const o of options) map.set(o, classifyInvestor(o))
    return map
  }, [options])

  const tabCounts = useMemo(() => {
    let funds = 0
    let angels = 0
    for (const o of options) {
      if (classified.get(o) === 'fund') funds++
      else angels++
    }
    return { all: options.length, fund: funds, angel: angels }
  }, [options, classified])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return options.filter((o) => {
      if (tab !== 'all' && classified.get(o) !== tab) return false
      if (q && !o.toLowerCase().includes(q)) return false
      return true
    })
  }, [options, classified, tab, search])

  // Keep selected items pinned to top, regardless of which tab they belong to.
  const ordered = useMemo(() => {
    const selectedSet = new Set(selected)
    const selectedInOptions = options.filter((o) => selectedSet.has(o))
    const unselected = filtered.filter((o) => !selectedSet.has(o))
    return [...selectedInOptions, ...unselected]
  }, [filtered, options, selected])

  if (options.length === 0) {
    return <p className="text-xs text-gray-400">Will populate once enriched companies have investors.</p>
  }

  return (
    <div>
      {/* Tabs */}
      <div className="inline-flex items-center gap-1 mb-2 bg-gray-100 rounded-lg p-0.5">
        {(['all', 'fund', 'angel'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              tab === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'all' ? 'All' : t === 'fund' ? 'Funds' : 'Angels'}{' '}
            <span className="text-gray-400 tabular-nums">({tabCounts[t]})</span>
          </button>
        ))}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${options.length} investor${options.length === 1 ? '' : 's'}…`}
        className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition mb-2"
      />
      <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1 -m-1 border border-gray-100 rounded-lg bg-gray-50/50">
        {ordered.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-2">
            No {tab === 'fund' ? 'funds' : tab === 'angel' ? 'angels' : 'investors'} match{search ? ` "${search}"` : ''}
          </p>
        ) : (
          ordered.map((inv) => (
            <Chip
              key={inv}
              active={selected.includes(inv)}
              onClick={() => onToggle(inv)}
            >
              {inv}
            </Chip>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          {selected.length} selected
        </p>
      )}
    </div>
  )
}

/**
 * Reusable searchable multi-select used by Sector, Country, and Investor filters.
 *
 * Behaviour:
 *   - Search input filters the option list (case-insensitive substring).
 *   - Selected items always render at the top, even when not matching the search,
 *     so the user can see what's active.
 *   - Scrollable area is capped at max-h-56 so a 200+ option list (countries,
 *     sectors) doesn't overwhelm the form.
 *   - When no options exist (empty DB + no curated list) we show emptyHint.
 */
function SearchablePicker({
  options,
  selected,
  onToggle,
  placeholder,
  emptyHint,
}: {
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  placeholder: string
  emptyHint: string
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, search])

  // Show selected first, then the rest of the filtered list (excluding any
  // selected items already rendered at the top).
  const ordered = useMemo(() => {
    const selectedSet = new Set(selected)
    const selectedInOptions = options.filter((o) => selectedSet.has(o))
    const filteredUnselected = filtered.filter((o) => !selectedSet.has(o))
    return [...selectedInOptions, ...filteredUnselected]
  }, [filtered, options, selected])

  if (options.length === 0) {
    return <p className="text-xs text-gray-400">{emptyHint}</p>
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition mb-2"
      />
      <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1 -m-1 border border-gray-100 rounded-lg bg-gray-50/50">
        {ordered.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-2">No matches for &ldquo;{search}&rdquo;</p>
        ) : (
          ordered.map((opt) => (
            <Chip
              key={opt}
              active={selected.includes(opt)}
              onClick={() => onToggle(opt)}
            >
              {opt}
            </Chip>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          {selected.length} selected
        </p>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function RangeInputs({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  placeholder,
}: {
  minValue: string
  maxValue: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={minValue}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={`Min (${placeholder})`}
        className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
      />
      <span className="text-xs text-gray-400">–</span>
      <input
        type="number"
        value={maxValue}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder="Max"
        className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
      />
    </div>
  )
}

function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (next: Filters) => void
}) {
  const remove = (key: keyof Filters, value?: string) => {
    if (Array.isArray(filters[key]) && value != null) {
      onChange({ ...filters, [key]: (filters[key] as string[]).filter((v) => v !== value) })
    } else {
      onChange({ ...filters, [key]: Array.isArray(filters[key]) ? [] : '' })
    }
  }

  const stageLabel  = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v
  const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v

  return (
    <div className="flex flex-wrap gap-1.5 mb-5">
      {filters.sectors.map((v) => (
        <ActiveChip key={`sec-${v}`} onRemove={() => remove('sectors', v)}>Sector: {v}</ActiveChip>
      ))}
      {filters.stages.map((v) => (
        <ActiveChip key={`stg-${v}`} onRemove={() => remove('stages', v)}>Stage: {stageLabel(v)}</ActiveChip>
      ))}
      {filters.statuses.map((v) => (
        <ActiveChip key={`sta-${v}`} onRemove={() => remove('statuses', v)}>Status: {statusLabel(v)}</ActiveChip>
      ))}
      {filters.countries.map((v) => (
        <ActiveChip key={`cty-${v}`} onRemove={() => remove('countries', v)}>Country: {v}</ActiveChip>
      ))}
      {(filters.minHeadcount || filters.maxHeadcount) && (
        <ActiveChip onRemove={() => { onChange({ ...filters, minHeadcount: '', maxHeadcount: '' }) }}>
          Headcount: {filters.minHeadcount || '0'}–{filters.maxHeadcount || '∞'}
        </ActiveChip>
      )}
      {(filters.minFunding || filters.maxFunding) && (
        <ActiveChip onRemove={() => { onChange({ ...filters, minFunding: '', maxFunding: '' }) }}>
          Funding: {formatRange(filters.minFunding, filters.maxFunding)}
        </ActiveChip>
      )}
      {(filters.minFoundedYear || filters.maxFoundedYear) && (
        <ActiveChip onRemove={() => { onChange({ ...filters, minFoundedYear: '', maxFoundedYear: '' }) }}>
          Founded: {filters.minFoundedYear || '—'}–{filters.maxFoundedYear || '—'}
        </ActiveChip>
      )}
      {filters.investors.map((v) => (
        <ActiveChip key={`inv-${v}`} onRemove={() => remove('investors', v)}>Investor: {v}</ActiveChip>
      ))}
    </div>
  )
}

function ActiveChip({
  children,
  onRemove,
}: {
  children: React.ReactNode
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs font-medium rounded-md bg-gray-900 text-white">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-white/20 transition-colors"
        aria-label="Remove filter"
      >
        <X size={12} />
      </button>
    </span>
  )
}

function formatRange(min: string, max: string): string {
  const fmt = (v: string) => {
    if (!v) return '∞'
    const n = Number(v)
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
    return `$${n}`
  }
  return `${min ? fmt(min) : '$0'}–${fmt(max)}`
}
