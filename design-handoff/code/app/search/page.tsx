import { Suspense } from 'react'
import SearchClient from './SearchClient'

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="px-8 py-8 max-w-5xl">
          <div className="h-12 w-full bg-gray-100 rounded-xl animate-pulse" />
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  )
}
