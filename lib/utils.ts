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
  PRE_SEED:             'Pre-Seed',
  SEED:                 'Seed',
  SERIES_A:             'Series A',
  SERIES_A_EXTENSION:   'Series A (Ext)',
  SERIES_A_EXT:         'Series A (Ext)',
  SERIES_B:             'Series B',
  SERIES_B_EXTENSION:   'Series B (Ext)',
  SERIES_C:             'Series C',
  SERIES_D:             'Series D',
  SERIES_E:             'Series E',
  GROWTH:               'Growth',
  VENTURE:              'Venture Round',
  STRATEGIC:            'Strategic Round',
  CONVERTIBLE_NOTE:     'Convertible Note',
  ANGEL:                'Angel Round',
  GRANT:                'Grant',
  DEBT:                 'Debt',
  DEBT_FINANCING:       'Debt Financing',
  ICO:                  'ICO',
  IPO:                  'IPO',
  PRIVATE_EQUITY:       'Private Equity',
  CORPORATE_ROUND:      'Corporate Round',
  POST_IPO_EQUITY:      'Post-IPO Equity',
  POST_IPO_DEBT:        'Post-IPO Debt',
  SECONDARY_MARKET:     'Secondary Market',
  NON_EQUITY_ASSISTANCE:'Non-Equity Assistance',
}

export function formatFundingRound(value: string | null | undefined): string {
  if (!value) return '—'
  if (ROUND_LABELS[value]) return ROUND_LABELS[value]
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
