import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCompanyById } from '@/lib/queries'
import CompanyPage from './CompanyTabs'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const VALID_TABS = ['overview', 'team', 'funding', 'traction', 'signals', 'notes']

export default async function CompanyDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams
  const company = await getCompanyById(id)
  if (!company) notFound()

  const activeTab = VALID_TABS.includes(tab ?? '') ? tab! : 'overview'

  return (
    <div className="px-8 py-6 max-w-6xl">
      <Link
        href="/database"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-5"
      >
        <ArrowLeft size={14} />
        Back to Database
      </Link>
      <CompanyPage company={company} activeTab={activeTab} />
    </div>
  )
}
