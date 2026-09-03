-- 014: Admin bypass for kundali_reports — allow admins to read all kundalis.
--
-- Problem: Admins viewing kundalis from the admin panel hit the public
-- /shared/:slug route, which is guarded by the "public read shared reports"
-- policy requiring is_shared = true. Most kundalis default to is_shared = false,
-- so admin "View" buttons land on "Kundali Not Found."
--
-- Solution: Add a SELECT policy that grants admins unconditional read access
-- to all kundali_reports rows, bypassing the is_shared requirement.

-- NOTE: `create policy if not exists` is NOT valid PostgreSQL in any version.
-- The old apply-migration.js used that form and could never have run, but this
-- policy IS live — verified 2026-08-21 against pg_policies; someone applied the
-- correct form by hand. Impersonating an admin (set role authenticated +
-- request.jwt.claims) returns all 359 rows, so the admin read path works.
-- Drop-then-create is the correct idempotent form if it ever needs replaying.
drop policy if exists "admins read all reports" on kundli_reports;

create policy "admins read all reports" on kundli_reports
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );
