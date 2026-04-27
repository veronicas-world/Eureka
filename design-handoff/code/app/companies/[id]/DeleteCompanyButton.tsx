'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteCompany } from '@/app/actions/companies'

interface Props {
  companyId: string
  companyName: string
}

export default function DeleteCompanyButton({ companyId, companyName }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteCompany(companyId)
        router.push('/database')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete company.')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
      >
        <Trash2 size={13} />
        Delete
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !isPending && setShowConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          <div
            className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete company?</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Are you sure you want to delete <span className="font-medium text-gray-700">{companyName}</span>?
              This will permanently remove the company and all associated people, signals, notes, and interactions.
              This cannot be undone.
            </p>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="h-8 px-3 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 shadow-sm"
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
