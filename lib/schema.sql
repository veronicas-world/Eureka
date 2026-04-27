-- ============================================================
-- VC Sourcing & Startup Tracking — Database Schema
-- ============================================================

-- ------------------------------------------------------------
-- Helper: updated_at trigger function
-- ------------------------------------------------------------
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ------------------------------------------------------------
-- companies
-- ------------------------------------------------------------
create table companies (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  website                 text,
  linkedin_url            text,
  description             text,
  sector                  text,
  subsector               text,
  stage                   text check (stage in ('pre-seed','seed','series-a','series-b','growth')),
  country                 text,
  city                    text,
  founded_year            integer,
  employee_count          integer,
  employee_count_source   text,
  total_funding_usd       bigint,
  last_funding_date       date,
  last_funding_round      text,
  last_funding_amount_usd bigint,
  investors               text[],
  status                  text check (status in ('tracking','outreached','passed','portfolio')),
  signal_score            integer check (signal_score between 0 and 100),
  tags                    text[],
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger companies_updated_at
  before update on companies
  for each row execute function update_updated_at();

create index idx_companies_status  on companies (status);
create index idx_companies_sector  on companies (sector);
create index idx_companies_stage   on companies (stage);

alter table companies enable row level security;

create policy "companies: authenticated full access"
  on companies for all
  to authenticated
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- people
-- ------------------------------------------------------------
create table people (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies (id) on delete cascade,
  name        text not null,
  title       text,
  linkedin_url text,
  email       text,
  is_founder  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table people enable row level security;

create policy "people: authenticated full access"
  on people for all
  to authenticated
  using (true)
  with check (true);

-- Migration: add prior experience & education columns
alter table people add column if not exists profile_picture_url text;
alter table people add column if not exists harmonic_urn text;
alter table people add column if not exists prior_company text;
alter table people add column if not exists prior_title text;
alter table people add column if not exists education text;


-- ------------------------------------------------------------
-- signals
-- ------------------------------------------------------------
create table signals (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies (id) on delete cascade,
  signal_type  text check (signal_type in ('funding','hiring_spike','news','founder_move','product_launch')),
  signal_source text check (signal_source in ('crunchbase','linkedin','techcrunch','manual')),
  headline     text,
  detail       text,
  signal_date  date,
  strength     text check (strength in ('weak','moderate','strong')),
  url          text,
  created_at   timestamptz not null default now()
);

create index idx_signals_company_id  on signals (company_id);
create index idx_signals_signal_type on signals (signal_type);

alter table signals enable row level security;

create policy "signals: authenticated full access"
  on signals for all
  to authenticated
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- notes
-- ------------------------------------------------------------
create table notes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies (id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();

alter table notes enable row level security;

create policy "notes: authenticated full access"
  on notes for all
  to authenticated
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- interactions
-- ------------------------------------------------------------
create table interactions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references companies (id) on delete cascade,
  interaction_type text check (interaction_type in ('email','call','meeting','linkedin','intro')),
  summary          text,
  interaction_date date,
  next_step        text,
  created_at       timestamptz not null default now()
);

alter table interactions enable row level security;

create policy "interactions: authenticated full access"
  on interactions for all
  to authenticated
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- company_urls  (migration — run after initial schema)
-- ------------------------------------------------------------

-- Extend status constraint to include meeting booked
alter table companies drop constraint if exists companies_status_check;
alter table companies add constraint companies_status_check
  check (status in ('tracking', 'outreached', 'meeting booked', 'passed', 'portfolio'));

create table company_urls (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies (id) on delete cascade,
  label       text,
  url         text not null,
  created_at  timestamptz not null default now()
);

create index idx_company_urls_company_id on company_urls (company_id);

alter table company_urls enable row level security;

create policy "company_urls: authenticated full access"
  on company_urls for all
  to authenticated
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- Harmonic enrichment columns + signal_source update (migration)
-- ------------------------------------------------------------
alter table companies add column if not exists logo_url          text;
alter table companies add column if not exists customer_type     text;
alter table companies add column if not exists enrichment_status text;
alter table companies add column if not exists harmonic_id       integer;
alter table companies add column if not exists harmonic_urn      text;
alter table companies add column if not exists last_enriched_at  timestamptz;

alter table people add column if not exists harmonic_urn         text;
alter table people add column if not exists profile_picture_url  text;

alter table companies add column if not exists short_description     text;
alter table companies add column if not exists headcount_30d_growth  float;
alter table companies add column if not exists headcount_90d_growth  float;
alter table companies add column if not exists headcount_6m_growth   float;
alter table companies add column if not exists latest_valuation_usd  bigint;
alter table companies add column if not exists funding_rounds_count  integer;
alter table companies add column if not exists traction_metrics      jsonb;

alter table signals drop constraint if exists signals_signal_source_check;
alter table signals add constraint signals_signal_source_check
  check (signal_source in ('crunchbase','linkedin','techcrunch','manual','harmonic'));

-- Funding rounds detail + last_funding_date as text (ISO date string)
alter table companies add column if not exists funding_rounds_data jsonb;
alter table companies add column if not exists last_funding_date   text;

-- Degree from education history
alter table people add column if not exists degree text;

-- ------------------------------------------------------------
-- Cleanup: delete legacy "enriched via Harmonic" noise signals
-- (new enrichment runs no longer emit these)
-- ------------------------------------------------------------
delete from signals where headline ilike '%enriched via Harmonic%';

-- ------------------------------------------------------------
-- Stage constraint expansion (migration)
--   Full list: bootstrapped, pre-seed, seed, series-a..series-h,
--              growth, private, ipo, acquired
--   Note: legacy 'public' values are renamed to 'ipo' first so the
--   new CHECK constraint won't fail on existing rows.
-- ------------------------------------------------------------
alter table companies drop constraint if exists companies_stage_check;
update companies set stage = 'ipo' where stage = 'public';
alter table companies add constraint companies_stage_check
  check (stage in (
    'bootstrapped',
    'pre-seed',
    'seed',
    'series-a',
    'series-b',
    'series-c',
    'series-d',
    'series-e',
    'series-f',
    'series-g',
    'series-h',
    'growth',
    'private',
    'ipo',
    'acquired'
  ));

-- ------------------------------------------------------------
-- display_order: user-curated row position on the /database page
-- (drag-and-drop). Lower = higher in the list. NULLS LAST so new
-- rows appear at the end until they're explicitly placed.
-- ------------------------------------------------------------
alter table companies add column if not exists display_order double precision;
create index if not exists idx_companies_display_order on companies (display_order nulls last);


-- ------------------------------------------------------------
-- Pigi Tier 0 — raw JSON columns for bulk Harmonic caching
-- (migration 002)
-- ------------------------------------------------------------

-- Full Harmonic company response (source of truth for re-derivation)
alter table companies add column if not exists harmonic_raw  jsonb;
-- Cache of /companies/<urn>/similar — Harmonic's curated similarity graph
alter table companies add column if not exists similar_urns  jsonb;
-- Affinity / highlight badges: YC W24, Forbes 30u30, Sequoia Scout, etc.
alter table companies add column if not exists highlights    jsonb;

-- Full Harmonic person response
alter table people add column if not exists harmonic_raw  jsonb;
-- Complete experience[] history (Pigi lifts the current_position-only cap)
alter table people add column if not exists experience    jsonb;

-- Raw Harmonic signal / event object — needed to reverse-engineer ranking
alter table signals add column if not exists harmonic_raw  jsonb;

-- GIN indexes so jsonb path queries stay fast once Pigi fills these
create index if not exists idx_companies_harmonic_raw on companies using gin (harmonic_raw);
create index if not exists idx_companies_highlights   on companies using gin (highlights);
create index if not exists idx_people_harmonic_raw    on people    using gin (harmonic_raw);
create index if not exists idx_people_experience      on people    using gin (experience);


-- ============================================================
-- Migration 003 — Pigi v1 (2026-04-27)
-- ============================================================

create table if not exists company_snapshots (
  id           uuid        primary key default gen_random_uuid(),
  company_id   uuid        not null references companies (id) on delete cascade,
  harmonic_urn text,
  captured_at  timestamptz not null default now(),
  harmonic_raw jsonb       not null,
  unique (company_id, captured_at)
);
create index if not exists idx_company_snapshots_company_id  on company_snapshots (company_id);
create index if not exists idx_company_snapshots_captured_at on company_snapshots (captured_at desc);
create index if not exists idx_company_snapshots_raw         on company_snapshots using gin (harmonic_raw);
alter table company_snapshots enable row level security;
do $$ begin
  create policy "company_snapshots: authenticated full access"
    on company_snapshots for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create table if not exists list_folders (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  parent_id  uuid        references list_folders (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_list_folders_parent_id on list_folders (parent_id);
alter table list_folders enable row level security;
do $$ begin
  create policy "list_folders: authenticated full access"
    on list_folders for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create table if not exists lists (
  id             uuid        primary key default gen_random_uuid(),
  folder_id      uuid        references list_folders (id) on delete set null,
  name           text        not null,
  description    text,
  color          text,
  created_at     timestamptz not null default now(),
  last_viewed_at timestamptz
);
create index if not exists idx_lists_folder_id on lists (folder_id);
alter table lists enable row level security;
do $$ begin
  create policy "lists: authenticated full access"
    on lists for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create table if not exists list_companies (
  list_id    uuid             not null references lists     (id) on delete cascade,
  company_id uuid             not null references companies (id) on delete cascade,
  added_at   timestamptz      not null default now(),
  position   double precision,
  primary key (list_id, company_id)
);
create index if not exists idx_list_companies_company_id on list_companies (company_id);
alter table list_companies enable row level security;
do $$ begin
  create policy "list_companies: authenticated full access"
    on list_companies for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

create table if not exists saved_searches (
  id                   uuid        primary key default gen_random_uuid(),
  harmonic_id          text        unique,
  name                 text,
  query                jsonb,
  filters              jsonb,
  column_view_settings jsonb,
  source               text        check (source in ('eureka', 'harmonic')),
  created_at           timestamptz not null default now(),
  last_viewed_at       timestamptz
);
alter table saved_searches enable row level security;
do $$ begin
  create policy "saved_searches: authenticated full access"
    on saved_searches for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

alter table companies drop constraint if exists companies_stage_check;
alter table companies add constraint companies_stage_check
  check (stage in (
    'bootstrapped', 'pre-seed', 'seed',
    'series-a', 'series-b', 'series-c', 'series-d',
    'series-e', 'series-f', 'series-g', 'series-h',
    'growth', 'private', 'ipo', 'acquired',
    'venture-unknown'
  ));

alter table companies add column if not exists web_traffic bigint;
alter table companies add column if not exists tags_v2     jsonb;
create index if not exists idx_companies_tags_v2 on companies using gin (tags_v2);
