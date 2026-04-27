'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const nav = [
  {
    id: 'dashboard',
    label: 'dashboard',
    href: '/dashboard',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'database',
    label: 'database',
    href: '/database',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
      </svg>
    ),
  },
  {
    id: 'pipeline',
    label: 'pipeline',
    href: '/pipeline',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h7" /><path d="M14 12h7" /><path d="M3 18h7" />
        <path d="M3 6v12" /><path d="M14 12v6" />
      </svg>
    ),
  },
  {
    id: 'signals',
    label: 'signals',
    href: '/signals',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'search',
    href: '/search',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: 'var(--nav)',
        borderRight: '1px solid var(--nav-hairline)',
        color: 'var(--nav-ink)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-baseline gap-2 px-[22px] py-[22px]"
        style={{ borderBottom: '1px solid var(--nav-hairline)' }}
      >
        <span style={{ color: 'var(--ink-ghost)', fontSize: 13, opacity: 0.8 }}>｡☾⋆⁺</span>
        <span
          className="tracking-wide"
          style={{ fontSize: 18, fontWeight: 700, color: '#E9EBF7', letterSpacing: '0.02em' }}
        >
          eureka
        </span>
        <span style={{ color: 'var(--ink-ghost)', fontSize: 13, opacity: 0.8 }}>⋆˚‧</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4">
        <div
          className="px-2.5 pb-1.5 pt-0"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--nav-ink-soft)',
          }}
        >
          notebook
        </div>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded transition-all',
                active
                  ? 'text-white'
                  : 'hover:bg-white/[0.04]'
              )}
              style={{
                fontSize: 13,
                color: active ? '#FFFFFF' : 'var(--nav-ink)',
                opacity: active ? 1 : 0.78,
                background: active ? 'var(--nav-active)' : undefined,
              }}
            >
              <span style={{ opacity: active ? 1 : 0.75 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-[22px] py-4 flex flex-col gap-1"
        style={{ borderTop: '1px solid var(--nav-hairline)', fontSize: 10, color: 'var(--nav-ink-soft)' }}
      >
        <span style={{ color: 'var(--ink-ghost)', fontSize: 11, opacity: 0.7 }}>☾ evening shift</span>
        <span style={{ letterSpacing: '0.05em' }}>v0.2 · eureka</span>
      </div>
    </aside>
  )
}
