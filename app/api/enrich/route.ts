import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  parseCompany,
  parsePerson,
  extractRoles,
  type PersonRole,
} from '@/lib/pigi/parsers'

const HARMONIC_API_KEY = process.env.HARMONIC_API_KEY!

function extractDomain(website: string): string {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, website } = await req.json()

    if (!companyId || !website) {
      return NextResponse.json(
        { success: false, error: 'companyId and website are required' },
        { status: 400 },
      )
    }

    const domain = extractDomain(website)
    console.log('[enrich] domain:', domain)

    const url = `https://api.harmonic.ai/companies?website_domain=${encodeURIComponent(domain)}`
    console.log('[enrich] POST', url)

    const harmonicRes = await fetch(url, {
      method: 'POST',
      headers: { apikey: HARMONIC_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const raw = await harmonicRes.json().catch(() => null)
    console.log('[enrich] status:', harmonicRes.status)

    // 404 = not yet in Harmonic — enrichment queued; store the URN if present
    if (harmonicRes.status === 404) {
      const supabase     = await createServerSupabaseClient()
      const enrichmentUrn = (raw as Record<string, unknown> | null)?.entity_urn as string | undefined
      if (enrichmentUrn) {
        await supabase
          .from('companies')
          .update({ enrichment_status: enrichmentUrn })
          .eq('id', companyId)
      }
      return NextResponse.json(
        { success: false, error: "Harmonic is fetching this company's data. Try enriching again in 2 hours." },
        { status: 404 },
      )
    }

    // 201 = stale data returned + refresh queued — treat as success
    if (!harmonicRes.ok && harmonicRes.status !== 201) {
      return NextResponse.json(
        { success: false, error: `Harmonic returned ${harmonicRes.status}` },
        { status: 502 },
      )
    }

    if (!raw || typeof raw !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Empty response from Harmonic' },
        { status: 502 },
      )
    }

    // ── Parse + update companies ───────────────────────────────────────────────
    const c      = raw as Record<string, unknown>
    const parsed = parseCompany(c)

    // Filter out null/undefined so we don't overwrite user-entered data
    const updatePayload: Record<string, unknown> = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined),
    )
    // Always store the raw response regardless of parsed nulls
    updatePayload.harmonic_raw = c

    console.log('[enrich] update payload keys:', Object.keys(updatePayload))

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
    // Extract all current-position roles — no 20-person cap
    const peopleRels = (c.people ?? []) as unknown[]
    const roles      = extractRoles(peopleRels)
    const roleMap    = new Map<string, PersonRole>(roles.map((r) => [r.urn, r]))

    let peopleAdded   = 0
    let peopleUpdated = 0

    if (roleMap.size > 0) {
      // Harmonic /persons accepts urns=... query params, but a single URL with
      // hundreds of URNs blows past URL-length limits (~2k–8k chars depending
      // on the server) and Harmonic returns 414 / empty. Batch at 50, matching
      // the pigi CLI script. This is the difference between 0 people on big
      // companies (Anthropic, OpenAI) and full enrichment.
      const PERSONS_BATCH_SIZE = 50
      const allUrns = [...roleMap.keys()]
      console.log('[enrich] fetching', allUrns.length, 'persons in', Math.ceil(allUrns.length / PERSONS_BATCH_SIZE), 'batches')

      const personsList: Record<string, unknown>[] = []
      for (let i = 0; i < allUrns.length; i += PERSONS_BATCH_SIZE) {
        const batch      = allUrns.slice(i, i + PERSONS_BATCH_SIZE)
        const urnParams  = batch.map((u) => `urns=${encodeURIComponent(u)}`).join('&')
        const personsUrl = `https://api.harmonic.ai/persons?${urnParams}`

        const personsRes = await fetch(personsUrl, { headers: { apikey: HARMONIC_API_KEY } })
        if (!personsRes.ok) {
          console.error(`[enrich] persons batch ${i / PERSONS_BATCH_SIZE + 1} failed:`, personsRes.status)
          continue
        }
        const personsRaw = await personsRes.json().catch(() => [])
        if (Array.isArray(personsRaw)) {
          personsList.push(...(personsRaw as Record<string, unknown>[]))
        }
      }
      console.log('[enrich] persons batches returned', personsList.length, 'records')

      for (const personRaw of personsList) {
        const urn  = ((personRaw.entity_urn as string | undefined) ?? '').trim()
        const role = roleMap.get(urn)
        if (!role) continue

        const record = parsePerson(personRaw, role, companyId)
        if (!record.name) continue

        const upsertRecord = { ...record, harmonic_raw: personRaw }

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
          const { error } = await supabase.from('people').update(upsertRecord).eq('id', existingId)
          if (!error) peopleUpdated++
        } else {
          const { error } = await supabase.from('people').insert(upsertRecord)
          if (!error) peopleAdded++
        }
      }

      console.log(`[enrich] people — ${roleMap.size} roles, ${peopleAdded} added, ${peopleUpdated} updated`)
    }

    // ── Signals ───────────────────────────────────────────────────────────────
    // Emit signals for funding events, hiring spikes, and highlights.
    // The snapshot-diff signal deriver (Phase 2) will handle richer signals.
    const companyName  = (updatePayload.name as string | undefined) ?? 'Company'
    const today        = new Date().toISOString().split('T')[0]
    const signalInserts: object[] = []

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

    const bestGrowth =
      (parsed.headcount_6m_growth ?? parsed.headcount_90d_growth ?? parsed.headcount_30d_growth)
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

    console.log(`[enrich] done — ${Object.keys(updatePayload).length} fields, ${peopleAdded} people added, ${signalInserts.length} signals`)

    return NextResponse.json({
      success: true,
      fieldsUpdated:  Object.keys(updatePayload),
      peopleAdded,
      peopleUpdated,
      signalsCreated: signalInserts.length,
    })
  } catch (err) {
    console.error('[enrich] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
