'use client'

import Link from 'next/link'
import { Globe } from 'lucide-react'
import type { CompanyRow } from '@/lib/queries'
import { SignalBadge, StageBadge } from '@/components/ui/Badge'

type ColumnId = 'tracking' | 'outreached' | 'meeting booked' | 'passed' | 'portfolio'

const columns: { id: ColumnId; label: string }[] = [
  { id: 'tracking',       label: 'Tracking'      },
  { id: 'outreached',     label: 'Outreached'     },
  { id: 'meeting booked', label: 'Meeting Booked' },
  { id: 'passed',         label: 'Passed'         },
  { id: 'portfolio',      label: 'Portfolio'      },
]

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
  return (
    <div className="px-8 py-8 min-h-screen">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Pipeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track companies through your deal workflow</p>
      </div>

      <div className="flex gap-3 items-start overflow-x-auto pb-6">
        {columns.map((col) => {
          const cards = companies.filter((c) => c.status === col.id)
          return (
            <div key={col.id} className="flex flex-col w-64 shrink-0">
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

              {/* Cards */}
              <div className="space-y-2">
                {cards.length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-lg py-6 flex items-center justify-center">
                    <span className="text-xs text-gray-300">Empty</span>
                  </div>
                ) : (
                  cards.map((company) => (
                    <KanbanCard key={company.id} company={company} />
                  ))
                )}

                {cards.length > 0 && (
                  <div className="border border-dashed border-gray-200 rounded-lg h-10 flex items-center justify-center">
                    <span className="text-xs text-gray-300">Drop here</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KanbanCard({ company }: { company: CompanyRow }) {
  return (
    <Link href={`/companies/${company.id}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all group">
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
