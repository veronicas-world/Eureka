# Pigi — Harmonic API recon checklist

_Last updated: 2026-04-27_

---

## Why this exists

Pigi (your bulk-extraction agent — `πηγή`, "spring / source") is what's going to pull every Harmonic response we can reach into Supabase before your work access ends. Before Pigi runs at scale, I need to know which endpoints actually exist on your tier, what their response shapes look like, and where Harmonic hides things like the per-signal ranking score.

You said you have direct API access through work. Perfect — that swaps out the screenshot recon for an **API recon**, which is far higher fidelity and far less work for you. Each section below is one short call you run, then paste the raw JSON back into a file at:

```
design-handoff/pigi-recon/<section-letter>-<short-name>.json
```

Then commit the whole `pigi-recon/` folder so I can read it. **Redact PII (your name, your email, internal team identifiers) but leave Harmonic's response structure intact** — I need every field name and nesting level to write Pigi's parsers.

If a call 4xx's, paste the error body anyway — that's the answer for "is this endpoint on my tier?"

---

## How to run these

You have two options. Pick whichever is easier.

### Option A: curl from your terminal

```bash
export HARMONIC_API_KEY=<your-work-key>

curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/<endpoint>" \
  | jq . > design-handoff/pigi-recon/<section>.json
```

### Option B: a tiny Node script

If you'd rather, I can drop a `scripts/pigi/recon.ts` that fans the whole list out in one shot — just say the word and I'll write it. You'd run `npm run pigi:recon` and it writes all the JSON files for you. (I haven't written it yet because I want you to confirm the endpoint list below first — no point automating a recon list I might have wrong.)

---

## Pin a test company first

Pick **one company you know is in Harmonic well** (lots of funding history, lots of people, lots of signals). Suggested: a famous AI/SaaS company with a Series B+ track record — e.g. `anthropic.com`, `stripe.com`, `notion.so`. Whichever you pick, use the **same domain throughout this doc** so I can cross-reference responses.

Write the chosen domain here when you start: `<TEST_COMPANY_DOMAIN = anthropic.com>`

You'll also need its `harmonic_urn` (returned from §A) for any URN-based call below.

---

## A. Company by domain — confirms baseline access

**Unblocks**: Tier 0.1, 0.4, 0.6 (whole Pigi core)

This is the call your existing `app/api/enrich/route.ts` already makes. We re-run it to capture the full untruncated response.

```bash
curl -s -X POST -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies?website_domain=$TEST_COMPANY_DOMAIN" \
  | jq . > design-handoff/pigi-recon/A-company-by-domain.json
```

**Specifically check the response includes:**
- `funding_rounds` → confirms funding-rounds add-on is on your tier
- `traction_metrics` → check what shape this takes (just buckets, or full series?)
- `highlights` → the affinity array (YC, Forbes 30u30, etc.)
- `tags_v2` → sub-sector hierarchy
- `customer_type`
- `socials`, `location`, `website`

---

## B. Person batch — confirms people add-on

**Unblocks**: Tier 0.5

Take 3–5 person URNs from §A's `people` array.

```bash
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/persons?urns=urn:harmonic:person:abc&urns=urn:harmonic:person:def" \
  | jq . > design-handoff/pigi-recon/B-persons-batch.json
```

**Specifically check:**
- Does each person include a full `experience[]` history array (not just `current_position`)? If yes, Tier 0.5 is trivially achievable.
- Does it include `education[]` with school names + degrees?
- Is there a `seniority` or `function` field?
- Any field that smells like "soon-to-be founder" prediction?

---

## C. Similar companies — confirms similarity graph access

**Unblocks**: Tier 0.2

Replace `<URN>` with the company URN from §A.

```bash
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies/<URN>/similar" \
  | jq . > design-handoff/pigi-recon/C-similar-companies.json
```

If 4xx, also try:
- `/companies/<URN>/similar_companies`
- `/companies/<URN>/recommendations`
- `/companies/similar?urn=<URN>`

Paste whatever works (or all four error bodies).

---

## D. Company signals — the signal-ranking question

**Unblocks**: Tier 0.9 + the deferred signal-ranking decision

This is the most important call in the whole recon, because it's the input to defining Eureka's signal ranking. Try whichever of these your tier exposes (paste all responses):

```bash
# Try 1: dedicated signals endpoint
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies/<URN>/signals" \
  | jq . > design-handoff/pigi-recon/D1-company-signals.json

# Try 2: events endpoint
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies/<URN>/events" \
  | jq . > design-handoff/pigi-recon/D2-company-events.json

# Try 3: timeline / activity
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies/<URN>/timeline" \
  | jq . > design-handoff/pigi-recon/D3-company-timeline.json

# Try 4: highlights flow
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies/<URN>/highlights" \
  | jq . > design-handoff/pigi-recon/D4-company-highlights.json
```

**Specifically check for:**
- Any field named `score`, `priority`, `rank`, `strength`, `magnitude`, `relevance`, `weight`. **This is the ranking signal we're deferring on — capture it now so we can define Eureka's ranking later.**
- A `type` enum (funding round / hiring spike / founder move / etc.).
- A `created_at` / `effective_at` timestamp.
- Whether there's a `trigger` payload (e.g. for hiring spikes: which department, what % growth).

---

## E. Saved searches — sync opportunity

**Unblocks**: Tier 1.2 cheap-shortcut (sync your existing Harmonic saved searches into Eureka in one shot)

```bash
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/saved_searches" \
  | jq . > design-handoff/pigi-recon/E1-saved-searches.json

# If that 4xx's:
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/users/me/saved_searches" \
  | jq . > design-handoff/pigi-recon/E2-my-saved-searches.json
```

If either works, we get a free first batch of saved-search seed data for Tier 1.2.

---

## F. Watchlists / lists — confirms list API exposure

**Unblocks**: Tier 1.1 cheap-shortcut (initial seed of your work-Harmonic lists into Eureka)

```bash
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/watchlists" \
  | jq . > design-handoff/pigi-recon/F1-watchlists.json

# Alternate names to try if F1 4xx's:
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/lists" \
  | jq . > design-handoff/pigi-recon/F2-lists.json

curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/users/me/watchlists" \
  | jq . > design-handoff/pigi-recon/F3-my-watchlists.json
```

If you have lists at work that you'd want mirrored into Eureka, this is the cleanest way in.

---

## G. Web traffic — open question

**Unblocks**: Open question §6 (whether to add web traffic to Pigi's pull set)

```bash
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/companies/<URN>/web_traffic" \
  | jq . > design-handoff/pigi-recon/G1-web-traffic.json
```

If §A's response already has a `web_traffic` field nested inside `traction_metrics`, skip §G — paste that subtree instead and label it `G2-web-traffic-inline.json`.

---

## H. People search — does Harmonic expose stealth-founder signals?

**Unblocks**: Open question — whether Tier 2.8 (stealth founder) is buildable today vs. needs LinkedIn API.

Try a small POST that filters for "left a top-tier company, no current employer":

```bash
curl -s -X POST -H "apikey: $HARMONIC_API_KEY" -H "content-type: application/json" \
  -d '{"filters":{"is_stealth_founder":true},"size":5}' \
  "https://api.harmonic.ai/persons/search" \
  | jq . > design-handoff/pigi-recon/H1-stealth-search.json
```

If that 4xx's, paste the error body — that's the answer.

Also try "soon-to-be founder" predictive flag if your UI exposes one:

```bash
curl -s -X POST -H "apikey: $HARMONIC_API_KEY" -H "content-type: application/json" \
  -d '{"filters":{"founder_prediction_score":{"gte":0.7}},"size":5}' \
  "https://api.harmonic.ai/persons/search" \
  | jq . > design-handoff/pigi-recon/H2-soon-to-be-founder.json
```

---

## I. Investor / firm intelligence

**Unblocks**: Tier 2.6 (investor profile pages)

Pick one investor name from §A's `funding_rounds[].investors`.

```bash
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/investors?name=Sequoia%20Capital" \
  | jq . > design-handoff/pigi-recon/I1-investor-by-name.json

# Or by URN if Harmonic exposes investor URNs:
curl -s -H "apikey: $HARMONIC_API_KEY" \
  "https://api.harmonic.ai/investors/<INVESTOR_URN>/portfolio" \
  | jq . > design-handoff/pigi-recon/I2-investor-portfolio.json
```

---

## J. AI / chat surface — does API expose Scout?

**Unblocks**: Tier 2.1 (AI search) — answers "do we use Harmonic's AI or roll our own?"

This is a long shot. Try whatever Scout-adjacent endpoint shows up in your Harmonic web app's network tab when you use the AI chat. (Open devtools, send one Scout query, copy the call.) Paste the request URL, headers, and response body to:

```
design-handoff/pigi-recon/J-scout-from-network-tab.json
```

If Scout is gated behind an internal-only endpoint, that's also the answer — we build our own AI search using cached `harmonic_raw`.

---

## K. Rate limits

**Unblocks**: Pigi's concurrency setting

Look at the response headers from any of the calls above. Specifically:
- `x-ratelimit-limit`
- `x-ratelimit-remaining`
- `retry-after` (only set on 429s)

Paste the headers to:

```
design-handoff/pigi-recon/K-rate-limit-headers.txt
```

This tells me whether to set Pigi's concurrency to 4 (conservative) or 16 (if your tier is generous).

---

## What I do once you paste these back

1. **Update `app/api/enrich/route.ts`** to read every confirmed field (lift the 20-person cap, pull experience history, capture highlights fully).
2. **Write `scripts/pigi/run.ts`** — Pigi v1, with the right concurrency, the right endpoint list, the right backoff.
3. **Write `lib/pigi/parsers/`** — one parser per Harmonic resource type, each consuming `harmonic_raw` and emitting Eureka-typed columns.
4. **Migration**: add `harmonic_raw`, `similar_urns`, `highlights`, `experience`, `harmonic_raw` (signals) jsonb columns.
5. **Run Pigi against your full Database**, spot-check 5 records, then leave it on a `--watch` schedule until access ends.
6. **Re-open the signal-ranking question** with §D's data in hand. Propose a concrete formula for Eureka's `signals.strength` based on what Harmonic's response actually contains.

---

## Coverage check — does this recon cover all five sidebar areas?

| Eureka sidebar | Recon covers it? |
|---|---|
| `/dashboard` | Indirectly — KPIs roll up from companies/signals data captured in §A and §D. |
| `/database` | §A (company shape) + §B (people) cover every column in the Database table. |
| `/pipeline` | n/a — pipeline is a UX over `companies.status`, no Harmonic data needed. |
| `/signals` | §D — directly. |
| `/search` | §A + §B + §H (people) + §F (saved searches) cover it. |
| `/companies/[id]` | §A (Overview, Funding, Highlights), §B (Team), §A traction subtree (Traction), §C (Similar), §D (Signals tab). All six tabs covered. |

If any of these feel under-covered after you skim the recon, flag it and I'll add a section.
