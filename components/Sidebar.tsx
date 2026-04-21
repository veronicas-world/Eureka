'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Database, Kanban, Zap, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { label: 'Database', href: '/database',  icon: Database },
  { label: 'Pipeline',  href: '/pipeline',  icon: Kanban   },
  { label: 'Signals',   href: '/signals',   icon: Zap      },
  { label: 'Search',    href: '/search',    icon: Search   },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen bg-[#111111] border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/[0.06]">
        <div className="w-5 h-5 rounded bg-white/90 flex items-center justify-center">
          <span className="text-[10px] font-black text-gray-900 leading-none">E</span>
        </div>
        <span className="text-[15px] font-semibold text-white tracking-tight">Eureka</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'
              )}
            >
              <Icon
                className={cn('shrink-0', active ? 'text-white' : 'text-zinc-500')}
                size={15}
                strokeWidth={active ? 2 : 1.75}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-zinc-600">Eureka v0.1</p>
      </div>
    </aside>
  )
}
