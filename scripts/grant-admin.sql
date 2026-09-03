-- Manual script to grant admin access to a user by email
-- Usage: Run this in the Supabase SQL Editor or via psql
--
-- Replace 'user@example.com' with the target email address

do $$
declare
  target_email text := 'mayur.chaudhary@example.com'; -- CHANGE THIS EMAIL AS NEEDED
  target_user_id uuid;
begin
  -- Look up the user ID from auth.users
  select id into target_user_id
  from auth.users
  where email = target_email;

  -- If the user doesn't exist in auth.users yet, they need to sign in first
  if target_user_id is null then
    raise exception 'User % not found in auth.users. They must sign in at least once before admin access can be granted.', target_email;
  else
    -- Upsert the user_profiles row with is_admin = true
    -- This creates the profile if it doesn't exist, or updates is_admin if it does
    insert into user_profiles (id, is_admin, onboarding_done, has_paid, created_at)
    values (target_user_id, true, false, false, now())
    on conflict (id) do update
    set is_admin = true;

    raise notice 'Admin access granted to % (user_id: %)', target_email, target_user_id;
  end if;
end $$;
