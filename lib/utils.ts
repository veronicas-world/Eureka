export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number | undefined): string {
  if (!value) return '—'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export function formatGrowth(pct: number | null | undefined): string {
  if (pct == null) return ''
  const sign = pct > 0 ? '+' : ''
  return `${sign}${(pct * 100).toFixed(1)}%`
}
