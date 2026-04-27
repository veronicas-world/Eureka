# Eureka — Design Handoff

This folder is a self-contained package to hand to a Claude (or any designer) for a UI/UX redesign. It contains everything needed to understand what the app does, what the data looks like, and how the pages are currently structured — so the redesign work can focus on the visual and interaction layer rather than reverse-engineering the codebase.

## What's inside

```
design-handoff/
├── README.md          ← you are here
├── BRIEF.md           ← the vision, tone, constraints, do's and don'ts
├── PAGES.md           ← per-page context: route, files, data, user goals
├── code/              ← the design-relevant source code
│   ├── app/           ← every page.tsx and *Client.tsx
│   ├── components/    ← shared UI components (Sidebar, Badge, Button, Card, etc.)
│   ├── lib/           ← types, utilities, taxonomy (stages, sectors, countries)
│   ├── tailwind.config.ts
│   └── package.json   ← so the designer knows which libraries are available
└── screenshots/       ← drop your own screenshots here before handoff (see below)
```

Server-only code (`app/api/`, `app/actions/`, the SQL schema, Supabase clients) is **deliberately excluded** — designs do not need it and shipping it would just add noise.

## How to use this with a fresh Claude conversation

1. Open a new conversation with Claude (claude.ai works fine; Claude Code or the desktop app is even better since it can read all files at once).
2. Drop the entire `design-handoff/` folder into the conversation.
3. Type something like:

   > Read BRIEF.md and PAGES.md first, then skim the code in code/. After that, propose a redesign for the [Dashboard / Database / etc.] page that follows the brief. Show me your work as updated TSX files using the existing Tailwind utility approach.

4. Iterate page by page. Don't ask for a full redesign of every page in one shot — the responses will be too shallow.

## Before handing off — add screenshots

The `screenshots/` folder is empty. Before sending this bundle to the designer, add screenshots of every page in its **current** state. The designer needs visuals to understand what's actually happening — code alone misses the feel of how dense or sparse a page renders with real data.

Suggested capture list (one screenshot each, named exactly):

```
screenshots/
├── 01-dashboard.png
├── 02-database.png
├── 03-database-with-filters.png
├── 04-search-empty.png
├── 05-search-with-filters-open.png
├── 06-search-results.png
├── 07-pipeline.png
├── 08-signals.png
├── 09-company-overview.png
├── 10-company-funding.png
├── 11-company-traction.png
├── 12-company-people.png
├── 13-new-company.png
└── 14-edit-company.png
```

Include both empty states and populated states where the difference is meaningful.

## Tech stack quick-reference (for the designer)

- **Next.js 16** (App Router, RSC) — pages are server components by default; client interactivity lives in `*Client.tsx` files
- **React 19**
- **TypeScript** (strict)
- **Tailwind CSS** — utility-first, no separate design system framework
- **Recharts** — all charts (bar charts on Dashboard, combo chart on Overview, headcount/metric charts on Traction)
- **lucide-react** — all icons
- **@dnd-kit** — drag-and-drop on the Database page
- **Supabase** — data store (designer doesn't touch this)

## What to ask the redesign Claude to deliver

For each page redesign, request:

1. The updated `*Client.tsx` (or `page.tsx` for server-only pages) as a complete file
2. A short note explaining the design decisions
3. Any new shared components broken out into `components/` if they'll be reused

Avoid asking for: a Figma file, a design system spec doc, branded marketing pages, or a logo. None of that is needed.

## Constraints worth re-stating

- **Don't break** the data shape: the redesign must work with the same fields exposed by `lib/queries.ts` and the same enums in `lib/stages.ts`
- **Don't swap** Tailwind for another styling approach
- **Don't add** a marketing site, auth flow, or onboarding — Eureka is a single-user tool with no signup
- **Don't introduce emojis** — see BRIEF.md for the celestial Unicode characters that ARE wanted
