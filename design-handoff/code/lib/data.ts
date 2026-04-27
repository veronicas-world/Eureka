export type Company = {
  id: string
  name: string
  website: string
  sector: string
  subsector: string
  stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'growth'
  country: string
  city: string
  founded_year: number
  employee_count: number
  total_funding_usd: number
  last_funding_round: string
  last_funding_amount_usd: number
  last_funding_date: string
  investors: string[]
  status: 'tracking' | 'outreached' | 'passed' | 'portfolio'
  signal_score: number
  description: string
  tags: string[]
}

export const companies: Company[] = [
  {
    id: '1',
    name: 'Synthia AI',
    website: 'synthia.ai',
    sector: 'Artificial Intelligence',
    subsector: 'Generative AI',
    stage: 'seed',
    country: 'USA',
    city: 'San Francisco',
    founded_year: 2022,
    employee_count: 18,
    total_funding_usd: 2_500_000,
    last_funding_round: 'Seed',
    last_funding_amount_usd: 2_500_000,
    last_funding_date: '2024-03-12',
    investors: ['Sequoia', 'Y Combinator'],
    status: 'tracking',
    signal_score: 88,
    description:
      'Synthia AI builds foundation models for scientific research, enabling drug discovery and materials science teams to run experiments 10× faster using AI-driven simulation.',
    tags: ['AI', 'Deep Science', 'B2B SaaS'],
  },
  {
    id: '2',
    name: 'Meridian Health',
    website: 'meridianhealth.io',
    sector: 'HealthTech',
    subsector: 'Digital Health',
    stage: 'series-a',
    country: 'UK',
    city: 'London',
    founded_year: 2021,
    employee_count: 54,
    total_funding_usd: 11_000_000,
    last_funding_round: 'Series A',
    last_funding_amount_usd: 8_000_000,
    last_funding_date: '2024-01-22',
    investors: ['Index Ventures', 'Balderton'],
    status: 'outreached',
    signal_score: 74,
    description:
      'Meridian Health is a preventive care platform that uses continuous biometric monitoring and ML to predict hospitalisation risk in chronic disease patients, reducing readmissions by 40%.',
    tags: ['HealthTech', 'ML', 'Preventive Care'],
  },
  {
    id: '3',
    name: 'FluxOps',
    website: 'fluxops.dev',
    sector: 'Developer Tools',
    subsector: 'Infrastructure',
    stage: 'pre-seed',
    country: 'Germany',
    city: 'Berlin',
    founded_year: 2023,
    employee_count: 6,
    total_funding_usd: 500_000,
    last_funding_round: 'Pre-Seed',
    last_funding_amount_usd: 500_000,
    last_funding_date: '2023-11-05',
    investors: ['HV Capital'],
    status: 'tracking',
    signal_score: 43,
    description:
      'FluxOps provides AI-powered incident response tooling for platform engineering teams, automatically triaging and routing alerts with context-aware runbooks.',
    tags: ['DevTools', 'Infra', 'AIOps'],
  },
  {
    id: '4',
    name: 'Orbita Space',
    website: 'orbita.space',
    sector: 'Deep Tech',
    subsector: 'Space Technology',
    stage: 'series-b',
    country: 'USA',
    city: 'Austin',
    founded_year: 2019,
    employee_count: 210,
    total_funding_usd: 62_000_000,
    last_funding_round: 'Series B',
    last_funding_amount_usd: 45_000_000,
    last_funding_date: '2023-09-18',
    investors: ['Andreessen Horowitz', 'Founders Fund', 'Lux Capital'],
    status: 'portfolio',
    signal_score: 92,
    description:
      'Orbita Space develops low-cost satellite propulsion systems using cold-gas micro-thrusters, enabling precise orbital maneuvering for small-sat constellations at a fraction of legacy costs.',
    tags: ['Space', 'Hardware', 'Deep Tech'],
  },
  {
    id: '5',
    name: 'Greenleaf Carbon',
    website: 'greenleaf.earth',
    sector: 'CleanTech',
    subsector: 'Carbon Markets',
    stage: 'seed',
    country: 'Australia',
    city: 'Melbourne',
    founded_year: 2022,
    employee_count: 12,
    total_funding_usd: 1_200_000,
    last_funding_round: 'Seed',
    last_funding_amount_usd: 1_200_000,
    last_funding_date: '2023-06-30',
    investors: ['Blackbird Ventures'],
    status: 'passed',
    signal_score: 31,
    description:
      'Greenleaf Carbon operates a voluntary carbon credit marketplace for agricultural land managers, using satellite imagery to verify and tokenise sequestration credits.',
    tags: ['CleanTech', 'Carbon', 'Marketplace'],
  },
  {
    id: '6',
    name: 'Velox Finance',
    website: 'velox.fi',
    sector: 'Fintech',
    subsector: 'B2B Payments',
    stage: 'series-a',
    country: 'Singapore',
    city: 'Singapore',
    founded_year: 2020,
    employee_count: 38,
    total_funding_usd: 14_500_000,
    last_funding_round: 'Series A',
    last_funding_amount_usd: 12_000_000,
    last_funding_date: '2024-02-14',
    investors: ['Tiger Global', 'Quona Capital'],
    status: 'outreached',
    signal_score: 65,
    description:
      'Velox Finance is an embedded cross-border payments infrastructure for Southeast Asian SMEs, offering real-time FX settlement and multi-currency treasury management via API.',
    tags: ['Fintech', 'Payments', 'API', 'SEA'],
  },
]
