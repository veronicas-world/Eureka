import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  MapPin,
  Calendar,
  Users2,
  TrendingUp,
  Pencil,
} from 'lucide-react'
import { getCompanyById } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { SignalBadge, StatusBadge, StageBadge, Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import CompanyTabs from './CompanyTabs'
import EnrichButton from '@/components/EnrichButton'

interface Props {
  params: { id: string }
}

export default async function CompanyDetailPage({ params }: Props) {
  const company = await getCompanyById(params.id)
  if (!company) notFound()

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Back + Edit */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/database"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Database
        </Link>
        <div className="flex items-center gap-2">
          <EnrichButton companyId={company.id} website={company.website} />
          <Link
            href={`/companies/${company.id}/edit`}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
          >
            <Pencil size={13} />
            Edit
          </Link>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Left column ──────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-4">
          <Card>
            {/* Name + badges */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-gray-600">{company.name[0]}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-gray-900 leading-tight">
                  {company.name}
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {company.stage  && <StageBadge  stage={company.stage}   />}
                  {company.status && <StatusBadge status={company.status} />}
                </div>
              </div>
            </div>

            {/* Description */}
            {company.description && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {company.description}
              </p>
            )}

            {/* Metadata */}
            <div className="space-y-2.5 text-sm">
              {company.website && (
                <MetaRow icon={Globe}>
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-gray-900 flex items-center gap-1 group"
                  >
                    {company.website}
                    <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </MetaRow>
              )}
              {(company.city || company.country) && (
                <MetaRow icon={MapPin}>
                  <span className="text-gray-600">
                    {[company.city, company.country].filter(Boolean).join(', ')}
                  </span>
                </MetaRow>
              )}
              {company.founded_year && (
                <MetaRow icon={Calendar}>
                  <span className="text-gray-600">Founded {company.founded_year}</span>
                </MetaRow>
              )}
              {company.employee_count && (
                <MetaRow icon={Users2}>
                  <span className="text-gray-600">{company.employee_count.toLocaleString()} employees</span>
                </MetaRow>
              )}
              {(company.sector || company.subsector) && (
                <MetaRow icon={TrendingUp}>
                  <span className="text-gray-600">
                    {[company.sector, company.subsector].filter(Boolean).join(' · ')}
                  </span>
                </MetaRow>
              )}
            </div>
          </Card>

          {/* Funding */}
          <Card>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Funding
            </p>
            <div className="space-y-2">
              <FundingRow label="Total Raised" value={formatCurrency(company.total_funding_usd ?? undefined)} />
              <FundingRow label="Last Round"   value={company.last_funding_round ?? undefined} />
              <FundingRow label="Amount"       value={formatCurrency(company.last_funding_amount_usd ?? undefined)} />
              <FundingRow label="Date"         value={company.last_funding_date ?? undefined} />
            </div>
            {company.investors && company.investors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1.5">Investors</p>
                <div className="flex flex-wrap gap-1">
                  {company.investors.map((inv) => (
                    <Badge key={inv} variant="gray" className="text-[11px]">{inv}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Signal score */}
          {company.signal_score != null && (
            <Card>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Signal Score
                </p>
                <SignalBadge score={company.signal_score} />
              </div>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    company.signal_score >= 70
                      ? 'bg-emerald-400'
                      : company.signal_score >= 40
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                  }`}
                  style={{ width: `${company.signal_score}%` }}
                />
              </div>
            </Card>
          )}

          {/* Tags */}
          {company.tags && company.tags.length > 0 && (
            <Card>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {company.tags.map((tag) => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column ─────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <CompanyTabs
            companyId={company.id}
            signals={company.signals ?? []}
            notes={company.notes ?? []}
            people={company.people ?? []}
            interactions={company.interactions ?? []}
            urls={company.company_urls ?? []}
          />
        </div>
      </div>
    </div>
  )
}

function MetaRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className="text-gray-400 shrink-0" />
      {children}
    </div>
  )
}

function FundingRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900">{value ?? '—'}</span>
    </div>
  )
}
