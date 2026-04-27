'use client'

import { useState, useEffect } from 'react'

interface Props {
  name: string
  logoUrl?: string | null
  domain?: string | null
  size?: number
  shape?: 'circle' | 'square'
  className?: string
}

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN

function resolveDomain(input: string): string {
  try {
    const url = input.startsWith('http') ? input : `https://${input}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return input.replace(/^www\./, '').split('/')[0]
  }
}

function guessDomain(name: string): string {
  // Full slug first: "Goldman Sachs" → goldmansachs.com
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${slug}.com`
}


function buildSources(name: string, logoUrl?: string | null, domain?: string | null): string[] {
  const sources: string[] = []

  // 1. Direct logo URL from Harmonic
  if (logoUrl) sources.push(logoUrl)

  const resolvedDomain = domain ? resolveDomain(domain) : null
  const guessedDomain  = guessDomain(name)

  // 2. Logo.dev only when we have a confirmed real domain (from the website field).
  //    Guessed domains based on company name are too unreliable and return wrong logos.
  if (resolvedDomain) {
    sources.push(`https://img.logo.dev/${resolvedDomain}?token=${LOGO_DEV_TOKEN}`)
  }

  // 3. Google favicon — use confirmed domain if available, else fall back to name guess
  const faviconDomain = resolvedDomain ?? guessedDomain
  sources.push(`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=64`)

  return sources
}

const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-yellow-100 text-yellow-700',
  'bg-cyan-100 text-cyan-700',
]

function colorForName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]
}

export default function CompanyLogo({
  name,
  logoUrl,
  domain,
  size = 24,
  shape = 'circle',
  className = '',
}: Props) {
  const sources = buildSources(name, logoUrl, domain)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && idx < sources.length) {
      console.log(`[CompanyLogo] "${name}" → ${sources[idx]}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, name])

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded'
  const style = { width: size, height: size }

  if (idx >= sources.length) {
    return (
      <div
        className={`${shapeClass} ${colorForName(name)} border border-gray-200 flex items-center justify-center shrink-0 font-bold select-none ${className}`}
        style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      >
        {name[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[idx]}
      alt={name}
      className={`${shapeClass} object-contain bg-white shrink-0 ${className}`}
      style={style}
      onError={() => setIdx((i) => i + 1)}
    />
  )
}
