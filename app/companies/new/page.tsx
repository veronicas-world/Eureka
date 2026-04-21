'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { addCompany } from '@/app/actions/companies'

// ── Submit button (must be inside <form> to access useFormStatus) ────────────
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
    >
      {pending ? 'Saving…' : 'Add Company'}
    </button>
  )
}

// ── Field primitives ─────────────────────────────────────────────────────────
function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

const inputCls =
  'w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow'

const selectCls =
  'w-full h-9 pl-3 pr-8 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent appearance-none cursor-pointer'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 10px center' as const,
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</h2>
      <div className="mt-2 h-px bg-gray-100" />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NewCompanyPage() {
  const [state, formAction] = useFormState(addCompany, null)

  // Dynamic URL list
  const nextId = useRef(1)
  const [urlRows, setUrlRows] = useState<number[]>([])

  const addUrl = () => {
    setUrlRows((prev) => [...prev, nextId.current++])
  }
  const removeUrl = (id: number) => {
    setUrlRows((prev) => prev.filter((r) => r !== id))
  }

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/database"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Database
        </Link>
      </div>

      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Add Company</h1>
        <p className="text-sm text-gray-500 mt-1">Add a new startup to your sourcing database.</p>
      </div>

      {/* Error banner */}
      {state?.error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-8">
        {/* ── Company Information ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Company Information</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="name" required>Company Name</Label>
              <input id="name" name="name" type="text" required placeholder="e.g. Synthia AI" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <input id="website" name="website" type="text" placeholder="synthia.ai" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <input id="linkedin_url" name="linkedin_url" type="text" placeholder="linkedin.com/company/synthia-ai" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="What does this company do? What problem are they solving?"
                className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── Classification ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Classification</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="sector">Sector</Label>
              <input id="sector" name="sector" type="text" placeholder="e.g. Artificial Intelligence" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="subsector">Subsector</Label>
              <input id="subsector" name="subsector" type="text" placeholder="e.g. Generative AI" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <div className="relative">
                <select id="stage" name="stage" className={selectCls} style={selectStyle} defaultValue="">
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
                <select id="status" name="status" className={selectCls} style={selectStyle} defaultValue="tracking">
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
              <input id="signal_score" name="signal_score" type="number" min={0} max={100} placeholder="e.g. 78" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <input id="tags" name="tags" type="text" placeholder="AI, B2B SaaS, Deep Tech (comma-separated)" className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── Location & Team ─────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Location & Team</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="country">Country</Label>
              <input id="country" name="country" type="text" placeholder="e.g. USA" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <input id="city" name="city" type="text" placeholder="e.g. San Francisco" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="founded_year">Founded Year</Label>
              <input id="founded_year" name="founded_year" type="number" min={1900} max={2099} placeholder="e.g. 2022" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="employee_count">Employee Count</Label>
              <input id="employee_count" name="employee_count" type="number" min={0} placeholder="e.g. 18" className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── Funding ─────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Funding</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <Label htmlFor="total_funding_usd">Total Funding (USD)</Label>
              <input id="total_funding_usd" name="total_funding_usd" type="number" min={0} placeholder="e.g. 2500000" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="last_funding_round">Last Funding Round</Label>
              <div className="relative">
                <select id="last_funding_round" name="last_funding_round" className={selectCls} style={selectStyle} defaultValue="">
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
              <input id="last_funding_amount_usd" name="last_funding_amount_usd" type="number" min={0} placeholder="e.g. 2500000" className={inputCls} />
            </div>
            <div>
              <Label htmlFor="last_funding_date">Last Funding Date</Label>
              <input id="last_funding_date" name="last_funding_date" type="date" className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── Notes ───────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Notes</SectionHeader>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Initial research notes, investment thesis, why this company is interesting…"
            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
          />
        </section>

        {/* ── Relevant URLs ────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader>Relevant URLs</SectionHeader>

          {urlRows.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">
              No URLs added. Use this to track pitch decks, press coverage, product demos, and more.
            </p>
          ) : (
            <div className="space-y-2.5 mb-4">
              {urlRows.map((rowId) => (
                <div key={rowId} className="flex items-center gap-2">
                  <input
                    name="url_label"
                    type="text"
                    placeholder="Label (e.g. Pitch Deck)"
                    className="h-9 w-36 shrink-0 px-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <input
                    name="url_href"
                    type="url"
                    placeholder="https://…"
                    className="flex-1 h-9 px-3 text-sm bg-white border border-gray-200 rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeUrl(rowId)}
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
            onClick={addUrl}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Plus size={13} />
            Add URL
          </button>
        </section>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <Link
            href="/database"
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
