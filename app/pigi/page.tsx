import Link from 'next/link'
import { getPigiHomeData } from '@/lib/queries'
import PigiAvatar from './PigiAvatar'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string | null {
  // Return null when there's no run yet — the page omits the
  // "she last looked" line entirely so the empty-state isn't said twice.
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms) || ms < 0) return 'just now'
  const min  = Math.floor(ms / 60_000)
  const hr   = Math.floor(min / 60)
  const day  = Math.floor(hr  / 24)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min} minute${min === 1 ? '' : 's'} ago`
  if (hr  < 24)  return `${hr} hour${hr === 1 ? '' : 's'} ago`
  if (day === 1) return 'yesterday'
  return `${day} days ago`
}

function formatShortDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function stateLine(count: number, lastRunAt: string | null): string {
  if (!lastRunAt)   return 'she hasn\u2019t looked yet \u2014 try running pigi'
  if (count === 0)  return 'she\u2019s quiet today \u22c5 no new movement'
  if (count === 1)  return 'she found 1 thing while you were away'
  if (count <= 5)   return `she found ${count} things while you were away`
  if (count <= 15)  return `she found ${count} things \u2014 worth a look`
  return `she found a lot \u2014 ${count} things \u2014 take your time`
}

const signalTypeColor: Record<string, string> = {
  funding:        'rgba(59,130,246,0.10)',
  hiring_spike:   'rgba(16,185,129,0.10)',
  team_growth:    'rgba(16,185,129,0.10)',
  news:           'rgba(148,163,184,0.10)',
  founder_move:   'rgba(168,85,247,0.10)',
  product_launch: 'rgba(249,115,22,0.10)',
  highlight:      'rgba(168,85,247,0.10)',
  tag:            'rgba(168,85,247,0.10)',
  team_change:    'rgba(168,85,247,0.10)',
  valuation:      'rgba(59,130,246,0.10)',
  web_traffic:    'rgba(56,189,248,0.10)',
}

const signalTypeInk: Record<string, string> = {
  funding:        '#1d4ed8',
  hiring_spike:   '#047857',
  team_growth:    '#047857',
  news:           '#475569',
  founder_move:   '#7e22ce',
  product_launch: '#c2410c',
  highlight:      '#7e22ce',
  tag:            '#7e22ce',
  team_change:    '#7e22ce',
  valuation:      '#1d4ed8',
  web_traffic:    '#0369a1',
}

const signalTypeLabel: Record<string, string> = {
  funding:        'funding',
  hiring_spike:   'hiring',
  team_growth:    'team',
  news:           'news',
  founder_move:   'founder',
  product_launch: 'launch',
  highlight:      'highlight',
  tag:            'tag',
  team_change:    'team',
  valuation:      'valuation',
  web_traffic:    'traffic',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PigiPage() {
  const { lastRunAt, recentDiffSignals, totalCompanies, totalSnapshots } =
    await getPigiHomeData()

  return (
    <div style={{ padding: '36px 44px 80px', maxWidth: 1180 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="mb-5" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <PigiAvatar size={140} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            className="flex items-baseline gap-2.5 m-0"
            style={{
              fontSize:      22,
              fontWeight:    600,
              color:         'var(--ink)',
              letterSpacing: '-0.005em',
            }}
          >
            <span>pigi</span>
            <span
              style={{
                color:    'var(--ink-faint)',
                fontSize: 14,
                fontWeight: 400,
              }}
            >
              ⋆˚‧₊☁︎ ˙‧₊✩₊‧｡☾⋆⁺
            </span>
          </h1>
          {lastRunAt && (
            <p
              className="mt-3"
              style={{
                fontSize: 13,
                color:    'var(--ink-soft)',
                fontStyle: 'italic',
              }}
            >
              she last looked: {formatRelative(lastRunAt)}
            </p>
          )}
          <p
            className={lastRunAt ? 'mt-1' : 'mt-3'}
            style={{
              fontSize: 14,
              color:    'var(--ink)',
            }}
          >
            {stateLine(recentDiffSignals.length, lastRunAt)}
          </p>
        </div>
      </header>

      {/* ── What's new ────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader label="what’s new" sub="the past seven days" />

        {recentDiffSignals.length === 0 ? (
          <EmptyCard>
            no new signals in the past week. <br />
            <span style={{ color: 'var(--ink-faint)' }}>
              pigi runs once a day at 6am — check back tomorrow.
            </span>
          </EmptyCard>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {recentDiffSignals.map((s) => {
              const type = s.signal_type ?? 'news'
              return (
                <Link
                  key={s.id}
                  href={`/companies/${s.company_id}`}
                  style={{
                    display:        'grid',
                    gridTemplateColumns: 'minmax(140px, 180px) auto 1fr auto',
                    alignItems:     'center',
                    gap:            14,
                    padding:        '12px 16px',
                    background:     'white',
                    border:         '1px solid var(--paper-edge, #e7e5e0)',
                    borderRadius:   10,
                    fontSize:       13,
                    color:          'var(--ink)',
                    textDecoration: 'none',
                    transition:     'border-color 120ms ease, transform 120ms ease',
                  }}
                  className="hover:border-gray-300 hover:shadow-sm"
                >
                  <span
                    style={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow:   'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.companies?.name ?? 'company'}
                  </span>

                  <span
                    style={{
                      fontSize:      10,
                      letterSpacing: '0.06em',
                      textTransform: 'lowercase',
                      padding:       '3px 8px',
                      borderRadius:  999,
                      background:    signalTypeColor[type] ?? signalTypeColor.news,
                      color:         signalTypeInk[type] ?? signalTypeInk.news,
                      whiteSpace:    'nowrap',
                    }}
                  >
                    {signalTypeLabel[type] ?? type}
                  </span>

                  <span
                    style={{
                      color:        'var(--ink-soft)',
                      whiteSpace:   'nowrap',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.headline ?? ''}
                  </span>

                  <span
                    style={{
                      color:    'var(--ink-faint)',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatShortDate(s.signal_date)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Quiet stats ───────────────────────────────────────────── */}
      <section>
        <SectionHeader label="quiet stats" sub="what pigi keeps watch over" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <StatTile label="companies tracked" value={totalCompanies.toLocaleString()} />
          <StatTile label="snapshots taken"   value={totalSnapshots.toLocaleString()} />
          <StatTile label="rhythm"            value="daily ⋆ 6am" />
        </div>
        <p
          style={{
            marginTop:     20,
            fontSize:      11,
            color:         'var(--ink-faint)',
            letterSpacing: '0.03em',
            fontStyle:     'italic',
          }}
        >
          pigi sleeps when you do. ｡☾⋆⁺
        </p>
      </section>
    </div>
  )
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-3" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span
        style={{
          fontSize:      11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color:         'var(--ink-soft)',
          fontWeight:    500,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
        ⋆ {sub}
      </span>
    </div>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background:   'white',
        border:       '1px dashed var(--paper-edge, #e7e5e0)',
        borderRadius: 10,
        padding:      '28px 20px',
        textAlign:    'center',
        fontSize:     13,
        color:        'var(--ink-soft)',
        lineHeight:   1.6,
      }}
    >
      {children}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background:   'white',
        border:       '1px solid var(--paper-edge, #e7e5e0)',
        borderRadius: 10,
        padding:      '14px 16px',
      }}
    >
      <div
        style={{
          fontSize:      10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color:         'var(--ink-soft)',
          marginBottom:  6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}
