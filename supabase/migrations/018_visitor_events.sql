-- ═══════════════════════════════════════════════════════════════════════════
-- 018: Visitor tracking + first-party analytics
--
-- Why: we had no record of *who* (network-wise) generates kundalis. GA4 discards
-- the IP before processing and Clarity masks it, so neither can answer "where is
-- guest traffic coming from", "is one IP farming free kundalis", or "did these
-- two accounts sign up from the same address". Those need the IP in our own
-- Postgres, next to user_profiles and payment_orders.
--
-- The IP is captured server-side by the track-visit edge function. The browser
-- cannot read its own public IP, and anything a client sends is spoofable — so
-- nothing here is ever written from the client.
--
-- Shape: an append-only event log, not one row per session. One table then
-- serves the audit trail, the per-IP rate-limit count, and the guest→signup
-- funnel. session_id is the join key to kundli_reports.session_id.
--
-- ── Extended for the /admin Analytics section ───────────────────────────────
-- The same log now also backs behavioural analytics: page views, clicks, session
-- duration, drop-off. Extending this table rather than adding a second one is
-- deliberate — the questions that matter are joins ("of the sessions that
-- generated a kundali, how many signed in?"), and those are trivial inside one
-- log and awkward across two.
--
-- The reason this is first-party at all: GA4 (G-WJX6J34M3S) receives nothing but
-- pageviews, because every named click tag stops at window.dataLayer until
-- someone builds a trigger in GTM container GTM-K8SZDDSJ, which lives outside
-- this repo. And no external tool can join a click to payment_orders. GA4 and
-- Clarity keep running in parallel as a cross-check; see ANALYTICS.md.
--
-- NOT in scope: session replay / DOM recording. Clarity keeps that job.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists visitor_events (
  id          uuid primary key default gen_random_uuid(),
  -- Matches kundli_reports.session_id (sessionStorage "sessionId"). text, not
  -- uuid, to mirror that column exactly so the join needs no cast.
  session_id  text not null,
  -- Null for guests. Populated on the "signed_in" event, which is what links a
  -- guest's earlier anonymous rows to an account.
  user_id     uuid references auth.users(id) on delete set null,
  ip_address  inet,
  -- Full x-forwarded-for chain. Behind the gateway the leftmost entry is
  -- client-supplied and therefore spoofable; keeping the chain is what makes a
  -- spoofed value detectable after the fact.
  ip_chain    text,
  user_agent  text,
  referrer    text,
  path        text,
  -- Known values. Left unconstrained on purpose: a CHECK here would make adding
  -- an event a migration, and payment_orders already shows what happens when
  -- code writes a value the CHECK forbids (see 009 + payment-webhook).
  --   visit             — first load of the SPA        (track-visit)
  --   page_view         — route change within the SPA  (track-visit)
  --   session_end       — pagehide, carries duration   (track-visit)
  --   click             — one interaction, see props   (track-visit)
  --   kundali_generated — report saved                 (track-visit)
  --   payment_started   — ₹99 order attempted          (track-visit)
  --   signed_in         — links session_id to user_id  (track-visit)
  --   report_requested  — generate-report call ledger  (generate-report)
  --   error             — client-side failure          (track-visit)
  --
  -- Admin-only behaviour signals. These five are queued by the client through
  -- queueEvent() and never routed through analytics(), which is the app's one
  -- window.dataLayer writer — so nothing about them reaches GTM container
  -- GTM-K8SZDDSJ or GA4, and the agreed click-tag strings are untouched. They
  -- exist for /admin → Analytics and nothing else. See ANALYTICS.md.
  --   dead_click        — click that hit nothing interactive  (props: selector)
  --   rage_click        — 3+ clicks in one spot inside 700ms  (props: selector, dead)
  --   scroll_depth      — 25/50/75/100% reached, once each    (props: depth, doc_h)
  --   cta_view          — a tagged CTA was genuinely seen     (props: tag)
  --   field_focus       — first focus of a form field         (props: form, field, order)
  --
  -- Payment *completion* is deliberately absent. It is read from
  -- payment_orders.status instead: a client-reported purchase is forgeable, and
  -- Payment.tsx's completeAndRedirect is reached from six different paths.
  event       text not null default 'visit',
  -- Reserved for geo enrichment. Deliberately not populated yet — no external
  -- lookup is wired up, and a half-filled column reads as missing data.
  country     text,
  region      text,
  city        text,
  created_at  timestamptz not null default now()
);

-- ── Analytics columns ───────────────────────────────────────────────────────
-- ALTERs rather than columns inside the CREATE above, because `create table if
-- not exists` on an already-existing table silently skips new columns — the
-- exact trap that made 008_fix_missing_columns.sql necessary. Written this way,
-- the block is correct whether or not 018 has been applied before.
alter table visitor_events add column if not exists props       jsonb;
alter table visitor_events add column if not exists viewport_w  integer;
alter table visitor_events add column if not exists viewport_h  integer;
-- Derived from the user-agent server-side, in track-visit. Stored rather than
-- parsed at query time so no aggregate has to pick apart a UA string in SQL.
alter table visitor_events add column if not exists device      text;
alter table visitor_events add column if not exists browser     text;
alter table visitor_events add column if not exists os          text;
-- Milliseconds. On session_end this is the whole session; on page_view it is the
-- dwell on the *previous* path, which is what makes per-page time measurable.
alter table visitor_events add column if not exists duration_ms integer;
-- Client-side ordering tie-breaker, monotonic within one page load.
--
-- created_at defaults to now(), which is TRANSACTION time — and event-queue.ts
-- sends a whole batch that track-visit writes with one multi-row insert. Every
-- row in that batch therefore carries the identical timestamp, and the dwell and
-- exit-page windows in the `views` CTE below (which order by created_at) had a
-- full tie to break arbitrarily. That shuffled per-page dwell between paths and
-- put the exit on whichever row came back first.
--
-- A counter rather than a client timestamp: created_at stays server-authoritative
-- and a skewed client clock cannot reorder anything, because this only ever
-- disambiguates rows that already tie. Null on rows written before this existed.
alter table visitor_events add column if not exists seq integer;

comment on column visitor_events.props is
  'Event parameters. Known keys: tag (the GTM click-tag name), selector, text, from (previous path on page_view), sampled (bool, click coordinates were recorded), depth + doc_h (scroll_depth), dead (rage_click), form + field + order (field_focus).';

create index if not exists visitor_events_session_id_idx on visitor_events (session_id);
-- Exactly the sort the dwell/exit windows in the `views` CTE perform.
create index if not exists visitor_events_session_order_idx
  on visitor_events (session_id, created_at, seq);
-- Serves the rate-limit count: "rows for this IP since now() - 1 hour".
create index if not exists visitor_events_ip_created_idx on visitor_events (ip_address, created_at desc);
create index if not exists visitor_events_user_id_idx    on visitor_events (user_id);
create index if not exists visitor_events_created_at_idx on visitor_events (created_at desc);
-- Serves every analytics aggregate, all of which filter on a window and then
-- group by event. Leading with created_at means one index scan for "last N days"
-- rather than a full sequential scan of the log.
create index if not exists visitor_events_created_event_idx on visitor_events (created_at desc, event);
-- The per-path pages table and its exit-rate calculation.
create index if not exists visitor_events_path_idx on visitor_events (path) where path is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Writes are service-role only (track-visit). There is deliberately NO insert
-- policy for anon/authenticated: an insert policy here would let any anon-key
-- holder forge rows, which defeats the entire point of capturing the IP
-- server-side.
alter table visitor_events enable row level security;

-- Admin read, same shape as 014_admin_read_all_kundalis.sql. Drop-then-create
-- because `create policy if not exists` is not valid PostgreSQL in any version.
drop policy if exists "admins read all visitor events" on visitor_events;

create policy "admins read all visitor events" on visitor_events
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );

-- ── Per-session rollup ──────────────────────────────────────────────────────
-- The admin panel reads this instead of aggregating client-side.
-- security_invoker so the admin SELECT policy above still applies — a plain view
-- runs as its owner and would leak every row to any anon-key holder.
drop view if exists visitor_session_summary;

create view visitor_session_summary
with (security_invoker = true) as
select
  session_id,
  min(created_at)                                  as first_seen_at,
  max(created_at)                                  as last_seen_at,
  count(*)                                         as event_count,
  count(distinct ip_address)                       as distinct_ips,
  (array_agg(ip_address order by created_at desc)
     filter (where ip_address is not null))[1]     as last_ip,
  (array_agg(user_id order by created_at desc)
     filter (where user_id is not null))[1]        as user_id,
  (array_agg(user_agent order by created_at desc)
     filter (where user_agent is not null))[1]     as last_user_agent,
  array_agg(distinct event)                        as events
from visitor_events
group by session_id;

-- security_invoker needs PG 15+. If this project is ever on an older server the
-- clause is rejected and the migration fails loudly — which is the right outcome,
-- because silently falling back to an owner-run view would expose every row.
-- The revoke below is the second line of defence: only the service role (which
-- ignores grants) reads this view, so anon and authenticated need no access to it
-- at all. 015 revokes EXECUTE from the same two roles for the same reason.
revoke all on visitor_session_summary from anon, authenticated;

-- ── Click coordinates ───────────────────────────────────────────────────────
-- Kept out of visitor_events on purpose. A coordinate row is written per sampled
-- click, which is 10-100x the volume of the funnel events, and it wants its own
-- (much shorter) retention. Mixing the two would make every funnel aggregate
-- scan past a pile of heatmap rows it does not need.
create table if not exists click_points (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  path        text not null,
  device      text,
  viewport_w  integer,
  viewport_h  integer,
  -- Normalised 0-1 against the document width and the full scroll height, so a
  -- point stays meaningful across viewport sizes. Storing raw pixels would make
  -- a 390px phone and a 1440px desktop uncomparable.
  x_pct       numeric(6,5) not null,
  y_pct       numeric(6,5) not null,
  selector    text,
  created_at  timestamptz not null default now()
);

-- Added after the table shipped, so ALTER rather than inline — this migration is
-- re-runnable and some projects already have the original three columns.
--
-- doc_h: the document height y_pct is a fraction OF, in CSS pixels.
--   Without it a fraction cannot be turned back into a position. The admin heatmap
--   has to multiply y_pct by *some* height, and the only one available to it is the
--   height of its own preview iframe — a different page state to the visitor's
--   (an open accordion, lazily loaded content, a longer report). Every blob was
--   therefore displaced, worst at the bottom of the page, which is how clicks came
--   to appear in regions holding no elements. Nullable: rows written before this
--   column existed have none, and admin_click_map falls back for them.
--
-- kind: which sort of click this was — 'click' (hit something interactive),
--   'dead' (hit nothing interactive), 'rage' (repeated in one spot). Derived
--   server-side in track-visit from the already-validated event verb, never read
--   from the request body. Defaulted so existing rows are plain clicks.
alter table click_points add column if not exists doc_h integer;
alter table click_points add column if not exists kind  text not null default 'click';

-- The heatmap always asks for one path, one device class, one kind, over a window.
create index if not exists click_points_path_device_idx
  on click_points (path, device, created_at desc);
create index if not exists click_points_path_kind_idx
  on click_points (path, kind, created_at desc);

alter table click_points enable row level security;

-- Same posture as visitor_events above: no insert policy at all, so only the
-- service role (track-visit) writes. Admin read, so the panel can be built
-- against a direct query if the edge action is ever unavailable.
drop policy if exists "admins read all click points" on click_points;

create policy "admins read all click points" on click_points
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );

-- ── Internal traffic ────────────────────────────────────────────────────────
-- Which sessions are the team's own, so the Analytics panel can answer "how are
-- REAL users behaving" instead of counting our own testing.
--
-- A filter, never a blocklist. Rows matching these rules are still recorded, and
-- still listed in full in the Visitors & IPs panel — they are only subtracted
-- from the aggregate numbers, and only while the operator has the filter on.
--
-- A table rather than constants in the function body, for the reason 015 gives
-- for pipeline_thresholds: an office changes ISP, or a new person joins, and
-- neither should need a migration.
--
-- ── Why CIDRs, and why several per office ──────────────────────────────────
-- Measured from the Vikhroli office on 26 Aug 2026: three consecutive requests
-- left by three different ISPs (Tata Teleservices, Satellite Netcom, Vortex
-- Netsol). The office runs multiple WAN links and balances across them
-- per-request. Two consequences are baked into the design below:
--
--   1. One address per office is not enough — it would silently catch a third
--      of the traffic while looking like it worked.
--   2. Matching has to be per SESSION, not per event. One person's single visit
--      can arrive from all three links, so an event-level filter would leave
--      every internal session partly counted. See internal_sessions in
--      admin_analytics() below.
create table if not exists internal_traffic (
  id         uuid primary key default gen_random_uuid(),
  -- 'network' — an office address or range, matched against visitor_events.ip_address
  -- 'account' — a specific user, for team members testing from home or mobile data
  kind       text not null check (kind in ('network', 'account')),
  network    cidr,
  user_id    uuid references auth.users(id) on delete cascade,
  -- 'Vikhroli', 'Goregaon', 'Team' — grouping for the admin UI, not logic.
  label      text not null default 'Internal',
  -- The ISP and the date observed. Without it, a stale row a year from now is
  -- impossible to tell apart from a live one.
  note       text,
  -- Disable rather than delete, so a temporarily-wrong rule can be turned off
  -- and back on without losing the note explaining what it was.
  enabled    boolean not null default true,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Exactly one of the two, matching `kind`. A row with both set would match far
  -- more than whoever wrote it intended.
  constraint internal_traffic_shape check (
    (kind = 'network' and network is not null and user_id is null) or
    (kind = 'account' and user_id is not null and network is null)
  )
);

-- Partial uniques rather than one composite: two nulls never conflict, so a
-- plain unique(network, user_id) would happily allow the same address twice.
create unique index if not exists internal_traffic_network_key
  on internal_traffic (network) where network is not null;
create unique index if not exists internal_traffic_user_key
  on internal_traffic (user_id) where user_id is not null;

alter table internal_traffic enable row level security;

-- Same posture as the two tables above: service-role write only, admin read.
drop policy if exists "admins read internal traffic" on internal_traffic;

create policy "admins read internal traffic" on internal_traffic
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );

-- ── Seed: Vikhroli ──────────────────────────────────────────────────────────
-- The three addresses observed on 26 Aug 2026, as /32s rather than a guessed
-- range. Widening one to a /24 later is a click in the admin UI; a guessed range
-- that happens to overlap a residential pool would delete real users from the
-- numbers and give no sign that it had.
--
-- `on conflict do nothing` so re-applying this migration never clobbers an entry
-- someone has since edited, disabled or re-labelled.
--
-- Goregaon has no entry yet — nobody has read its address. Add it from
-- /admin → IP Addresses → Internal traffic → "Add my current IP", from that
-- office, on each of its links.
insert into internal_traffic (kind, network, label, note) values
  ('network', '27.107.167.94/32',  'Vikhroli', 'Tata Teleservices AS17762 — rDNS says static. Observed 26 Aug 2026.'),
  ('network', '103.87.167.58/32',  'Vikhroli', 'Satellite Netcom AS137166 — may be dynamic. Observed 26 Aug 2026.'),
  ('network', '206.84.224.70/32',  'Vikhroli', 'Vortex Netsol AS136334 — may be dynamic. Observed 26 Aug 2026.')
on conflict do nothing;

-- ── Which preview a click belongs under ─────────────────────────────────────
-- The single answer to "which device canvas should this point be drawn on", used
-- by both admin_analytics()'s click_map_paths CTE and admin_click_map() below. A
-- function rather than repeated CASE blocks precisely because those two must
-- agree: the picker prints a count and the canvas draws the points, and when they
-- disagreed the panel contradicted itself on screen.
--
-- Declared HERE, above admin_analytics, rather than beside the heatmap function:
-- a SQL-language function body is parsed and validated at CREATE time, so
-- admin_analytics() cannot reference a helper defined later in the file.
--
-- Why viewport width beats the device label: click_points.device is derived from
-- the User-Agent in track-visit, so a desktop browser in a 500px window is
-- recorded as 'desktop' and then previewed at 1440px — every one of its
-- coordinates misplaced by nearly 3x. viewport_w is the width the page actually
-- laid out in, which is the width the preview reproduces.
--
-- Falls back to the UA class only when no viewport was reported, so every row
-- lands in exactly one bucket and none is silently dropped.
create or replace function click_viewport_class(p_viewport_w integer, p_device text)
returns text
language sql
immutable
parallel safe
as $$
  select case
           when p_viewport_w is null then p_device
           when p_viewport_w < 600   then 'mobile'
           when p_viewport_w < 1024  then 'tablet'
           else 'desktop'
         end;
$$;

-- ── Analytics aggregate ─────────────────────────────────────────────────────
-- One round trip for the whole /admin Analytics section, in the shape of
-- admin_pipeline_health() in 015. Aggregating here rather than in the browser is
-- not a preference: the funnel needs a join against payment_orders, which the
-- client cannot read for other users at all.
--
-- Scale note: this reads raw rows. At current volume (12-30 kundalis/day) that
-- is comfortable for a long while. The point to add a daily rollup table is when
-- click_points passes roughly 1M rows — pre-building one now would be a second
-- source of truth to keep correct for no measurable gain.
--
-- ── Adding a parameter is not a replace ────────────────────────────────────
-- Postgres overloads on the argument list, so `create or replace` with an extra
-- parameter leaves the OLD function in place, still carrying its grants, and
-- PostgREST may resolve either one. Drop it explicitly first.
drop function if exists admin_analytics(integer);
drop function if exists admin_analytics(integer, boolean);

-- Explicit bounds rather than a day count, because "1 Aug to 14 Aug" cannot be
-- expressed as a number of days back from now. The presets (Today, Yesterday,
-- 7/30/90d) are resolved in the browser and arrive already converted, so this
-- function has one notion of a window and no preset vocabulary of its own.
create or replace function admin_analytics(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now(),
  -- Subtract the team's own traffic. Default true: the panel exists to describe
  -- real users, so that is what it should show without anyone having to know a
  -- filter exists. The payload reports what was hidden either way, so the UI can
  -- state the mode rather than quietly showing a different number.
  p_exclude_internal boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  -- Ordered rather than trusted: these arrive from an edge function that got
  -- them from a request body. An inverted range would not error, it would
  -- silently return nothing — which reads as "no traffic", not as bad input.
  win as (
    select
      least(coalesce(p_from, now() - interval '30 days'), coalesce(p_to, now()))    as since,
      greatest(coalesce(p_to, now()), coalesce(p_from, now() - interval '30 days')) as until
  ),
  -- Day boundaries for the series below, in IST.
  --
  -- This used `current_date`, which on Supabase is UTC. India is UTC+5:30, so
  -- everything between 00:00 and 05:30 IST was counted against the previous day
  -- and late-night traffic landed on the wrong bar. The users and the team are
  -- both in India, so Kolkata's midnight is the one that means anything here.
  grid_bounds as (
    select
      (timezone('Asia/Kolkata', (select since from win)))::date as from_day,
      (timezone('Asia/Kolkata', (select until from win)))::date as to_day
  ),
  -- Sessions belonging to us rather than to a user, by either rule in
  -- internal_traffic. Computed as a whole-session verdict on purpose: the
  -- Vikhroli office balances across three ISPs per request, so one visit's
  -- events carry several different addresses. Matching event-by-event would
  -- leave every internal session partly counted, which is worse than not
  -- filtering — the number would look plausible and be wrong.
  internal_sessions as (
    select distinct e.session_id
    from visitor_events e
    where e.created_at >= (select since from win)
      and e.created_at <= (select until from win)
      and (
        exists (
          select 1 from internal_traffic n
          where n.enabled and n.network is not null
            and e.ip_address is not null
            and e.ip_address <<= n.network
        )
        or exists (
          select 1 from internal_traffic a
          where a.enabled and a.user_id is not null
            and a.user_id = e.user_id
        )
      )
  ),
  -- The accounts behind those sessions, plus any explicitly listed. Needed
  -- because payment_orders has no IP column and can only be filtered by user.
  internal_users as (
    select user_id from internal_traffic where enabled and user_id is not null
    union
    select distinct e.user_id
    from visitor_events e
    where e.user_id is not null
      and e.session_id in (select session_id from internal_sessions)
  ),
  ev as (
    select *
    from visitor_events
    where created_at >= (select since from win)
      and created_at <= (select until from win)
      -- Canary probes are diagnostics, not traffic. Mirrors 015's exclusion.
      and session_id not like 'canary-%'
      and (
        not p_exclude_internal
        or session_id not in (select session_id from internal_sessions)
      )
  ),
  -- One row per session. Every engagement number below is derived from this.
  sess as (
    select
      session_id,
      min(created_at)                                     as first_seen,
      max(created_at)                                     as last_seen,
      count(*) filter (where event in ('visit', 'page_view')) as views,
      -- Prefer the explicit session_end measurement; fall back to the span
      -- between first and last event. The fallback under-reports the final page
      -- (nothing marks its end) which is exactly why session_end exists.
      coalesce(
        max(duration_ms) filter (where event = 'session_end'),
        (extract(epoch from max(created_at) - min(created_at)) * 1000)::integer
      )                                                   as duration_ms,
      bool_or(event = 'kundali_generated')                as did_kundali,
      bool_or(event = 'signed_in')                        as did_signin,
      bool_or(event = 'payment_started')                  as did_pay_start,
      min(created_at) filter (where event = 'kundali_generated') as t_kundali,
      min(created_at) filter (where event = 'signed_in')  as t_signin,
      (array_agg(user_id  order by created_at desc) filter (where user_id  is not null))[1] as user_id,
      (array_agg(device   order by created_at desc) filter (where device   is not null))[1] as device,
      (array_agg(browser  order by created_at desc) filter (where browser  is not null))[1] as browser,
      (array_agg(referrer order by created_at asc)  filter (where referrer is not null))[1] as first_referrer
    from ev
    group by session_id
  ),
  -- Page views with the dwell that belongs to them. A page_view carries the time
  -- spent on the *previous* path, so the value has to be pulled forward from the
  -- next row. The last page of a session therefore has no dwell — nothing marks
  -- its end — and is left out of the average rather than counted as zero.
  views as (
    select
      session_id,
      path,
      -- `seq` breaks the tie created_at cannot: a batch is one insert, so every
      -- row in it shares a timestamp. Without the tie-break these two windows
      -- order arbitrarily and both dwell and the exit page land on the wrong
      -- path. Rows predating the column sort first / last respectively, which
      -- keeps them ordered sanely against rows that have one.
      lead(duration_ms) over (
        partition by session_id order by created_at, seq nulls first
      ) as dwell_ms,
      row_number() over (
        partition by session_id order by created_at desc, seq desc nulls last
      ) as rn_from_end
    from ev
    where event in ('visit', 'page_view')
      and path is not null
  ),
  pay as (
    select
      count(*)                                                as orders,
      count(*) filter (where status = 'completed')            as completed,
      count(*) filter (where status = 'failed')               as failed,
      count(*) filter (where status = 'expired')              as expired,
      count(*) filter (where status = 'pending')              as pending,
      count(distinct user_id) filter (where status = 'completed') as paying_users,
      coalesce(sum(amount) filter (where status = 'completed'), 0) as revenue
    from payment_orders o
    where o.created_at >= (select since from win)
      and o.created_at <= (select until from win)
      -- By user, because there is no IP on an order. Without this the funnel can
      -- report more completions than starts once the filter is on, which reads
      -- as a broken funnel rather than a working filter.
      -- `not exists` rather than `not in`: internal_users is a UNION of two
      -- branches, and if either ever yields a NULL, `not in` evaluates to NULL
      -- for every row and silently returns zero orders. Both branches guard
      -- against it today; this makes a future edit unable to reintroduce it.
      and (
        not p_exclude_internal
        or not exists (select 1 from internal_users u where u.user_id = o.user_id)
      )
  ),
  day_grid as (
    select d::date as day
    from generate_series(
      (select from_day from grid_bounds)::timestamp,
      (select to_day   from grid_bounds)::timestamp,
      interval '1 day'
    ) d
  ),
  -- ── The last thing a session touched ────────────────────────────────────────
  -- "Which button were people looking at when they gave up?" — not answerable
  -- from the clicks table, which ranks by volume and so is dominated by whatever
  -- everybody clicks on the way in.
  --
  -- Needs no new client event: a session's final click row already is the answer.
  -- Keyed exactly like the 'events' block above (tag, else selector) so the same
  -- control carries the same label in both tables.
  last_click as (
    select
      session_id,
      coalesce(props->>'tag', props->>'selector', '(unidentified)') as label,
      path
    from (
      select
        session_id, props, path,
        row_number() over (partition by session_id order by created_at desc) as rn
      from ev
      where event = 'click'
    ) c
    where rn = 1
  ),
  -- ── Scroll reach ───────────────────────────────────────────────────────────
  -- Distinct SESSIONS per milestone, not events: the question is how many people
  -- got that far, and a session emits each milestone at most once per page view
  -- but may visit a page twice.
  --
  -- The denominator is deliberately the session count for the page from
  -- visit/page_view rows, NOT the count of sessions that reported a scroll
  -- milestone. A visitor who lands and leaves without scrolling reports no
  -- milestone at all, so scoping the denominator to reporters would divide by only
  -- the people who scrolled and put every page at ~100% reach — a plausible number
  -- that says the opposite of the truth.
  scroll as (
    select
      path,
      count(distinct session_id) filter (where event in ('visit', 'page_view'))  as sessions,
      count(distinct session_id) filter (where event = 'scroll_depth' and (props->>'depth')::int >= 25)  as d25,
      count(distinct session_id) filter (where event = 'scroll_depth' and (props->>'depth')::int >= 50)  as d50,
      count(distinct session_id) filter (where event = 'scroll_depth' and (props->>'depth')::int >= 75)  as d75,
      count(distinct session_id) filter (where event = 'scroll_depth' and (props->>'depth')::int >= 100) as d100
    from ev
    where path is not null
      and event in ('visit', 'page_view', 'scroll_depth')
    group by path
  ),
  -- ── CTA seen vs clicked ────────────────────────────────────────────────────
  -- The denominator the clicks table has always lacked. A CTA with 40 clicks is
  -- excellent at 60 impressions and invisible at 6,000, and until now those two
  -- were the same row.
  --
  -- full outer join, not a left join from either side: a CTA can be clicked
  -- without an impression (cta_view needs half the element on screen for a second,
  -- and a fast click beats that) and impressed without a click, which is the
  -- interesting case. Joining one way silently drops the other.
  cta as (
    select
      coalesce(v.tag, c.tag)                as tag,
      coalesce(v.sessions, 0)               as seen_sessions,
      coalesce(c.clicks, 0)                 as clicks,
      coalesce(c.sessions, 0)               as clicked_sessions
    from (
      select props->>'tag' as tag, count(distinct session_id) as sessions
      from ev
      where event = 'cta_view' and props->>'tag' is not null
      group by props->>'tag'
    ) v
    full outer join (
      select props->>'tag' as tag, count(*) as clicks, count(distinct session_id) as sessions
      from ev
      where event = 'click' and props->>'tag' is not null
      group by props->>'tag'
    ) c on c.tag = v.tag
  )
  select jsonb_build_object(
    'generated_at', now(),
    'from',         (select since from win),
    'to',           (select until from win),
    -- Rounded up, so a 36-hour window reports 2 rather than 1. Used only for
    -- labels; nothing computes from it.
    'days',         ceil(extract(epoch from (select until from win) - (select since from win)) / 86400.0)::int,

    -- ── Funnel ──
    -- Sessions, not events: "how many people got this far", which is the
    -- question. Completed payments come from payment_orders because a
    -- client-reported purchase is forgeable.
    'funnel', jsonb_build_object(
      'sessions',          (select count(*) from sess),
      'kundali_generated', (select count(*) from sess where did_kundali),
      'signed_in',         (select count(*) from sess where did_signin),
      'payment_started',   (select count(*) from sess where did_pay_start),
      'payment_completed', (select completed from pay),
      'paying_users',      (select paying_users from pay),
      'revenue',           (select revenue from pay)
    ),

    -- ── The guest to Google question, asked directly ──
    -- Numerator requires the sign-in to come *after* the kundali. A user who was
    -- already signed in before generating one is not a conversion.
    --
    -- Strictly `>`, so identical timestamps count as "already signed in" rather
    -- than as a conversion. That is the conservative direction — it can only
    -- understate the number, never inflate it. In practice the two events are
    -- separate HTTP requests seconds apart; ties only show up in bulk inserts,
    -- where every row shares the transaction's now().
    'guest_to_google', jsonb_build_object(
      'generated_as_guest', (select count(*) from sess where did_kundali),
      'then_signed_in',     (select count(*) from sess
                             where did_kundali and t_signin is not null and t_signin > t_kundali),
      'already_signed_in',  (select count(*) from sess
                             where did_kundali and t_signin is not null and t_signin <= t_kundali)
    ),

    -- ── Pay click vs actual payment ──
    'payment', (select jsonb_build_object(
        'clicks',    (select count(*) from ev where event = 'payment_started'),
        'sessions',  (select count(*) from sess where did_pay_start),
        'orders',    orders,
        'completed', completed,
        'failed',    failed,
        'expired',   expired,
        'pending',   pending,
        'revenue',   revenue
      ) from pay),

    -- ── Engagement ──
    'engagement', (select jsonb_build_object(
        'sessions',        count(*),
        'avg_seconds',     round(coalesce(avg(duration_ms), 0) / 1000.0, 1),
        -- ::numeric is required, not cosmetic: percentile_cont returns double
        -- precision and there is no round(double precision, integer) in
        -- Postgres, only round(numeric, integer).
        'median_seconds',  round((coalesce(percentile_cont(0.5) within group (order by duration_ms::float8), 0) / 1000.0)::numeric, 1),
        -- A single-view session is a bounce. With route tracking in place this
        -- means "arrived and left without going anywhere".
        'bounce_pct',      round(100.0 * count(*) filter (where views <= 1) / greatest(count(*), 1), 1),
        'views_per_session', round(coalesce(avg(views), 0), 2),
        'identified',      count(*) filter (where user_id is not null),
        'anonymous',       count(*) filter (where user_id is null)
      ) from sess),

    -- ── Where people leave ──
    -- exits / views per path is the drop-off signal: a high exit rate on
    -- /payment means something different from a high one on /kundali.
    'pages', (
      select coalesce(jsonb_agg(row order by (row->>'views')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'path',        path,
                 'views',       count(*),
                 'sessions',    count(distinct session_id),
                 'avg_seconds', round(coalesce(avg(dwell_ms), 0) / 1000.0, 1),
                 'exits',       count(*) filter (where rn_from_end = 1),
                 'exit_pct',    round(100.0 * count(*) filter (where rn_from_end = 1) / greatest(count(*), 1), 1)
               ) as row
        from views
        group by path
        order by count(*) desc
        limit 50
      ) t
    ),

    -- ── What gets clicked ──
    -- Prefers the GTM tag name when one is present, so the 33 already-agreed
    -- names carry straight through; falls back to a derived selector.
    'events', (
      select coalesce(jsonb_agg(row order by (row->>'clicks')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'label',    coalesce(props->>'tag', props->>'selector', '(unidentified)'),
                 'tagged',   props->>'tag' is not null,
                 'clicks',   count(*),
                 'sessions', count(distinct session_id),
                 'users',    count(distinct user_id)
               ) as row
        from ev
        where event = 'click'
        group by coalesce(props->>'tag', props->>'selector', '(unidentified)'), props->>'tag' is not null
        order by count(*) desc
        limit 50
      ) t
    ),

    -- ── Where people stop reading ──
    -- The one question the pages table cannot answer. It reports that people left
    -- a page; this reports how far down they got before they did — which is the
    -- only signal at all on a page whose only interaction is scrolling.
    --
    -- First-party only: scroll_depth is queued by src/lib/scroll-tracking.ts and
    -- never routed through analytics(), so nothing about it reaches GTM or GA4.
    'scroll_depth', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'path',     path,
                 'sessions', sessions,
                 'd25',      d25,
                 'd50',      d50,
                 'd75',      d75,
                 'd100',     d100,
                 -- Reach as a percentage, computed here so the panel cannot divide
                 -- by a different denominator than this block used.
                 'd25_pct',  round(100.0 * d25  / greatest(sessions, 1), 1),
                 'd50_pct',  round(100.0 * d50  / greatest(sessions, 1), 1),
                 'd75_pct',  round(100.0 * d75  / greatest(sessions, 1), 1),
                 'd100_pct', round(100.0 * d100 / greatest(sessions, 1), 1)
               ) as row
        from scroll
        where sessions > 0
        order by sessions desc
        limit 50
      ) t
    ),

    -- ── CTA seen vs clicked ──
    -- The real "dropoff button" figure: a control nobody clicks and a control
    -- nobody reaches look identical in the clicks table, and only one of them is
    -- worth changing.
    --
    -- First-party only: cta_view is queued by src/lib/cta-visibility.ts.
    'cta_funnel', (
      select coalesce(jsonb_agg(row order by (row->>'seen_sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'tag',              tag,
                 'seen_sessions',    seen_sessions,
                 'clicks',           clicks,
                 'clicked_sessions', clicked_sessions,
                 -- Null rather than 0 when nothing was ever seen: a rate with no
                 -- denominator is unknown, and printing 0.0% would say the control
                 -- was shown and ignored.
                 'ctr', case
                          when seen_sessions > 0
                            then round(100.0 * clicked_sessions / seen_sessions, 1)
                          else null
                        end
               ) as row
        from cta
        where tag is not null
        order by seen_sessions desc, clicks desc
        limit 50
      ) t
    ),

    -- ── Friction ──
    -- Clicks that hit nothing, and clicks repeated in one spot. Both were dropped
    -- at the listener until now, which is why a cold region of the heatmap was
    -- ambiguous: "nobody clicked here" and "people click here constantly and
    -- nothing happens" drew the same picture.
    --
    -- Grouped by path AND selector, because "somewhere on the landing page" is not
    -- actionable and "the div wrapping the hero image" is.
    'friction', (
      select coalesce(jsonb_agg(row order by (row->>'events')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'kind',     case when event = 'dead_click' then 'dead' else 'rage' end,
                 'path',     path,
                 'selector', coalesce(props->>'selector', '(unidentified)'),
                 'events',   count(*),
                 'sessions', count(distinct session_id)
               ) as row
        from ev
        where event in ('dead_click', 'rage_click')
        group by
          case when event = 'dead_click' then 'dead' else 'rage' end,
          path,
          coalesce(props->>'selector', '(unidentified)')
        order by count(*) desc
        limit 50
      ) t
    ),

    -- ── Where the onboarding form stalls ──
    -- One row per field, with the sessions that reached it. The shape of the decay
    -- is the answer; there is no separate "abandoned" event because abandonment IS
    -- the gap between one field's reach and the next one's.
    --
    -- Ordered by min(order) — the position the field held in visitors' own
    -- progression through the form — rather than by volume, because a funnel read
    -- out of order is not a funnel.
    --
    -- First-party only: field_focus is queued by src/lib/form-tracking.ts.
    'form_fields', (
      select coalesce(jsonb_agg(row order by (row->>'position')::int asc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'form',     coalesce(props->>'form', '(unnamed)'),
                 'field',    props->>'field',
                 'sessions', count(distinct session_id),
                 'position', min(coalesce((props->>'order')::int, 99))
               ) as row
        from ev
        where event = 'field_focus'
          and props->>'field' is not null
        group by coalesce(props->>'form', '(unnamed)'), props->>'field'
        limit 50
      ) t
    ),

    -- ── The last thing they touched ──
    -- Ranked by how often a control was a session's FINAL click. The clicks table
    -- cannot show this: it ranks by volume, so it is dominated by whatever
    -- everyone clicks on the way in.
    --
    -- `converted` splits the two readings apart. A control that is the last click
    -- of sessions that then paid is the end of a successful journey; the same
    -- control at the end of sessions that did not is where people gave up. Without
    -- the split, the download button and the dead end rank side by side.
    'exit_clicks', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'label',     l.label,
                 'path',      l.path,
                 'sessions',  count(*),
                 'converted', count(*) filter (where s.did_pay_start)
               ) as row
        from last_click l
        join sess s on s.session_id = l.session_id
        group by l.label, l.path
        order by count(*) desc
        limit 50
      ) t
    ),

    -- ── Who they are on ──
    'devices', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'device',   coalesce(device, 'unknown'),
                 'sessions', count(*)
               ) as row
        from sess group by coalesce(device, 'unknown')
      ) t
    ),
    'browsers', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'browser',  coalesce(browser, 'unknown'),
                 'sessions', count(*)
               ) as row
        from sess group by coalesce(browser, 'unknown')
      ) t
    ),

    -- ── Where they came from ──
    -- First-touch referrer per session, bucketed. Host-level rather than full
    -- URL: a referrer path is high-cardinality noise in a summary.
    'sources', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'source',   bucket,
                 'sessions', count(*)
               ) as row
        from (
          select case
                   when first_referrer is null then 'direct'
                   when first_referrer ~* '(google|bing|duckduckgo|yahoo|ecosia)\.' then 'organic'
                   when first_referrer ~* '(instagram|facebook|linkedin|twitter|x\.com|t\.co|whatsapp|youtube|reddit)' then 'social'
                   else 'referral'
                 end as bucket
          from sess
        ) b
        group by bucket
      ) t
    ),

    -- ── Daily series ──
    -- Cross-joined against a generated day grid so a quiet day comes back as an
    -- explicit 0. 015 learned this the hard way: a missing key renders as a gap
    -- in the chart, which reads as "no data" rather than the zero it is.
    'daily', (
      select coalesce(jsonb_agg(row order by row->>'day'), '[]'::jsonb)
      from (
        -- Every bucket compares the IST-local date, not `created_at >= g.day`.
        -- The latter casts a date to timestamptz in the SERVER timezone (UTC on
        -- Supabase), which pushed 00:00-05:30 IST traffic onto the day before.
        select jsonb_build_object(
                 'day',      g.day,
                 'sessions', (select count(*) from sess s
                              where (timezone('Asia/Kolkata', s.first_seen))::date = g.day),
                 'views',    (select count(*) from ev
                              where event in ('visit', 'page_view')
                                and (timezone('Asia/Kolkata', created_at))::date = g.day),
                 'kundalis', (select count(*) from ev
                              where event = 'kundali_generated'
                                and (timezone('Asia/Kolkata', created_at))::date = g.day),
                 'signins',  (select count(*) from ev
                              where event = 'signed_in'
                                and (timezone('Asia/Kolkata', created_at))::date = g.day),
                 -- Filtered the same way the funnel's payment step is, or the
                 -- chart line would include internal orders the funnel excluded.
                 'payments', (select count(*) from payment_orders o
                              where o.status = 'completed'
                                and (timezone('Asia/Kolkata', o.created_at))::date = g.day
                                and (
                                  not p_exclude_internal
                                  or not exists (select 1 from internal_users u where u.user_id = o.user_id)
                                ))
               ) as row
        from day_grid g
      ) t
    ),

    -- ── Which paths have coordinate samples ──
    -- Drives the heatmap's path picker. Without it the operator has to guess
    -- which pages were sampled.
    --
    -- Grouped by path AND device, because admin_click_map() below filters by
    -- device and this did not. A path-only count sat next to a per-device canvas,
    -- so a page could read "1,840" in the picker and then draw an empty grid on
    -- Mobile — a contradiction on screen with nothing explaining it. The client
    -- sums the devices for its all-device total, which it cannot do the other way
    -- round.
    --
    -- device is nullable (an unclassifiable user agent with no viewport reported),
    -- and jsonb_build_object keeps that as a json null rather than dropping the
    -- key, so the client must treat null as its own bucket rather than as "all".
    --
    -- Two things here must match admin_click_map() exactly or the panel
    -- contradicts itself on screen:
    --   1. the bucket is click_viewport_class(), not the raw `device` column —
    --      that function is the single answer to which canvas a point belongs on;
    --   2. `kind` is carried, because the heatmap can now show dead clicks. A
    --      count that summed both kinds would sit beside a canvas drawing one.
    'click_map_paths', (
      select coalesce(jsonb_agg(row order by (row->>'points')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'path',   path,
                 'device', click_viewport_class(viewport_w, device),
                 'kind',   kind,
                 'points', count(*)
               ) as row
        from click_points
        where created_at >= (select since from win)
          and created_at <= (select until from win)
          and (
            not p_exclude_internal
            or session_id not in (select session_id from internal_sessions)
          )
        group by path, click_viewport_class(viewport_w, device), kind
      ) t
    ),

    -- ── What the filter did ──
    -- Always computed, whether or not the filter is on, so the panel can say
    -- "214 internal hidden" or "214 internal included" rather than showing two
    -- different totals on two visits with no explanation for the difference.
    -- Reporting only when active would make the two states indistinguishable at
    -- a glance, which is exactly how a filtered number gets quoted as a real one.
    'internal', jsonb_build_object(
      'excluded',         p_exclude_internal,
      'sessions_matched', (select count(*) from internal_sessions),
      'networks_active',  (select count(*) from internal_traffic where enabled and network is not null),
      'accounts_active',  (select count(*) from internal_traffic where enabled and user_id is not null)
    )
  );
$$;

-- ── Heatmap points ──────────────────────────────────────────────────────────
-- Separate from admin_analytics so the dashboard payload never carries thousands
-- of coordinates. Buckets server-side so the browser never receives raw points.
--
-- ── Why the vertical resolution is not 40 ───────────────────────────────────
-- It was a 40x40 grid. On a ~5,000px mobile page that makes each vertical bucket
-- 125px tall, and the renderer draws the blob at the bucket's centre with a radius
-- of ~18px — so a click on a real button was routinely painted in the whitespace
-- above or below it. x keeps 40 buckets (a page is only ~390-1440px wide, so those
-- are 10-36px each); y is bucketed in ABSOLUTE 24px bands instead, which is both
-- finer and independent of how tall any one visitor's page was.
--
-- Cells are emitted only where n > 0, so the payload stays sparse however many
-- bands the page spans.
--
-- Same overload caveat as admin_analytics above: drop before adding a parameter,
-- or the older version survives with its grants.
drop function if exists admin_click_map(text, text, integer);
drop function if exists admin_click_map(text, text, integer, boolean);
drop function if exists admin_click_map(text, text, timestamptz, timestamptz, boolean);

create or replace function admin_click_map(
  p_path   text,
  -- NOTE the asymmetry with click_map_paths above, which is deliberate but easy
  -- to trip over: there, `device: null` is the unclassified BUCKET (a request
  -- that carried no User-Agent). Here, a null p_device means EVERY device,
  -- because that is the useful default for a function taking a filter. The two
  -- cannot be expressed by one nullable parameter, so the admin panel never
  -- passes null — it always names one of mobile/desktop/tablet, and reports
  -- unclassified points separately.
  p_device text default null,
  p_from   timestamptz default now() - interval '30 days',
  p_to     timestamptz default now(),
  p_exclude_internal boolean default true,
  -- 'click' (hit something interactive), 'dead' (hit nothing), 'rage' (repeated in
  -- one spot). Null means 'click' rather than "every kind": mixing a dead-click map
  -- into a click map would make the one distinction the panel exists to draw
  -- invisible again.
  p_kind   text default 'click'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select
      least(coalesce(p_from, now() - interval '30 days'), coalesce(p_to, now()))    as since,
      greatest(coalesce(p_to, now()), coalesce(p_from, now() - interval '30 days')) as until
  ),
  -- Repeated from admin_analytics rather than shared, because a view over it
  -- would have to fix the window and this one takes its bounds independently. Keep
  -- the two in step: a click_points row is keyed by session, so the heatmap must
  -- hide exactly the sessions the funnel hides or the two panels disagree about
  -- the same week.
  internal_sessions as (
    select distinct e.session_id
    from visitor_events e
    where e.created_at >= (select since from win)
      and e.created_at <= (select until from win)
      and (
        exists (
          select 1 from internal_traffic n
          where n.enabled and n.network is not null
            and e.ip_address is not null
            and e.ip_address <<= n.network
        )
        or exists (
          select 1 from internal_traffic a
          where a.enabled and a.user_id is not null
            and a.user_id = e.user_id
        )
      )
  ),
  -- Named `sampled` rather than the obvious `rows`: ROWS is a PostgreSQL keyword
  -- (window frames, FETCH FIRST n ROWS) and using it as a CTE name is asking for
  -- a parse error the next time this query grows a window function.
  sampled as (
    select x_pct, y_pct, doc_h
    from click_points
    where path = p_path
      and created_at >= (select since from win)
      and created_at <= (select until from win)
      and kind = coalesce(p_kind, 'click')
      -- One bucket per row, by the width the page actually laid out in. See
      -- click_viewport_class() above for why this is not `device = p_device`.
      and (p_device is null or click_viewport_class(viewport_w, device) = p_device)
      and (
        not p_exclude_internal
        or session_id not in (select session_id from internal_sessions)
      )
  ),
  -- ── The reference page height ──
  -- The median of the heights these clicks were actually recorded against, which
  -- is what makes an absolute depth meaningful: a click at y_pct 0.6 of a 5,000px
  -- page and one at 0.6 of a 9,000px page are 2,400px apart and are not the same
  -- position, however similar the fractions look.
  --
  -- percentile_disc, not percentile_cont: a real observed height, not an average of
  -- two that no visitor had. 0 when nothing in the set carries one (entirely
  -- pre-upgrade data), which switches the whole result to fraction mode below.
  ref as (
    select coalesce(
             (select percentile_disc(0.5) within group (order by doc_h)
              from sampled where doc_h is not null),
             0
           )::int as ref_h
  ),
  pts as (
    select
      -- floor to a cell, then report the cell's centre. least() keeps a click at
      -- exactly 1.0 inside the last bucket instead of creating a 41st.
      least(floor(x_pct * 40), 39)::int as cx,
      case
        -- Pixel mode: 24px bands of real depth. A row with no doc_h of its own is
        -- placed against the reference height, which is the best available estimate
        -- and far closer than the admin's own iframe height.
        --
        -- Capped at band 1666 (~40,000px) so one absurd doc_h cannot expand the
        -- payload without bound.
        when (select ref_h from ref) > 0
          then least(floor(y_pct * coalesce(doc_h, (select ref_h from ref)) / 24.0), 1666)::int
        -- Fraction mode: 200 buckets rather than the original 40, so the vertical
        -- resolution is usable even without a stored height.
        else least(floor(y_pct * 200), 199)::int
      end as cy
    from sampled
  ),
  grid as (select cx, cy, count(*) as n from pts group by cx, cy)
  select jsonb_build_object(
    'path',   p_path,
    'device', p_device,
    'kind',   coalesce(p_kind, 'click'),
    'total',  (select count(*) from pts),
    -- The height the y_px values below are depths into. The panel compares it with
    -- the height it measures in its own preview and warns when the two diverge —
    -- otherwise a backdrop that has grown or shrunk since silently misplaces
    -- everything, which is the failure this whole change is about.
    'median_doc_h', nullif((select ref_h from ref), 0),
    'cells',  (
      select coalesce(jsonb_agg(jsonb_build_object(
               'x', round((cx + 0.5) / 40.0, 4),
               -- Always present, so the "densest spots" list can print a
               -- percentage in either mode. In pixel mode it is the depth
               -- expressed as a fraction of the reference height.
               'y', case
                      when (select ref_h from ref) > 0
                        then round(least((cy * 24 + 12)::numeric / (select ref_h from ref), 1), 4)
                      else round((cy + 0.5) / 200.0, 4)
                    end,
               -- Absolute depth in CSS pixels, or null in fraction mode. The
               -- renderer prefers it and falls back to 'y' when it is absent.
               'y_px', case when (select ref_h from ref) > 0 then cy * 24 + 12 else null end,
               'n', n
             ) order by n desc), '[]'::jsonb)
      from grid
    ),
    -- The renderer needs the busiest cell to scale its colour ramp. Computing it
    -- here means the browser does not have to walk the whole array first.
    'max_n', (select coalesce(max(n), 0) from grid)
  );
$$;

-- ── Which of these sessions are ours? ───────────────────────────────────────
-- For the Visitors table's `internal` badge. Takes the ids actually on screen
-- (capped at 2000 by the caller) and returns the internal subset, rather than
-- returning every internal session in the retention window.
--
-- It needs to be an RPC rather than a PostgREST filter for the same reason the
-- aggregate does: `last_ip` on visitor_session_summary is one address, and a
-- Vikhroli session carries several. Judging a session by its last address alone
-- would miss the ones whose final request happened to leave by an unlisted link.
create or replace function admin_internal_sessions(p_session_ids text[])
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct e.session_id
  from visitor_events e
  where e.session_id = any(p_session_ids)
    and (
      exists (
        select 1 from internal_traffic n
        where n.enabled and n.network is not null
          and e.ip_address is not null
          and e.ip_address <<= n.network
      )
      or exists (
        select 1 from internal_traffic a
        where a.enabled and a.user_id is not null
          and a.user_id = e.user_id
      )
    );
$$;

-- ── Is this address one of ours? ────────────────────────────────────────────
-- For generate-report's rate limiter, which needs the answer per request and
-- cannot reasonably pull the whole rule table across to Deno to do CIDR
-- containment by hand. Reuses the same enabled-network rules the panel filters
-- on, so exempting an office from rate limits and hiding it from the numbers are
-- one decision made in one place.
create or replace function is_internal_ip(p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from internal_traffic
    where enabled and network is not null and p_ip <<= network
  );
$$;

-- SECURITY DEFINER functions in the public schema are exposed by PostgREST to
-- any anon-key holder unless revoked. 016 had to add exactly this for
-- admin_pipeline_health; both functions read every visitor's activity.
revoke execute on function admin_internal_sessions(text[])                     from public, anon, authenticated;
grant  execute on function admin_internal_sessions(text[])                     to service_role;

revoke execute on function admin_analytics(timestamptz, timestamptz, boolean)                       from public, anon, authenticated;
revoke execute on function admin_click_map(text, text, timestamptz, timestamptz, boolean, text)    from public, anon, authenticated;
revoke execute on function is_internal_ip(inet)                                                    from public, anon, authenticated;

grant execute on function admin_analytics(timestamptz, timestamptz, boolean)                        to service_role;
grant execute on function admin_click_map(text, text, timestamptz, timestamptz, boolean, text)      to service_role;
grant execute on function is_internal_ip(inet)                                                      to service_role;

-- click_viewport_class is a pure helper over its arguments — it reads no table and
-- reveals nothing — but it is in the public schema, so PostgREST exposes it to any
-- anon-key holder unless revoked. Same posture as everything above.
revoke execute on function click_viewport_class(integer, text)                                      from public, anon, authenticated;
grant  execute on function click_viewport_class(integer, text)                                      to service_role;

-- ── Retention ───────────────────────────────────────────────────────────────
-- 180 days. Follows 010's pattern for webhook_events and 016's for
-- pipeline_alerts — a log table without retention grows forever.
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Unschedule first so re-applying this migration doesn't error on a duplicate
-- job name. cron.unschedule throws if the job is absent, hence the guard.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-old-visitor-events') then
    perform cron.unschedule('cleanup-old-visitor-events');
  end if;
end $$;

SELECT cron.schedule(
  'cleanup-old-visitor-events',
  '30 3 * * 0',
  $$
    DELETE FROM visitor_events
    WHERE created_at < now() - interval '180 days'
  $$
);

-- Click coordinates get 30 days, not 180. They are the highest-volume rows here
-- and the shortest-lived in usefulness: a heatmap is read against the current
-- design of a page, and the landing page changes far more often than quarterly.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-old-click-points') then
    perform cron.unschedule('cleanup-old-click-points');
  end if;
end $$;

SELECT cron.schedule(
  'cleanup-old-click-points',
  '45 3 * * *',
  $$
    DELETE FROM click_points
    WHERE created_at < now() - interval '30 days'
  $$
);
