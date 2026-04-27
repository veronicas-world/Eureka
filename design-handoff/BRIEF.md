# Eureka — Design Brief

## What this is

Eureka is a personal VC sourcing tool. One user (the founder/operator) tracks companies, signals, and pipeline. It is **not** a multi-tenant SaaS product. There is no marketing site. There is no onboarding. The user lands directly in the app.

The current implementation looks like a stripped-down clone of Harmonic.ai — clean, dense, data-first, minimal chrome. That is the **structural** north star and should be preserved. The visual identity, however, should pivot from "generic enterprise SaaS" to something that feels like the user's own.

## The aesthetic shift I want

Three pillars, in order of importance:

### 1. Blue, calm, evening tones

Move the palette away from neutral grays and emerald accents toward a twilight/evening blue spectrum. Imagine sitting with the app at the end of a long workday. Cool, quiet, unhurried. Suggested directions (designer to refine):

- **Primary surface:** very pale blue-tinted off-white (think paper at dusk)
- **Ink / text:** deep midnight blue rather than pure black
- **Accent:** a single muted twilight blue for primary actions and selected states
- **Secondary accent:** a soft dusty lavender or starlight silver for highlights
- **Avoid:** pure white, pure black, hot saturated colors, the existing emerald/amber/violet rainbow

Gradients are fine if they're whisper-soft (e.g. predawn-to-twilight on a hero card). No neon, no high-contrast cyberpunk.

### 2. Decorative celestial Unicode characters, sprinkled

These exact characters are part of the identity:

```
⋆˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺
```

These are **Unicode text glyphs**, not emojis. They render with the surrounding text color and weight. They should appear:

- As subtle dividers between sections
- As bullet markers in lists where bullets are appropriate
- Ornamentally beside page titles or section headers (sparingly)
- As a tiny watermark/flourish in empty states ("no signals yet ⋆˚‧₊")
- In the loading state, gently animated (e.g. twinkling opacity)

**Rules:**
- Sparingly. Two or three per screen, not a constellation on every line.
- Always at the same color/weight as nearby text — never colored.
- Never inside data values or interactive controls (don't put a star inside a button label).
- Pair them with whitespace; they should feel like punctuation, not decoration jammed in.

### 3. Typewriter / monospaced typography

The brand voice is a private notebook, not a dashboard product. Use a typewriter or refined monospace font for **everything**: headers, body, table cells, numbers. Pick one of these (designer to choose):

- **Special Elite** — most "typewriter," slightly distressed
- **Courier Prime** — clean typewriter, very readable at small sizes
- **JetBrains Mono** — modern, technical, still typewriter-adjacent
- **IBM Plex Mono** — neutral, professional, very legible (safest pick if Special Elite feels too costume-y)

Hierarchy comes from size and weight, not from mixing serif/sans/mono. Tabular numerals everywhere there are numbers (counts, funding, dates).

## What is explicitly NOT wanted

- Emojis (🚀✨🌙 etc.) — the celestial Unicode characters are the **only** non-letter glyph allowed
- Cute icons in the wrong places
- Pastel rainbow stage badges
- Marketing-y CTAs ("Get started!", "Discover insights")
- Skeuomorphism, glassmorphism, drop shadows that aren't whisper-soft
- Saturated warning/error reds — keep red muted and dignified

## What MUST be preserved (functional non-negotiables)

- The data model in `lib/queries.ts` and `lib/stages.ts` — designs must work with the existing fields
- Tailwind utility class approach (no CSS-in-JS swap, no MUI/Chakra rewrite)
- Recharts for charts (designer can change colors and density, but the chart library stays)
- lucide-react for icons (designer can choose which, but no swap to Heroicons/Phosphor)
- Sidebar navigation with the existing routes: Dashboard, Database, Pipeline, Signals, Search
- Drag-and-drop reordering on the Database page (visual treatment can change)
- URL-state filters on Search and Database (filter chips behavior can be redesigned)

## What is open for total redesign

- Every layout, spacing, type scale, color, border treatment, shadow
- The chart styling (bars vs alternative visualization is fine if it serves the data)
- Empty states, loading states, error states — these are very thin right now
- The shape of the company detail page (tabs are fine, but the in-tab layouts can be reimagined)
- The shape of the dashboard (the four KPIs + two charts + three lists is one option, not the only one)
- The pipeline page — it's the weakest page and the most open to reinvention

## Reference: Harmonic.ai

Look at Harmonic for: information density, the way filters live alongside results, the way company rows show stage/status/funding inline, the muted enterprise tone. Borrow the **structure**. Replace the **skin**.

## Tagline / voice

If copy is needed:

- Quiet, declarative, low-key.
- "Three companies tracked this week" not "🎉 You're crushing it!"
- Empty states that read like a margin note, e.g. "no signals yet ⋆˚‧₊  check back tomorrow"
- Never address the user in second person commands. The app is a notebook, not a coach.
