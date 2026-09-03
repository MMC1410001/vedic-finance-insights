-- 012: RLS hardening — close the public read on kundli_reports and birth_profiles.
--
-- Both tables were readable by anyone holding the anon key, which ships in the
-- public JS bundle. Verified before this migration: 294 rows of kundli_reports
-- (full_name, birth_date, birth_time, birth_place) and 47 rows of birth_profiles.
--
-- Cause: 004's "public read shared reports" is `using (share_slug is not null)`,
-- but saveKundaliReport() mints a share_slug for EVERY report, so the policy
-- matched every row. Sharing now needs an explicit opt-in flag instead.

-- ── 1. Explicit share flag ───────────────────────────────────────────────────
-- Defaults to false, so every existing report becomes private. Share links
-- handed out before this migration stop resolving; that is intended.
alter table kundli_reports add column if not exists is_shared boolean default false;

create index if not exists idx_reports_is_shared on kundli_reports(is_shared)
  where is_shared = true;

-- ── 2. Replace the SELECT policies ───────────────────────────────────────────
drop policy if exists "public read shared reports" on kundli_reports;
drop policy if exists "users read own reports" on kundli_reports;

-- Owners read their own. The old policy also carried an
--   `or session_id = current_setting('request.headers',true)::json->>'x-session-id'`
-- clause, dropped here: the browser client is built with no global headers, so
-- x-session-id is never sent and the clause could never match. Guests read their
-- chart from sessionStorage/Zustand, never from this table, so nothing regresses.
create policy "users read own reports" on kundli_reports
  for select using (user_id = auth.uid());

-- Deliberately shared reports stay world-readable, for /shared/:slug.
create policy "public read shared reports" on kundli_reports
  for select using (is_shared = true);

-- ── 3. Let owners flip is_shared ─────────────────────────────────────────────
-- 007's update policy is left in place: its `user_id is null` arm is what lets
-- getUserKundalis() claim a guest's orphaned report at signup, and RLS cannot
-- see the client's WHERE clause to scope it any tighter without the header
-- above. Narrowing it would break the guest -> signup handover, so it is tracked
-- separately rather than changed blind here.

-- ── 4. birth_profiles — close it entirely ────────────────────────────────────
-- 001 created `for all using (true) with check (true)`, i.e. anon could read,
-- write AND delete. The table is referenced nowhere in src/ or
-- supabase/functions/. No replacement policy: with RLS enabled and no policy,
-- the table is unreachable via PostgREST while remaining intact for inspection.
drop policy if exists "anon full access profiles" on birth_profiles;
alter table birth_profiles enable row level security;

-- ── 5. Admin flag ────────────────────────────────────────────────────────────
-- Replaces the shared admin password that shipped in the client bundle.
alter table user_profiles add column if not exists is_admin boolean default false;
