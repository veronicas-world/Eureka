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
  // Pigi Tier 0 — cached Harmonic payloads
  harmonic_raw: unknown
  similar_urns: unknown
  highlights: unknown
  // Pigi v1 — new typed columns
  web_traffic: number | null
  tags_v2: unknown
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
  // Pigi Tier 0 — raw Harmonic event object for ranking recon
  harmonic_raw: unknown
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
  // Pigi Tier 0 — cached Harmonic payloads
  harmonic_raw: unknown
  experience: unknown
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

// Columns needed for the /database list view.
// EXCLUDES the heavy JSONB blobs (harmonic_raw, similar_urns, highlights,
// traction_metrics, funding_rounds_data) — those can be 5MB+ per row for
// big companies like Anthropic and would blow past Supabase's 8s statement
// timeout once you have a handful of enriched companies. The detail page
// (getCompanyById) still loads them when you actually open a company.
const LIST_COLUMNS = `
  id, name, website, linkedin_url, description, short_description,
  sector, subsector, stage, country, city, founded_year,
  employee_count, employee_count_source,
  headcount_30d_growth, headcount_90d_growth, headcount_6m_growth,
  total_funding_usd, last_funding_date, last_funding_round,
  last_funding_amount_usd, latest_valuation_usd, funding_rounds_count,
  investors, status, signal_score, tags, logo_url, customer_type,
  enrichment_status, harmonic_id, harmonic_urn, last_enriched_at,
  display_order, web_traffic, tags_v2,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim()

export async function getCompanies(): Promise<CompanyRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('companies')
    .select(LIST_COLUMNS)
    // User-curated order first (drag-and-drop on /database). Rows that
    // haven't been placed yet (display_order is null) fall to the bottom,
    // sorted by recency.
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at',    { ascending: false })

  if (error) {
    console.error('[getCompanies]', error.message)
    return []
  }
  // Cast through unknown — the heavy JSONB fields will be undefined on these
  // rows but the CompanyRow type marks them as `unknown`, which accepts that.
  return (data ?? []) as unknown as CompanyRow[]
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

// ── Pigi v1 row types ────────────────────────────────────────────────────────

export type CompanySnapshotRow = {
  id:           string
  company_id:   string
  harmonic_urn: string | null
  captured_at:  string
  harmonic_raw: unknown
}

export type SavedSearchRow = {
  id:                   string
  harmonic_id:          string | null
  name:                 string | null
  query:                unknown
  filters:              unknown
  column_view_settings: unknown
  source:               'eureka' | 'harmonic' | null
  created_at:           string
  last_viewed_at:       string | null
}

export type ListFolderRow = {
  id:         string
  name:       string
  parent_id:  string | null
  created_at: string
}

export type ListRow = {
  id:             string
  folder_id:      string | null
  name:           string
  description:    string | null
  color:          string | null
  created_at:     string
  last_viewed_at: string | null
}

export type ListCompanyRow = {
  list_id:    string
  company_id: string
  added_at:   string
  position:   number | null
}

// ── Pigi Home ────────────────────────────────────────────────────────────────

export type PigiHomeData = {
  lastRunAt:         string | null   // most recent company_snapshots.captured_at
  recentDiffSignals: SignalRow[]     // signals from pigi_diff in the last 7 days
  totalCompanies:    number
  totalSnapshots:    number
}

/**
 * Fetches everything Pigi's home page needs in three small queries.
 * "Last run" is approximated by the most recent company_snapshots.captured_at —
 * since the deriver only writes new snapshots when pigi runs, this is a reliable
 * proxy without needing filesystem access to the log files.
 */
export async function getPigiHomeData(): Promise<PigiHomeData> {
  const supabase = await createServerSupabaseClient()

  // 1) Most recent snapshot — Pigi's last visit
  const { data: lastSnap } = await supabase
    .from('company_snapshots')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 2) Recent diff signals — what Pigi noticed
  // Window: last 7 days. Includes harmonic-sourced signals too so the page
  // isn't empty before pigi has had a chance to diff anything (since most
  // companies only have 1 snapshot right now). Once pigi has been running
  // for a few days this naturally fills with pigi_diff signals.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: signals } = await supabase
    .from('signals')
    .select(`*, companies ( name )`)
    .gte('signal_date', sevenDaysAgo)
    .not('headline', 'ilike', ENRICHED_NOISE_PATTERN)
    .order('signal_date', { ascending: false })
    .limit(40)

  // 3) Counts — for the "quiet stats" footer
  const [{ count: totalCompanies }, { count: totalSnapshots }] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('company_snapshots').select('id', { count: 'exact', head: true }),
  ])

  return {
    lastRunAt:         lastSnap?.captured_at ?? null,
    recentDiffSignals: signals ?? [],
    totalCompanies:    totalCompanies ?? 0,
    totalSnapshots:    totalSnapshots ?? 0,
  }
}
