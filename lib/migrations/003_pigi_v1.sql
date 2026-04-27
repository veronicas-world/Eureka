-- ============================================================
-- Pigi v1 — schema additions
-- Run in Supabase SQL editor. All statements are idempotent.
-- ============================================================


-- ------------------------------------------------------------
-- company_snapshots
-- Immutable per-run snapshots of the Harmonic API response.
-- The signal deriver (Phase 2) diffs N vs N-1 to emit signals.
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- list_folders  (hierarchical: folders can nest inside folders)
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- lists
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- list_companies
-- ------------------------------------------------------------
create table if not exists list_companies (
  list_id    uuid            not null references lists    (id) on delete cascade,
  company_id uuid            not null references companies (id) on delete cascade,
  added_at   timestamptz     not null default now(),
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


-- ------------------------------------------------------------
-- saved_searches
-- query is jsonb (Harmonic's query is a structured filter_group,
-- not a plain text string).
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- companies: stage constraint expansion
-- Add 'venture-unknown' (Harmonic's VENTURE_UNKNOWN stage).
-- ------------------------------------------------------------
alter table companies drop constraint if exists companies_stage_check;
alter table companies add constraint companies_stage_check
  check (stage in (
    'bootstrapped',
    'pre-seed',
    'seed',
    'series-a', 'series-b', 'series-c', 'series-d',
    'series-e', 'series-f', 'series-g', 'series-h',
    'growth',
    'private',
    'ipo',
    'acquired',
    'venture-unknown'
  ));


-- ------------------------------------------------------------
-- companies: new typed columns populated by Pigi
-- ------------------------------------------------------------
-- Current monthly web visitors (top-level scalar from Harmonic response).
-- Full time-series lives in traction_metrics.web_traffic.
alter table companies add column if not exists web_traffic bigint;

-- Structured tag data (tags_v2 array verbatim from Harmonic).
-- The plain text[] tags column stays for quick string queries.
alter table companies add column if not exists tags_v2 jsonb;

create index if not exists idx_companies_tags_v2 on companies using gin (tags_v2);
