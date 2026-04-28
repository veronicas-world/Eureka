# Pigi — Character Design Notes

> Source reference: Veronica's hand-drawn sketch shared in chat on 2026-04-27.
> The original image should be saved alongside this file as
> `pigi-character/pigi-sketch-v1.png` for permanent archival.

## What Pigi looks like

Pigi is a small five-pointed star with a kawaii face — two closed-eye-shaped
expressions and a tiny smile. She wears a tall pointed wizard's hat decorated
with little stars. She holds a magic wand tipped with a star, and small
four-pointed sparkle-stars trail from the wand tip.

Drawn in black ink on white paper. Hand-drawn, slightly imperfect linework. The
sketch quality is part of the brief — Pigi should feel personal, notebook-like,
and slightly mischievous, not corporate or polished.

## Design pillars

**Celestial.** A star, not an animal or human. This connects to the etymology
(πηγή = source) extended one layer — a stellar source, a point of light that
reveals other points of light. Fits VC sourcing: she finds the next stars.

**Soft & kawaii.** Closed-eye smile, round-ish star body. Friendly to look at
even when she's delivering bad news ("this company you tracked just got
acquired and you missed it"). She should never feel like a dashboard widget.

**Magical.** The wizard hat and wand are the active elements. When Pigi is
*doing* something — running, fetching, surfacing a signal — the wand is where
the action lives. Sparkles trail behind animated motion.

**Hand-drawn.** Vector versions should preserve the wobble and imperfection of
the ink lines. No clean geometric reconstructions. If we move to SVG, trace by
hand or use an "ink" filter.

## Forms / states

These are sketches for how Pigi expresses different states in the UI:

| State        | Visual                                                           |
|--------------|------------------------------------------------------------------|
| Idle         | Star + hat, eyes closed, wand at rest, no sparkles               |
| Running      | Wand raised, sparkles actively trailing, slight bob animation    |
| Found something | Eyes open wide, wand pointing toward the discovery, more stars  |
| Empty / nothing new | Star slightly smaller, hat tilted, no wand sparkles      |
| Error / failed run | Hat slightly askew, one eye squinting, no sparkles        |
| Sleeping (between runs) | Tiny "z" near her head, stars trailing slowly        |

Veronica may draw additional forms over time — they should all live in
`design-handoff/pigi-character/` and be referenced here.

## Color palette (proposed)

Pigi's natural state is the same twilight palette as the rest of Eureka:

- Star body fill: `--paper` (#F4F2EB) — she stays light against the dark hat
- Star body outline: `--ink` (#1B2240) — the ink-on-paper feeling
- Hat fill: `--accent` (#5B73B8) — twilight blue
- Hat stars + wand sparkles: `--paper` against the accent, or warm gold
  (#E6C57A) on light backgrounds for contrast
- Face expressions: `--ink` strokes only, no fills

## Where Pigi appears

These are the planned UI surfaces (Phase 3):

- **Sidebar avatar** — small (24×24) idle pose, next to "Pigi" nav label
- **Pigi home page header** — large (120×120) animated when Pigi has new
  signals to show; idle when not
- **Loading states** — running pose with wand sparkles, replaces generic
  spinners on any Pigi-driven action (Enrich button, Run Pigi Now, etc.)
- **Empty states** — sleeping pose with the "no companies match these
  filters" / "no signals yet" copy
- **Error toast icon** — small askew-hat pose, paired with red toast colors

## Voice / personality (working notes)

Pigi doesn't talk a lot. When she does, she's quiet, observational, and a bit
poetic. Examples of how she might phrase things in the UI:

- "Found something new at acme.co" *(not "New result: 1 record updated")*
- "Sleeping until tomorrow morning" *(not "Next scheduled run: 24h")*
- "Couldn't reach Harmonic just now — I'll try again" *(not "API error 503")*
- "Quiet today" *(empty state)*

She refers to herself in the first person occasionally but never aggressively
("I'll keep watching" rather than "Pigi is monitoring"). She is *not* a
chatbot — these are short status whispers, never a dialogue.

## Implementation notes (for Phase 3)

When we build her UI presence, the avatar should be a single SVG that we
can swap variants of via CSS class (`.pigi-idle`, `.pigi-running`, etc.).
The wand sparkles should be CSS-animated, not part of the SVG — that lets
us reuse the same body across states.

If we want her to feel truly hand-drawn we should consider exporting from
Veronica's actual sketches rather than re-drawing in vector. A scan + careful
SVG trace preserves the imperfection in a way Figma wouldn't.

---

*This is a living document. Update as Veronica draws new forms.*
