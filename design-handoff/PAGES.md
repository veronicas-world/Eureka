# Page-by-page Context

For each page below: route → primary files → data → user goals → notes for redesign.

---

## Sidebar (always visible, every page)

- **Files:** `components/Sidebar.tsx`
- **Routes:** Dashboard, Database, Pipeline, Signals, Search
- **Notes:** Currently a dark sidebar with the brand mark "E Eureka" at the top. The mark could become a small celestial flourish + wordmark in the new typewriter font. Keep the order of routes.

---

## 1. Dashboard — `/dashboard`

- **Files:** `app/dashboard/page.tsx`, `app/dashboard/DashboardClient.tsx`
- **Data shown:**
  - Four KPIs: Total Companies, Tracking, Portfolio, Added (7d)
  - Pipeline by Status — horizontal bar chart, 5 fixed buckets (Tracking, Outreached, Meeting Booked, Passed, Portfolio). Bars are clickable → navigate to `/database?status=…`
  - Companies by Stage — horizontal bar chart, all 15 stages shown (Bootstrapped → IPO → Acquired). Scrollable inside fixed-height card. Bars clickable → `/database?stage=…`
  - Top by Signal Score — list of 5 companies ranked by `signal_score`
  - Recent Signals — 5 most recent rows from `signals` table
  - Recently Added — 6 most recent companies as small cards
- **User goal (5s):** "What's new in my world today?"
- **User goal (30s):** "What should I open first?"
- **Open for redesign:** the layout grid, the chart visualization choice, the ordering of sections. The data shape is fixed.

---

## 2. Database — `/database`

- **Files:** `app/database/page.tsx`, `app/database/DatabaseClient.tsx`
- **Data shown:** A table of every company with columns: drag handle, name + logo, sector, stage, status, country, headcount, total funding, last round, founded year, signal score
- **Filters:** Stage, Status, Sector, free-text search. Filter values come from URL params and persist on reload. Filtering is client-side after the initial server fetch.
- **Drag-and-drop:** Rows reorder via @dnd-kit. New ordering is persisted to a `display_order` column. The grip handle is in the leftmost column. (Drag activation distance is 6px so row clicks still work.)
- **Each row:** clicks through to `/companies/[id]`
- **User goal:** scan, filter, sort, jump into any company.
- **Notes for redesign:** This is the densest page. It must stay scannable. Treat it like a printed ledger — generous line height, tabular numerals, very subtle row separators (probably no full borders — try alternating row tints in the palest twilight blues).

---

## 3. Search — `/search`

- **Files:** `app/search/page.tsx`, `app/search/SearchClient.tsx`
- **Data shown:**
  - Big search input at top (companies, people, signals — text matches name/description/sector for companies, name/title/email for people, headline/detail for signals)
  - Toggleable filter panel below: Stage chips, Status chips, Sector (searchable picker), Country (searchable picker), Headcount range, Funding range, Founded-year range, Investors (searchable with All/Funds/Angels tabs)
  - Active filter chips render below the panel
  - Results split into three sections: Companies, People, Signals
- **User goal:** "I'm looking for X" — free-form discovery.
- **Notes for redesign:** the filter panel currently feels generic-SaaS. Could be reimagined as a left-side rail like Harmonic's. Keep the searchable picker pattern (`SearchablePicker` and `InvestorPicker` in `SearchClient.tsx`) — that interaction is good, just reskin it.

---

## 4. Pipeline — `/pipeline`

- **Files:** `app/pipeline/page.tsx`, `app/pipeline/PipelineClient.tsx`
- **Data shown:** Companies grouped by `status` (Tracking / Outreached / Meeting Booked / Passed / Portfolio).
- **User goal:** see where deals stand at a glance, move them between stages.
- **Notes for redesign:** This is the **weakest page** in the current build and the most open to reinvention. Currently it's a basic kanban-style layout. Could be redesigned as: a vertical timeline, a board with drag-between-columns, or an "evening summary" card. Use this page to show off the new aesthetic.

---

## 5. Signals — `/signals`

- **Files:** `app/signals/page.tsx`, `app/signals/SignalsFeed.tsx`
- **Data shown:** A feed of all signals (funding events, hiring spikes, news, founder moves, product launches), each with a strength (strong / moderate / weak), a headline, a source, a date, and a link back to the company.
- **User goal:** "What's happened recently across all my tracked companies?"
- **Notes for redesign:** Treat as a chronological journal. Date dividers ("April 27 ⋆˚‧₊") would fit the celestial vibe. Strength can be conveyed by ink density (faint/medium/dark) instead of colored badges.

---

## 6. Company detail — `/companies/[id]`

- **Files:** `app/companies/[id]/page.tsx`, `CompanyTabs.tsx`, `OverviewChart.tsx`, `FundingTab.tsx`, `TractionTab.tsx`, `HeadcountChart.tsx`, `MetricChart.tsx`, `DeleteCompanyButton.tsx`
- **Tabs:** Overview, Funding, Traction, People (some live in tab files, some inline)
- **Data shown:**
  - **Overview:** name, logo, description, stage, status, sector, country, founded year, employee count, total funding, signal score, key metrics chart (headcount + funding over time as a combo chart), related companies
  - **Funding:** total raised, funding rounds count, latest valuation, last round info, full funding rounds timeline (parsed from `funding_rounds_data` JSON)
  - **Traction:** headcount growth at 30d / 90d / 6m windows, charts for each metric
  - **People:** founders, current employees, prior companies, education backgrounds
- **User goal:** "Tell me everything about this company in 30 seconds."
- **Notes for redesign:** This is where typewriter typography will shine — long-form data laid out like a notebook entry. Dossier feel, not dashboard feel.

---

## 7. New company — `/companies/new`

- **Files:** `app/companies/new/page.tsx`
- **What it is:** A form to manually add a company. Fields: name, website, sector, stage, status, country, etc.
- **User goal:** quick capture.
- **Notes for redesign:** Currently a generic stacked form. Could be reimagined as an index card / handwritten memo aesthetic.

---

## 8. Edit company — `/companies/[id]/edit`

- **Files:** `app/companies/[id]/edit/page.tsx`, `EditCompanyClient.tsx`
- **What it is:** Same fields as new, populated. Has an Enrich button that calls Harmonic to backfill data.
- **Notes for redesign:** The Enrich button is the most important affordance here — make it feel intentional, like striking a match.

---

## Shared components

Located in `components/`:

- **`Sidebar.tsx`** — global nav
- **`CompanyLogo.tsx`** — square or round avatar with fallback initials, used everywhere
- **`SchoolLogo.tsx`** — same pattern for education entries on People
- **`EnrichButton.tsx`** — "fetch from Harmonic" trigger button
- **`ui/Badge.tsx`** — `Badge`, `StageBadge`, `StatusBadge`, `SignalBadge` — currently colored pills, ripe for a redesign into more typographic treatments
- **`ui/Button.tsx`** — primary/secondary/ghost button variants
- **`ui/Card.tsx`** — wrapper card with border + shadow

These components are used across every page — redesigning these gets you 70% of the visual transformation.
