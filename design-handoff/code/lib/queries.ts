import { createServerSupabaseClient } from './supabase-server'

// ── Row types ────────────────────────────────────────────────────────────────

export type CompanyRow = {
  id: string
  name: string
  website: string | null
  linkedin_url: string | null
  description: string | null
  short_description: string | null
  sector: string | null
  subsector: string | null
  stage: string | null
  country: string | null
  city: string | null
  founded_year: number | null
  employee_count: number | null
  employee_count_source: string | null
  headcount_30d_growth: number | null
  headcount_90d_growth: number | null
  headcount_6m_growth: number | null
  total_funding_usd: number | null
  last_funding_date: string | null
  last_funding_round: string | null
  last_funding_amount_usd: number | null
  latest_valuation_usd: number | null
  funding_rounds_count: number | null
  investors: string[] | null
  status: string | null
  signal_score: number | null
  tags: string[] | null
  logo_url: string | null
  customer_type: string | null
  enrichment_status: string | null
  harmonic_id: number | null
  harmonic_urn: string | null
  last_enriched_at: string | null
  traction_metrics: unknown
  funding_rounds_data: unknown
  display_order: number | null
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
  prior_company: string | null
  prior_title: string | null
  education: string | null
  degree: string | null
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
    // User-curated order first (drag-and-drop on /database). Rows that
    // haven't been placed yet (display_order is null) fall to the bottom,
    // sorted by recency.
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at',    { ascending: false })

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
    .order('signal_date', { referencedTable: 'signals', ascending: false, nullsFirst: false })
    .single()

  if (error) {
    console.error('[getCompanyById]', error.message)
    return null
  }
  return data as CompanyWithRelations
}

/**
 * Find companies related to `companyId` by sector (and ideally subsector).
 * Strategy:
 *   1. If subsector is set, prefer same-subsector matches.
 *   2. Fill remaining slots with same-sector matches.
 *   3. Return at most `limit` companies, excluding the source company itself.
 */
export async function getRelatedCompanies(
  companyId: string,
  sector: string | null,
  subsector: string | null,
  limit = 6,
): Promise<CompanyRow[]> {
  if (!sector && !subsector) return []
  const supabase = await createServerSupabaseClient()

  const seen = new Set<string>()
  const out: CompanyRow[] = []

  // Pass 1: subsector match
  if (subsector) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('subsector', subsector)
      .neq('id', companyId)
      .order('signal_score', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (error) {
      console.error('[getRelatedCompanies subsector]', error.message)
    } else if (data) {
      for (const row of data) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          out.push(row)
          if (out.length >= limit) return out
        }
      }
    }
  }

  // Pass 2: sector match (minus anything already included)
  if (sector && out.length < limit) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('sector', sector)
      .neq('id', companyId)
      .order('signal_score', { ascending: false, nullsFirst: false })
      .limit(limit * 2) // pull extra so we have room after de-duping
    if (error) {
      console.error('[getRelatedCompanies sector]', error.message)
    } else if (data) {
      for (const row of data) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          out.push(row)
          if (out.length >= limit) break
        }
      }
    }
  }

  return out
}

// Filter out the noisy generic "enriched via Harmonic" pseudo-signal that
// older enrichment runs created. New runs no longer emit it (see
// app/api/enrich/route.ts), but existing rows are still in the DB.
const ENRICHED_NOISE_PATTERN = '%enriched via Harmonic%'

export async function getSignals(): Promise<SignalRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('signals')
    .select(`
      *,
      companies ( name )
    `)
    .not('headline', 'ilike', ENRICHED_NOISE_PATTERN)
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
    .not('headline', 'ilike', ENRICHED_NOISE_PATTERN)
    .order('signal_date', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('[getAllSignals]', error.message)
    return []
  }
  return data ?? []
}
