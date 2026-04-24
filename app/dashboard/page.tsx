import { getCompanies, getAllSignals } from '@/lib/queries'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const [companies, signals] = await Promise.all([
    getCompanies(),
    getAllSignals(),
  ])
  return <DashboardClient companies={companies} signals={signals} />
}
