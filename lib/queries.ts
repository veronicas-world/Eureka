import { createServerSupabaseClient } from './supabase-server'

// ── Row types ────────────────────────────────────────────────────────────────

export type CompanyRow = {
  id: string
  name: string
  website: string | null
  linkedin_url: string | null
  description: string | null
  sector: string | null
  subsector: string | null
  stage: string | null
  country: string | null
  city: string | null
  founded_year: number | null
  employee_count: number | null
  employee_count_source: string | null
  total_funding_usd: number | null
  last_funding_date: string | null
  last_funding_round: string | null
  last_funding_amount_usd: number | null
  investors: string[] | null
  status: string | null
  signal_score: number | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export type SignalRow = {
  id: string
  company_id: string
  signal_type: string | null
  signal_source: string | null
  headline: string | null
  detail: string | null
  signal_date: string | null
  strength: string | null
  url: string | null
  created_at: string
  companies?: { name: string } | null
}

export type NoteRow = {
  id: string
  company_id: string
  content: string
  created_at: string
  updated_at: string
}

export type PersonRow = {
  id: string
  company_id: string
  name: string
  title: string | null
  linkedin_url: string | null
  email: string | null
  is_founder: boolean
  notes: string | null
  profile_picture_url: string | null
  harmonic_urn: string | null
  created_at: string
}

export type InteractionRow = {
  id: string
  company_id: string
  interaction_type: string | null
  summary: string | null
  interaction_date: string | null
  next_step: string | null
  created_at: string
}

export type CompanyUrlRow = {
  id: string
  company_id: string
  label: string | null
  url: string
  created_at: string
}

export type CompanyWithRelations = CompanyRow & {
  signals: SignalRow[]
  notes: NoteRow[]
  people: PersonRow[]
  interactions: InteractionRow[]
  company_urls: CompanyUrlRow[]
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getCompanies(): Promise<CompanyRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getCompanies]', error.message)
    return []
  }
  return data ?? []
}

export async function getCompanyById(id: string): Promise<CompanyWithRelations | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      signals ( * ),
      notes ( * ),
      people ( * ),
      interactions ( * ),
      company_urls ( * )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getCompanyById]', error.message)
    return null
  }
  return data as CompanyWithRelations
}

export async function getSignals(): Promise<SignalRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('signals')
    .select(`
      *,
      companies ( name )
    `)
    .order('signal_date', { ascending: false })

  if (error) {
    console.error('[getSignals]', error.message)
    return []
  }
  return data ?? []
}

export async function getAllSignals(): Promise<SignalRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('signals')
    .select(`
      *,
      companies ( name )
    `)
    .order('signal_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllSignals]', error.message)
    return []
  }
  return data ?? []
}
