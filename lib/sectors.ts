/**
 * Common startup/VC sectors. Used as a baseline for the sector filter so the
 * dropdown is useful even when very few companies are in the database. Merged
 * at runtime with whatever distinct values appear in the DB.
 *
 * The list aims to mirror Harmonic.ai / Crunchbase's industry taxonomy at a
 * pragmatic level — broad enough to cover most companies but not so granular
 * that it becomes overwhelming.
 */
export const COMMON_SECTORS: string[] = [
  // Software / Infra
  'AI/ML',
  'Developer Tools',
  'Open Source',
  'DevOps',
  'Cloud Infrastructure',
  'Data Infrastructure',
  'Databases',
  'Cybersecurity',
  'Identity & Access',
  'API Tools',
  'No-Code / Low-Code',
  'Productivity',
  'Collaboration',
  'Analytics',
  'Business Intelligence',
  'Observability',
  'IT Operations',

  // Vertical SaaS
  'SaaS',
  'Vertical SaaS',
  'Enterprise Software',
  'CRM',
  'HR Tech',
  'Marketing Tech',
  'Sales Tech',
  'Customer Support',
  'Legal Tech',
  'Compliance / RegTech',
  'Procurement',
  'Supply Chain',
  'Logistics',

  // Finance
  'Fintech',
  'Banking',
  'Payments',
  'Lending',
  'Wealth Management',
  'Insurance / InsurTech',
  'Crypto / Web3',
  'Blockchain',
  'Trading / Markets',
  'Embedded Finance',
  'Real Estate / PropTech',

  // Consumer
  'Consumer',
  'E-commerce',
  'Marketplaces',
  'Social',
  'Creator Economy',
  'Gaming',
  'Media & Entertainment',
  'Streaming',
  'Travel',
  'Food & Beverage',
  'Fashion',
  'Beauty',
  'Fitness & Wellness',
  'Dating',

  // Health
  'Healthcare',
  'Digital Health',
  'Biotech',
  'Pharma',
  'Medical Devices',
  'Mental Health',
  'Health Insurance',

  // Climate / Energy
  'Climate Tech',
  'Clean Energy',
  'Battery / Storage',
  'EV / Mobility',
  'Carbon Markets',
  'Sustainability',
  'AgTech',
  'Food Tech',
  'Water',

  // Industrial / Hardware
  'Hardware',
  'Robotics',
  'Manufacturing',
  'Industrial Automation',
  'Aerospace',
  'Defense',
  'Space',
  'Semiconductors',
  'IoT',
  'AR / VR',
  '3D Printing',
  'Construction Tech',

  // Education
  'EdTech',
  'Workforce Education',
  'Childcare',

  // Other
  'Government / GovTech',
  'Nonprofit',
  'Other',
]

export function mergeSectors(fromDb: string[]): string[] {
  return Array.from(new Set([...fromDb, ...COMMON_SECTORS])).sort((a, b) =>
    a.localeCompare(b),
  )
}
