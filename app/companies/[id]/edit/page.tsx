import { notFound } from 'next/navigation'
import { getCompanyById } from '@/lib/queries'
import EditCompanyClient from './EditCompanyClient'

interface Props {
  params: { id: string }
}

export default async function EditCompanyPage({ params }: Props) {
  const company = await getCompanyById(params.id)
  if (!company) notFound()
  return <EditCompanyClient company={company} />
}
