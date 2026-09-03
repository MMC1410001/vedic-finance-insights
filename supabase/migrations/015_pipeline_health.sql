-- ═══════════════════════════════════════════════════════════════════════════
-- 015: Kundali pipeline health — per-stream monitoring, alerting, diagnostics
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Why this exists: on 2026-08-18 the RLS hardening in 012/013 silently broke the
-- guest write path. saveKundaliReport() chained .select() onto its insert, which
-- PostgREST issues as INSERT ... RETURNING; Postgres applies SELECT policies to
-- returned rows, and a guest row (user_id NULL, is_shared false) matched none.
-- Guest saves per day went 12 -> 3 -> 0 -> 0 -> 0 while signed-in saves held at
-- ~30/day, so every aggregate number stayed green. Nobody noticed for three days.
--
-- Two lessons encoded here:
--   1. Monitor each stream separately. A healthy total hid a dead stream.
--   2. A dashboard is a pull mechanism. The cron job below is the push half.

-- ── 1. Tunable thresholds ───────────────────────────────────────────────────
-- A table rather than constants in the function body, so operators can retune
-- without shipping a migration.
create table if not exists pipeline_thresholds (
  stream      text primary key,
  warn_hours  integer,
  crit_hours  integer,
  enabled     boolean not null default true
);

insert into pipeline_thresholds (stream, warn_hours, crit_hours, enabled) values
  ('guest',     24, 72, true),
  ('signed_in', 12, 24, true),
  -- Admin-generated kundalis are created by hand and are rare (3 ever). Alerting
  -- on their absence would be pure noise.
  ('admin',   null, null, false)
on conflict (stream) do nothing;

alter table pipeline_thresholds enable row level security;
-- No policies: service-role only, same posture as webhook_events in 009.

-- ── 2. Alert log ────────────────────────────────────────────────────────────
create table if not exists pipeline_alerts (
  id           uuid primary key default gen_random_uuid(),
  stream       text not null,
  severity     text not null check (severity in ('warn', 'critical')),
  message      text not null,
  hours_since  numeric,
  detected_at  timestamptz not null default now(),
  resolved_at  timestamptz
);

-- One OPEN alert per stream. This partial unique index is what stops the hourly
-- job from stacking a fresh row every hour for a single ongoing outage, while
-- still keeping resolved alerts as history.
create unique index if not exists idx_pipeline_alerts_open
  on pipeline_alerts (stream) where resolved_at is null;

create index if not exists idx_pipeline_alerts_detected
  on pipeline_alerts (detected_at desc);

alter table pipeline_alerts enable row level security;
-- No policies: service-role only.

-- ── 3. Health snapshot ──────────────────────────────────────────────────────
-- One round trip: per-stream freshness + volume, plus a 30-day daily series.
--
-- Stream classification is defined once, here, and must match the edge function
-- and the UI. Order matters: admin-generated rows carry user_id NULL, so without
-- the is_admin_generated branch first they would be counted as guests.
create or replace function admin_pipeline_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with classified as (
    select
      case
        when is_admin_generated then 'admin'
        when user_id is not null then 'signed_in'
        else 'guest'
      end as stream,
      created_at
    from kundli_reports
    -- Canary probes are diagnostics, not traffic.
    where session_id is null or session_id not like 'canary-%'
  ),
  streams as (
    select unnest(array['guest', 'signed_in', 'admin']) as stream
  ),
  per_stream as (
    select
      s.stream,
      jsonb_build_object(
        'last_at',      max(c.created_at),
        'hours_since',  case
                          when max(c.created_at) is null then null
                          else round(extract(epoch from now() - max(c.created_at)) / 3600.0, 1)
                        end,
        'count_24h',    count(c.created_at) filter (where c.created_at > now() - interval '24 hours'),
        'count_7d',     count(c.created_at) filter (where c.created_at > now() - interval '7 days'),
        'count_prev_7d',count(c.created_at) filter (where c.created_at > now() - interval '14 days'
                                             and c.created_at <= now() - interval '7 days'),
        'total',        count(c.created_at)
      ) as stats
    from streams s
    left join classified c on c.stream = s.stream
    group by s.stream
  ),
  -- Cross join the day series with the stream list so a quiet day comes back as
  -- an explicit 0. A missing key would render as a gap in the chart rather than
  -- as the zero it actually is — which is precisely the failure being monitored.
  day_grid as (
    select d::date as day, s.stream
    from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
    cross join streams s
  ),
  daily as (
    select
      g.day,
      g.stream,
      count(c.created_at) as n
    from day_grid g
    left join classified c
      on c.stream = g.stream
     and c.created_at >= g.day
     and c.created_at <  g.day + interval '1 day'
    group by g.day, g.stream
  )
  select jsonb_build_object(
    'generated_at', now(),
    'streams', (select jsonb_object_agg(stream, stats) from per_stream),
    'daily', (
      select coalesce(jsonb_agg(row order by row->>'day'), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'day',       day,
                 'guest',     max(n) filter (where stream = 'guest'),
                 'signed_in', max(n) filter (where stream = 'signed_in'),
                 'admin',     max(n) filter (where stream = 'admin')
               ) as row
        from daily
        group by day
      ) t
    )
  );
$$;

-- ── 4. Live RLS snapshot ────────────────────────────────────────────────────
-- pg_policies is not reachable through PostgREST, which is why this needs to be
-- a function. Migration 013 put it plainly: "the migration files are not the
-- whole truth about this database. Verify RLS against the live project."
create or replace function admin_rls_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table',      tablename,
        'policy',     policyname,
        'cmd',        cmd,
        'roles',      roles::text,
        'qual',       qual,
        'with_check', with_check
      )
      order by tablename, cmd, policyname
    ),
    '[]'::jsonb
  )
  from pg_policies
  where schemaname = 'public'
    and tablename in ('kundli_reports', 'user_profiles');
$$;

-- ── 5. The watchdog ─────────────────────────────────────────────────────────
-- Raises an alert when a stream goes quiet past its threshold, escalates warn ->
-- critical in place, and resolves the open alert once traffic returns.
create or replace function pipeline_health_check()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t            record;
  last_seen    timestamptz;
  hrs          numeric;
  new_severity text;
  msg          text;
begin
  for t in select * from pipeline_thresholds where enabled loop
    select max(created_at) into last_seen
    from kundli_reports
    where (session_id is null or session_id not like 'canary-%')
      and case
            when is_admin_generated then 'admin'
            when user_id is not null then 'signed_in'
            else 'guest'
          end = t.stream;

    -- No rows at all: nothing to compare against, so stay quiet rather than
    -- alerting forever on a stream that has simply never been used.
    if last_seen is null then
      continue;
    end if;

    hrs := round(extract(epoch from now() - last_seen) / 3600.0, 1);

    new_severity := case
      when t.crit_hours is not null and hrs >= t.crit_hours then 'critical'
      when t.warn_hours is not null and hrs >= t.warn_hours then 'warn'
      else null
    end;

    if new_severity is null then
      -- Healthy: close any open alert for this stream.
      update pipeline_alerts
         set resolved_at = now()
       where stream = t.stream and resolved_at is null;
    else
      msg := format(
        'No %s kundali in %sh (%s threshold %sh)',
        t.stream, hrs, new_severity,
        case when new_severity = 'critical' then t.crit_hours else t.warn_hours end
      );

      -- The partial unique index makes this an upsert on the OPEN alert, so an
      -- ongoing outage escalates in place instead of stacking a row per hour.
      insert into pipeline_alerts (stream, severity, message, hours_since)
      values (t.stream, new_severity, msg, hrs)
      on conflict (stream) where resolved_at is null
      do update set severity    = excluded.severity,
                    message     = excluded.message,
                    hours_since = excluded.hours_since;
    end if;
  end loop;

  -- Sweep canary probes the client failed to clean up, so a browser closed
  -- mid-test cannot leave litter in the reports table.
  delete from kundli_reports
   where session_id like 'canary-%'
     and created_at < now() - interval '1 hour';
end;
$$;

-- ── 6. Lock the functions down ──────────────────────────────────────────────
-- These are SECURITY DEFINER functions in the public schema, so PostgREST would
-- otherwise expose them as RPCs callable with the anon key that ships in the JS
-- bundle. admin_rls_snapshot() in particular hands out the whole policy map.
-- Leaving these open would re-create the class of hole 012 was written to close.
revoke execute on function admin_pipeline_health()  from public, anon, authenticated;
revoke execute on function admin_rls_snapshot()     from public, anon, authenticated;
revoke execute on function pipeline_health_check()  from public, anon, authenticated;

grant execute on function admin_pipeline_health()  to service_role;
grant execute on function admin_rls_snapshot()     to service_role;
grant execute on function pipeline_health_check()  to service_role;

-- ── 7. Schedule it ──────────────────────────────────────────────────────────
-- pg_cron is already enabled and running two jobs from 010. Offset to :07 so it
-- does not contend with the on-the-hour jobs.
select cron.unschedule('pipeline-health-check')
  where exists (select 1 from cron.job where jobname = 'pipeline-health-check');

select cron.schedule(
  'pipeline-health-check',
  '7 * * * *',
  $$ select pipeline_health_check() $$
);
