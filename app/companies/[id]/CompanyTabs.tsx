'use client'

import { useTransition, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, StickyNote, Users, MessageSquare, Link2,
  ExternalLink, ChevronRight, Plus, Trash2, Loader2,
} from 'lucide-react'
import type { SignalRow, NoteRow, PersonRow, InteractionRow, CompanyUrlRow } from '@/lib/queries'
import {
  addNote, deleteNote,
  addPerson, deletePerson,
  addInteraction,
  addSignal,
} from '@/app/actions/companies'
import { Badge } from '@/components/ui/Badge'

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

// ── Shared helpers ────────────────────────────────────────────────────────────

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
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      <Plus size={13} />
      {label}
    </button>
  )
}

function FormActions({
  onCancel,
  isPending,
  label,
}: {
  onCancel: () => void
  isPending: boolean
  label: string
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="h-7 px-3 text-xs font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shadow-sm"
      >
        {isPending && <Loader2 size={11} className="animate-spin" />}
        {label}
      </button>
    </div>
  )
}

function DeleteButton({
  onDelete,
  isDeleting,
}: {
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isDeleting}
      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 disabled:opacity-40"
      aria-label="Delete"
    >
      {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
    </button>
  )
}

// ── Tab types / config ────────────────────────────────────────────────────────

type Tab = 'signals' | 'notes' | 'people' | 'interactions' | 'urls'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'signals',      label: 'Signals',      icon: Zap           },
  { id: 'notes',        label: 'Notes',        icon: StickyNote    },
  { id: 'people',       label: 'People',       icon: Users         },
  { id: 'interactions', label: 'Interactions', icon: MessageSquare },
  { id: 'urls',         label: 'URLs',         icon: Link2         },
]

// ── Root component ────────────────────────────────────────────────────────────

interface Props {
  companyId:    string
  signals:      SignalRow[]
  notes:        NoteRow[]
  people:       PersonRow[]
  interactions: InteractionRow[]
  urls:         CompanyUrlRow[]
}

export default function CompanyTabs({
  companyId, signals, notes, people, interactions, urls,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('signals')

  const counts: Record<Tab, number> = {
    signals:      signals.length,
    notes:        notes.length,
    people:       people.length,
    interactions: interactions.length,
    urls:         urls.length,
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 px-1 pt-1 overflow-x-auto">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={[
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap',
              activeTab === tabId
                ? 'text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gray-900 after:rounded-t'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
            {counts[tabId] > 0 && (
              <span className="ml-0.5 text-[10px] font-semibold tabular-nums bg-gray-100 text-gray-600 rounded px-1 py-px">
                {counts[tabId]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="min-h-[480px]">
        {activeTab === 'signals'      && <SignalsTab      companyId={companyId} signals={signals}           />}
        {activeTab === 'notes'        && <NotesTab        companyId={companyId} notes={notes}               />}
        {activeTab === 'people'       && <PeopleTab       companyId={companyId} people={people}             />}
        {activeTab === 'interactions' && <InteractionsTab companyId={companyId} interactions={interactions} />}
        {activeTab === 'urls'         && <UrlsTab         urls={urls}                                       />}
      </div>
    </div>
  )
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ companyId, notes }: { companyId: string; notes: NoteRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const content = textareaRef.current?.value ?? ''
    if (!content.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await addNote(companyId, content)
        if (textareaRef.current) textareaRef.current.value = ''
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add note.')
      }
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteNote(id)
        router.refresh()
      } catch {
        setError('Failed to delete note.')
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div>
      {/* Compose area */}
      <form onSubmit={handleAdd} className="px-5 pt-4 pb-3 border-b border-gray-100">
        <textarea
          ref={textareaRef}
          rows={3}
          placeholder="Add a note — research findings, thesis, meeting takeaways…"
          className={textareaCls}
          disabled={isPending}
        />
        <div className="flex items-center justify-between mt-2">
          <FormError message={error} />
          <button
            type="submit"
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shadow-sm"
          >
            {isPending && <Loader2 size={11} className="animate-spin" />}
            Add Note
          </button>
        </div>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyList message="No notes yet. Add your first note above." />
      ) : (
        <div className="divide-y divide-gray-100">
          {notes.map((n) => (
            <div key={n.id} className="px-5 py-4 group flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {new Date(n.updated_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <DeleteButton
                onDelete={() => handleDelete(n.id)}
                isDeleting={deletingId === n.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── People tab ────────────────────────────────────────────────────────────────

function PeopleTab({ companyId, people }: { companyId: string; people: PersonRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
        if (founderRef.current) founderRef.current.checked = false
        setShowForm(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add person.')
      }
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deletePerson(id)
        router.refresh()
      } catch {
        setError('Failed to delete person.')
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <AddButton onClick={() => { setShowForm(true); setError(null) }} label="Add Person" />
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleAdd}
          className="px-5 py-4 bg-gray-50/60 border-b border-gray-200"
        >
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
              <Label htmlFor="p-notes">Notes</Label>
              <input id="p-notes" name="notes" type="text" placeholder="Met at YC Demo Day…" className={inputCls} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                ref={founderRef}
                id="p-founder"
                name="is_founder"
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
              />
              <label htmlFor="p-founder" className="text-sm text-gray-700 cursor-pointer select-none">
                Is a founder
              </label>
            </div>
          </div>
          <FormError message={error} />
          <FormActions
            onCancel={() => { setShowForm(false); setError(null); formRef.current?.reset() }}
            isPending={isPending}
            label="Add Person"
          />
        </form>
      )}

      {/* People list */}
      {people.length === 0 && !showForm ? (
        <EmptyList message="No people added yet." />
      ) : (
        <div className="divide-y divide-gray-100">
          {people.map((p) => (
            <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-gray-600">{p.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    {p.is_founder && <Badge variant="purple">Founder</Badge>}
                  </div>
                  {p.title && <p className="text-xs text-gray-500 mt-0.5">{p.title}</p>}
                  {p.email && <p className="text-xs text-gray-400 mt-0.5">{p.email}</p>}
                  {p.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{p.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.linkedin_url && (
                  <a
                    href={p.linkedin_url.startsWith('http') ? p.linkedin_url : `https://${p.linkedin_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
                <DeleteButton
                  onDelete={() => handleDelete(p.id)}
                  isDeleting={deletingId === p.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Interactions tab ──────────────────────────────────────────────────────────

const interactionTypeLabel: Record<string, string> = {
  email: 'Email', call: 'Call', meeting: 'Meeting', linkedin: 'LinkedIn', intro: 'Intro',
}

function InteractionsTab({
  companyId,
  interactions,
}: {
  companyId: string
  interactions: InteractionRow[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await addInteraction(companyId, {
          interaction_type: (fd.get('interaction_type') as string) || null,
          summary:          (fd.get('summary')          as string)?.trim() || null,
          interaction_date: (fd.get('interaction_date') as string) || null,
          next_step:        (fd.get('next_step')        as string)?.trim() || null,
        })
        formRef.current?.reset()
        setShowForm(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to log interaction.')
      }
    })
  }

  const sorted = [...interactions].sort((a, b) => {
    if (!a.interaction_date && !b.interaction_date) return 0
    if (!a.interaction_date) return 1
    if (!b.interaction_date) return -1
    return b.interaction_date.localeCompare(a.interaction_date)
  })

  return (
    <div>
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-gray-100">
        <AddButton onClick={() => { setShowForm(true); setError(null) }} label="Log Interaction" />
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleAdd}
          className="px-5 py-4 bg-gray-50/60 border-b border-gray-200"
        >
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
              <textarea
                id="i-summary"
                name="summary"
                rows={3}
                placeholder="What was discussed? Key takeaways…"
                className={textareaCls}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="i-next">Next Step</Label>
              <input id="i-next" name="next_step" type="text" placeholder="Follow up with deck by Friday…" className={inputCls} />
            </div>
          </div>
          <FormError message={error} />
          <FormActions
            onCancel={() => { setShowForm(false); setError(null); formRef.current?.reset() }}
            isPending={isPending}
            label="Log Interaction"
          />
        </form>
      )}

      {/* Timeline */}
      {sorted.length === 0 && !showForm ? (
        <EmptyList message="No interactions logged yet." />
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map((i) => (
            <div key={i.id} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {i.interaction_type && (
                  <Badge variant="gray">
                    {interactionTypeLabel[i.interaction_type] ?? i.interaction_type}
                  </Badge>
                )}
                {i.interaction_date && (
                  <span className="text-xs text-gray-400">{i.interaction_date}</span>
                )}
              </div>
              {i.summary && (
                <p className="text-sm text-gray-700 leading-relaxed">{i.summary}</p>
              )}
              {i.next_step && (
                <div className="flex items-center gap-1.5 mt-2">
                  <ChevronRight size={12} className="text-gray-400 shrink-0" />
                  <p className="text-xs text-gray-500">{i.next_step}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Signals tab ───────────────────────────────────────────────────────────────

const strengthVariant: Record<string, 'green' | 'yellow' | 'red'> = {
  strong: 'green', moderate: 'yellow', weak: 'red',
}

const signalTypeVariant: Record<string, 'blue' | 'purple' | 'amber' | 'green' | 'gray'> = {
  funding: 'green', hiring_spike: 'blue', news: 'gray', founder_move: 'purple', product_launch: 'amber',
}

function SignalsTab({ companyId, signals }: { companyId: string; signals: SignalRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
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
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-gray-100">
        <AddButton onClick={() => { setShowForm(true); setError(null) }} label="Add Signal" />
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleAdd}
          className="px-5 py-4 bg-gray-50/60 border-b border-gray-200"
        >
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
              <textarea
                id="s-detail"
                name="detail"
                rows={2}
                placeholder="Additional context or notes…"
                className={textareaCls}
              />
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
          <FormActions
            onCancel={() => { setShowForm(false); setError(null); formRef.current?.reset() }}
            isPending={isPending}
            label="Add Signal"
          />
        </form>
      )}

      {/* Signals list */}
      {signals.length === 0 && !showForm ? (
        <EmptyList message="No signals tracked yet." />
      ) : (
        <div className="divide-y divide-gray-100">
          {signals.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {s.signal_type && (
                      <Badge variant={signalTypeVariant[s.signal_type] ?? 'gray'}>
                        {s.signal_type.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {s.strength && (
                      <Badge variant={strengthVariant[s.strength] ?? 'gray'}>{s.strength}</Badge>
                    )}
                    {s.signal_source && (
                      <span className="text-xs text-gray-400">{s.signal_source}</span>
                    )}
                  </div>
                  {s.headline && (
                    <p className="text-sm font-medium text-gray-900">{s.headline}</p>
                  )}
                  {s.detail && (
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{s.detail}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.signal_date && (
                    <span className="text-xs text-gray-400">{s.signal_date}</span>
                  )}
                  {s.url && (
                    <a
                      href={s.url.startsWith('http') ? s.url : `https://${s.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── URLs tab (read-only — added via Add Company form) ─────────────────────────

function UrlsTab({ urls }: { urls: CompanyUrlRow[] }) {
  if (urls.length === 0) {
    return <EmptyList message="No URLs saved. Add them when editing the company." />
  }
  return (
    <div className="divide-y divide-gray-100">
      {urls.map((u) => (
        <a
          key={u.id}
          href={u.url.startsWith('http') ? u.url : `https://${u.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
              <Link2 size={13} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              {u.label && (
                <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700">{u.label}</p>
              )}
              <p className={`truncate ${u.label ? 'text-xs text-gray-400' : 'text-sm text-gray-700'}`}>
                {u.url}
              </p>
            </div>
          </div>
          <ExternalLink size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
        </a>
      ))}
    </div>
  )
}

// ── Shared empty list state ───────────────────────────────────────────────────

function EmptyList({ message }: { message: string }) {
  return (
    <div className="px-5 py-12 flex items-center justify-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}
