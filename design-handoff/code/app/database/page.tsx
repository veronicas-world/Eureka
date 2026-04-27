import { Suspense } from 'react'
import { getCompanies } from '@/lib/queries'
import DatabaseClient from './DatabaseClient'

export default async function DatabasePage() {
  const companies = await getCompanies()
  const sectors = Array.from(
    new Set(companies.map((c) => c.sector).filter((s): s is string => s !== null))
  ).sort()

  return (
    <Suspense
      fallback={
        <div className="px-8 py-8">
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
          <div className="h-64 bg-gray-100 rounded animate-pulse" />
        </div>
      }
    >
      <DatabaseClient companies={companies} sectors={sectors} />
    </Suspense>
  )
}
