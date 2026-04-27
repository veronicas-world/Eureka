/**
 * Common startup-friendly countries. Used as a baseline for the country filter
 * dropdown — merged with whatever distinct values exist in the database so the
 * filter is useful even when very few companies are in the DB.
 */
export const COMMON_COUNTRIES: string[] = [
  'United States',
  'Canada',
  'United Kingdom',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Sweden',
  'Denmark',
  'Norway',
  'Finland',
  'Switzerland',
  'Ireland',
  'Belgium',
  'Austria',
  'Poland',
  'Czech Republic',
  'Portugal',
  'Greece',
  'Turkey',
  'Estonia',
  'Israel',
  'United Arab Emirates',
  'Saudi Arabia',
  'South Africa',
  'Egypt',
  'India',
  'Singapore',
  'Hong Kong',
  'Japan',
  'South Korea',
  'China',
  'Australia',
  'New Zealand',
  'Indonesia',
  'Vietnam',
  'Thailand',
  'Philippines',
  'Brazil',
  'Mexico',
  'Argentina',
  'Chile',
  'Colombia',
  'Peru',
  'Uruguay',
]

export function mergeCountries(fromDb: string[]): string[] {
  return Array.from(new Set([...fromDb, ...COMMON_COUNTRIES])).sort()
}
