export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return '—'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

const ROUND_LABELS: Record<string, string> = {
  BOOTSTRAPPED:           'Bootstrapped',
  PRE_SEED:               'Pre-Seed',
  SEED:                   'Seed',
  SEED_EXTENSION:         'Seed (Ext)',
  SERIES_A:               'Series A',
  SERIES_A_EXTENSION:     'Series A (Ext)',
  SERIES_A_EXT:           'Series A (Ext)',
  SERIES_B:               'Series B',
  SERIES_B_EXTENSION:     'Series B (Ext)',
  SERIES_C:               'Series C',
  SERIES_D:               'Series D',
  SERIES_E:               'Series E',
  SERIES_F:               'Series F',
  SERIES_G:               'Series G',
  SERIES_H:               'Series H',
  GROWTH:                 'Growth',
  LATE_STAGE:             'Late Stage',
  VENTURE:                'Venture Round',
  STRATEGIC:              'Strategic Round',
  CONVERTIBLE_NOTE:       'Convertible Note',
  ANGEL:                  'Angel Round',
  GRANT:                  'Grant',
  DEBT:                   'Debt',
  DEBT_FINANCING:         'Debt Financing',
  ICO:                    'ICO',
  IPO:                    'IPO',
  PUBLIC:                 'Public',
  PRIVATE_EQUITY:         'Private Equity',
  CORPORATE_ROUND:        'Corporate Round',
  POST_IPO_EQUITY:        'Post-IPO Equity',
  POST_IPO_DEBT:          'Post-IPO Debt',
  SECONDARY_MARKET:       'Secondary Market',
  NON_EQUITY_ASSISTANCE:  'Non-Equity Assistance',
  // M&A variants — Harmonic uses several spellings; map them all to "M&A"
  M_AND_A:                'M&A',
  MERGER:                 'M&A',
  ACQUISITION:            'M&A',
  ACQUIRED:               'M&A',
  MERGER_OR_ACQUISITION:  'M&A',
  MERGER_AND_ACQUISITION: 'M&A',
  M_A:                    'M&A',
}

export function formatFundingRound(value: string | null | undefined): string {
  if (!value) return '—'
  // Normalise so callers don't have to: try the raw value first, then a
  // canonical UPPER_SNAKE form so "Merger and Acquisition", "merger_or_acquisition",
  // "m and a" all hit the same M&A label.
  if (ROUND_LABELS[value]) return ROUND_LABELS[value]
  const normalised = value
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (ROUND_LABELS[normalised]) return ROUND_LABELS[normalised]
  // Fallback: replace underscores with spaces, title-case each word
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const DEGREE_LABELS: Record<string, string | null> = {
  BACHELORS_DEGREE:    'B.S.',
  BACHELOR_OF_SCIENCE: 'B.S.',
  BACHELOR_OF_ARTS:    'B.A.',
  MASTERS_DEGREE:      'M.S.',
  MASTER_OF_SCIENCE:   'M.S.',
  MASTER_OF_ARTS:      'M.A.',
  MBA:                 'MBA',
  DOCTORATE_DEGREE:    'Ph.D.',
  PHD:                 'Ph.D.',
  JURIS_DOCTOR:        'J.D.',
  ASSOCIATE_DEGREE:    'A.S.',
  HIGH_SCHOOL:         null,   // hide entirely
  HIGH_SCHOOL_DIPLOMA: null,
}

/** Returns a short formatted degree label, or null if it should be hidden. */
export function formatDegree(raw: string | null | undefined): string | null {
  if (!raw) return null
  const upper = raw.toUpperCase().replace(/\s+/g, '_')
  if (upper in DEGREE_LABELS) return DEGREE_LABELS[upper]
  // Unknown value — hide it (don't show raw all-caps strings)
  return null
}

export function formatGrowth(pct: number | null | undefined): string {
  if (pct == null || pct === 0) return ''
  const sign = pct > 0 ? '+' : ''
  return `${sign}${(pct * 100).toFixed(1)}%`
}
