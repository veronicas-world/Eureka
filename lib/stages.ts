/**
 * Canonical funding stages used site-wide (filters, dashboard, badges, forms).
 *
 * NOTE: the database `companies.stage` column has a CHECK constraint. To allow
 * these new values, run the migration in lib/schema.sql (see "stage constraint
 * expansion" section).
 */

export type Stage =
  | 'bootstrapped'
  | 'pre-seed'
  | 'seed'
  | 'series-a'
  | 'series-b'
  | 'series-c'
  | 'series-d'
  | 'series-e'
  | 'series-f'
  | 'series-g'
  | 'series-h'
  | 'growth'
  | 'private'
  | 'ipo'
  | 'acquired'
  | 'venture-unknown'

export const STAGE_OPTIONS: { value: Stage; label: string; color: string }[] = [
  { value: 'bootstrapped', label: 'Bootstrapped', color: '#9ca3af' },
  { value: 'pre-seed',     label: 'Pre-Seed',     color: '#a78bfa' },
  { value: 'seed',         label: 'Seed',         color: '#60a5fa' },
  { value: 'series-a',     label: 'Series A',     color: '#34d399' },
  { value: 'series-b',     label: 'Series B',     color: '#fbbf24' },
  { value: 'series-c',     label: 'Series C',     color: '#fb923c' },
  { value: 'series-d',     label: 'Series D',     color: '#f87171' },
  { value: 'series-e',     label: 'Series E',     color: '#ec4899' },
  { value: 'series-f',     label: 'Series F',     color: '#c084fc' },
  { value: 'series-g',     label: 'Series G',     color: '#818cf8' },
  { value: 'series-h',     label: 'Series H',     color: '#22d3ee' },
  { value: 'growth',       label: 'Growth',       color: '#f97316' },
  { value: 'private',      label: 'Private',      color: '#475569' },
  { value: 'ipo',          label: 'IPO',          color: '#06b6d4' },
  { value: 'acquired',         label: 'Acquired',            color: '#6b7280' },
  { value: 'venture-unknown', label: 'Venture (Unknown)',    color: '#94a3b8' },
]

export const STAGE_VALUES = STAGE_OPTIONS.map((s) => s.value)

export const STAGE_LABELS = Object.fromEntries(
  STAGE_OPTIONS.map((s) => [s.value, s.label])
) as Record<Stage, string>
