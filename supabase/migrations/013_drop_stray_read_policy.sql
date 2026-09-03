-- 013: Drop the out-of-band "anyone can read reports" policy.
--
-- 012 correctly replaced the two SELECT policies that exist in migration
-- history, yet anon could still read all 294 rows. Cause: a third policy
--
--   anyone can read reports [cmd=SELECT roles={public} using=true]
--
-- was present in the live database but in NO migration file — added by hand
-- through the Supabase dashboard. RLS policies are OR'd, so an unconditional
-- `using (true)` overrides every narrower policy alongside it.
--
-- Lesson worth keeping: the migration files are not the whole truth about this
-- database. Verify RLS against the live project, not the repo.

drop policy if exists "anyone can read reports" on kundli_reports;

-- Guard against the same shape reappearing under any other name: drop every
-- SELECT policy on this table whose qualifier is an unconditional `true`.
-- The two intended policies (user_id = auth.uid(), is_shared = true) are not
-- matched by this and survive.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'kundli_reports'
      and cmd = 'SELECT' and qual = 'true'
  loop
    raise notice 'dropping unconditional SELECT policy: %', pol.policyname;
    execute format('drop policy %I on kundli_reports', pol.policyname);
  end loop;
end $$;
