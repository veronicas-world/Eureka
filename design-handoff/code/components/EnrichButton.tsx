'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

type State = 'idle' | 'loading' | 'success' | 'error'

interface EnrichResult {
  peopleAdded: number
  peopleUpdated: number
  signalsCreated: number
}

interface Props {
  companyId: string
  website: string | null
  /** 'button' = full labeled button (detail page), 'icon' = icon-only (table row) */
  variant?: 'button' | 'icon'
}

export default function EnrichButton({ companyId, website, variant = 'button' }: Props) {
  const router = useRouter()
  const [state, setState]   = useState<State>('idle')
  const [errMsg, setErrMsg] = useState<string>('')
  const [result, setResult] = useState<EnrichResult | null>(null)

  async function handleEnrich() {
    if (!website) {
      setErrMsg('No website set — add a website URL first')
      setState('error')
      setTimeout(() => setState('idle'), 3000)
      return
    }

    setState('loading')
    setErrMsg('')
    setResult(null)

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, website }),
      })
      const json = await res.json()

      if (!json.success) {
        setErrMsg(json.error ?? 'Enrichment failed')
        setState('error')
        setTimeout(() => setState('idle'), 4000)
        return
      }

      setResult({ peopleAdded: json.peopleAdded ?? 0, peopleUpdated: json.peopleUpdated ?? 0, signalsCreated: json.signalsCreated ?? 0 })
      setState('success')
      setTimeout(() => {
        setState('idle')
        setResult(null)
        router.refresh()
      }, 5000)
    } catch {
      setErrMsg('Network error — please try again')
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  function peopleSummary(r: EnrichResult): string {
    if (r.peopleAdded > 0 && r.peopleUpdated > 0)
      return `${r.peopleAdded} added, ${r.peopleUpdated} updated`
    if (r.peopleAdded > 0) return `${r.peopleAdded} people added`
    if (r.peopleUpdated > 0) return `${r.peopleUpdated} people updated`
    return '0 people'
  }

  if (variant === 'icon') {
    const successTitle = result
      ? `Enriched — ${peopleSummary(result)}, ${result.signalsCreated} signals created`
      : 'Enriched!'
    return (
      <button
        onClick={handleEnrich}
        disabled={state === 'loading'}
        title={
          state === 'success' ? successTitle :
          state === 'error'   ? errMsg :
          'Enrich with Harmonic'
        }
        className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 inline-flex ${
          state === 'success' ? 'text-emerald-500' :
          state === 'error'   ? 'text-red-400' :
          'text-gray-400 hover:text-gray-600'
        }`}
      >
        {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> :
         state === 'success' ? <CheckCircle2 size={14} /> :
         state === 'error'   ? <AlertCircle size={14} /> :
         <Zap size={14} />}
      </button>
    )
  }

  const successLabel = result
    ? `Enriched — ${peopleSummary(result)}, ${result.signalsCreated} signals`
    : 'Enriched!'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleEnrich}
        disabled={state === 'loading' || state === 'success'}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border transition-colors shadow-sm ${
          state === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
            : state === 'error'
            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
        }`}
      >
        {state === 'loading' ? (
          <><Loader2 size={13} className="animate-spin" /> Enriching...</>
        ) : state === 'success' ? (
          <><CheckCircle2 size={13} /> {successLabel}</>
        ) : (
          <><Zap size={13} /> Enrich with Harmonic</>
        )}
      </button>
      {state === 'error' && (
        <p className="text-xs text-red-500 max-w-xs text-right">{errMsg}</p>
      )}
    </div>
  )
}
