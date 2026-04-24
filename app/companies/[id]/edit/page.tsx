import { notFound } from 'next/navigation'
import { getCompanyById } from '@/lib/queries'
import EditCompanyClient from './EditCompanyClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCompanyPage({ params }: Props) {
  const { id } = await params
  const company = await getCompanyById(id)
  if (!company) notFound()
  return <EditCompanyClient company={company} />
}
