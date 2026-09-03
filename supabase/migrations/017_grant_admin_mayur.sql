-- 017: Grant admin access to mayur.chaudhary@example.com
--
-- Purpose: Make admin access independent of kundali generation by directly
-- upserting a user_profiles row for the specified email. Previously, a user
-- needed to generate a kundali or complete onboarding to create their profile
-- row, which prevented admin panel access until then.
--
-- This migration:
-- 1. Looks up the user ID from auth.users by email
-- 2. Upserts a user_profiles row with is_admin = true
-- 3. Preserves existing profile data if the row already exists
--
-- Safe to run multiple times (upsert is idempotent).

do $$
declare
  target_email text := 'mayur.chaudhary@example.com';
  target_user_id uuid;
begin
  -- Look up the user ID from auth.users
  select id into target_user_id
  from auth.users
  where email = target_email;

  -- If the user doesn't exist in auth.users yet, they need to sign in first
  if target_user_id is null then
    raise notice 'User % not found in auth.users. They must sign in at least once before admin access can be granted.', target_email;
  else
    -- Upsert the user_profiles row with is_admin = true
    -- on_conflict preserves existing onboarding_done and has_paid values
    insert into user_profiles (id, is_admin, onboarding_done, has_paid, created_at)
    values (target_user_id, true, false, false, now())
    on conflict (id) do update
    set is_admin = true;

    raise notice 'Admin access granted to % (user_id: %)', target_email, target_user_id;
  end if;
end $$;
