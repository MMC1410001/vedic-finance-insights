-- VedicFinance schema

-- Birth profiles
create table if not exists birth_profiles (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  birth_date  text not null,
  birth_time  text not null,
  birth_place text not null,
  latitude    float not null,
  longitude   float not null,
  timezone    float not null,
  accuracy    text not null default 'exact',
  created_at  timestamptz default now()
);

-- Kundli reports
create table if not exists kundli_reports (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references birth_profiles(id) on delete cascade,
  session_id      text not null,
  financial_phase text,
  confidence_lvl  text,
  time_window     text,
  primary_insight text,
  scores          jsonb,
  dashboard       jsonb,
  timeline        jsonb,
  reasoning       jsonb,
  confidence      jsonb,
  d1_chart        jsonb,
  d9_chart        jsonb,
  dasha           jsonb,
  transits        jsonb,
  created_at      timestamptz default now()
);

-- Index for fast session lookups
create index if not exists idx_reports_session on kundli_reports(session_id);
create index if not exists idx_profiles_session on birth_profiles(session_id);

-- Allow anonymous reads/writes (no auth for MVP)
alter table birth_profiles enable row level security;
alter table kundli_reports  enable row level security;

create policy "anon full access profiles" on birth_profiles for all using (true) with check (true);
create policy "anon full access reports"  on kundli_reports  for all using (true) with check (true);
