'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, ExternalLink, Pencil, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { CompanyRow } from '@/lib/queries'
import { formatCurrency, formatFundingRound } from '@/lib/utils'
import { SignalBadge, StatusBadge, StageBadge } from '@/components/ui/Badge'
import EnrichButton from '@/components/EnrichButton'
import CompanyLogo from '@/components/CompanyLogo'
import { STAGE_VALUES, STAGE_LABELS } from '@/lib/stages'
import { reorderCompanies } from '@/app/actions/companies'

function getMarketVerticals(tagsV2: unknown): string[] {
  if (!Array.isArray(tagsV2)) return []
  return tagsV2
    .filter((t): t is Record<string, unknown> =>
      t !== null && typeof t === 'object' &&
      (t as Record<string, unknown>).type === 'MARKET_VERTICAL'
    )
    .map((t) => t.display_value as string)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function SectorCell({ company }: { company: CompanyRow }) {
  if (company.sector) {
    return <span style={{ color: 'var(--ink-soft)' }}>{company.sector}</span>
  }
  const verticals = getMarketVerticals(company.tags_v2)
  if (verticals.length === 0) return <span style={{ color: 'var(--ink-ghost)' }}>—</span>
  const extra = verticals.length - 1
  return (
    <span className="flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
      <span>{verticals[0]}</span>
      {extra > 0 && (
        <span
          className="inline-flex items-center px-1.5 h-4 rounded-full text-[10px] font-medium cursor-help"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline-2)', color: 'var(--ink-faint)' }}
          title={verticals.join(', ')}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}

const ALL = 'All'

const stageOptions = [ALL, ...STAGE_VALUES]
const statusOptions = [ALL, 'tracking', 'outreached', 'meeting booked', 'passed', 'portfolio']

const stageLabels: Record<string, string> = STAGE_LABELS

interface Props {
  companies: CompanyRow[]
  sectors: string[]
}

export default function DatabaseClient({ companies, sectors }: Props) {
  const searchParams = useSearchParams()
  const initialStage  = searchParams.get('stage')  ?? ALL
  const initialStatus = searchParams.get('status') ?? ALL
  const initialSector = searchParams.get('sector') ?? ALL
  const initialQuery  = searchParams.get('q')      ?? ''

  const [query, setQuery]   = useState(initialQuery)
  const [stage, setStage]   = useState(initialStage)
  const [sector, setSector] = useState(initialSector)
  const [status, setStatus] = useState(initialStatus)

  // Local copy of companies so we can optimistically reflect drag-and-drop
  // ordering before the server round-trip finishes.
  const [localCompanies, setLocalCompanies] = useState<CompanyRow[]>(companies)
  const [, startTransition] = useTransition()

  // Re-sync from props whenever the server fetch returns a new list (e.g.
  // after a revalidatePath following a reorder).
  useEffect(() => {
    setLocalCompanies(companies)
  }, [companies])

  // Sync filters when the URL changes (e.g. user clicks a dashboard bar
  // while already on /database).
  useEffect(() => {
    setStage(searchParams.get('stage')   ?? ALL)
    setStatus(searchParams.get('status') ?? ALL)
    setSector(searchParams.get('sector') ?? ALL)
    setQuery(searchParams.get('q')       ?? '')
  }, [searchParams])

  const sectorOptions = [ALL, ...sectors]

  const filtered = useMemo(() => {
    return localCompanies.filter((c) => {
      const q = query.toLowerCase()
      if (q && !c.name.toLowerCase().includes(q) && !(c.sector ?? '').toLowerCase().includes(q)) return false
      if (stage  !== ALL && c.stage  !== stage)  return false
      if (sector !== ALL && c.sector !== sector) return false
      if (status !== ALL && c.status !== status) return false
      return true
    })
  }, [localCompanies, query, stage, sector, status])

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 6px so a click on a row link still works without triggering a drag
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Map the visible drag (active → over) onto the FULL companies list so
    // the saved order stays globally consistent even when filters are on.
    const fromGlobal = localCompanies.findIndex((c) => c.id === active.id)
    const toGlobal   = localCompanies.findIndex((c) => c.id === over.id)
    if (fromGlobal === -1 || toGlobal === -1) return

    const reordered = arrayMove(localCompanies, fromGlobal, toGlobal)
    setLocalCompanies(reordered) // optimistic

    const orderedIds = reordered.map((c) => c.id)
    startTransition(() => {
      reorderCompanies(orderedIds).catch((err) => {
        console.error('[reorderCompanies]', err)
        // On failure, fall back to the server's view of the world.
        setLocalCompanies(companies)
      })
    })
  }

  return (
    <div style={{ padding: '36px 44px 80px', maxWidth: 1180 }}>
      {/* Page header */}
      <header className="flex items-end justify-between gap-5 mb-6">
        <div>
          <h1 className="flex items-baseline gap-2.5 m-0" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
            <span>database</span>
            <span style={{ color: 'var(--ink-faint)', fontSize: 14, fontWeight: 400 }}>˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺</span>
          </h1>
          <p className="mt-1.5" style={{ fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.02em' }}>
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
            <span style={{ marginLeft: 8, color: 'var(--ink-faint)' }}>· drag rows to reorder</span>
          </p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded transition-colors"
          style={{ fontSize: 12, fontWeight: 500, background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)' }}
        >
          <Plus size={12} />
          add company
        </Link>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-faint)' }} />
          <input
            type="text"
            placeholder="search companies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded outline-none transition-shadow"
            style={{
              fontSize: 12.5,
              background: 'var(--surface)',
              border: '1px solid var(--hairline-2)',
              color: 'var(--ink)',
            }}
          />
        </div>

        <FilterSelect
          value={stage}
          onChange={setStage}
          options={stageOptions}
          formatter={(v) => v === ALL ? 'all stages' : (stageLabels[v] ?? v).toLowerCase()}
        />
        <FilterSelect
          value={sector}
          onChange={setSector}
          options={sectorOptions}
          formatter={(v) => v === ALL ? 'all sectors' : v.toLowerCase()}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={statusOptions}
          formatter={(v) => v === ALL ? 'all statuses' : v}
        />
      </div>

      {/* Table */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filtered.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="rounded-md overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
            <table className="w-full" style={{ fontSize: 12.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline-2)' }}>
                  <Th className="w-8" />
                  <Th>company</Th>
                  <Th>sector</Th>
                  <Th>stage</Th>
                  <Th>country</Th>
                  <Th>signal</Th>
                  <Th>status</Th>
                  <Th>total funding</Th>
                  <Th>last round</Th>
                  <Th>founded</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center" style={{ color: 'var(--ink-faint)', fontSize: 12.5 }}>
                      <span className="twinkle">⋆</span>{' '}
                      {localCompanies.length === 0
                        ? 'no companies in your database yet.'
                        : 'no companies match these filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((company) => (
                    <SortableCompanyRow key={company.id} company={company} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// --------------------------------------------------------------
// Sortable row
// --------------------------------------------------------------

function SortableCompanyRow({ company }: { company: CompanyRow }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: company.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? 'var(--paper-soft)' : undefined,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="group transition-colors"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(91,115,184,0.04)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
    >
      {/* Drag handle */}
      <td style={{ padding: '12px 8px 12px 12px', width: 32, borderBottom: '1px dotted var(--hairline)' }}>
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab active:cursor-grabbing touch-none"
          style={{ color: 'var(--ink-ghost)', display: 'inline-flex' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      </td>

      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', verticalAlign: 'middle' }}>
        <div className="flex items-center gap-2">
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            domain={company.website}
            size={24}
            shape="square"
          />
          <Link
            href={`/companies/${company.id}`}
            style={{ fontWeight: 600, color: 'var(--ink)' }}
          >
            {company.name}
          </Link>
          {company.website && (
            <a
              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--ink-faint)' }}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', verticalAlign: 'middle' }}>
        <SectorCell company={company} />
      </td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', verticalAlign: 'middle' }}>
        {company.stage ? <StageBadge stage={company.stage} /> : <span style={{ color: 'var(--ink-ghost)' }}>—</span>}
      </td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', color: 'var(--ink-soft)', verticalAlign: 'middle' }}>{company.country ?? '—'}</td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', verticalAlign: 'middle' }}>
        <SignalBadge score={company.signal_score} />
      </td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', verticalAlign: 'middle' }}>
        {company.status ? <StatusBadge status={company.status} /> : <span style={{ color: 'var(--ink-ghost)' }}>—</span>}
      </td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', color: 'var(--ink-soft)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>
        {formatCurrency(company.total_funding_usd)}
      </td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', color: 'var(--ink-soft)', verticalAlign: 'middle' }}>{formatFundingRound(company.last_funding_round)}</td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', color: 'var(--ink-faint)', verticalAlign: 'middle' }}>{company.founded_year ?? '—'}</td>
      <td style={{ padding: '12px', borderBottom: '1px dotted var(--hairline)', verticalAlign: 'middle' }}>
        <div className="flex items-center gap-0.5">
          <EnrichButton companyId={company.id} website={company.website} variant="icon" />
          <Link
            href={`/companies/${company.id}/edit`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded inline-flex"
            style={{ color: 'var(--ink-faint)' }}
          >
            <Pencil size={13} />
          </Link>
        </div>
      </td>
    </tr>
  )
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={className}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: 9.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: 'var(--ink-faint)',
      }}
    >
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
      className="h-8 pl-3 pr-7 rounded appearance-none cursor-pointer outline-none transition-shadow"
      style={{
        fontSize: 12,
        background: 'var(--surface)',
        border: '1px solid var(--hairline-2)',
        color: 'var(--ink)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A92AB' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
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
