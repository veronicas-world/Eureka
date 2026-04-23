'use client'

import { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ExternalLink, ChevronRight, ChevronDown, ChevronUp, Plus, Trash2,
  Loader2, Mail, Pencil, ArrowRight, Briefcase, GraduationCap, Users, X,
} from 'lucide-react'
import type { CompanyWithRelations, PersonRow, SignalRow, NoteRow, InteractionRow } from '@/lib/queries'
import {
  addNote, deleteNote,
  addPerson, deletePerson,
  addInteraction, addSignal,
} from '@/app/actions/companies'
import { Badge, SignalBadge, StatusBadge, StageBadge } from '@/components/ui/Badge'
import { formatCurrency, formatGrowth, formatDegree } from '@/lib/utils'
import HeadcountChart from './HeadcountChart'
import TractionTab from './TractionTab'
import FundingTab from './FundingTab'
import EnrichButton from '@/components/EnrichButton'
import DeleteCompanyButton from './DeleteCompanyButton'
import CompanyLogo from '@/components/CompanyLogo'
import SchoolLogo from '@/components/SchoolLogo'

// ── Shared style constants ────────────────────────────────────────────────────

const inputCls =
  'w-full h-8 px-3 text-sm bg-white border border-gray-200 rounded-md ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 ' +
  'focus:border-transparent transition-shadow'

const selectCls =
  'w-full h-8 pl-3 pr-7 text-sm bg-white border border-gray-200 rounded-md ' +
  'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ' +
  'appearance-none cursor-pointer'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 8px center' as const,
}

const textareaCls =
  'w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 ' +
  'focus:border-transparent resize-none'

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'team',      label: 'Team' },
  { id: 'funding',   label: 'Funding' },
  { id: 'traction',  label: 'Traction' },
  { id: 'signals',   label: 'Signals' },
  { id: 'notes',     label: 'Notes' },
] as const

// ── Signal display maps ───────────────────────────────────────────────────────

const signalTypeVariant: Record<string, 'blue' | 'purple' | 'amber' | 'green' | 'gray'> = {
  funding: 'green', hiring_spike: 'blue', news: 'gray', founder_move: 'purple', product_launch: 'amber',
}
const strengthVariant: Record<string, 'green' | 'yellow' | 'red'> = {
  strong: 'green', moderate: 'yellow', weak: 'red',
}
const interactionTypeLabel: Record<string, string> = {
  email: 'Email', call: 'Call', meeting: 'Meeting', linkedin: 'LinkedIn', intro: 'Intro',
}

// ── People classification ─────────────────────────────────────────────────────

const EXEC_KEYWORDS = ['ceo', 'cto', 'cfo', 'coo', 'chief ', 'president', 'director', 'head of', 'vice president', 'general manager', 'managing director']

function isExecutive(title: string | null | undefined): boolean {
  if (!title) return false
  const t = title.toLowerCase()
  if (/\bvp\b/.test(t)) return true
  return EXEC_KEYWORDS.some((kw) => t.includes(kw))
}

function computeCounts(items: string[]): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const trimmed = item.trim()
    if (trimmed) map.set(trimmed, (map.get(trimmed) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }
  catch { return d }
}

function formatFullDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function linkedinHref(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : `https://${url}`
}

// ── Shared small components ───────────────────────────────────────────────────

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-xs text-red-600 mt-2">{message}</p>
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      <Plus size={13} />{label}
    </button>
  )
}

function FormActions({ onCancel, isPending, label }: { onCancel: () => void; isPending: boolean; label: string }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <button type="button" onClick={onCancel} disabled={isPending}
        className="h-7 px-3 text-xs font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40">
        Cancel
      </button>
      <button type="submit" disabled={isPending}
        className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shadow-sm">
        {isPending && <Loader2 size={11} className="animate-spin" />}{label}
      </button>
    </div>
  )
}

function DeleteButton({ onDelete, isDeleting }: { onDelete: () => void; isDeleting: boolean }) {
  return (
    <button type="button" onClick={onDelete} disabled={isDeleting} aria-label="Delete"
      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 disabled:opacity-40">
      {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{children}</p>
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {count != null && count > 0 && (
        <span className="text-sm font-semibold text-gray-400 tabular-nums">{count}</span>
      )}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ person, size = 'md' }: { person: PersonRow; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-7 h-7 text-[11px]', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' }
  return (
    <div className={`${sizeMap[size]} rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden`}>
      {person.profile_picture_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={person.profile_picture_url} alt={person.name} className="w-full h-full object-cover" />
        : <span className="font-bold text-gray-500">{person.name[0]}</span>}
    </div>
  )
}

// ── Person modal ─────────────────────────────────────────────────────────────

function PersonModal({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const lhref = linkedinHref(person.linkedin_url)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-start gap-4 p-6 pb-4">
          <Avatar person={person} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base font-bold text-gray-900">{person.name}</span>
              {lhref && (
                <a href={lhref} target="_blank" rel="noopener noreferrer"
                  className="text-[#0077b5] hover:opacity-70 shrink-0"
                  onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            {person.title && <p className="text-sm text-gray-500 mt-0.5">{person.title}</p>}
            {person.email && (
              <a href={`mailto:${person.email}`}
                className="inline-flex items-center gap-1 mt-2 h-7 px-2.5 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={(e) => e.stopPropagation()}>
                <Mail size={11} />{person.email}
              </a>
            )}
          </div>
          <button onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {person.prior_company && (
            <div className="flex items-center gap-2 text-sm">
              <CompanyLogo name={person.prior_company} size={16} shape="square" />
              <span className="text-gray-700">
                {person.prior_title
                  ? <><span className="text-gray-500">{person.prior_title}</span>{' at '}</>
                  : null}
                <span className="font-semibold text-gray-800">{person.prior_company}</span>
              </span>
            </div>
          )}
          {person.education && (
            <div className="flex items-center gap-2 text-sm">
              <SchoolLogo school={person.education} size={16} />
              <span className="text-gray-700">
                {formatDegree(person.degree)
                  ? <><span className="font-semibold">{formatDegree(person.degree)}</span>{' · '}{person.education}</>
                  : person.education}
              </span>
            </div>
          )}
          {person.notes && (
            <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              {person.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Person detail card (Executives / Employees) ───────────────────────────────

function PersonDetailCard({ p, onDelete, isDeleting, onSelect }: {
  p: PersonRow; onDelete: () => void; isDeleting: boolean; onSelect: (p: PersonRow) => void
}) {
  const lhref = linkedinHref(p.linkedin_url)
  return (
    <div
      className="border border-gray-200 rounded-xl p-4 bg-white group cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
      onClick={() => onSelect(p)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar person={p} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 leading-tight">{p.name}</span>
              {lhref && (
                <a href={lhref} target="_blank" rel="noopener noreferrer"
                  className="text-[#0077b5] hover:opacity-70 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-tight mt-px truncate max-w-[180px]">{p.title ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {p.email && (
            <a href={`mailto:${p.email}`}
              className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Mail size={13} />
            </a>
          )}
          <DeleteButton onDelete={onDelete} isDeleting={isDeleting} />
        </div>
      </div>

      <div className="mt-3 space-y-1.5 pl-[52px]">
        {p.prior_company ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 leading-snug">
            <CompanyLogo name={p.prior_company} size={14} shape="square" />
            <span>
              {p.prior_title && <span>{p.prior_title} at </span>}
              <span className="font-semibold text-gray-800">{p.prior_company}</span>
            </span>
          </div>
        ) : null}
        {p.education ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <SchoolLogo school={p.education} size={14} />
            <span>{p.education}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Founder card (expandable) ─────────────────────────────────────────────────

function FounderCard({ p, onSelect }: { p: PersonRow; onSelect: (p: PersonRow) => void }) {
  const [expanded, setExpanded] = useState(false)
  const lhref = linkedinHref(p.linkedin_url)
  const hasDetails = !!(p.prior_company || p.education || p.notes)

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="p-4 cursor-pointer" onClick={() => onSelect(p)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar person={p} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                {lhref && (
                  <a href={lhref} target="_blank" rel="noopener noreferrer"
                    className="text-[#0077b5] hover:opacity-70 shrink-0"
                    onClick={(e) => e.stopPropagation()}>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-px">{p.title ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {p.email && (
              <a href={`mailto:${p.email}`}
                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <Mail size={13} />
              </a>
            )}
          </div>
        </div>

        {expanded && hasDetails && (
          <div className="mt-4 pl-[52px] space-y-2">
            {p.prior_company && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <CompanyLogo name={p.prior_company} size={14} shape="square" />
                <span>
                  {p.prior_title && <span>{p.prior_title} at </span>}
                  <span className="font-semibold text-gray-800">{p.prior_company}</span>
                </span>
              </div>
            )}
            {p.education && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <SchoolLogo school={p.education} size={14} />
                <span>{p.education}</span>
              </div>
            )}
            {p.notes && (
              <p className="text-xs text-gray-500 leading-relaxed">{p.notes}</p>
            )}
          </div>
        )}
      </div>

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          {expanded
            ? <><ChevronUp size={12} />Show less</>
            : <><ChevronDown size={12} />Show more</>}
        </button>
      )}
    </div>
  )
}

// ── Hire card (Talent Flow) ───────────────────────────────────────────────────

function HireCard({ p }: { p: PersonRow }) {
  const lhref = linkedinHref(p.linkedin_url)
  const hireDate = formatFullDate(p.created_at)

  return (
    <div className="flex items-start gap-3">
      <Avatar person={p} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900">{p.name}</span>
          {lhref && (
            <a href={lhref} target="_blank" rel="noopener noreferrer"
              className="text-[#0077b5] hover:opacity-70">
              <ExternalLink size={11} />
            </a>
          )}
        </div>
        {p.title && <p className="text-xs text-gray-600 mt-px">{p.title}</p>}
        <p className="text-xs text-gray-400 mt-0.5">Started: {hireDate}</p>
        {p.prior_company && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
            <CompanyLogo name={p.prior_company} size={14} shape="square" />
            <span>
              Was: {p.prior_title && <span>{p.prior_title} </span>}
              <span className="font-semibold text-gray-700">{p.prior_company}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Signal card (shared) ──────────────────────────────────────────────────────

function SignalCard({ s }: { s: SignalRow }) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {s.signal_type && (
              <Badge variant={signalTypeVariant[s.signal_type] ?? 'gray'}>
                {s.signal_type.replace(/_/g, ' ')}
              </Badge>
            )}
            {s.strength && <Badge variant={strengthVariant[s.strength] ?? 'gray'}>{s.strength}</Badge>}
            {s.signal_source && <span className="text-xs text-gray-400">{s.signal_source}</span>}
          </div>
          {s.headline && <p className="text-sm font-medium text-gray-900">{s.headline}</p>}
          {s.detail   && <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{s.detail}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {s.signal_date && <span className="text-xs text-gray-400">{s.signal_date}</span>}
          {s.url && (
            <a href={s.url.startsWith('http') ? s.url : `https://${s.url}`}
              target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Person form (shared across team sections) ─────────────────────────────

function AddPersonForm({ companyId, onDone, onCancel }: {
  companyId: string; onDone: () => void; onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const founderRef = useRef<HTMLInputElement>(null)

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = (fd.get('name') as string)?.trim()
    if (!name) return
    setError(null)
    startTransition(async () => {
      try {
        await addPerson(companyId, {
          name,
          title:        (fd.get('title')        as string)?.trim() || null,
          linkedin_url: (fd.get('linkedin_url') as string)?.trim() || null,
          email:        (fd.get('email')        as string)?.trim() || null,
          is_founder:   founderRef.current?.checked ?? false,
          notes:        (fd.get('notes')        as string)?.trim() || null,
        })
        formRef.current?.reset()
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add person.')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleAdd}
      className="border border-gray-200 rounded-xl p-5 bg-gray-50/60 mb-6">
      <p className="text-sm font-semibold text-gray-700 mb-4">Add Person</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <div>
          <Label htmlFor="p-name" required>Name</Label>
          <input id="p-name" name="name" type="text" required placeholder="Sarah Chen" className={inputCls} />
        </div>
        <div>
          <Label htmlFor="p-title">Title</Label>
          <input id="p-title" name="title" type="text" placeholder="Co-founder & CEO" className={inputCls} />
        </div>
        <div>
          <Label htmlFor="p-linkedin">LinkedIn URL</Label>
          <input id="p-linkedin" name="linkedin_url" type="text" placeholder="linkedin.com/in/…" className={inputCls} />
        </div>
        <div>
          <Label htmlFor="p-email">Email</Label>
          <input id="p-email" name="email" type="email" placeholder="sarah@company.com" className={inputCls} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="p-notes">Notes / Headline</Label>
          <input id="p-notes" name="notes" type="text" placeholder="Serial founder, ex-Google…" className={inputCls} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input ref={founderRef} id="p-founder" name="is_founder" type="checkbox"
            className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer" />
          <label htmlFor="p-founder" className="text-sm text-gray-700 cursor-pointer select-none">Is a founder</label>
        </div>
      </div>
      <FormError message={error} />
      <FormActions onCancel={onCancel} isPending={isPending} label="Add Person" />
    </form>
  )
}

// ── Talent Flow ───────────────────────────────────────────────────────────────

function TalentFlowSection({ people }: { people: PersonRow[] }) {
  const recentHires = [...people]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  return (
    <div>
      <SectionHeader title="Talent flow" />
      <div className="grid grid-cols-2 gap-4">
        {/* Recent hires */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-3">Recent hires ({people.length})</p>
          <div className="border border-gray-200 rounded-xl bg-white p-5">
            {recentHires.length > 0 ? (
              <>
                <p className="text-xs text-gray-400 mb-4">Notable hires</p>
                <div className="space-y-5">
                  {recentHires.map((p) => <HireCard key={p.id} p={p} />)}
                </div>
              </>
            ) : (
              <EmptyState message="No hire data available yet." />
            )}
          </div>
        </div>

        {/* Recent departures — placeholder */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-3">Recent departures (0)</p>
          <div className="border border-gray-200 rounded-xl bg-white p-5">
            <EmptyState message="No departure data available. Enrich to see employee movement." />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Talent Network ────────────────────────────────────────────────────────────

function TalentNetworkSection({ people }: { people: PersonRow[] }) {
  const [netTab, setNetTab] = useState<'work' | 'education'>('work')

  const workCounts  = computeCounts(people.map((p) => p.prior_company).filter(Boolean) as string[])
  const eduCounts   = computeCounts(people.map((p) => p.education).filter(Boolean) as string[])
  const activeList  = netTab === 'work' ? workCounts : eduCounts

  return (
    <div>
      <SectionHeader title="Talent network" />
      <div className="grid grid-cols-2 gap-4">
        {/* Top talent sources */}
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="px-5 pt-4 pb-0">
            <p className="text-sm font-medium text-gray-700 mb-3">Top talent sources</p>
            <div className="flex gap-5 border-b border-gray-200">
              {(['work', 'education'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setNetTab(t)}
                  className={[
                    'pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                    netTab === t
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700',
                  ].join(' ')}>
                  {t === 'work' ? 'Work experience' : 'Education'}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 py-3">
            {activeList.length > 0 ? (
              <div>
                {activeList.slice(0, 10).map(({ name, count }) => (
                  <div key={name}
                    className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {netTab === 'work'
                        ? <CompanyLogo name={name} size={24} shape="square" />
                        : <SchoolLogo school={name} size={24} />}
                      <span className="text-sm text-gray-800 truncate">{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-500 tabular-nums shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message={netTab === 'work' ? 'No prior company data yet.' : 'No education data yet.'} />
            )}
          </div>
        </div>

        {/* Alumni-founded startups — placeholder */}
        <div className="border border-gray-200 rounded-xl bg-white p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Alumni-founded startups</p>
          <EmptyState message="No alumni startup data available." />
        </div>
      </div>
    </div>
  )
}

// ── Founders & CEO ────────────────────────────────────────────────────────────

function FoundersCEOSection({ founders, onSelect }: { founders: PersonRow[]; onSelect: (p: PersonRow) => void }) {
  if (founders.length === 0) return null

  return (
    <div>
      <SectionHeader title="Founders & CEO" count={founders.length} />
      <div className="space-y-3">
        {founders.map((p) => <FounderCard key={p.id} p={p} onSelect={onSelect} />)}
      </div>
    </div>
  )
}

// ── Team Growth ───────────────────────────────────────────────────────────────

interface TractionMetricPoint {
  metric_type?: string
  value?: number
  timestamp?: string
  [key: string]: unknown
}

function TeamGrowthSection({ company }: { company: CompanyWithRelations }) {
  const headcount = company.employee_count
  const growth30d = company.headcount_30d_growth
  const growth90d = company.headcount_90d_growth
  const growth6m  = company.headcount_6m_growth

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && company.traction_metrics) {
      console.log('[TeamGrowth] traction_metrics raw:', company.traction_metrics)
      if (Array.isArray(company.traction_metrics)) {
        console.log('[TeamGrowth] first 3 items:', (company.traction_metrics as unknown[]).slice(0, 3))
      }
    }
  }, [company.traction_metrics])

  const tractionSeries = useMemo((): Array<{ label: string; headcount: number; ts: string }> => {
    if (!Array.isArray(company.traction_metrics)) return []
    return (company.traction_metrics as TractionMetricPoint[])
      .filter((m) => m.metric_type === 'HEADCOUNT' && typeof m.value === 'number' && m.timestamp)
      .map((m) => ({
        label: new Date(m.timestamp!).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        headcount: m.value!,
        ts: m.timestamp!,
      }))
      .sort((a, b) => a.ts.localeCompare(b.ts))
  }, [company.traction_metrics])

  const hasGrowthData = growth30d != null || growth90d != null || growth6m != null
  const hasAnyData    = headcount != null && (hasGrowthData || tractionSeries.length >= 2)

  if (!hasAnyData) {
    return (
      <div>
        <SectionHeader title="Team growth" />
        <div className="border border-gray-200 rounded-xl bg-white p-8 text-center">
          <Users size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Enrich this company to see team growth data.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Team growth" />
      <div className="border border-gray-200 rounded-xl bg-white p-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Headcount</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{headcount!.toLocaleString()}</p>
          </div>
          {growth30d != null && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">30-Day</p>
              <p className={`text-xl font-bold mt-0.5 ${growth30d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {growth30d > 0 ? '+' : ''}{(growth30d * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {growth90d != null && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">90-Day</p>
              <p className={`text-xl font-bold mt-0.5 ${growth90d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {growth90d > 0 ? '+' : ''}{(growth90d * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {growth6m != null && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">6-Month</p>
              <p className={`text-xl font-bold mt-0.5 ${growth6m > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {growth6m > 0 ? '+' : ''}{(growth6m * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Chart — prefer real time series, fall back to growth-pct back-calculation */}
        {tractionSeries.length >= 2 ? (
          <HeadcountChart
            series={tractionSeries}
            lastFundingDate={company.last_funding_date}
            lastFundingRound={company.last_funding_round}
            lastFundingAmount={company.last_funding_amount_usd}
          />
        ) : hasGrowthData ? (
          <HeadcountChart
            currentHeadcount={headcount!}
            growth30d={growth30d}
            growth90d={growth90d}
            growth6m={growth6m}
            lastFundingDate={company.last_funding_date}
            lastFundingRound={company.last_funding_round}
            lastFundingAmount={company.last_funding_amount_usd}
          />
        ) : null}
      </div>
    </div>
  )
}

// ── Executives section ────────────────────────────────────────────────────────

function ExecutivesSection({ executives, onRefresh, onSelect }: {
  executives: PersonRow[]; companyId: string; onRefresh: () => void; onSelect: (p: PersonRow) => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      try { await deletePerson(id); onRefresh() }
      catch { setError('Failed to delete person.') }
      finally { setDeletingId(null) }
    })
  }

  if (executives.length === 0) return null

  return (
    <div>
      <SectionHeader title="Executives" count={executives.length} />
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {executives.map((p) => (
          <PersonDetailCard key={p.id} p={p}
            onDelete={() => handleDelete(p.id)}
            isDeleting={deletingId === p.id}
            onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

// ── Employees section ─────────────────────────────────────────────────────────

function EmployeesSection({ employees, onRefresh, onSelect }: {
  employees: PersonRow[]; companyId: string; onRefresh: () => void; onSelect: (p: PersonRow) => void
}) {
  const [visible, setVisible]   = useState(10)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition]     = useTransition()
  const [error, setError]       = useState<string | null>(null)

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      try { await deletePerson(id); onRefresh() }
      catch { setError('Failed to delete person.') }
      finally { setDeletingId(null) }
    })
  }

  if (employees.length === 0) return null

  const shown = employees.slice(0, visible)

  return (
    <div>
      <SectionHeader title="Employees" count={employees.length} />
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {shown.map((p) => (
          <PersonDetailCard key={p.id} p={p}
            onDelete={() => handleDelete(p.id)}
            isDeleting={deletingId === p.id}
            onSelect={onSelect} />
        ))}
      </div>
      {visible < employees.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + 10)}
            className="h-8 px-4 text-sm font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
            Load more ({employees.length - visible} remaining)
          </button>
        </div>
      )}
    </div>
  )
}

// ── Team tab ──────────────────────────────────────────────────────────────────

function TeamTab({ company }: { company: CompanyWithRelations }) {
  const router = useRouter()
  const [showAddForm, setShowAddForm]       = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<PersonRow | null>(null)

  const people     = company.people ?? []
  const founders   = people.filter((p) => p.is_founder)
  const executives = people.filter((p) => !p.is_founder && isExecutive(p.title))
  const employees  = people.filter((p) => !p.is_founder && !isExecutive(p.title))

  const handleDone = () => {
    setShowAddForm(false)
    router.refresh()
  }

  return (
    <div className="px-6 py-6">
      {selectedPerson && (
        <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}

      {/* Add person button */}
      <div className="flex items-center justify-end mb-6">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
          <Plus size={13} />Add Person
        </button>
      </div>

      {showAddForm && (
        <AddPersonForm
          companyId={company.id}
          onDone={handleDone}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="space-y-10">
        <TalentFlowSection people={people} />
        <TalentNetworkSection people={people} />
        <FoundersCEOSection founders={founders} onSelect={setSelectedPerson} />
        <TeamGrowthSection company={company} />
        <ExecutivesSection executives={executives} companyId={company.id} onRefresh={() => router.refresh()} onSelect={setSelectedPerson} />
        <EmployeesSection employees={employees} companyId={company.id} onRefresh={() => router.refresh()} onSelect={setSelectedPerson} />
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ company }: { company: CompanyWithRelations }) {
  const [expanded, setExpanded] = useState(false)
  const description = company.description ?? company.short_description
  const TRUNCATE = 300
  const isLong = !!description && description.length > TRUNCATE

  const fundingPerEmployee =
    company.total_funding_usd && company.employee_count
      ? Math.round(company.total_funding_usd / company.employee_count)
      : null

  const recentSignals = (company.signals ?? []).slice(0, 3)
  const recentNotes   = (company.notes   ?? []).slice(0, 2)

  return (
    <div className="divide-y divide-gray-100">
      {/* Stats bar */}
      <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
        <StatCell label="Total Raised"   value={formatCurrency(company.total_funding_usd ?? undefined)} />
        <StatCell
          label="Headcount"
          value={company.employee_count?.toLocaleString() ?? '—'}
          sub={formatGrowth(company.headcount_30d_growth) || undefined}
          subColor={company.headcount_30d_growth == null ? undefined : company.headcount_30d_growth > 0 ? 'green' : 'red'}
        />
        <StatCell label="Funding Rounds"    value={company.funding_rounds_count?.toString() ?? '—'} />
        <StatCell label="Latest Valuation"  value={formatCurrency(company.latest_valuation_usd ?? undefined)} />
        <StatCell label="Funding / Employee" value={fundingPerEmployee ? formatCurrency(fundingPerEmployee) : '—'} />
      </div>

      {/* Description */}
      {description && (
        <div className="px-6 py-5">
          <SectionLabel>About</SectionLabel>
          <p className="text-sm text-gray-700 leading-relaxed">
            {isLong && !expanded ? description.slice(0, TRUNCATE) + '…' : description}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-700 mt-1.5 transition-colors">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Tags */}
      {company.tags && company.tags.length > 0 && (
        <div className="px-6 py-5">
          <SectionLabel>Tags</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {company.tags.map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}
          </div>
        </div>
      )}

      {/* Investors */}
      {company.investors && company.investors.length > 0 && (
        <div className="px-6 py-5">
          <SectionLabel>Investors</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {company.investors.map(inv => <Badge key={inv} variant="gray">{inv}</Badge>)}
          </div>
        </div>
      )}

      {/* Recent signals */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Recent Signals</SectionLabel>
          <Link href={`/companies/${company.id}?tab=signals`}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        {recentSignals.length === 0
          ? <p className="text-sm text-gray-400">No signals yet.</p>
          : recentSignals.map(s => <SignalCard key={s.id} s={s} />)
        }
      </div>

      {/* Recent notes */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Recent Notes</SectionLabel>
          <Link href={`/companies/${company.id}?tab=notes`}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        {recentNotes.length === 0
          ? <p className="text-sm text-gray-400">No notes yet.</p>
          : recentNotes.map(n => (
            <div key={n.id} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{n.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(n.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Funding tab lives in ./FundingTab.tsx ───────────────────────────────────

// ── Traction tab lives in ./TractionTab.tsx ─────────────────────────────────

// ── Signals tab ───────────────────────────────────────────────────────────────

function SignalsTab({ companyId, signals }: { companyId: string; signals: SignalRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm]      = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await addSignal(companyId, {
          signal_type:   (fd.get('signal_type')   as string) || null,
          signal_source: (fd.get('signal_source') as string)?.trim() || null,
          headline:      (fd.get('headline')      as string)?.trim() || null,
          detail:        (fd.get('detail')        as string)?.trim() || null,
          signal_date:   (fd.get('signal_date')   as string) || null,
          strength:      (fd.get('strength')      as string) || null,
          url:           (fd.get('url')           as string)?.trim() || null,
        })
        formRef.current?.reset()
        setShowForm(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add signal.')
      }
    })
  }

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-100">
        <AddButton onClick={() => { setShowForm(true); setError(null) }} label="Add Signal" />
      </div>

      {showForm && (
        <form ref={formRef} onSubmit={handleAdd}
          className="px-5 py-4 bg-gray-50/60 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <div>
              <Label htmlFor="s-type">Signal Type</Label>
              <div className="relative">
                <select id="s-type" name="signal_type" className={selectCls} style={selectStyle} defaultValue="">
                  <option value="">Select type…</option>
                  <option value="funding">Funding</option>
                  <option value="hiring_spike">Hiring Spike</option>
                  <option value="news">News</option>
                  <option value="founder_move">Founder Move</option>
                  <option value="product_launch">Product Launch</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="s-source">Source</Label>
              <input id="s-source" name="signal_source" type="text" placeholder="e.g. TechCrunch, LinkedIn" className={inputCls} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="s-headline">Headline</Label>
              <input id="s-headline" name="headline" type="text" placeholder="Synthia AI raises $5M seed round" className={inputCls} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="s-detail">Detail</Label>
              <textarea id="s-detail" name="detail" rows={2}
                placeholder="Additional context or notes…" className={textareaCls} />
            </div>
            <div>
              <Label htmlFor="s-date">Signal Date</Label>
              <input id="s-date" name="signal_date" type="date" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="s-strength">Strength</Label>
              <div className="relative">
                <select id="s-strength" name="strength" className={selectCls} style={selectStyle} defaultValue="">
                  <option value="">Select strength…</option>
                  <option value="weak">Weak</option>
                  <option value="moderate">Moderate</option>
                  <option value="strong">Strong</option>
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="s-url">URL</Label>
              <input id="s-url" name="url" type="text" placeholder="https://techcrunch.com/…" className={inputCls} />
            </div>
          </div>
          <FormError message={error} />
          <FormActions onCancel={() => { setShowForm(false); setError(null); formRef.current?.reset() }}
            isPending={isPending} label="Add Signal" />
        </form>
      )}

      {signals.length === 0 && !showForm
        ? <EmptyState message="No signals tracked yet." />
        : <div className="px-5">{signals.map(s => <SignalCard key={s.id} s={s} />)}</div>
      }
    </div>
  )
}

// ── Notes tab (notes + interactions) ─────────────────────────────────────────

function NotesTab({ companyId, notes, interactions }: {
  companyId: string; notes: NoteRow[]; interactions: InteractionRow[]
}) {
  const router = useRouter()
  const [notePending, startNoteTransition]   = useTransition()
  const [intPending,  startIntTransition]    = useTransition()
  const [deletingId,  setDeletingId]         = useState<string | null>(null)
  const [showIntForm, setShowIntForm]        = useState(false)
  const [noteError,   setNoteError]          = useState<string | null>(null)
  const [intError,    setIntError]           = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const intFormRef  = useRef<HTMLFormElement>(null)

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    const content = textareaRef.current?.value ?? ''
    if (!content.trim()) return
    setNoteError(null)
    startNoteTransition(async () => {
      try {
        await addNote(companyId, content)
        if (textareaRef.current) textareaRef.current.value = ''
        router.refresh()
      } catch (err) {
        setNoteError(err instanceof Error ? err.message : 'Failed to add note.')
      }
    })
  }

  const handleDeleteNote = (id: string) => {
    setDeletingId(id)
    startNoteTransition(async () => {
      try { await deleteNote(id); router.refresh() }
      catch { setNoteError('Failed to delete note.') }
      finally { setDeletingId(null) }
    })
  }

  const handleAddInteraction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setIntError(null)
    startIntTransition(async () => {
      try {
        await addInteraction(companyId, {
          interaction_type: (fd.get('interaction_type') as string) || null,
          summary:          (fd.get('summary')          as string)?.trim() || null,
          interaction_date: (fd.get('interaction_date') as string) || null,
          next_step:        (fd.get('next_step')        as string)?.trim() || null,
        })
        intFormRef.current?.reset()
        setShowIntForm(false)
        router.refresh()
      } catch (err) {
        setIntError(err instanceof Error ? err.message : 'Failed to log interaction.')
      }
    })
  }

  const sortedInteractions = [...interactions].sort((a, b) => {
    if (!a.interaction_date && !b.interaction_date) return 0
    if (!a.interaction_date) return 1
    if (!b.interaction_date) return -1
    return b.interaction_date.localeCompare(a.interaction_date)
  })

  return (
    <div className="divide-y divide-gray-100">
      {/* Notes section */}
      <div>
        <form onSubmit={handleAddNote} className="px-5 pt-4 pb-3 border-b border-gray-100">
          <textarea ref={textareaRef} rows={3}
            placeholder="Add a note — research findings, thesis, meeting takeaways…"
            className={textareaCls} disabled={notePending} />
          <div className="flex items-center justify-between mt-2">
            <FormError message={noteError} />
            <button type="submit" disabled={notePending}
              className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shadow-sm">
              {notePending && <Loader2 size={11} className="animate-spin" />}Add Note
            </button>
          </div>
        </form>

        {notes.length === 0
          ? <div className="px-5 py-6 text-sm text-gray-400">No notes yet.</div>
          : <div className="divide-y divide-gray-100">
              {notes.map(n => (
                <div key={n.id} className="px-5 py-4 group flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {new Date(n.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <DeleteButton onDelete={() => handleDeleteNote(n.id)} isDeleting={deletingId === n.id} />
                </div>
              ))}
            </div>
        }
      </div>

      {/* Interactions section */}
      <div>
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Interactions</p>
          <AddButton onClick={() => { setShowIntForm(true); setIntError(null) }} label="Log Interaction" />
        </div>

        {showIntForm && (
          <form ref={intFormRef} onSubmit={handleAddInteraction}
            className="px-5 py-4 bg-gray-50/60 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div>
                <Label htmlFor="i-type">Type</Label>
                <div className="relative">
                  <select id="i-type" name="interaction_type" className={selectCls} style={selectStyle} defaultValue="">
                    <option value="">Select type…</option>
                    <option value="email">Email</option>
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="intro">Intro</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="i-date">Date</Label>
                <input id="i-date" name="interaction_date" type="date" className={inputCls} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="i-summary">Summary</Label>
                <textarea id="i-summary" name="summary" rows={3}
                  placeholder="What was discussed? Key takeaways…" className={textareaCls} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="i-next">Next Step</Label>
                <input id="i-next" name="next_step" type="text"
                  placeholder="Follow up with deck by Friday…" className={inputCls} />
              </div>
            </div>
            <FormError message={intError} />
            <FormActions onCancel={() => { setShowIntForm(false); setIntError(null); intFormRef.current?.reset() }}
              isPending={intPending} label="Log Interaction" />
          </form>
        )}

        {sortedInteractions.length === 0 && !showIntForm
          ? <div className="px-5 py-6 text-sm text-gray-400">No interactions logged yet.</div>
          : <div className="divide-y divide-gray-100">
              {sortedInteractions.map(i => (
                <div key={i.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {i.interaction_type && (
                      <Badge variant="gray">{interactionTypeLabel[i.interaction_type] ?? i.interaction_type}</Badge>
                    )}
                    {i.interaction_date && <span className="text-xs text-gray-400">{i.interaction_date}</span>}
                  </div>
                  {i.summary && <p className="text-sm text-gray-700 leading-relaxed">{i.summary}</p>}
                  {i.next_step && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <ChevronRight size={12} className="text-gray-400 shrink-0" />
                      <p className="text-xs text-gray-500">{i.next_step}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Stat cell (shared) ────────────────────────────────────────────────────────

function StatCell({ label, value, sub, subColor }: {
  label: string; value: string; sub?: string; subColor?: 'green' | 'red'
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      {sub && (
        <p className={`text-xs font-medium mt-0.5 ${
          subColor === 'green' ? 'text-emerald-600' : subColor === 'red' ? 'text-red-500' : 'text-gray-400'
        }`}>{sub}</p>
      )}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

interface Props {
  company: CompanyWithRelations
  activeTab: string
}

export default function CompanyPage({ company, activeTab }: Props) {
  const websiteHref = company.website
    ? (company.website.startsWith('http') ? company.website : `https://${company.website}`)
    : null
  const lhref = linkedinHref(company.linkedin_url)

  return (
    <div>
      {/* ── Company header ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 mb-0 rounded-b-none border-b-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            {/* Logo */}
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              domain={company.website}
              size={48}
              shape="square"
              className="border border-gray-100"
            />

            {/* Name + meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
                {company.stage  && <StageBadge  stage={company.stage}   />}
                {company.status && <StatusBadge status={company.status} />}
                {company.customer_type && <Badge variant="blue">{company.customer_type}</Badge>}
                {company.signal_score != null && <SignalBadge score={company.signal_score} />}
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
                {company.founded_year && (
                  <span>Founded {company.founded_year}</span>
                )}
                {(company.city || company.country) && (
                  <span>{[company.city, company.country].filter(Boolean).join(', ')}</span>
                )}
                {company.sector && <span>{company.sector}</span>}
                {websiteHref && (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors">
                    <ExternalLink size={10} />
                    {company.website!.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                )}
                {lhref && (
                  <a href={lhref} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors">
                    <ExternalLink size={10} />LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <EnrichButton companyId={company.id} website={company.website} />
            <Link href={`/companies/${company.id}/edit`}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm">
              <Pencil size={13} />Edit
            </Link>
            <DeleteCompanyButton companyId={company.id} companyName={company.name} />
          </div>
        </div>
      </div>

      {/* ── Tab navigation ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 border-t-gray-100 shadow-sm flex gap-0 overflow-x-auto">
        {TABS.map(tab => (
          <Link
            key={tab.id}
            href={`/companies/${company.id}?tab=${tab.id}`}
            className={[
              'flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative',
              activeTab === tab.id
                ? 'text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {tab.label}
            {tab.id === 'team' && company.people && company.people.length > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold tabular-nums bg-gray-100 text-gray-500 rounded px-1 py-px">
                {company.people.length}
              </span>
            )}
            {tab.id === 'signals' && company.signals && company.signals.length > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold tabular-nums bg-gray-100 text-gray-500 rounded px-1 py-px">
                {company.signals.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm min-h-[480px]">
        {activeTab === 'overview'  && <OverviewTab  company={company} />}
        {activeTab === 'team'      && <TeamTab      company={company} />}
        {activeTab === 'funding'   && <FundingTab   company={company} />}
        {activeTab === 'traction'  && <TractionTab  company={company} />}
        {activeTab === 'signals'   && <SignalsTab   companyId={company.id} signals={company.signals ?? []} />}
        {activeTab === 'notes'     && <NotesTab     companyId={company.id} notes={company.notes ?? []} interactions={company.interactions ?? []} />}
      </div>
    </div>
  )
}
