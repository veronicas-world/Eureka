/**
 * lib/pigi/parsers.ts
 *
 * Pure functions that transform raw Harmonic API responses into
 * typed Eureka DB records. No I/O, no framework imports.
 *
 * Shared by:
 *   - scripts/pigi/run.ts        (bulk nightly extractor)
 *   - app/api/enrich/route.ts    (single-company Enrich button)
 */

// ── Stage mapping ─────────────────────────────────────────────────────────────

export function mapStage(stage: string | null | undefined): string | null {
  if (!stage) return null
  const s = stage
    .toUpperCase()
    .replace(/-/g, '_')
    .replace(/_(EXTENDED|EXTENSION|PLUS|II|III)$/i, '')

  if (s === 'BOOTSTRAPPED')                                         return 'bootstrapped'
  if (s === 'PRE_SEED' || s === 'PRESEED')                          return 'pre-seed'
  if (s === 'SEED')                                                 return 'seed'
  if (s === 'SERIES_A')                                             return 'series-a'
  if (s === 'SERIES_B')                                             return 'series-b'
  if (s === 'SERIES_C')                                             return 'series-c'
  if (s === 'SERIES_D')                                             return 'series-d'
  if (s === 'SERIES_E')                                             return 'series-e'
  if (s === 'SERIES_F')                                             return 'series-f'
  if (s === 'SERIES_G')                                             return 'series-g'
  if (s === 'SERIES_H')                                             return 'series-h'
  if (s === 'GROWTH' || s === 'LATE_STAGE')                         return 'growth'
  if (s === 'PRIVATE_EQUITY' || s === 'PRIVATE')                    return 'private'
  if (s === 'IPO' || s === 'PUBLIC' || s === 'POST_IPO')            return 'ipo'
  if (
    s === 'ACQUIRED' || s === 'ACQUISITION' || s === 'MERGED' ||
    s === 'MERGER'   || s === 'M_AND_A'     || s === 'MERGER_OR_ACQUISITION'
  )                                                                 return 'acquired'
  if (s === 'VENTURE_UNKNOWN')                                      return 'venture-unknown'
  return null
}

// ── Similar URNs ──────────────────────────────────────────────────────────────

/**
 * Extracts company URNs from the related_companies dict
 * (acquisitions, subsidiaries, prior_stealth_association, etc.).
 */
export function extractSimilarUrns(relatedCompanies: unknown): string[] {
  if (
    !relatedCompanies ||
    typeof relatedCompanies !== 'object' ||
    Array.isArray(relatedCompanies)
  ) return []

  const urns: string[] = []
  for (const val of Object.values(relatedCompanies as Record<string, unknown>)) {
    if (!Array.isArray(val)) continue
    for (const item of val) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const urn = (o.entity_urn ?? o.urn ?? o.company_urn) as string | undefined
      if (urn) urns.push(urn)
    }
  }
  return [...new Set(urns)]
}

// ── Highlights merge ──────────────────────────────────────────────────────────

/**
 * Merges top-level highlights (1 entry for Anthropic) with
 * employee_highlights (99 entries) into a single jsonb array.
 */
export function mergeHighlights(
  highlights: unknown,
  employeeHighlights: unknown,
): unknown[] {
  const h  = Array.isArray(highlights)         ? highlights         : []
  const eh = Array.isArray(employeeHighlights) ? employeeHighlights : []
  return [...h, ...eh]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractPctChange(bucket: unknown): number | null {
  if (!bucket || typeof bucket !== 'object') return null
  const b = bucket as Record<string, unknown>
  const v = b.percent_change ?? b.pct_change ?? b.value
  if (typeof v !== 'number') return null
  // Harmonic returns full percentage (15.38 = +15.38%). Divide to decimal.
  return v / 100
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null
}

// ── ParsedCompany ─────────────────────────────────────────────────────────────

export type ParsedCompany = {
  name:                    string | null
  description:             string | null
  short_description:       string | null
  logo_url:                string | null
  customer_type:           string | null
  stage:                   string | null
  founded_year:            number | null
  employee_count:          number | null
  country:                 string | null
  city:                    string | null
  linkedin_url:            string | null
  web_traffic:             number | null
  total_funding_usd:       number | null
  last_funding_round:      string | null
  last_funding_amount_usd: number | null
  last_funding_date:       string | null
  latest_valuation_usd:    number | null
  funding_rounds_count:    number | null
  funding_rounds_data:     unknown
  traction_metrics:        unknown
  tags:                    string[] | null
  tags_v2:                 unknown
  highlights:              unknown[]
  similar_urns:            string[]
  investors:               string[] | null
  harmonic_urn:            string | null
  harmonic_id:             number | null
  enrichment_status:       string | null
  last_enriched_at:        string
  headcount_30d_growth:    number | null
  headcount_90d_growth:    number | null
  headcount_6m_growth:     number | null
  website?:                string
}

export function parseCompany(raw: Record<string, unknown>): ParsedCompany {
  const funding    = (raw.funding    ?? {}) as Record<string, unknown>
  const location   = (raw.location   ?? {}) as Record<string, unknown>
  const socials    = (raw.socials    ?? {}) as Record<string, unknown>
  const linkedin   = (socials.linkedin ?? {}) as Record<string, unknown>
  const websiteObj = (raw.website    ?? {}) as Record<string, unknown>

  // Founded year
  let founded_year: number | null = null
  const fd = raw.founding_date as Record<string, unknown> | null | undefined
  if (fd?.date) {
    const y = new Date(fd.date as string).getFullYear()
    if (!isNaN(y)) founded_year = y
  }

  // Funding rounds array (top-level, not nested in funding)
  const fundingRoundsArr = Array.isArray(raw.funding_rounds) ? raw.funding_rounds : []

  // Investors: deduplicated investor_name across all rounds
  const investorSet = new Set<string>()
  for (const round of fundingRoundsArr) {
    const r = round as Record<string, unknown>
    const invArr = Array.isArray(r.investors) ? r.investors : []
    for (const inv of invArr) {
      const o = inv as Record<string, unknown>
      const name = str(o.investor_name ?? o.name)
      if (name) investorSet.add(name)
    }
  }
  // Legacy fallback: funding.investors[]
  if (investorSet.size === 0) {
    const legacyInv = Array.isArray(funding.investors) ? funding.investors : []
    for (const inv of legacyInv) {
      const name = typeof inv === 'string' ? inv.trim() : str((inv as Record<string, unknown>).name)
      if (name) investorSet.add(name)
    }
  }

  // Tags
  const tagsV2Raw = Array.isArray(raw.tags_v2) ? raw.tags_v2 : []
  const tags: string[] = tagsV2Raw
    .map((t: unknown) =>
      typeof t === 'string' ? t : str((t as Record<string, unknown>).display_value) ?? ''
    )
    .filter(Boolean)

  // Traction metrics
  const tractionObj = (!Array.isArray(raw.traction_metrics) && raw.traction_metrics)
    ? (raw.traction_metrics as Record<string, unknown>)
    : {}
  const hcTraction = (tractionObj.headcount ?? {}) as Record<string, unknown>

  const headcount_30d_growth =
    extractPctChange(hcTraction['30d_ago'])  ??
    extractPctChange(hcTraction['1m_ago'])   ??
    null

  const headcount_90d_growth =
    extractPctChange(hcTraction['90d_ago'])  ??
    extractPctChange(hcTraction['3m_ago'])   ??
    null

  const headcount_6m_growth =
    extractPctChange(hcTraction['180d_ago']) ??
    extractPctChange(hcTraction['6m_ago'])   ??
    null

  // Valuation: prefer funding.valuation scalar, then latest round post_money_valuation
  let latest_valuation_usd: number | null = num(funding.valuation)
  if (!latest_valuation_usd) {
    for (let i = fundingRoundsArr.length - 1; i >= 0; i--) {
      const r = fundingRoundsArr[i] as Record<string, unknown>
      const v = num(r.post_money_valuation)
      if (v && v > 0) { latest_valuation_usd = v; break }
    }
  }
  // Legacy field name from older Harmonic API shape
  if (!latest_valuation_usd) {
    latest_valuation_usd = num((funding as Record<string, unknown>).last_funding_post_money_valuation)
  }

  // Last funding date (ISO date string)
  const rawDate = str(funding.last_funding_at ?? funding.last_funding_date)
  const last_funding_date = rawDate ? rawDate.split('T')[0] : null

  // Website domain
  const websiteDomain = str(websiteObj.domain)

  // Stage: try raw.stage first; fall back to inferring from last_funding_type
  let stage: string | null = mapStage(str(raw.stage))
  if (!stage) {
    const lft = (str(funding.last_funding_type) ?? '').toUpperCase()
    const inferredStage = mapStage(lft)
    if (inferredStage) {
      stage = inferredStage
    } else if (
      lft === 'SECONDARY' ||
      lft === 'STRATEGIC_ROUND' ||
      lft === 'STRATEGIC' ||
      lft === 'DEBT' ||
      lft === 'CONVERTIBLE_NOTE'
    ) {
      const totalFunding = num(funding.funding_total) ?? num(funding.total_funding_raised) ?? 0
      stage = totalFunding > 50_000_000 ? 'venture-unknown' : null
    }
  }

  const out: ParsedCompany = {
    name:                    str(raw.name),
    description:             str(raw.description),
    short_description:       str(raw.short_description),
    logo_url:                str(raw.logo_url),
    customer_type:           str(raw.customer_type),
    stage,
    founded_year,
    employee_count:          num(raw.headcount) ?? num(raw.corrected_headcount),
    country:                 str(location.country),
    city:                    str(location.city),
    linkedin_url:            str(raw.linkedin_url) ?? str(linkedin.url),
    web_traffic:             num(raw.web_traffic),
    total_funding_usd:       num(funding.funding_total) ?? num(funding.total_funding_raised),
    last_funding_round:      str(funding.last_funding_type),
    last_funding_amount_usd: num(funding.last_funding_total) ?? num(funding.last_funding_amount),
    last_funding_date,
    latest_valuation_usd,
    funding_rounds_count:
      num(funding.num_funding_rounds) ??
      (fundingRoundsArr.length > 0 ? fundingRoundsArr.length : null),
    funding_rounds_data:  fundingRoundsArr.length > 0 ? fundingRoundsArr : null,
    traction_metrics:     raw.traction_metrics ?? null,
    tags:                 tags.length   > 0 ? tags           : null,
    tags_v2:              tagsV2Raw.length > 0 ? tagsV2Raw   : null,
    highlights:           mergeHighlights(raw.highlights, raw.employee_highlights),
    similar_urns:         extractSimilarUrns(raw.related_companies),
    investors:            investorSet.size > 0 ? [...investorSet] : null,
    harmonic_urn:         str(raw.entity_urn),
    harmonic_id:          num(raw.id),
    enrichment_status:    str(raw.entity_urn) ?? 'enriched',
    last_enriched_at:     new Date().toISOString(),
    headcount_30d_growth,
    headcount_90d_growth,
    headcount_6m_growth,
  }

  if (websiteDomain) out.website = websiteDomain
  return out
}

// ── PersonRole (extracted from company.people[] relationship objects) ─────────

export type PersonRole = {
  urn:        string
  title:      string | null
  is_founder: boolean
}

/**
 * Parses company.people[] (relationship objects) into roles.
 * Filters for is_current_position === true. No cap on count.
 */
export function extractRoles(people: unknown[]): PersonRole[] {
  const roles: PersonRole[] = []
  for (const rel of people) {
    if (!rel || typeof rel !== 'object') continue
    const r = rel as Record<string, unknown>
    if (r.is_current_position === false) continue
    // Relationship objects have .person = the URN string
    const urn = str(r.person ?? r.entity_urn)
    if (!urn) continue
    const roleType = ((r.role_type ?? '') as string).toUpperCase()
    roles.push({
      urn,
      title:      str(r.title),
      is_founder: roleType === 'FOUNDER' || roleType === 'CO_FOUNDER',
    })
  }
  return roles
}

// ── ParsedPerson ──────────────────────────────────────────────────────────────

export type ParsedPerson = {
  company_id:          string
  name:                string | null
  title:               string | null
  linkedin_url:        string | null
  email:               string | null
  profile_picture_url: string | null
  harmonic_urn:        string | null
  notes:               string | null
  is_founder:          boolean
  prior_company:       string | null
  prior_title:         string | null
  education:           string | null
  degree:              string | null
  experience:          unknown
}

export function parsePerson(
  raw:       Record<string, unknown>,
  role:      PersonRole,
  companyId: string,
): ParsedPerson {
  const socials  = (raw.socials  ?? {}) as Record<string, unknown>
  const linkedin = (socials.linkedin ?? {}) as Record<string, unknown>
  const contact  = (raw.contact  ?? {}) as Record<string, unknown>
  const emails   = (contact.emails ?? []) as unknown[]

  let email: string | null = null
  if (emails.length > 0) {
    const first = emails[0]
    email = typeof first === 'string' ? first : str((first as Record<string, unknown>).email)
  }

  // Full experience array from the /persons endpoint
  const experiences = (raw.experience ?? raw.experiences ?? []) as Record<string, unknown>[]

  // Prior company: most recent PAST role (is_current_position === false)
  function extractOrgName(val: unknown): string {
    if (typeof val === 'string') return val.trim()
    if (val && typeof val === 'object')
      return str((val as Record<string, unknown>).name) ?? ''
    return ''
  }

  function parseEndDate(e: Record<string, unknown>): number {
    const raw = e.end_date ?? e.end_date_v2 ?? e.ended_at
    if (!raw) return Infinity  // no end date → treat as current
    if (typeof raw === 'object') {
      const d = (raw as Record<string, unknown>).date ?? (raw as Record<string, unknown>).value
      if (typeof d === 'string') return new Date(d).getTime()
    }
    if (typeof raw === 'string') return new Date(raw).getTime()
    return 0
  }

  const pastRoles = experiences.filter(
    (e) => e.is_current_position === false || e.is_current === false,
  )
  const priorExp = pastRoles.length > 0
    ? pastRoles.reduce((best, e) => parseEndDate(e) > parseEndDate(best) ? e : best)
    : null

  const prior_company = priorExp
    ? (extractOrgName(priorExp.company_name ?? priorExp.company ?? priorExp.organization_name) || null)
    : null
  const prior_title = priorExp ? str(priorExp.title) : null

  // Education: prefer entries with a degree; pick most recent by end_date
  const educations = (raw.education ?? raw.educations ?? []) as Record<string, unknown>[]

  function extractSchoolName(edu: Record<string, unknown>): string {
    const s = edu.school ?? edu.school_name ?? edu.institution_name
    if (typeof s === 'string') return s.trim()
    if (s && typeof s === 'object') return str((s as Record<string, unknown>).name) ?? ''
    return ''
  }

  function extractDegreeLabel(edu: Record<string, unknown>): string {
    const d = edu.standardized_degree ?? edu.degree ?? edu.degree_name
    if (typeof d === 'string') return d.trim()
    if (d && typeof d === 'object') {
      const n = (d as Record<string, unknown>).name ?? (d as Record<string, unknown>).value
      if (typeof n === 'string') return n.trim()
    }
    return ''
  }

  function parseEduEndDate(edu: Record<string, unknown>): number {
    const raw = edu.end_date ?? edu.end_date_v2 ?? edu.ended_at
    if (!raw) return Infinity
    if (typeof raw === 'object') {
      const d = (raw as Record<string, unknown>).date ?? (raw as Record<string, unknown>).year
      if (typeof d === 'string' || typeof d === 'number') return new Date(String(d)).getTime()
    }
    if (typeof raw === 'string' || typeof raw === 'number') return new Date(String(raw)).getTime()
    return 0
  }

  let education: string | null = null
  let degree:    string | null = null
  try {
    const withDegree = educations.filter((e) => !!e.standardized_degree)
    const candidates = withDegree.length > 0 ? withDegree : educations
    const chosen     = candidates.length > 0
      ? candidates.reduce((best, e) => parseEduEndDate(e) > parseEduEndDate(best) ? e : best)
      : null
    if (chosen) {
      education = extractSchoolName(chosen) || null
      degree    = extractDegreeLabel(chosen) || null
    }
  } catch {
    // malformed data — leave null
  }

  return {
    company_id:          companyId,
    name:                str(raw.full_name),
    title:               role.title,
    linkedin_url:        str(linkedin.url),
    email,
    profile_picture_url: str(raw.profile_picture_url),
    harmonic_urn:        str(raw.entity_urn),
    notes:               str(raw.linkedin_headline),
    is_founder:          role.is_founder,
    prior_company,
    prior_title,
    education,
    degree,
    experience:          experiences.length > 0 ? experiences : null,
  }
}
