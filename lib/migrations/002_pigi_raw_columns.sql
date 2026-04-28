-- ============================================================
-- Pigi Tier 0 — raw JSON columns for bulk Harmonic caching
-- Run in Supabase SQL editor (or via supabase db push if you
-- add a supabase/ project later).
-- ============================================================

-- companies: store full Harmonic company response
alter table companies
  add column if not exists harmonic_raw  jsonb;

-- companies: cache /companies/<urn>/similar response
alter table companies
  add column if not exists similar_urns  jsonb;

-- companies: affinity / highlight badges (YC W24, Forbes 30u30, etc.)
alter table companies
  add column if not exists highlights    jsonb;

-- people: store full Harmonic person response
alter table people
  add column if not exists harmonic_raw  jsonb;

-- people: full experience[] history (not just current_position)
alter table people
  add column if not exists experience    jsonb;

-- signals: store raw Harmonic signal/event object for ranking recon
alter table signals
  add column if not exists harmonic_raw  jsonb;

-- Indexes: GIN so jsonb lookups are fast once Pigi fills these.
create index if not exists idx_companies_harmonic_raw
  on companies using gin (harmonic_raw);

create index if not exists idx_companies_highlights
  on companies using gin (highlights);

create index if not exists idx_people_harmonic_raw
  on people using gin (harmonic_raw);

create index if not exists idx_people_experience
  on people using gin (experience);
