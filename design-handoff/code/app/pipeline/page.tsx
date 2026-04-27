import { getCompanies } from '@/lib/queries'
import PipelineClient from './PipelineClient'

export default async function PipelinePage() {
  const companies = await getCompanies()
  return <PipelineClient companies={companies} />
}
