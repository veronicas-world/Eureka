# Eureka ⇄ Harmonic — Gap Analysis & Build Plan

_Last updated: 2026-04-27_

> **Post-recon update (2026-04-27 PM).** Pigi recon ran against `anthropic.com`. Findings live in [`PIGI-RECON-FINDINGS.md`](./PIGI-RECON-FINDINGS.md). Major deltas to this plan:
> - **Signals are derived by snapshot-diff**, not pulled from a Harmonic endpoint (no signals/events/timeline endpoint exists on this tier). Tier 0.9 becomes "snapshot capture + diff job."
> - **Similar-companies graph** comes from `related_companies` nested in the main `/companies` response — no separate endpoint call needed (Tier 0.2 simplifies).
> - **Saved searches import** is a free seed: 41 saved searches returned from `/saved_searches`. Tier 1.2 gets a one-shot import.
> - **Watchlists are hierarchical** (folders → lists). Schema reflects this in Tier 1.1.
> - **Pigi cadence** = daily (`--watch` 24h loop), runtime ~1 month per Veronica's access window. ~30 snapshots gives the diff job good signal-to-noise.
> - **Concurrency = 4**, no rate-limit headers exposed by Harmonic.

---

## 0. TL;DR — start here

You're racing two clocks: the work clock (Harmonic API access ends when your role does), and the shipping clock (you want the app usable solo after that). The single most valuable thing to do **right now** is not new UI — it's **Pigi**, a bulk extraction job that pulls every byte of Harmonic data you can reach into your own Supabase, in raw form, before the access disappears. Everything else can be built on top of cached data after access ends. Anything Pigi doesn't pull now is gone forever.

> **Pigi** (πηγή — Greek for spring / fountain / well / source). Both literal (your data spring) and figurative (source of insight). Pigi is the agent / job; Eureka is the app. Same family, different roles.

**Recommended order of operations:**

1. **Tier 0 (this week, while you still have Harmonic)** — Pigi bulk-caches everything: companies, people graph, similar-companies, full traction time-series, highlights, funding-round JSONs. Pull once, store the raw Harmonic JSON in a `harmonic_raw` jsonb column. Re-derive forever.
2. **Tier 1 (next 1–2 weeks)** — Watchlists, Saved Searches, CSV export, unified company timeline, per-department headcount chart, highlight badges, real drag-between Pipeline columns, finish the twilight refresh on Pipeline + Signals.
3. **Tier 2 (after access ends, if you still want it)** — AI search, AI summaries, personal alert digests, bulk actions, custom fields, investor profile pages.
4. **Tier 3 (skip)** — multi-user, SSO, role tiers, list-sharing, public API, CRM sync. **Eureka is solo-only.** None of this fits.

> **Solo-only scope.** Per your note, Eureka is one user — you. I've stripped every team feature out of the plan: no `is_public` lists, no list permissions, no shared saved searches, no team network graph, no audit log. Wherever Harmonic has a multi-user surface (e.g. "Team network" in §2), it's listed in §2 as feature-surface context only and is **explicitly out of scope** for what we build.

> **Signal ranking is deferred.** Harmonic clearly has a signal-ranking concept (a strength score per signal, sometimes a per-user "for you" rank). I won't define a scoring formula until Pigi has cached enough Harmonic responses that we can reverse-engineer how their score moves. Until then, Eureka's `signals.strength` stays as the simple integer it is today (1–3), and the `/dashboard` "top by signal" widget keeps using `total_funding` as the proxy. We'll revisit this once Pigi has been running for a week.

Detailed plan below.

---

## 1. What you have today (Eureka inventory)

### Pages

| Page | Status | Density | Twilight refresh |
|---|---|---|---|
| `/dashboard` | Strong. 4 KPIs, pipeline-by-status bar, companies-by-stage scrollable bar (15 stages), top-by-signal, recent signals, recently-added cards. | High | ✅ done |
| `/database` | Strong. Sortable table (name+logo, sector, stage, status, country, signal, total funding, last round, founded). Drag-and-drop reorder, persisted via `display_order`. URL-state filters (stage/sector/status/q). | High | ✅ done |
| `/search` | Strong. Big input + filter rail (stage chips, status chips, sector picker, country picker, headcount/funding/founded ranges, investor picker with All/Funds/Angels tabs). Three result sections (Companies, People, Signals). | High | ⚠️ partial — works but generic chrome |
| `/pipeline` | Weak. Static kanban — 5 status columns, cards click through. **No drag-between-columns** ("Drop here" is just a label). | Low | ❌ pre-twilight (white cards, colored dots) |
| `/signals` | Medium. Feed with type/strength filters, but card design is pre-twilight (rounded cards, colored badges). | Medium | ❌ pre-twilight |
| `/companies/[id]` | Strong. Six tabs: Overview, Team, Funding, Traction, Signals, Notes. FundingTab parses `funding_rounds_data` JSON for timeline + valuations. TractionTab shows headcount % deltas. Team shows founders + employees with prior_company / education. | High | ✅ mostly |
| `/companies/new`, `/companies/[id]/edit` | Functional. Generic stacked form. EnrichButton calls Harmonic. | Medium | ⚠️ needs notebook treatment per BRIEF |

### Data model (Supabase)

- `companies` — 40+ columns. Includes the Harmonic enrichment surface: `logo_url`, `customer_type`, `harmonic_id/urn`, `short_description`, `headcount_30d/90d/6m_growth`, `latest_valuation_usd`, `funding_rounds_count`, `traction_metrics jsonb`, `funding_rounds_data jsonb`, `last_funding_date`. Plus the user-curated `display_order double precision`.
- `people` — name, title, linkedin_url, email, is_founder, profile_picture_url, harmonic_urn, prior_company, prior_title, education, degree.
- `signals` — type, source, headline, detail, date, strength, url. Source CHECK includes 'harmonic'.
- `notes`, `interactions`, `company_urls`.
- 15-stage CHECK constraint: bootstrapped → pre-seed → seed → series-a..h → growth → private → ipo → acquired.
- 5 statuses: tracking, outreached, meeting booked, passed, portfolio.

### Server actions (`app/actions/companies.ts`)

`addCompany`, `updateCompany`, `deleteCompany`, `deleteUrl`, `updateUrls`, `addNote`, `deleteNote`, `addPerson`, `deletePerson`, `addInteraction`, `addSignal`, `reorderCompanies`.

### Harmonic enrichment route (`app/api/enrich/route.ts`)

- Calls `POST https://api.harmonic.ai/companies?website_domain=…` then `GET /persons?urns=…`.
- **Confirms paid tier**: route reads `c.funding_rounds` (the funding-rounds add-on) successfully. You have it.
- Reads: `funding_rounds`, `traction_metrics` (headcount only — 30d/90d/180d % buckets), `tags_v2`, `highlights`, `people` (current_position only, capped at 20), `socials.linkedin`, `location`, `website.domain`.
- Stage mapping handles every Harmonic enum incl. M&A variants (ACQUISITION, MERGED, M_AND_A, MERGER_OR_ACQUISITION).
- Person enrichment captures `prior_company`, `prior_title`, `education.school_name`, `education.standardized_degree`.
- Signals only emit for funding events, hiring spikes (>10% growth), and highlights — generic "enriched" pseudo-signal removed.

### Stub / scaffolded but empty

- `/api/harmonic/watchlists/` — directory exists, no `route.ts`. Watchlists is unbuilt.

### Visual identity (per BRIEF.md, mostly executed)

- Twilight palette (`--paper #F4F2EB`, `--ink #1B2240`, `--accent #5B73B8`, `--nav #161B33`, …).
- Celestial Unicode glyphs `⋆˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺` as section flourishes, never colored, never inside controls.
- JetBrains Mono everywhere.
- `.twinkle` keyframe animation for empty states.
- Pipeline + Signals haven't received the refresh yet.

---

## 2. What Harmonic has (feature surface)

> **Updated 2026-04-27 with Veronica's first batch of screenshots.** Several items below are now confirmed against live UI, and several were materially wrong in my first draft. I've folded the corrections inline and called out anything new.

### Top-level navigation (left rail, confirmed from screenshots)

Harmonic's left rail has four icons:
1. **Search** (magnifying glass) — companies / people / investors / saved searches.
2. **Scout** (the 4-dot logo) — **AI chat surface**. Far more central than I had it. See §2.J for detail.
3. **Discover / Explore** (compass) — separate exploratory surface.
4. **Workspace** (boxes) — Lists + My network + Team network.

### Confirmed against screenshots

### A. Company database
- ~20M companies, ~160M people in a unified entity model.
- Profile header with logo, name, website, description, founded year, HQ + secondary offices, total funding, latest round, latest post-money valuation, employee count, customer type (B2B/B2C/B2B2C), highlights/affinities (YC, Forbes 30u30, etc.).
- Tags / sub-sectors hierarchy.

### B. Companies search
- Free text + faceted filters: industry tags, sub-industries, geography (HQ country/region/city + secondary locations), employee count range, total funding range, latest valuation range, latest round date range, last round amount range, founded year range, customer type, growth rates (headcount 30d/90d/6m/1y, web traffic, social followers), team metrics, affinities, funding sources (specific investors, fund-vs-angel).
- Saved searches that persist and re-run automatically.
- Saved-search alerts (email / Slack) when net-new matches appear.
- "Similar companies" — find companies like X (vector / clustering, not just sector match).
- Bulk actions: add to list, export, change column view.
- Net-new indicator since last visit on saved searches.

### C. Watchlists / lists
- Public + private lists. _(Solo: only "private" applies.)_
- Add from search, from company page, manually, by URL paste, or in bulk.
- Per-list custom fields (text, number, date, dropdown).
- ~~List sharing / permissions inside an org.~~ _(Out of scope — solo tool.)_
- "Net new" diff since last view.
- Activity feed scoped to a list.
- Heatmap or leaderboard views.

### D. People search
- Filters: title, seniority, current company, past company, school, degree, location, function/department, years experience.
- Stealth founder detection — recently left big tech, no LinkedIn employer.
- "Soon to be founders" predictive scoring.
- Alumni filters (ex-Stripe, ex-Anthropic, ex-Meta, etc.).
- Repeat founder filter.
- People-to-company joins — find companies hiring ex-X talent.

### E. Signals / activity feed
- Funding rounds, valuation movements.
- Hiring spikes (per role, per department).
- Founder moves (corporate → startup, startup → startup).
- Headcount inflection points.
- Web traffic spikes (SimilarWeb-style).
- Social follower spikes (LinkedIn / Twitter / Instagram per channel).
- Product launches, Product Hunt mentions, news.
- Stealth detection, layoffs, office relocation (newer signal types).
- Custom signal rules per user.
- **Signal ranking** — Harmonic surfaces signals with an implicit priority (size of round, magnitude of growth, recency, founder caliber). The exact formula isn't documented. **Deferred per your note** — we'll define Eureka's ranking once Pigi has cached enough Harmonic signal responses to reverse-engineer the ordering. Schema-level: keep `signals.strength SMALLINT` as-is for now; add `signals.harmonic_rank_raw jsonb` later if Pigi finds a useful field to capture.

### F. Company detail (tabs vary by Harmonic version)
- **Overview** — header + summary + highlights + key stats + affinities.
- **Team** — founders, key hires, headcount over time, **per-department headcount chart**, open roles.
- **Funding** — rounds timeline, post-money valuation, investor list with amounts and rounds.
- **Traction** — headcount, web traffic, social follower charts per channel, sometimes Glassdoor.
- **Investors** — full investor table with stake / round / lead.
- **Customers** — public customer logos.
- **News** — third-party news mentions feed.
- **Similar companies** — clustered list.
- **Custom fields** — per-list.
- **Notes / activity** — unified timeline.

### G. Affinity / network mapping
- Network graph (who knows whom via shared employers, schools, prior funds).
- ~~"Warm intro" surface — show who at your firm has a connection to a target.~~ _(Team feature — out of scope.)_
- LinkedIn / Gmail integration to detect prior conversations. _(Personal-account version is in scope eventually; team-shared version isn't.)_

### H. Investor / firm intelligence
- Per-firm portfolio rollup.
- Recent investments by firm.
- Co-investor analysis.
- Investor profile pages.

### I. Workflow / integrations
- ~~CRM sync: Affinity, Attio, HubSpot, Salesforce.~~ _(Out of scope — Eureka **is** your CRM.)_
- Slack alerts on signals + saved searches. _(Personal-channel version is in scope; team-channel isn't.)_
- Email digests. _(In scope as a personal digest to your address.)_
- CSV export everywhere.
- ~~Public REST + GraphQL API.~~ _(Out of scope — solo tool.)_
- ~~Chrome extension to enrich on LinkedIn / company sites.~~ _(Out of scope — nice-to-have but not solo-essential.)_
- ~~Zapier / Make webhooks.~~ _(Out of scope — solo tool.)_

### J. AI features (newer)
- AI search ("AI infra companies in Europe with 50–100 employees raised in last 6 months").
- AI company summary on detail page.
- AI-generated signal explanations.
- AI-extracted founder bios.

### K. Saved views / boards
- Custom column views in lists.
- Pivot / groupby views.
- Multiple chart configs per list.

### L. Admin / enterprise
- Multi-user, role tiers, audit log, SSO, team workspaces, shared lists, team network graph.
- **All skipped — Eureka is a single-user notebook by design.**

---

## 3. Gap matrix

Each item below: **(impact)** how much it closes the Harmonic gap for a single VC user × **(effort)** rough build cost × **(notes)** how it changes if your Harmonic access ends.

### Tier 0 — Pigi: race the Harmonic clock (do FIRST, this week)

> **Pigi** is the agent / job. Concretely: `scripts/pigi/` with a CLI entrypoint, a config of which Harmonic endpoints to call, and a logbook of what it successfully pulled. Everything below is Pigi's job description.

These are the irreversible ones. Whatever Pigi doesn't pull now disappears when your access ends.

| # | What | Impact | Effort | Notes |
|---|---|---|---|---|
| 0.1 | **Pigi core: bulk extraction** — walk every company you care about (and every company in Harmonic's typeahead / list search you can reach) and store the raw Harmonic JSON in a new `companies.harmonic_raw jsonb` column + raw person JSON in `people.harmonic_raw jsonb`. Pull once, derive forever. | Existential | M (1–2 days) | Without this, anything not already extracted is gone forever when access ends. |
| 0.2 | **Pigi: similar-companies graph** — cache `/companies/{id}/similar` in `companies.similar_urns jsonb`. | High | S (~3 hrs) | Harmonic's curated similar-companies graph is unique IP — survive its loss. |
| 0.3 | **Pigi: full traction extraction** — current code only stores % deltas. Pull the **full headcount time-series** + **per-department breakdown** + **per-channel social follower history** (LinkedIn/Twitter/etc.) into `traction_metrics jsonb`. | High | S (~4 hrs) | Charts you can render later from raw data. |
| 0.4 | **Pigi: highlights / affinities** — store the full affinity list (YC W24, Forbes 30u30, Sequoia Scout, etc.) into a `companies.highlights jsonb` column. | Med | S (~1 hr) | Powers badge rendering. |
| 0.5 | **Pigi: people history** — currently `app/api/enrich/route.ts` caps at 20 people, current_position only. Lift to all returned, pull `experience[]` history. Powers repeat-founder + alumni queries forever. | High | S (~3 hrs) | Whole reason People search has any depth post-Harmonic. |
| 0.6 | **Pigi: investor breakdowns** — `funding_rounds_data` is stored, but parse it eagerly for per-investor amounts (lead, follow-on). Or just trust the raw JSON if it's already complete. | Med | S (~2 hrs) | Powers a future investor profile page. |
| 0.7 | **Pigi: news / press history** — if Harmonic exposes a press feed in their API for your tier, pull it. Otherwise skip. | Med | S (~2 hrs to probe) | Worth one round-trip to find out. |
| 0.8 | **Pigi: affinity / network data** — if your tier exposes shared-school / shared-employer graph data, pull it. Probably not exposed via API, but check. | Med if available | S (~1 hr to probe) | Likely a Harmonic-UI-only feature. |
| 0.9 | **Pigi: signal corpus** — pull the raw signal stream Harmonic emits for every company you care about, store it in `signals.harmonic_raw jsonb`. We'll use this corpus to define Eureka's signal ranking later (per your deferred-ranking note). | High | S (~3 hrs) | Without this, signal ranking can't be reverse-engineered after access ends. |

**Implementation pattern**: `scripts/pigi/run.ts` reads a domain list (or, preferably, walks `companies` table directly), fans out concurrently with a rate limit (start at 4), backs off on 429, logs every failure to `scripts/pigi/log/<timestamp>.json` so you can re-run only the misses. Idempotent (upsert by `harmonic_urn`). One-shot mode and `--watch` mode (re-pulls every 24h while access is live).

### Tier 1 — Fill the most visible Harmonic gaps (next 1–2 weeks)

Do these AFTER the data is safely in your DB.

| # | What | Impact | Effort | Notes |
|---|---|---|---|---|
| 1.1 | **Watchlists** — implement the empty `/api/harmonic/watchlists`. New tables: `lists` (id, name, description, color, created_at, last_viewed_at). `list_companies` (list_id, company_id, added_at, position). _No `is_public`, no `owner` — solo tool._ Same drag-reorder pattern as `/database`. UI: add to list from any company row, list-detail page, sidebar list of lists. | Existential | M (2 days) | This is the #1 missing concept in Eureka. Status buckets ≠ lists. |
| 1.2 | **Saved searches** — persist `/search` URL state with a name. Sidebar section "saved" with named entries that re-apply filters when clicked. New table: `saved_searches` (id, name, query, filters jsonb, created_at). Bonus: store last_viewed_at for net-new diff. | High | S (~half day) | Cheap, huge UX win. |
| 1.3 | **CSV export** — export Database, Search results, and any list to .csv. One small `app/api/export/route.ts`. | High | S (~2 hrs) | Most-requested feature in any tracker tool, period. |
| 1.4 | **Unified company timeline** — inside `/companies/[id]`, replace the separate Signals + Notes tabs with a single chronological "Activity" tab that interleaves signals, notes, interactions, edits, funding events. | High | S (~half day) | Leans into the "notebook" aesthetic and matches Harmonic's modern detail view. |
| 1.5 | **Per-department headcount chart** — once Tier 0.3 is done, render in TractionTab as a stacked area or small-multiples per department. | Med | S (~3 hrs) | Looks expensive, is cheap once data is there. |
| 1.6 | **Highlight / affinity badges** — render `companies.highlights` on the company header as small typewriter pills (e.g. `[YC W24]`, `[Forbes 30u30]`). Not colored. | Med | S (~2 hrs) | Easy aesthetic win once Tier 0.4 lands. |
| 1.7 | **Drag-between-columns Pipeline** — actually wire @dnd-kit on `/pipeline` so dropping a card on another column updates `companies.status`. The "Drop here" placeholder is currently dead. | High | S (~half day) | Low effort, fixes the weakest page in the build. |
| 1.8 | **Pipeline + Signals visual refresh** — bring those two pages into the twilight palette per BRIEF.md. Date dividers ("April 27 ⋆˚‧₊") on Signals. Strength via ink density not colored badges. Pipeline: drop the colored dots, use the same surface tones as Database. | High | S (~half day total) | Last 30% of the design refresh. |
| 1.9 | **Net-new indicator on Database / Lists / Saved searches** — show a small `+2 since you last looked` chip. Stored as `last_viewed_at` per list/search. | Med | S (~3 hrs) | Replicates Harmonic's most addictive UX hook. |
| 1.10 | **Tags / labels** — `companies.tags` array column already exists, no UI. Add chip-edit on company detail and tag filter on Database. | Med | S (~half day) | Tiny lift, infinite utility. |
| 1.11 | **People search depth** — once Tier 0.5 cached histories, expose past-company / past-school as filterable on `/search` People section. | High | M (1 day) | Unlocks ex-Stripe, ex-Anthropic style queries forever. |

### Tier 2 — Bigger lifts (after internship, if you still want them)

| # | What | Impact | Effort | Notes |
|---|---|---|---|---|
| 2.1 | **AI search** — natural-language → structured filters via OpenAI function calling. Cheap to build, signature Harmonic feature. | High | M (1–2 days) | Anthropic API key + a single function-call schema mirroring your Filters type. |
| 2.2 | **AI company summary** on detail page — generate a paragraph from cached fields. | Med | S (~half day) | Cache results to avoid re-spending tokens. |
| 2.3 | **Personal alert digest** — daily/weekly email or Slack-DM digest to *you*, summarizing new signals matching saved searches. Solo, never team channel. | High | M (1–2 days) | Resend or your personal Slack webhook + cron. |
| 2.4 | **Bulk actions** in Database / Search — multi-select, then mass status change, mass tag, mass-add-to-list, mass export. | Med | M (1 day) | |
| 2.5 | **Custom fields per list** — JSON column on `list_companies`. | Med | M (1 day) | |
| 2.6 | **Investor profile pages** — derive from `companies.investors[]` string array. Show portfolio, co-investors, recent rounds. | Med | M (1–2 days) | |
| 2.7 | **Network / affinity map** — needs LinkedIn API or Clay-like enrichment. Defer until LinkedIn integration. | High | L (week+) | |
| 2.8 | **Stealth founder pipeline** — needs LinkedIn API. | Med | L (week+) | |
| 2.9 | **Web traffic data** — needs SimilarWeb or alternative. Out of scope while solo. | Med | L | |

### Tier 3 — Skip (per your "solo tool only" note)

Doesn't fit a single-user notebook tool. Confirmed out of scope:

- Multi-user accounts, role tiers, SSO, audit log
- Team workspaces, shared lists, list permissions
- Team network graph / "warm intro from a colleague" surface
- Public REST or GraphQL API
- Chrome extension
- Affinity / Attio / HubSpot / Salesforce CRM sync (you ARE the CRM)
- Zapier / Make webhooks
- Onboarding flow, marketing site, sign-up screen, pricing page

---

## 4. Recommended starting point

**Build Pigi first (Tier 0.1 → 0.5, plus 0.9 for the signal corpus).** Reasons:

1. **Irreversible**. Your work clock is ticking. Every day you build UI instead of pulling data is a day of permanent data loss.
2. **Unblocks everything**. With a `companies.harmonic_raw jsonb` column, every Tier 1 feature has cached source-of-truth without re-calling Harmonic. You can iterate on UI for months without a single live API hit.
3. **Cheap to write**. Fan-out script + idempotent upsert. ~1–2 days for the whole pull.
4. **Audit trail**. Raw JSON means when you later notice "wait, what was Brex's headcount on Apr 27 2026?" — you can answer it.
5. **Unblocks signal ranking**. Tier 0.9 (signal corpus) is the prerequisite for defining Eureka's signal ranking later — without it, that question stays open forever.

Concrete sequence I'd ship:

1. **Day 1 morning**: schema migration adding `companies.harmonic_raw jsonb`, `companies.similar_urns jsonb`, `companies.highlights jsonb`, `people.harmonic_raw jsonb`, `people.experience jsonb`, `signals.harmonic_raw jsonb`. Update `lib/queries.ts` types.
2. **Day 1 afternoon**: `scripts/pigi/run.ts` that takes a domain list, calls the same `/companies?website_domain=…` endpoint your enrich route uses, then pulls similar + people + signals. Writes raw JSON. Concurrency = 4. Backoff on 429.
3. **Day 2 morning**: run Pigi on every company in your DB. Spot-check 5 records.
4. **Day 2 afternoon**: parser pass that fills the typed columns from `harmonic_raw` (headcount time-series, per-department breakdown, social followers, highlights) — this you can iterate on forever even after access ends, because the raw is cached.
5. **Then**: Tier 1.1 (Watchlists) is the highest-leverage UI feature. Start there.

---

## 5. What I need from you (now that you have direct API access)

Your note: _"I have a lot of access to Harmonic through my work and can give you the data you need."_ That changes the input model entirely. Instead of asking you to take screenshots, I'm asking you to run a small set of API calls and paste the raw JSON back to me. I'll use that to:

- Confirm which endpoints exist on your tier (vs. me guessing).
- Confirm response shapes so Pigi's parsers are right the first time.
- Reverse-engineer the signal-ranking shape (your point #2).

### Immediately — API recon

The exact list of calls and what to paste back is in the companion file: **[`PIGI-API-RECON.md`](./PIGI-API-RECON.md)**.

That file is structured so you can run each call, paste the response into a labeled section, and hand the whole thing back. Each section also notes _which gap-matrix item it unblocks_ so we don't pull anything we won't use.

### Soon

- The list of companies you want Pigi to walk first. Three options:
  1. Everything currently in your Eureka DB (cheapest, most-relevant).
  2. Everything in the equivalent Harmonic list / saved-search you maintain at work.
  3. A hand-curated set you give me as URLs or domains.
- Your work's Harmonic API key, dropped into `.env.local` as `HARMONIC_API_KEY` so Pigi can run from your machine.

### Eventually

- LinkedIn API credentials when you're ready. That unlocks Tier 2.7 + 2.8.
- A target deadline — how long do you expect Harmonic access to last? That changes how aggressively Pigi pulls (every 24h vs. every 6h vs. one-shot).

---

## 6. Open questions

- Does your Harmonic tier expose web traffic (SimilarWeb-style) data via API? If yes, that's a Tier 0 add for Pigi. (One probe call answers this — it's in the recon doc.)
- Does your tier have a `/saved_searches` or equivalent endpoint? If yes, we can sync your existing Harmonic saved searches into Eureka in one shot.
- Do you want Eureka lists to be folders (hierarchical) or flat? Affects the `lists` schema in Tier 1.1.
- Any need for a "Today" / "Evening Summary" homepage that's different from the dashboard? (Per BRIEF.md tagline, a calmer landing view that says "three things happened today" might fit the notebook aesthetic better than the current 4-KPI dashboard.)
- For signal ranking (deferred): once Pigi has cached a week's worth of signals, do you want me to (a) auto-derive a ranking by reverse-engineering Harmonic's apparent ordering, or (b) define a ranking from scratch using fields you care about (e.g. round-size × recency × your prior interest in the company)?

Sources cross-referenced for the Eureka inventory: `lib/schema.sql`, `lib/queries.ts`, `lib/stages.ts`, `lib/sectors.ts`, `app/api/enrich/route.ts`, `app/dashboard/DashboardClient.tsx`, `app/database/DatabaseClient.tsx`, `app/pipeline/PipelineClient.tsx`, `app/signals/SignalsFeed.tsx`, `app/search/SearchClient.tsx`, `app/companies/[id]/CompanyTabs.tsx`, `app/actions/companies.ts`, `components/Sidebar.tsx`, `app/layout.tsx`, `app/globals.css`, `package.json`, `design-handoff/BRIEF.md`, `design-handoff/PAGES.md`.
