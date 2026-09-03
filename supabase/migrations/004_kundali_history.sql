-- Add user_id and share_slug to kundli_reports for history & sharing

-- Link reports to authenticated users
alter table kundli_reports add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table kundli_reports add column if not exists full_name text;
alter table kundli_reports add column if not exists share_slug text unique;
alter table kundli_reports add column if not exists birth_date text;
alter table kundli_reports add column if not exists birth_time text;
alter table kundli_reports add column if not exists birth_place text;

-- Index for user lookups
create index if not exists idx_reports_user on kundli_reports(user_id);
create index if not exists idx_reports_share_slug on kundli_reports(share_slug);

-- Update RLS: users can read their own reports, anyone can read shared reports
drop policy if exists "anon full access reports" on kundli_reports;

-- Allow insert for anyone (guest or authenticated)
create policy "anyone can insert reports" on kundli_reports
  for insert with check (true);

-- Allow users to read their own reports
create policy "users read own reports" on kundli_reports
  for select using (
    user_id = auth.uid()
    or share_slug is not null
    or session_id = current_setting('request.headers', true)::json->>'x-session-id'
  );

-- Allow public read for shared reports (via share_slug)
create policy "public read shared reports" on kundli_reports
  for select using (share_slug is not null);
