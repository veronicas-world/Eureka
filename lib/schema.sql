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
