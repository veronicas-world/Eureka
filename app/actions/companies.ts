'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type ActionState = { error: string } | null

function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string | null)?.trim()
  return v || null
}

function num(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string | null)?.trim()
  if (!v) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// ── Add Company ───────────────────────────────────────────────────────────────

export async function addCompany(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = str(formData, 'name')
  if (!name) return { error: 'Company name is required.' }

  const supabase = await createServerSupabaseClient()

  const tagsRaw = str(formData, 'tags')
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : null

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name,
      website:                 str(formData, 'website'),
      linkedin_url:            str(formData, 'linkedin_url'),
      description:             str(formData, 'description'),
      sector:                  str(formData, 'sector'),
      subsector:               str(formData, 'subsector'),
      stage:                   str(formData, 'stage'),
      country:                 str(formData, 'country'),
      city:                    str(formData, 'city'),
      founded_year:            num(formData, 'founded_year'),
      employee_count:          num(formData, 'employee_count'),
      total_funding_usd:       num(formData, 'total_funding_usd'),
      last_funding_round:      str(formData, 'last_funding_round'),
      last_funding_amount_usd: num(formData, 'last_funding_amount_usd'),
      last_funding_date:       str(formData, 'last_funding_date'),
      status:                  str(formData, 'status') ?? 'tracking',
      signal_score:            num(formData, 'signal_score'),
      tags,
    })
    .select('id')
    .single()

  if (companyError) return { error: companyError.message }

  const companyId = company.id

  const notes = str(formData, 'notes')
  if (notes) {
    const { error: notesError } = await supabase
      .from('notes')
      .insert({ company_id: companyId, content: notes })
    if (notesError) console.error('[addCompany notes]', notesError.message)
  }

  const urlLabels = formData.getAll('url_label') as string[]
  const urlHrefs  = formData.getAll('url_href')  as string[]

  const urlRows = urlHrefs
    .map((href, i) => ({ href: href.trim(), label: (urlLabels[i] ?? '').trim() }))
    .filter((r) => r.href)
    .map((r) => ({ company_id: companyId, url: r.href, label: r.label || null }))

  if (urlRows.length > 0) {
    const { error: urlError } = await supabase.from('company_urls').insert(urlRows)
    if (urlError) console.error('[addCompany urls]', urlError.message)
  }

  redirect(`/companies/${companyId}`)
}

// ── Update Company ────────────────────────────────────────────────────────────

export async function updateCompany(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = str(formData, 'name')
  if (!name) return { error: 'Company name is required.' }

  const supabase = await createServerSupabaseClient()

  const tagsRaw = str(formData, 'tags')
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : null

  const { error: updateError } = await supabase
    .from('companies')
    .update({
      name,
      website:                 str(formData, 'website'),
      linkedin_url:            str(formData, 'linkedin_url'),
      description:             str(formData, 'description'),
      sector:                  str(formData, 'sector'),
      subsector:               str(formData, 'subsector'),
      stage:                   str(formData, 'stage'),
      country:                 str(formData, 'country'),
      city:                    str(formData, 'city'),
      founded_year:            num(formData, 'founded_year'),
      employee_count:          num(formData, 'employee_count'),
      total_funding_usd:       num(formData, 'total_funding_usd'),
      last_funding_round:      str(formData, 'last_funding_round'),
      last_funding_amount_usd: num(formData, 'last_funding_amount_usd'),
      last_funding_date:       str(formData, 'last_funding_date'),
      status:                  str(formData, 'status') ?? 'tracking',
      signal_score:            num(formData, 'signal_score'),
      tags,
    })
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  // Replace all URLs: delete existing, insert current set
  await supabase.from('company_urls').delete().eq('company_id', id)

  const urlLabels = formData.getAll('url_label') as string[]
  const urlHrefs  = formData.getAll('url_href')  as string[]

  const urlRows = urlHrefs
    .map((href, i) => ({ href: href.trim(), label: (urlLabels[i] ?? '').trim() }))
    .filter((r) => r.href)
    .map((r) => ({ company_id: id, url: r.href, label: r.label || null }))

  if (urlRows.length > 0) {
    const { error: urlError } = await supabase.from('company_urls').insert(urlRows)
    if (urlError) console.error('[updateCompany urls]', urlError.message)
  }

  // Insert new note if provided
  const newNote = str(formData, 'new_note')
  if (newNote) {
    const { error: noteError } = await supabase
      .from('notes')
      .insert({ company_id: id, content: newNote })
    if (noteError) console.error('[updateCompany note]', noteError.message)
  }

  redirect(`/companies/${id}`)
}

// ── Delete URL ────────────────────────────────────────────────────────────────

export async function deleteUrl(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('company_urls').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Update URLs (delete-all + insert) ─────────────────────────────────────────

export async function updateUrls(
  companyId: string,
  urls: { label: string; url: string }[]
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error: deleteError } = await supabase
    .from('company_urls')
    .delete()
    .eq('company_id', companyId)
  if (deleteError) throw new Error(deleteError.message)

  const rows = urls
    .filter((u) => u.url.trim())
    .map((u) => ({ company_id: companyId, url: u.url.trim(), label: u.label.trim() || null }))

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('company_urls').insert(rows)
    if (insertError) throw new Error(insertError.message)
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function addNote(companyId: string, content: string): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Note content is required.')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('notes')
    .insert({ company_id: companyId, content: trimmed })
  if (error) throw new Error(error.message)
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── People ────────────────────────────────────────────────────────────────────

export async function addPerson(
  companyId: string,
  data: {
    name: string
    title: string | null
    linkedin_url: string | null
    email: string | null
    is_founder: boolean
    notes: string | null
  }
): Promise<void> {
  if (!data.name.trim()) throw new Error('Name is required.')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('people')
    .insert({ company_id: companyId, ...data, name: data.name.trim() })
  if (error) throw new Error(error.message)
}

export async function deletePerson(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Interactions ──────────────────────────────────────────────────────────────

export async function addInteraction(
  companyId: string,
  data: {
    interaction_type: string | null
    summary: string | null
    interaction_date: string | null
    next_step: string | null
  }
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interactions')
    .insert({ company_id: companyId, ...data })
  if (error) throw new Error(error.message)
}

// ── Signals ───────────────────────────────────────────────────────────────────

export async function addSignal(
  companyId: string,
  data: {
    signal_type: string | null
    signal_source: string | null
    headline: string | null
    detail: string | null
    signal_date: string | null
    strength: string | null
    url: string | null
  }
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('signals')
    .insert({ company_id: companyId, ...data })
  if (error) throw new Error(error.message)
}
