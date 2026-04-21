'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Trash2, Loader2 } from 'lucide-react'
import { updateCompany, addNote, deleteNote } from '@/app/actions/companies'
import type { CompanyWithRelations, NoteRow } from '@/lib/queries'

// ── Primitives ────────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
    >
      {pending ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save Changes'}
    </button>
  )
}

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</h2>
      <div className="mt-2 h-px bg-gray-100" />
    </div>
  )
}

const inputCls =
  'w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-md ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 ' +
  'focus:border-transparent transition-shadow'

const selectCls =
  'w-full h-9 pl-3 pr-8 text-sm bg-white border border-gray-200 rounded-md ' +
  'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ' +
  'appearance-none cursor-pointer'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 10px center' as const,
}

// ── URL entry type ────────────────────────────────────────────────────────────

type UrlEntry = {
  key: number
  defaultLabel: string
  defaultHref: string
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  company: CompanyWithRelations
}

export default function EditCompanyClient({ company }: Props) {
  // Bind updateCompany to this company's id so useFormState gets (prevState, formData)
  const updateCompanyById = updateCompany.bind(null, company.id)
  const [state, formAction] = useFormState(updateCompanyById, null)

  // URL list — uncontrolled inputs, just track which rows are visible
  const nextKey = useRef(company.company_urls?.length ?? 0)
  const [urlEntries, setUrlEntries] = useState<UrlEntry[]>(() =>
    (company.company_urls ?? []).map((u, i) => ({
      key: i,
      defaultLabel: u.label ?? '',
      defaultHref: u.url,
    }))
  )

  const addUrlRow = () => {
    setUrlEntries((prev) => [
      ...prev,
      { key: nextKey.current++, defaultLabel: '', defaultHref: '' },
    ])
  }

  const removeUrlRow = (key: number) => {
    setUrlEntries((prev) => prev.filter((e) => e.key !== key))
  }

  // Notes — managed optimistically so form state is never lost on refresh
  const [notesList, setNotesList] = useState<NoteRow[]>(company.notes ?? [])
  const [notesPending, startNoteTransition] = useTransition()
  const [notesError, setNotesError] = useState<string | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)

  const handleAddNote = () => {
    const content = noteTextareaRef.current?.value?.trim()
    if (!content) return
    setNotesError(null)
    startNoteTransition(async () => {
      try {
        await addNote(company.id, content)
        // Optimistically add to list (no real id until page is reloaded)
        setNotesList((prev) => [
          ...prev,
          {
            id: `optimistic-${Date.now()}`,
            company_id: company.id,
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        if (noteTextareaRef.current) noteTextareaRef.current.value = ''
      } catch (err) {
        setNotesError(err instanceof Error ? err.message : 'Failed to add note.')
      }
    })
  }

  const handleDeleteNote = (id: string) => {
    if (id.startsWith('optimistic-')) return // can't delete unsaved note by id
    setDeletingNoteId(id)
    startNoteTransition(async () => {
      try {
        await deleteNote(id)
        setNotesList((prev) => prev.filter((n) => n.id !== id))
      } catch (err) {
        setNotesError(err instanceof Error ? err.message : 'Failed to delete note.')
      } finally {
        setDeletingNoteId(null)
      }
    })
  }

  const tagsValue = (company.tags ?? []).join(', ')

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href={`/companies/${company.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to {company.name}
        </Link>
      </div>

      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Edit Company</h1>
        <p className="text-sm text-gray-500 mt-1">Update details for {company.name}.</p>
      </div>

      {/* Error banner */}
      {state?.error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-8">
        {/* ── Company Information ──────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Company Information</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="name" required>Company Name</Label>
              <input
                id="name" name="name" type="text" required
                defaultValue={company.name}
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <input
                id="website" name="website" type="text"
                defaultValue={company.website ?? ''}
                placeholder="synthia.ai"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <input
                id="linkedin_url" name="linkedin_url" type="text"
                defaultValue={company.linkedin_url ?? ''}
                placeholder="linkedin.com/company/…"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description" name="description" rows={3}
                defaultValue={company.description ?? ''}
                placeholder="What does this company do?"
                className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── Classification ───────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Classification</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="sector">Sector</Label>
              <input
                id="sector" name="sector" type="text"
                defaultValue={company.sector ?? ''}
                placeholder="e.g. Artificial Intelligence"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="subsector">Subsector</Label>
              <input
                id="subsector" name="subsector" type="text"
                defaultValue={company.subsector ?? ''}
                placeholder="e.g. Generative AI"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <div className="relative">
                <select
                  id="stage" name="stage"
                  className={selectCls} style={selectStyle}
                  defaultValue={company.stage ?? ''}
                >
                  <option value="">Select stage…</option>
                  <option value="pre-seed">Pre-Seed</option>
                  <option value="seed">Seed</option>
                  <option value="series-a">Series A</option>
                  <option value="series-b">Series B</option>
                  <option value="growth">Growth</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <div className="relative">
                <select
                  id="status" name="status"
                  className={selectCls} style={selectStyle}
                  defaultValue={company.status ?? 'tracking'}
                >
                  <option value="tracking">Tracking</option>
                  <option value="outreached">Outreached</option>
                  <option value="meeting booked">Meeting Booked</option>
                  <option value="passed">Passed</option>
                  <option value="portfolio">Portfolio</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="signal_score">Signal Score (0–100)</Label>
              <input
                id="signal_score" name="signal_score" type="number" min={0} max={100}
                defaultValue={company.signal_score ?? ''}
                placeholder="e.g. 78"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <input
                id="tags" name="tags" type="text"
                defaultValue={tagsValue}
                placeholder="AI, B2B SaaS, Deep Tech (comma-separated)"
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* ── Location & Team ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Location & Team</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="country">Country</Label>
              <input
                id="country" name="country" type="text"
                defaultValue={company.country ?? ''}
                placeholder="e.g. USA"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <input
                id="city" name="city" type="text"
                defaultValue={company.city ?? ''}
                placeholder="e.g. San Francisco"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="founded_year">Founded Year</Label>
              <input
                id="founded_year" name="founded_year" type="number" min={1900} max={2099}
                defaultValue={company.founded_year ?? ''}
                placeholder="e.g. 2022"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="employee_count">Employee Count</Label>
              <input
                id="employee_count" name="employee_count" type="number" min={0}
                defaultValue={company.employee_count ?? ''}
                placeholder="e.g. 18"
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* ── Funding ──────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Funding</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="total_funding_usd">Total Funding (USD)</Label>
              <input
                id="total_funding_usd" name="total_funding_usd" type="number" min={0}
                defaultValue={company.total_funding_usd ?? ''}
                placeholder="e.g. 2500000"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="last_funding_round">Last Funding Round</Label>
              <div className="relative">
                <select
                  id="last_funding_round" name="last_funding_round"
                  className={selectCls} style={selectStyle}
                  defaultValue={company.last_funding_round ?? ''}
                >
                  <option value="">Select round…</option>
                  <option value="pre-seed">Pre-Seed</option>
                  <option value="seed">Seed</option>
                  <option value="series-a">Series A</option>
                  <option value="series-b">Series B</option>
                  <option value="series-c">Series C</option>
                  <option value="growth">Growth</option>
                  <option value="venture">Venture</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="last_funding_amount_usd">Last Round Amount (USD)</Label>
              <input
                id="last_funding_amount_usd" name="last_funding_amount_usd" type="number" min={0}
                defaultValue={company.last_funding_amount_usd ?? ''}
                placeholder="e.g. 2500000"
                className={inputCls}
              />
            </div>
            <div>
              <Label htmlFor="last_funding_date">Last Funding Date</Label>
              <input
                id="last_funding_date" name="last_funding_date" type="date"
                defaultValue={company.last_funding_date ?? ''}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* ── Notes ────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Notes</SectionHeader>

          {/* Existing notes */}
          {notesList.length > 0 && (
            <div className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              {notesList.map((n) => {
                const isOptimistic = n.id.startsWith('optimistic-')
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 group ${isOptimistic ? 'opacity-60' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {n.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {isOptimistic
                          ? 'Just added'
                          : new Date(n.updated_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                      </p>
                    </div>
                    {!isOptimistic && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n.id)}
                        disabled={deletingNoteId === n.id || notesPending}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 shrink-0 mt-0.5"
                      >
                        {deletingNoteId === n.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add new note */}
          <div>
            <Label htmlFor="note-new">Add a note</Label>
            <textarea
              ref={noteTextareaRef}
              id="note-new"
              rows={3}
              placeholder="Research notes, investment thesis, meeting takeaways…"
              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              disabled={notesPending}
            />
            {notesError && <p className="text-xs text-red-600 mt-1.5">{notesError}</p>}
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleAddNote}
                disabled={notesPending}
                className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-40"
              >
                {notesPending && <Loader2 size={11} className="animate-spin" />}
                Save Note
              </button>
            </div>
          </div>
        </section>

        {/* ── Relevant URLs ─────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Relevant URLs</SectionHeader>

          {urlEntries.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">No URLs saved for this company.</p>
          ) : (
            <div className="space-y-2.5 mb-4">
              {urlEntries.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2">
                  <input
                    name="url_label"
                    type="text"
                    placeholder="Label (e.g. Pitch Deck)"
                    defaultValue={entry.defaultLabel}
                    className="h-9 w-36 shrink-0 px-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <input
                    name="url_href"
                    type="url"
                    placeholder="https://…"
                    defaultValue={entry.defaultHref}
                    className="flex-1 h-9 px-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeUrlRow(entry.key)}
                    className="h-9 w-9 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addUrlRow}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Plus size={13} />
            Add URL
          </button>
        </section>

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <Link
            href={`/companies/${company.id}`}
            className="inline-flex items-center h-9 px-4 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  )
}
