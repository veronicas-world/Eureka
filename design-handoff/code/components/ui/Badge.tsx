import { cn } from '@/lib/utils'
import { STAGE_LABELS, type Stage } from '@/lib/stages'

type BadgeVariant = 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' | 'amber'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  green:   'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  yellow:  'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
  red:     'bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/20',
  blue:    'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  purple:  'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20',
  amber:   'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  gray:    'bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function SignalBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-gray-400">—</span>
  const variant = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'
  return (
    <Badge variant={variant} className="tabular-nums font-semibold">
      {score}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    tracking:        'blue',
    outreached:      'purple',
    'meeting booked':'amber',
    passed:          'gray',
    portfolio:       'green',
  }
  const labels: Record<string, string> = {
    tracking:        'Tracking',
    outreached:      'Outreached',
    'meeting booked':'Meeting Booked',
    passed:          'Passed',
    portfolio:       'Portfolio',
  }
  return (
    <Badge variant={map[status] ?? 'default'}>
      {labels[status] ?? status}
    </Badge>
  )
}

export function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage as Stage] ?? stage
  return (
    <Badge variant="gray">
      {label}
    </Badge>
  )
}
