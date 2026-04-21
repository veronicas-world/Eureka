import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:     'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 shadow-sm',
  secondary:   'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
  ghost:       'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  outline:     'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-sm',
  destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm:  'h-7 px-2.5 text-xs gap-1.5',
  md:  'h-8 px-3 text-sm gap-2',
  lg:  'h-9 px-4 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-40',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
