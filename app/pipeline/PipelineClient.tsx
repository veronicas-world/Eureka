'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { CompanyRow } from '@/lib/queries'
import { SignalBadge, StageBadge } from '@/components/ui/Badge'
import { updateCompanyStatus } from '@/app/actions/companies'

type ColumnId = 'tracking' | 'outreached' | 'meeting booked' | 'passed' | 'portfolio'

const columns: { id: ColumnId; label: string }[] = [
  { id: 'tracking',       label: 'Tracking'      },
  { id: 'outreached',     label: 'Outreached'     },
  { id: 'meeting booked', label: 'Meeting Booked' },
  { id: 'passed',         label: 'Passed'         },
  { id: 'portfolio',      label: 'Portfolio'      },
]

const COLUMN_IDS = new Set<string>(columns.map((c) => c.id))

const columnColors: Record<ColumnId, string> = {
  'tracking':       'bg-blue-400',
  'outreached':     'bg-violet-400',
  'meeting booked': 'bg-amber-400',
  'passed':         'bg-gray-300',
  'portfolio':      'bg-emerald-400',
}

interface Props {
  companies: CompanyRow[]
}

export default function PipelineClient({ companies }: Props) {
  const [localCompanies, setLocalCompanies] = useState<CompanyRow[]>(companies)
  const [activeCompany,  setActiveCompany]  = useState<CompanyRow | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 6px so a tap on a card link still works without triggering a drag
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCompany(localCompanies.find((c) => c.id === event.active.id) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCompany(null)
    const { active, over } = event
    if (!over) return

    const targetStatus = String(over.id) as ColumnId
    if (!COLUMN_IDS.has(targetStatus)) return   // dropped on unknown target

    const company = localCompanies.find((c) => c.id === active.id)
    if (!company || company.status === targetStatus) return

    // Optimistic update
    setLocalCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, status: targetStatus } : c))
    )

    startTransition(() => {
      updateCompanyStatus(company.id, targetStatus).catch((err) => {
        console.error('[updateCompanyStatus]', err)
        setLocalCompanies(companies) // roll back to server state
      })
    })
  }

  return (
    <div style={{ padding: '36px 44px 80px' }} className="min-h-screen">
      <header className="mb-7">
        <h1 className="flex items-baseline gap-2.5 m-0" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
          <span>pipeline</span>
          <span style={{ color: 'var(--ink-faint)', fontSize: 14, fontWeight: 400 }}>⋆˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺</span>
        </h1>
        <p className="mt-1.5" style={{ fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.02em' }}>
          where every conversation stands tonight
        </p>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 items-start overflow-x-auto pb-6">
          {columns.map((col) => {
            const cards = localCompanies.filter((c) => c.status === col.id)
            return (
              <DroppableColumn key={col.id} col={col} cards={cards} />
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCompany ? <KanbanCard company={activeCompany} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── Droppable column ──────────────────────────────────────────────────────────

function DroppableColumn({
  col,
  cards,
}: {
  col:   { id: ColumnId; label: string }
  cards: CompanyRow[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="flex flex-col w-64 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${columnColors[col.id]}`} />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {col.label}
          </span>
        </div>
        <span className="text-xs text-gray-400 tabular-nums font-medium">
          {cards.length}
        </span>
      </div>

      {/* Cards — the droppable zone */}
      <div
        ref={setNodeRef}
        className="space-y-2 min-h-16 rounded-lg transition-colors"
        style={{ background: isOver ? 'rgba(91,115,184,0.06)' : undefined }}
      >
        {cards.length === 0 ? (
          <div
            className="border border-dashed rounded-lg py-6 flex items-center justify-center transition-colors"
            style={{ borderColor: isOver ? 'rgba(91,115,184,0.4)' : '#e5e7eb' }}
          >
            <span className="text-xs text-gray-300">
              {isOver ? 'drop here' : 'Empty'}
            </span>
          </div>
        ) : (
          <>
            {cards.map((company) => (
              <DraggableCard key={company.id} company={company} />
            ))}
            <div className="border border-dashed border-gray-200 rounded-lg h-10 flex items-center justify-center">
              <span className="text-xs text-gray-300">Drop here</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Draggable card ────────────────────────────────────────────────────────────

function DraggableCard({
  company,
  isOverlay = false,
}: {
  company:    CompanyRow
  isOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: company.id })

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={{ opacity: isDragging && !isOverlay ? 0.35 : 1 }}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
    >
      <KanbanCard company={company} />
    </div>
  )
}

// ── Card UI ───────────────────────────────────────────────────────────────────

function KanbanCard({
  company,
  isOverlay = false,
}: {
  company:    CompanyRow
  isOverlay?: boolean
}) {
  return (
    <Link href={`/companies/${company.id}`}>
      <div
        className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all group"
        style={{ boxShadow: isOverlay ? '0 8px 24px rgba(0,0,0,0.12)' : undefined }}
      >
        {/* Name + signal */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-semibold text-gray-500">{company.name[0]}</span>
            </div>
            <span className="text-sm font-medium text-gray-900 truncate group-hover:text-gray-700 transition-colors">
              {company.name}
            </span>
          </div>
          {company.signal_score != null && <SignalBadge score={company.signal_score} />}
        </div>

        {/* Stage + sector */}
        <div className="flex items-center gap-2 flex-wrap">
          {company.stage && <StageBadge stage={company.stage} />}
          {company.sector && (
            <span className="text-xs text-gray-400">{company.sector}</span>
          )}
        </div>

        {/* Location */}
        {company.country && (
          <div className="flex items-center gap-1 mt-2">
            <Globe size={11} className="text-gray-300 shrink-0" />
            <span className="text-xs text-gray-400">
              {company.city ? `${company.city}, ` : ''}{company.country}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
