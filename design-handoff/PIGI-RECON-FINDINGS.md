# Pigi recon — findings (2026-04-27)

Test domain: `anthropic.com`. All endpoint paths are relative to `https://api.harmonic.ai`.

## What works on your tier

| Endpoint | Status | What we got |
|---|---|---|
| `POST /companies?website_domain=…` | ✅ 541 KB response | Goldmine — see "nested-richness" below |
| `GET /persons?urns=…` | ✅ 77 KB response, 4 persons | Full `experience[]` (9 items for sample), `education[]`, `awards__beta`, `recommendations__beta`, `linkedin_connections`, `linkedin_headline` |
| `GET /saved_searches` | ✅ 117 KB, **41 saved searches** | Each has `query`, `column_view_settings`, `is_private`, `creator`, `entity_urn`. Free seed for Tier 1.2. |
| `GET /companies/<urn>/highlights` | ⚠️ 200, but only 1 entry | Top-level highlights only. The richer surface is `employee_highlights` inside the main `/companies` response (99 entries). |

## What 404'd / Method-Not-Allowed'd

| Endpoint | Status | Workaround |
|---|---|---|
| `/companies/<urn>/signals` | 404 | **Derive signals by diffing snapshots over time** — see plan below |
| `/companies/<urn>/events` | 404 | same |
| `/companies/<urn>/timeline` | 404 | same |
| `/companies/<urn>/similar` (+ 3 variants) | 404 / 422 | **Use `related_companies` from main response** — it's already there |
| `/watchlists`, `/lists`, `/users/me/watchlists` | 404 | Watchlists are UI-only on this tier. Build Eureka lists from scratch (Tier 1.1). |
| `/users/me/saved_searches` | 404 | Use `/saved_searches` (works) |
| `POST /persons/search` | Method Not Allowed | Search probably needs different shape — defer |
| `GET /investors?name=…` | Method Not Allowed | Defer Tier 2.6 (investor profile pages) |
| Any `x-ratelimit-*` header | None observed | Pigi concurrency = **4** (conservative default) |

## Nested-richness inside `/companies` response

The main response is so rich that several recon endpoints turned out to be redundant:

```
top-level keys (43):
  entity_urn          urn:harmonic:company:3068389
  name                Anthropic
  legal_name          Anthropic, PBC
  short_description   "Safe, steerable AI for businesses."
  description         324 chars
  customer_type       "Business (B2B)"
  company_type        "STARTUP"
  ownership_status    "PRIVATE"
  stage               "VENTURE_UNKNOWN"   ← needs adding to mapStage()
  headcount           4360
  corrected_headcount 4360
  external_headcount  4568
  web_traffic         24,390,000          ← inline, no separate endpoint needed
  founding_date       dict
  headquarters        "San Francisco, California, United States"
  location            dict
  socials             7 platforms
  website             dict
  website_domain_aliases  list[4]
  name_aliases        list[6]
  tags                list[2]
  tags_v2             list[8]   ← sub-sectors
  highlights          list[1]   ← just "Venture Backed"
  employee_highlights list[99]  ← richer affinity surface
  funding             dict (funding_total, valuation, num_funding_rounds, ...)
  funding_rounds      list[20]
  people              list[79]  ← lift the 20-cap
  related_companies   dict (acquisitions, acquired_by, subsidiaries, prior_stealth_association, ...)
  leadership_prior_companies  list[13]
  traction_metrics    dict[31] ← see below
  ...
```

### `traction_metrics` (31 fields, each with 14d/30d/90d/180d/365d buckets)

Per-department headcount: `headcount_engineering`, `headcount_sales`, `headcount_design`, `headcount_marketing`, `headcount_product`, `headcount_operations`, `headcount_finance`, `headcount_legal`, `headcount_data`, `headcount_customer_success`, `headcount_advisor`, `headcount_people`, `headcount_support`, `headcount_other`, plus `headcount` total and `external_headcount`.

Per-channel social: `linkedin_follower_count`, `twitter_follower_count`, `facebook_follower_count`, `facebook_following_count`, `facebook_like_count`, `instagram_follower_count`, plus `external_*` mirrors.

Plus: `web_traffic`, `funding_total`.

Each field has shape `{ '14d_ago': <int>, '30d_ago': <int>, '90d_ago': <int>, '180d_ago': <int>, '365d_ago': <int>, 'metrics': <array of timestamped points>, 'latest_metric_value': <int> }`.

This unblocks **Tier 0.3** (full traction extraction) and **Tier 1.5** (per-department headcount chart).

### `funding_rounds[i]` shape

`announcement_date`, `funding_round_type` (e.g. `LATER_STAGE`), `funding_amount`, `funding_currency`, `post_money_valuation`, `valuation_info`, `investors[]` with `{entity_urn, investor_urn, investor_name, is_lead, association_urn, visibility_status}`.

Anthropic's most recent: $10B LATER_STAGE on 2026-04-24, lead investors Google + Amazon. `valuation: $350B`.

This unblocks **Tier 0.6** (investor breakdowns) immediately — no extra parsing needed.

## What this means for the plan

### Tier 0.2 — similar companies (NO endpoint, but data is free)

Original plan said `/companies/<urn>/similar` → cache in `companies.similar_urns`. The endpoint doesn't exist. **But `related_companies` is right there in the `/companies` response.** Just store it as part of `harmonic_raw` and parse the URNs out into `similar_urns` after. No extra API call.

### Tier 0.9 — signal corpus (BIG REVISION)

The dedicated signals endpoint doesn't exist. So we generate signals **by diffing snapshots over time**:

1. Pigi runs daily (or every 6h while access is alive).
2. Each run upserts the full `harmonic_raw` for every tracked company.
3. **Add a new table `company_snapshots(company_id, captured_at, harmonic_raw jsonb)`** — keeps every historical snapshot keyed by timestamp.
4. A separate `lib/pigi/signal-deriver.ts` compares snapshot N vs N-1 for each company and emits signal rows when:
   - `funding_rounds.length` changed → "new funding round" signal
   - `headcount` jumped >10% → "hiring spike" signal
   - `headcount_engineering` (or any department) jumped >20% → "department spike" signal
   - `valuation` changed → "valuation update" signal
   - new `employee_highlights` entries → "new key hire" signal
   - new `tags_v2` entries → "new sector classification" signal
   - new `related_companies` entries → "new similar competitor" signal

5. **Signal ranking (the deferred question)**: derive automatically from magnitude of the diff. E.g. `signals.strength = log10(funding_amount)` for funding rounds, `signals.strength = pct_headcount_change` for hiring spikes. We can refine the formula once a few weeks of snapshots accumulate.

This is more work than reading a stream, but the upside is **we own the signal logic forever** and can tune it however we want without depending on Harmonic's black-box ranking.

### Tier 1.2 — saved searches (FREE SEED)

Pigi can do a one-time pull of `/saved_searches`, get her 41 work-Harmonic saved searches, and seed Eureka's `saved_searches` table directly. Big head-start on Tier 1.2.

### Stage mapping needs an update

Anthropic's `stage` is `"VENTURE_UNKNOWN"`. The current `mapStage()` in `app/api/enrich/route.ts` doesn't handle this. Pigi's parser pass should map `VENTURE_UNKNOWN` → either `seed` / `series-a` / etc. (we need a default) or a new Eureka stage value `venture-unknown`. Schema constraint will need updating.

## Updated Pigi shopping list (the parsers it needs)

After the recon, Pigi v1's parser pass becomes very concrete:

1. **From `/companies`**: dump full body to `companies.harmonic_raw`. Then derive:
   - `companies.short_description`, `companies.headcount`, `companies.web_traffic`, `companies.customer_type`
   - `companies.stage` (via updated `mapStage`)
   - `companies.funding_total`, `companies.latest_valuation_usd`, `companies.last_funding_at`, `companies.last_funding_total`
   - `companies.funding_rounds_data` ← `funding_rounds` array verbatim
   - `companies.traction_metrics` ← `traction_metrics` dict verbatim
   - `companies.tags_v2` ← `tags_v2`
   - `companies.highlights` ← merge `highlights` + `employee_highlights`
   - `companies.similar_urns` ← extract URNs from `related_companies`
   - `companies.investors` ← deduped `investor_name`s from `funding_rounds[].investors[]`
   - For each entry in `people`, upsert into `people` table with `harmonic_urn`, `is_founder` (from `role_type`), and current `title`.

2. **From `/persons?urns=...`**: dump body to `people.harmonic_raw`. Derive:
   - `people.experience` ← full `experience[]` array verbatim
   - `people.linkedin_url`, `people.profile_picture_url`
   - `people.prior_company`, `people.prior_title` ← derived from `experience` (existing logic in `app/api/enrich/route.ts`)
   - `people.education[]`, `people.degree` ← from `education[]`

3. **From `/saved_searches`**: one-time pull, seed `saved_searches` table.

4. **Snapshot diff job (separate from extraction)**: runs after each extraction, populates `signals`.

## What's NOT possible from API on this tier (worth knowing)

- ❌ Reading watchlists from her work Harmonic account — no list API
- ❌ Stealth founder predictive scores — no people-search endpoint
- ❌ Investor profile pages from Harmonic — no investor endpoint
- ❌ Network/affinity graph — no endpoint
- ❌ Scout AI chat — UI-only

Anything that needs these is **either built from scratch in Eureka or descoped**.
