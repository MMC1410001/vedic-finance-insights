-- ═══════════════════════════════════════════════════════════════════════════
-- 016: Pipeline health follow-ups — IST day buckets + alert retention
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two QA findings against 015:
--
-- F6: the 30-day series bucketed on the server's UTC calendar day while the UI
--     renders timestamps with toLocaleString("en-IN"). Kundalis created between
--     00:00 and 05:30 IST landed in the *previous* bucket, so "today" read low
--     or empty through the Indian morning and looked like a dip that wasn't
--     there. On a card whose entire job is making a real dip obvious, a
--     recurring phantom dip is corrosive.
--
-- F7: pipeline_alerts had no retention. webhook_events gets a weekly cleanup in
--     010; this got none.
--
-- Only the two function bodies change. Tables, indexes, thresholds and the cron
-- schedule from 015 are untouched.

-- ── F6: bucket the daily series on the Asia/Kolkata calendar day ─────────────
-- The rolling 24h / 7d / prior-7d counters are deliberately NOT changed: they
-- are windows measured back from now(), so they carry no calendar-day meaning
-- and are already timezone-independent.
--
-- `(created_at at time zone 'Asia/Kolkata')::date` is not sargable, so this join
-- cannot use an index on created_at. At current volume (~360 rows) that is
-- irrelevant; revisit if this table reaches six figures.
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
    from generate_series(
           (now() at time zone 'Asia/Kolkata')::date - interval '29 days',
           (now() at time zone 'Asia/Kolkata')::date,
           interval '1 day'
         ) d
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
     and (c.created_at at time zone 'Asia/Kolkata')::date = g.day
    group by g.day, g.stream
  )
  select jsonb_build_object(
    'generated_at', now(),
    'timezone', 'Asia/Kolkata',
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

-- ── F7: retention for pipeline_alerts ───────────────────────────────────────
-- Appended to the existing hourly watchdog rather than given its own cron job:
-- the delete is indexed on detected_at and matches nothing on almost every run.
-- 90 days is well clear of the 14-day window the panel displays.
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
    -- alerting forever on a stream that has simply never been used. The panel
    -- renders this same case as a neutral "no data" tile, deliberately matching.
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

  -- Retention: drop long-resolved incidents. Open alerts are never deleted,
  -- however old — an unresolved outage must not age out of view.
  delete from pipeline_alerts
   where resolved_at is not null
     and resolved_at < now() - interval '90 days';
end;
$$;

-- `create or replace` preserves existing privileges, but re-assert them so this
-- file is correct if replayed against a database where 015 never ran. These are
-- SECURITY DEFINER functions in the public schema: without the revoke, PostgREST
-- exposes them as RPCs callable with the anon key that ships in the JS bundle.
revoke execute on function admin_pipeline_health() from public, anon, authenticated;
revoke execute on function pipeline_health_check() from public, anon, authenticated;

grant execute on function admin_pipeline_health() to service_role;
grant execute on function pipeline_health_check() to service_role;
