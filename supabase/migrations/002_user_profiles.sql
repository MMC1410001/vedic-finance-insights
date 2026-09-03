-- User profiles tied to auth
create table if not exists user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  birth_date      text,
  birth_time      text,
  birth_time_accuracy text default 'exact',
  birth_place     text,
  latitude        float,
  longitude       float,
  timezone        float,
  astro_sign      text,
  risk_tolerance  text,
  horizon         text,
  onboarding_done boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table user_profiles enable row level security;

-- Users can only read/write their own profile
create policy "users manage own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
