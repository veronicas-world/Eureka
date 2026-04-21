import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const HARMONIC_API_KEY = process.env.HARMONIC_API_KEY!

function mapStage(stage: string | null | undefined): string | null {
  if (!stage) return null
  const s = stage.toUpperCase()
  if (s === 'PRE_SEED')                                            return 'pre-seed'
  if (s === 'SEED')                                                return 'seed'
  if (s === 'SERIES_A')                                            return 'series-a'
  if (s === 'SERIES_B')                                            return 'series-b'
  if (s.startsWith('SERIES_C') || s.startsWith('SERIES_D') ||
      s.startsWith('SERIES_E') || s === 'GROWTH' ||
      s === 'LATE_STAGE' || s === 'PRIVATE_EQUITY')               return 'growth'
  return null
}

function extractDomain(website: string): string {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  }
}

type HarmonicPerson = Record<string, unknown>

interface PersonRelationship {
  urn: string
  title: string | null
  is_founder: boolean
}

function parseRelationship(rel: HarmonicPerson): PersonRelationship | null {
  const urn = (rel.person as string | undefined)?.trim()
  if (!urn) return null
  const roleType = ((rel.role_type ?? '') as string).toUpperCase()
  return {
    urn,
    title:      ((rel.title ?? '') as string).trim() || null,
    is_founder: roleType === 'FOUNDER' || roleType === 'CO_FOUNDER',
  }
}

function buildPersonRecord(
  person: HarmonicPerson,
  role: PersonRelationship,
  companyId: string,
) {
  const socials = (person.socials ?? {}) as Record<string, unknown>
  const linkedin = (socials.linkedin ?? {}) as Record<string, unknown>
  const contact = (person.contact ?? {}) as Record<string, unknown>
  const emails = (contact.emails ?? []) as unknown[]

  // emails may be strings or objects with an .email field
  let email: string | null = null
  if (emails.length > 0) {
    const first = emails[0]
    email = typeof first === 'string' ? first : ((first as Record<string, unknown>).email as string | undefined) ?? null
  }

  // Extract prior (non-current) company from experience array
  const experiences = (person.experience ?? person.experiences ?? []) as Record<string, unknown>[]
  const priorExp = experiences.find(
    (e) => e.is_current_position === false || e.is_current === false
  ) ?? (experiences.length > 1 ? experiences[1] : null)

  function extractOrgName(val: unknown): string {
    if (typeof val === 'string') return val.trim()
    if (val && typeof val === 'object') {
      const name = (val as Record<string, unknown>).name
      if (typeof name === 'string') return name.trim()
    }
    return ''
  }

  const prior_company = priorExp
    ? (extractOrgName(priorExp.company_name ?? priorExp.company ?? priorExp.organization_name) || null)
    : null
  const prior_title = priorExp
    ? (typeof priorExp.title === 'string' ? priorExp.title.trim() || null : null)
    : null

  // Extract most recent school from education array
  const educations = (person.education ?? person.educations ?? []) as Record<string, unknown>[]
  let education: string | null = null
  try {
    const firstEdu = educations[0] ?? null
    if (firstEdu) {
      const sn = firstEdu.school_name
      const s  = firstEdu.school
      const ins = firstEdu.institution_name
      const raw =
        typeof sn  === 'string' ? sn  :
        typeof sn  === 'object' && sn  ? (sn  as Record<string, unknown>).name as string :
        typeof s   === 'string' ? s   :
        typeof s   === 'object' && s   ? (s   as Record<string, unknown>).name as string :
        typeof ins === 'string' ? ins  :
        typeof ins === 'object' && ins ? (ins as Record<string, unknown>).name as string :
        ''
      education = (typeof raw === 'string' ? raw.trim() : '') || null
    }
  } catch {
    education = null
  }

  return {
    company_id:          companyId,
    name:                ((person.full_name as string | undefined)?.trim()) || null,
    title:               role.title,
    linkedin_url:        (linkedin.url as string | undefined) ?? null,
    email,
    profile_picture_url: (person.profile_picture_url as string | undefined) ?? null,
    harmonic_urn:        (person.entity_urn as string | undefined) ?? null,
    notes:               (person.linkedin_headline as string | undefined) ?? null,
    is_founder:          role.is_founder,
    prior_company,
    prior_title,
    education,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, website } = await req.json()

    if (!companyId || !website) {
      return NextResponse.json(
        { success: false, error: 'companyId and website are required' },
        { status: 400 }
      )
    }

    const domain = extractDomain(website)
    console.log('[enrich] domain:', domain)

    const url = `https://api.harmonic.ai/companies?website_domain=${encodeURIComponent(domain)}`
    console.log('[enrich] POST', url)

    const harmonicRes = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: HARMONIC_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    console.log('[enrich] status:', harmonicRes.status)

    const raw = await harmonicRes.json().catch(() => null)
    console.log('[enrich] raw response:', JSON.stringify(raw, null, 2))

    // 404 = not yet in Harmonic — enrichment queued; store the URN if present
    if (harmonicRes.status === 404) {
      const supabase = await createServerSupabaseClient()
      const enrichmentUrn = (raw as Record<string, unknown> | null)?.entity_urn as string | undefined
      if (enrichmentUrn) {
        await supabase
          .from('companies')
          .update({ enrichment_status: enrichmentUrn })
          .eq('id', companyId)
      }
      return NextResponse.json(
        { success: false, error: "Harmonic is fetching this company's data. Try enriching again in 2 hours." },
        { status: 404 }
      )
    }

    // 201 = stale data returned + refresh queued — treat as success
    if (!harmonicRes.ok && harmonicRes.status !== 201) {
      return NextResponse.json(
        { success: false, error: `Harmonic returned ${harmonicRes.status}` },
        { status: 502 }
      )
    }

    if (!raw || typeof raw !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Empty response from Harmonic' },
        { status: 502 }
      )
    }

    // ── Field mapping ─────────────────────────────────────────────────────────
    const c = raw as Record<string, unknown>
    const funding    = (c.funding    ?? {}) as Record<string, unknown>
    const location   = (c.location   ?? {}) as Record<string, unknown>
    const websiteObj = (c.website    ?? {}) as Record<string, unknown>
    const socials    = (c.socials    ?? {}) as Record<string, unknown>
    const linkedinSocial = (socials.linkedin ?? {}) as Record<string, unknown>

    const foundingDateObj = c.founding_date as Record<string, unknown> | null | undefined
    let founded_year: number | null = null
    if (foundingDateObj?.date) {
      const y = new Date(foundingDateObj.date as string).getFullYear()
      if (!isNaN(y)) founded_year = y
    }

    const investorList: string[] = ((funding.investors ?? []) as unknown[])
      .map((inv) => {
        if (typeof inv === 'string') return inv
        const o = inv as Record<string, unknown>
        return ((o.name ?? o.full_name ?? '') as string).trim()
      })
      .filter((n) => n.length > 0)

    const tags: string[] = ((c.tags_v2 ?? []) as unknown[])
      .map((t) => {
        if (typeof t === 'string') return t
        const o = t as Record<string, unknown>
        return ((o.display_value ?? '') as string).trim()
      })
      .filter((t) => t.length > 0)

    const linkedin_url = (c.linkedin_url ?? linkedinSocial.url ?? null) as string | null
    const websiteDomain = (websiteObj.domain as string | undefined) ?? null

    // Traction metrics
    const traction = (c.traction_metrics ?? {}) as Record<string, unknown>
    const headcount_30d_growth = (traction.headcount_growth_30d ?? traction.headcount_growth_1m ?? null) as number | null
    const headcount_90d_growth = (traction.headcount_growth_90d ?? traction.headcount_growth_3m ?? null) as number | null
    const headcount_6m_growth  = (traction.headcount_growth_180d ?? traction.headcount_growth_6m ?? null) as number | null

    // Funding rounds
    const fundingRoundsArr = (funding.funding_rounds ?? []) as unknown[]
    const funding_rounds_count = fundingRoundsArr.length > 0 ? fundingRoundsArr.length : null

    const enriched: Record<string, unknown> = {
      name:                    (c.name as string | undefined) ?? null,
      description:             (c.description as string | undefined) ?? null,
      short_description:       (c.short_description as string | undefined) ?? null,
      employee_count:          (c.headcount as number | undefined) ?? null,
      founded_year,
      linkedin_url,
      logo_url:                (c.logo_url as string | undefined) ?? null,
      customer_type:           (c.customer_type as string | undefined) ?? null,
      country:                 (location.country as string | undefined) ?? null,
      city:                    (location.city as string | undefined) ?? null,
      total_funding_usd:       (funding.total_funding_raised as number | undefined) ?? null,
      last_funding_round:      (funding.last_funding_type as string | undefined) ?? null,
      last_funding_amount_usd: (funding.last_funding_total as number | undefined) ?? null,
      last_funding_date:       (funding.last_funding_at as string | undefined) ?? null,
      latest_valuation_usd:    (funding.last_funding_post_money_valuation as number | undefined) ?? null,
      funding_rounds_count,
      stage:                   mapStage(c.stage as string | undefined),
      investors:               investorList.length > 0 ? investorList : null,
      tags:                    tags.length > 0 ? tags : null,
      enrichment_status:       (c.entity_urn as string | undefined) ?? 'enriched',
      harmonic_id:             (c.id as number | undefined) ?? null,
      harmonic_urn:            (c.entity_urn as string | undefined) ?? null,
      last_enriched_at:        new Date().toISOString(),
      traction_metrics:        c.traction_metrics ?? null,
      headcount_30d_growth,
      headcount_90d_growth,
      headcount_6m_growth,
      ...(websiteDomain ? { website: websiteDomain } : {}),
    }

    const updatePayload = Object.fromEntries(
      Object.entries(enriched).filter(([, v]) => v !== null && v !== undefined)
    )

    console.log('[enrich] update payload:', JSON.stringify(updatePayload, null, 2))

    const supabase = await createServerSupabaseClient()

    const { error: updateError } = await supabase
      .from('companies')
      .update(updatePayload)
      .eq('id', companyId)

    if (updateError) {
      console.error('[enrich] Supabase update error:', updateError.message)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // ── People ────────────────────────────────────────────────────────────────
    const peopleRelationships = (c.people ?? []) as HarmonicPerson[]

    // Extract current-position URNs only, cap at 20
    const roleMap = new Map<string, PersonRelationship>()
    for (const rel of peopleRelationships) {
      if (rel.is_current_position !== true) continue
      const parsed = parseRelationship(rel)
      if (parsed) roleMap.set(parsed.urn, parsed)
      if (roleMap.size >= 20) break
    }

    let peopleAdded   = 0
    let peopleUpdated = 0

    if (roleMap.size > 0) {
      // Batch fetch full person objects
      const urnParams = Array.from(roleMap.keys())
        .map((u) => `urns=${encodeURIComponent(u)}`)
        .join('&')
      const personsUrl = `https://api.harmonic.ai/persons?${urnParams}`
      console.log('[enrich] fetching persons:', personsUrl)

      const personsRes = await fetch(personsUrl, {
        method: 'GET',
        headers: { apikey: HARMONIC_API_KEY },
      })
      console.log('[enrich] persons status:', personsRes.status)

      const personsRaw = await personsRes.json().catch(() => [])
      const personObjects = Array.isArray(personsRaw) ? personsRaw as HarmonicPerson[] : []

      if (personObjects.length > 0) {
        console.log('[enrich] first full person object:', JSON.stringify(personObjects[0], null, 2))
      }

      for (const person of personObjects) {
        const urn = (person.entity_urn as string | undefined) ?? ''
        const role = roleMap.get(urn)
        if (!role) continue

        const record = buildPersonRecord(person, role, companyId)
        if (!record.name) continue

        // 1. Try match by harmonic_urn (only if urn is present)
        let existingId: string | null = null

        if (urn) {
          const { data } = await supabase
            .from('people')
            .select('id')
            .eq('company_id', companyId)
            .eq('harmonic_urn', urn)
            .maybeSingle()
          if (data) existingId = data.id
        }

        // 2. Fall back to match by name + company_id
        if (!existingId) {
          const { data } = await supabase
            .from('people')
            .select('id')
            .eq('company_id', companyId)
            .ilike('name', record.name)
            .maybeSingle()
          if (data) existingId = data.id
        }

        if (existingId) {
          const { error: updateErr } = await supabase
            .from('people')
            .update(record)
            .eq('id', existingId)
          if (updateErr) {
            console.error('[enrich] person update error:', updateErr.message)
          } else {
            peopleUpdated++
          }
        } else {
          const { error: insertErr } = await supabase.from('people').insert(record)
          if (insertErr) {
            console.error('[enrich] person insert error:', insertErr.message)
          } else {
            peopleAdded++
          }
        }
      }

      console.log(`[enrich] people — processed: ${personObjects.length}, inserted: ${peopleAdded}, updated: ${peopleUpdated}`)
    }

    console.log(`[enrich] people processed: ${roleMap.size}, added: ${peopleAdded}`)

    // ── Signals ───────────────────────────────────────────────────────────────
    const companyName = (updatePayload.name as string | undefined) ?? 'Company'
    const today = new Date().toISOString().split('T')[0]
    const signalInserts: object[] = []

    signalInserts.push({
      company_id:    companyId,
      signal_type:   'news',
      signal_source: 'harmonic',
      headline:      `${companyName} enriched via Harmonic`,
      strength:      'strong',
      signal_date:   today,
    })

    if (updatePayload.total_funding_usd || updatePayload.last_funding_round) {
      signalInserts.push({
        company_id:    companyId,
        signal_type:   'funding',
        signal_source: 'harmonic',
        headline:      updatePayload.last_funding_round
          ? `${companyName} raised ${updatePayload.last_funding_round}`
          : `${companyName} funding data updated`,
        detail:        updatePayload.last_funding_amount_usd
          ? `$${Number(updatePayload.last_funding_amount_usd).toLocaleString()}`
          : undefined,
        strength:      'strong',
        signal_date:   (updatePayload.last_funding_date as string | undefined) ?? today,
      })
    }

    const bestGrowth = headcount_6m_growth ?? headcount_90d_growth ?? headcount_30d_growth
    if (typeof bestGrowth === 'number' && bestGrowth > 0.1) {
      signalInserts.push({
        company_id:    companyId,
        signal_type:   'hiring_spike',
        signal_source: 'harmonic',
        headline:      `${companyName} headcount grew ${Math.round(bestGrowth * 100)}% recently`,
        strength:      bestGrowth > 0.3 ? 'strong' : 'moderate',
        signal_date:   today,
      })
    }

    // Highlights as signals
    const highlights = (c.highlights ?? []) as Record<string, unknown>[]
    for (const h of highlights) {
      const text = ((h.text ?? h.category ?? '') as string).trim()
      if (!text) continue
      signalInserts.push({
        company_id:    companyId,
        signal_type:   'news',
        signal_source: 'harmonic',
        headline:      text,
        strength:      'moderate',
        signal_date:   today,
      })
    }

    await supabase.from('signals').insert(signalInserts)

    const fieldsUpdated = Object.keys(updatePayload)
    const signalsCreated = signalInserts.length

    console.log(`[enrich] done — fields: ${fieldsUpdated.length}, people added: ${peopleAdded}, signals: ${signalsCreated}`)

    return NextResponse.json({
      success: true,
      fieldsUpdated,
      peopleAdded,
      signalsCreated,
    })
  } catch (err) {
    console.error('[enrich] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
