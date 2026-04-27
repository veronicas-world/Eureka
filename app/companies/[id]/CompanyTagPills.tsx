'use client'

import type { CompanyRow } from '@/lib/queries'

// ── Pill color palette per tag category ───────────────────────────────────────

type PillStyle = { bg: string; color: string }

const PILL_STYLES: Record<string, PillStyle> = {
  MARKET_VERTICAL:     { bg: '#ede9f5', color: '#4a3270' },
  MARKET_SUB_VERTICAL: { bg: '#ddd5ee', color: '#4a3270' },
  CUSTOMER_TYPE:       { bg: '#f5dde8', color: '#5a2845' },
  TECHNOLOGY_TYPE:     { bg: '#f5dde8', color: '#5a2845' },
  YC_BATCH:            { bg: '#fdf0dc', color: '#6a3a10' },
  AFFINITY:            { bg: '#d8eaf7', color: '#1a3a60' },
  HIGHLIGHT:           { bg: '#d8eaf7', color: '#1a3a60' },
}

const DEFAULT_PILL: PillStyle = { bg: '#f3f4f6', color: '#374151' }

// Category display labels for tooltips
const CATEGORY_LABELS: Record<string, string> = {
  MARKET_VERTICAL:     'Market vertical',
  MARKET_SUB_VERTICAL: 'Market sub-vertical',
  CUSTOMER_TYPE:       'Customer type',
  TECHNOLOGY_TYPE:     'Technology type',
  YC_BATCH:            'YC Batch',
  AFFINITY:            'Affinity',
  HIGHLIGHT:           'Highlights',
}

// Canonical group ordering
const GROUP_ORDER = [
  'MARKET_VERTICAL',
  'MARKET_SUB_VERTICAL',
  'CUSTOMER_TYPE',
  'TECHNOLOGY_TYPE',
  'YC_BATCH',
  'AFFINITY',
  'HIGHLIGHT',
]

// ── Types ─────────────────────────────────────────────────────────────────────

type Tag = { type: string; display_value: string }
type Highlight = { text?: string; category?: string }

type TagGroup = {
  type: string
  label: string
  values: string[]
  style: PillStyle
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTags(raw: unknown): Tag[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object')
    .map((t) => ({
      type:          typeof t.type          === 'string' ? t.type          : '',
      display_value: typeof t.display_value === 'string' ? t.display_value : '',
    }))
    .filter((t) => t.display_value)
}

function parseHighlights(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h): h is Highlight => h !== null && typeof h === 'object')
    .map((h) => h.text ?? h.category ?? '')
    .filter(Boolean) as string[]
}

function buildGroups(tags: Tag[], highlights: string[]): TagGroup[] {
  // Group tags by type
  const map = new Map<string, string[]>()
  for (const tag of tags) {
    const existing = map.get(tag.type) ?? []
    existing.push(tag.display_value)
    map.set(tag.type, existing)
  }

  if (highlights.length > 0) {
    map.set('HIGHLIGHT', highlights)
  }

  // Sort: canonical order first, then alphabetical for unknown types
  const types = [...map.keys()].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a)
    const bi = GROUP_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return types.map((type) => ({
    type,
    label: CATEGORY_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase(),
    values: map.get(type)!,
    style: PILL_STYLES[type] ?? DEFAULT_PILL,
  }))
}

// ── Pill with tooltip ─────────────────────────────────────────────────────────

function TagPill({ group }: { group: TagGroup }) {
  const firstValue = group.values[0]
  const extra = group.values.length - 1
  const { bg, color } = group.style
  const tooltipText = `${group.label}: ${group.values.join(', ')}`

  return (
    <div className="relative group/pill inline-flex items-center gap-0.5">
      <span
        className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium whitespace-nowrap select-none"
        style={{ background: bg, color }}
      >
        {firstValue}
      </span>
      {extra > 0 && (
        <span
          className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium select-none"
          style={{ background: bg, color, opacity: 0.75 }}
        >
          +{extra}
        </span>
      )}
      {/* Tooltip */}
      <div
        className="absolute bottom-full left-0 mb-1.5 hidden group-hover/pill:block z-20 pointer-events-none"
        style={{ minWidth: 120 }}
      >
        <div
          className="rounded-lg shadow-xl px-3 py-2 text-xs"
          style={{ background: 'var(--ink, #111827)', color: 'var(--paper, #f9fafb)' }}
        >
          <p className="font-semibold uppercase tracking-wide mb-1" style={{ fontSize: 9.5, opacity: 0.6 }}>
            {group.label}
          </p>
          <p className="leading-snug" style={{ whiteSpace: 'normal', maxWidth: 240 }}>
            {tooltipText.replace(`${group.label}: `, '')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CompanyTagPills({ company }: { company: CompanyRow }) {
  const tags       = parseTags(company.tags_v2)
  const highlights = parseHighlights(company.highlights)
  const groups     = buildGroups(tags, highlights)

  if (groups.length === 0) return null

  return (
    <div
      className="bg-white border-x border-b border-gray-200 px-6 py-3 flex flex-wrap gap-1.5"
      style={{ borderTop: '1px solid #f3f4f6' }}
    >
      {groups.map((group) => (
        <TagPill key={group.type} group={group} />
      ))}
    </div>
  )
}
