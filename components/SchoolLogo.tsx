'use client'

import { useState, useEffect } from 'react'
import { GraduationCap } from 'lucide-react'

interface Props {
  school: string
  size?: number
  className?: string
}

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN

// Ordered list: first match wins. More specific / longer entries come before
// shorter ones to prevent substring collisions (e.g. 'stern' ⊂ 'western').
const KNOWN: Array<[string, string]> = [
  // ── Named business schools (before short generic keys) ────────────────────
  ['harvard business',                   'harvard.edu'],
  ['columbia business',                  'columbia.edu'],
  ['london business school',             'london.edu'],
  ['wharton',                            'upenn.edu'],
  ['sloan',                              'mit.edu'],
  ['booth',                              'uchicago.edu'],
  ['kellogg',                            'northwestern.edu'],
  ['haas',                               'berkeley.edu'],
  ['fuqua',                              'duke.edu'],
  ['ross',                               'umich.edu'],
  ['mccombs',                            'utexas.edu'],
  ['darden',                             'virginia.edu'],
  ['tuck',                               'dartmouth.edu'],
  ['tepper',                             'cmu.edu'],
  ['fisher',                             'osu.edu'],
  ['hbs',                                'harvard.edu'],
  ['insead',                             'insead.edu'],
  ['lbs',                                'london.edu'],
  // 'johnson' and 'stern' are substrings of many names — keep them but only
  // after all longer multi-word keys that could collide.
  ['johnson',                            'cornell.edu'],
  // ── Multi-word university names (longest / most specific first) ───────────
  ['massachusetts institute',            'mit.edu'],
  ['carnegie mellon',                    'cmu.edu'],
  ['georgia institute of technology',    'gatech.edu'],
  ['georgia tech',                       'gatech.edu'],
  ['western illinois university',        'wiu.edu'],
  ['university of california, berkeley', 'berkeley.edu'],
  ['university of california, los angeles','ucla.edu'],
  ['university of california, san diego','ucsd.edu'],
  ['university of southern california',  'usc.edu'],
  ['university of north carolina',       'unc.edu'],
  ['university of british columbia',     'ubc.ca'],
  ['university of texas at austin',      'utexas.edu'],
  ['university of pennsylvania',         'upenn.edu'],
  ['university of michigan',             'umich.edu'],
  ['university of illinois',             'illinois.edu'],
  ['university of minnesota',            'umn.edu'],
  ['university of wisconsin',            'wisc.edu'],
  ['university of washington',           'uw.edu'],
  ['university of maryland',             'umd.edu'],
  ['university of virginia',             'virginia.edu'],
  ['university of florida',              'ufl.edu'],
  ['university of toronto',              'utoronto.ca'],
  ['university of waterloo',             'uwaterloo.ca'],
  ['university of texas',                'utexas.edu'],
  ['university of chicago',              'uchicago.edu'],
  ['uc berkeley',                        'berkeley.edu'],
  ['uc los angeles',                     'ucla.edu'],
  ['uc san diego',                       'ucsd.edu'],
  ['new york university',                'nyu.edu'],
  ['penn state',                         'psu.edu'],
  ['ohio state',                         'osu.edu'],
  ['notre dame',                         'nd.edu'],
  ['boston university',                  'bu.edu'],
  ['boston college',                     'bc.edu'],
  ['imperial college',                   'imperial.ac.uk'],
  ['london school of economics',         'lse.ac.uk'],
  ['indian institute of technology',     'iitb.ac.in'],
  ['eth zurich',                         'ethz.ch'],
  ['ecole polytechnique',                'polytechnique.edu'],
  // ── Single-word / short keys (substring risk — put after multi-word) ──────
  ['stanford',                           'stanford.edu'],
  ['harvard',                            'harvard.edu'],
  ['mit',                                'mit.edu'],
  ['yale',                               'yale.edu'],
  ['princeton',                          'princeton.edu'],
  ['columbia',                           'columbia.edu'],
  ['cornell',                            'cornell.edu'],
  ['upenn',                              'upenn.edu'],
  ['u penn',                             'upenn.edu'],
  ['brown',                              'brown.edu'],
  ['dartmouth',                          'dartmouth.edu'],
  ['duke',                               'duke.edu'],
  ['northwestern',                       'northwestern.edu'],
  ['northeastern',                       'northeastern.edu'],
  ['uchicago',                           'uchicago.edu'],
  ['berkeley',                           'berkeley.edu'],
  ['ucla',                               'ucla.edu'],
  ['ucsd',                               'ucsd.edu'],
  ['usc',                                'usc.edu'],
  ['michigan',                           'umich.edu'],
  ['gatech',                             'gatech.edu'],
  ['carnegie',                           'cmu.edu'],
  ['cmu',                                'cmu.edu'],
  ['caltech',                            'caltech.edu'],
  ['georgetown',                         'georgetown.edu'],
  ['vanderbilt',                         'vanderbilt.edu'],
  ['emory',                              'emory.edu'],
  ['tufts',                              'tufts.edu'],
  ['fordham',                            'fordham.edu'],
  ['nyu',                                'nyu.edu'],
  // 'stern' is a substring of 'western' — must come AFTER 'western illinois university'
  ['stern',                              'nyu.edu'],
  ['virginia',                           'virginia.edu'],
  ['illinois',                           'illinois.edu'],
  ['purdue',                             'purdue.edu'],
  ['unc',                                'unc.edu'],
  ['ut austin',                          'utexas.edu'],
  ['oxford',                             'ox.ac.uk'],
  ['cambridge',                          'cam.ac.uk'],
  ['lse',                                'lse.ac.uk'],
  ['iit',                                'iitb.ac.in'],
  ['tsinghua',                           'tsinghua.edu.cn'],
  ['peking',                             'pku.edu.cn'],
  // Additional schools
  ['rochester institute of technology',  'rit.edu'],
  ['worcester polytechnic',              'wpi.edu'],
  ['rensselaer polytechnic',             'rpi.edu'],
  ['clarkson university',                'clarkson.edu'],
  ['university of connecticut',          'uconn.edu'],
  ['university of rhode island',         'uri.edu'],
  ['university of vermont',              'uvm.edu'],
  ['university of new hampshire',        'unh.edu'],
  ['university at albany',               'albany.edu'],
  ['suny albany',                        'albany.edu'],
  ['bentley',                            'bentley.edu'],
  ['babson',                             'babson.edu'],
  ['quinnipiac',                         'qu.edu'],
  ['suffolk university',                 'suffolk.edu'],
  ['pace university',                    'pace.edu'],
  ['fairfield university',               'fairfield.edu'],
  ['lehigh',                             'lehigh.edu'],
  ['villanova',                          'villanova.edu'],
  ['wake forest',                        'wfu.edu'],
]

// Returns the confirmed domain from KNOWN, or null if the school is unknown.
// Pattern-matching fallbacks are intentionally removed — a missing logo is
// better than a confidently wrong one.
function resolveDomain(name: string): string | null {
  const lower = name.toLowerCase()
  for (const [key, domain] of KNOWN) {
    if (lower.includes(key)) return domain
  }
  return null
}

export default function SchoolLogo({ school, size = 20, className = '' }: Props) {
  const domain = resolveDomain(school)

  // Unknown school → no sources, render icon immediately.
  // Known school → try logo.dev, fall back to GraduationCap on error.
  const sources = domain
    ? [`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`]
    : []
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SchoolLogo] "${school}" → ${domain ?? 'unknown (icon fallback)'}`)
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
