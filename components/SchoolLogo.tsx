'use client'

import { useState, useEffect } from 'react'
import { GraduationCap } from 'lucide-react'

interface Props {
  school: string
  size?: number
  className?: string
}

const LOGO_DEV_TOKEN = 'pk_X5OGByKSRwKnHgUHHFRlaw'

// Ordered list: first match wins. More specific entries come first.
const KNOWN: Array<[string, string]> = [
  // Named business schools / programmes (more specific — before generic university names)
  ['harvard business',              'harvard.edu'],
  ['columbia business',             'columbia.edu'],
  ['wharton',                       'upenn.edu'],
  ['sloan',                         'mit.edu'],
  ['booth',                         'uchicago.edu'],
  ['kellogg',                       'northwestern.edu'],
  ['haas',                          'berkeley.edu'],
  ['stern',                         'nyu.edu'],
  ['fuqua',                         'duke.edu'],
  ['ross',                          'umich.edu'],
  ['mccombs',                       'utexas.edu'],
  ['darden',                        'virginia.edu'],
  ['tuck',                          'dartmouth.edu'],
  ['johnson',                       'cornell.edu'],
  ['tepper',                        'cmu.edu'],
  ['fisher',                        'osu.edu'],
  ['hbs',                           'harvard.edu'],
  ['insead',                        'insead.edu'],
  ['london business school',        'london.edu'],
  ['lbs',                           'london.edu'],
  // Universities — specific multi-word matches first
  ['massachusetts institute',       'mit.edu'],
  ['carnegie mellon',               'cmu.edu'],
  ['georgia institute of technology','gatech.edu'],
  ['georgia tech',                  'gatech.edu'],
  ['university of chicago',         'uchicago.edu'],
  ['university of california, berkeley', 'berkeley.edu'],
  ['uc berkeley',                   'berkeley.edu'],
  ['university of california, los angeles', 'ucla.edu'],
  ['uc los angeles',                'ucla.edu'],
  ['university of california, san diego', 'ucsd.edu'],
  ['uc san diego',                  'ucsd.edu'],
  ['university of southern california', 'usc.edu'],
  ['university of michigan',        'umich.edu'],
  ['university of texas at austin', 'utexas.edu'],
  ['university of texas',           'utexas.edu'],
  ['university of illinois',        'illinois.edu'],
  ['university of florida',         'ufl.edu'],
  ['university of north carolina',  'unc.edu'],
  ['university of minnesota',       'umn.edu'],
  ['university of wisconsin',       'wisc.edu'],
  ['university of maryland',        'umd.edu'],
  ['university of pennsylvania',    'upenn.edu'],
  ['university of washington',      'washington.edu'],
  ['university of virginia',        'virginia.edu'],
  ['university of toronto',         'utoronto.ca'],
  ['university of british columbia','ubc.ca'],
  ['university of waterloo',        'uwaterloo.ca'],
  ['new york university',           'nyu.edu'],
  ['boston university',             'bu.edu'],
  ['boston college',                'bc.edu'],
  ['ohio state',                    'osu.edu'],
  ['imperial college',              'imperial.ac.uk'],
  ['london school of economics',    'lse.ac.uk'],
  ['indian institute of technology','iitb.ac.in'],
  ['eth zurich',                    'ethz.ch'],
  ['ecole polytechnique',           'polytechnique.edu'],
  // Single-word / short matches last
  ['stanford',                      'stanford.edu'],
  ['harvard',                       'harvard.edu'],
  ['mit',                           'mit.edu'],
  ['yale',                          'yale.edu'],
  ['princeton',                     'princeton.edu'],
  ['columbia',                      'columbia.edu'],
  ['cornell',                       'cornell.edu'],
  ['upenn',                         'upenn.edu'],
  ['u penn',                        'upenn.edu'],
  ['brown',                         'brown.edu'],
  ['dartmouth',                     'dartmouth.edu'],
  ['duke',                          'duke.edu'],
  ['northwestern',                  'northwestern.edu'],
  ['uchicago',                      'uchicago.edu'],
  ['berkeley',                      'berkeley.edu'],
  ['ucla',                          'ucla.edu'],
  ['ucsd',                          'ucsd.edu'],
  ['usc',                           'usc.edu'],
  ['michigan',                      'umich.edu'],
  ['gatech',                        'gatech.edu'],
  ['carnegie',                      'cmu.edu'],
  ['cmu',                           'cmu.edu'],
  ['caltech',                       'caltech.edu'],
  ['nyu',                           'nyu.edu'],
  ['virginia',                      'virginia.edu'],
  ['illinois',                      'illinois.edu'],
  ['purdue',                        'purdue.edu'],
  ['unc',                           'unc.edu'],
  ['ut austin',                     'utexas.edu'],
  ['oxford',                        'ox.ac.uk'],
  ['cambridge',                     'cam.ac.uk'],
  ['lse',                           'lse.ac.uk'],
  ['iit',                           'iitb.ac.in'],
  ['tsinghua',                      'tsinghua.edu.cn'],
  ['peking',                        'pku.edu.cn'],
]

function resolveDomain(name: string): string {
  const lower = name.toLowerCase()

  // Check known table first
  for (const [key, domain] of KNOWN) {
    if (lower.includes(key)) return domain
  }

  // Pattern: "University of X" → x.edu
  const uniOf = lower.match(/university of ([a-z\s]+?)(?:\s*[,(\-]|$)/)
  if (uniOf) {
    const word = uniOf[1].trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')
    if (word) return `${word}.edu`
  }

  // Pattern: "X University" / "X College" / "X Institute" → x.edu
  const xUni = lower.match(/^([a-z]+)\s+(?:university|college|institute)/)
  if (xUni) return `${xUni[1].replace(/[^a-z0-9]/g, '')}.edu`

  // Fallback: first word + .edu
  const first = lower.split(/[\s,]/)[0].replace(/[^a-z0-9]/g, '')
  return `${first}.edu`
}

export default function SchoolLogo({ school, size = 20, className = '' }: Props) {
  const domain = resolveDomain(school)
  const sources = [
    `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  ]
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SchoolLogo] "${school}" → ${sources[0]}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school])

  const iconSize = Math.round(size * 0.55)
  const style = { width: size, height: size }

  if (idx >= sources.length) {
    return (
      <div
        className={`rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 ${className}`}
        style={style}
      >
        <GraduationCap size={iconSize} className="text-gray-400" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[idx]}
      alt={school}
      className={`rounded-full object-contain bg-white shrink-0 ${className}`}
      style={style}
      onError={() => setIdx((i) => i + 1)}
    />
  )
}
