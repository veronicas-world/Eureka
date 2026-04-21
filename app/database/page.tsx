import { getCompanies } from '@/lib/queries'
import DatabaseClient from './DatabaseClient'

export default async function DatabasePage() {
  const companies = await getCompanies()
  const sectors = Array.from(
    new Set(companies.map((c) => c.sector).filter((s): s is string => s !== null))
  ).sort()

  return <DatabaseClient companies={companies} sectors={sectors} />
}
