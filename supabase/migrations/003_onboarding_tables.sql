-- Separate onboarding data into focused tables
-- All reference auth.users(id) with cascade delete

-- 1. Birth details (step 1)
create table if not exists user_birth_details (
  id                  uuid primary key references auth.users(id) on delete cascade,
  birth_date          text not null,
  birth_time          text not null,
  birth_time_accuracy text not null default 'exact',
  birth_place         text not null,
  latitude            float not null,
  longitude           float not null,
  timezone            float not null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table user_birth_details enable row level security;
create policy "users manage own birth details" on user_birth_details
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 2. AstroSign quiz results (step 2)
create table if not exists user_astrosign (
  id              uuid primary key references auth.users(id) on delete cascade,
  element         text not null,           -- Fire / Earth / Air / Water
  sign_label      text not null,           -- "Fire 🔥" etc.
  sign_desc       text not null,
  quiz_answers    integer[] not null,      -- raw answer indices [0-3] per question
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table user_astrosign enable row level security;
create policy "users manage own astrosign" on user_astrosign
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 3. Financial profile (step 3)
create table if not exists user_financial_profile (
  id              uuid primary key references auth.users(id) on delete cascade,
  risk_tolerance  text not null,           -- Conservative / Moderate / Aggressive
  horizon         text not null,           -- Short-term / Medium / Long-term
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table user_financial_profile enable row level security;
create policy "users manage own financial profile" on user_financial_profile
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 4. Migrate existing data from user_profiles into new tables (safe no-op if empty)
insert into user_birth_details (id, birth_date, birth_time, birth_time_accuracy, birth_place, latitude, longitude, timezone, created_at, updated_at)
  select id, birth_date, birth_time, coalesce(birth_time_accuracy,'exact'), coalesce(birth_place,''), coalesce(latitude,0), coalesce(longitude,0), coalesce(timezone,0), created_at, updated_at
  from user_profiles
  where birth_date is not null
  on conflict (id) do nothing;

insert into user_astrosign (id, element, sign_label, sign_desc, quiz_answers, created_at, updated_at)
  select id, coalesce(astro_sign,'Earth'), coalesce(astro_sign,'Earth 🌍'), '', '{}'::integer[], created_at, updated_at
  from user_profiles
  where astro_sign is not null
  on conflict (id) do nothing;

insert into user_financial_profile (id, risk_tolerance, horizon, created_at, updated_at)
  select id, coalesce(risk_tolerance,'Moderate'), coalesce(horizon,'Long-term'), created_at, updated_at
  from user_profiles
  where risk_tolerance is not null
  on conflict (id) do nothing;
