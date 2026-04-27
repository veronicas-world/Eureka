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
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
            <span className="ml-2 text-gray-400">· drag rows to reorder</span>
          </p>
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
              <Th className="w-8" />
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
          {filtered.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={11} className="py-16 text-center text-sm text-gray-400">
                  {localCompanies.length === 0
                    ? 'No companies in your database yet.'
                    : 'No companies match your filters.'}
                </td>
              </tr>
            </tbody>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filtered.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {filtered.map((company) => (
                    <SortableCompanyRow key={company.id} company={company} />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          )}
        </table>
      </div>
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
    backgroundColor: isDragging ? '#f9fafb' : undefined,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group"
    >
      {/* Drag handle */}
      <td className="px-2 py-3 w-8">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            domain={company.website}
            size={24}
            shape="circle"
          />
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
        <SignalBadge score={company.signal_score} />
      </td>
      <td className="px-4 py-3">
        {company.status ? <StatusBadge status={company.status} /> : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-gray-600 tabular-nums">
        {formatCurrency(company.total_funding_usd)}
      </td>
      <td className="px-4 py-3 text-gray-600">{formatFundingRound(company.last_funding_round)}</td>
      <td className="px-4 py-3 text-gray-500">{company.founded_year ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-0.5">
          <EnrichButton companyId={company.id} website={company.website} variant="icon" />
          <Link
            href={`/companies/${company.id}/edit`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 inline-flex"
          >
            <Pencil size={14} />
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
