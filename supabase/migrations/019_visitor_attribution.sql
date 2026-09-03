-- ═══════════════════════════════════════════════════════════════════════════
-- 019: Campaign attribution (UTM)
--
-- Why: marketing runs WhatsApp and Instagram pushes to generate kundalis, and
-- nothing could say which push produced one. A tagged link tells GA4 where a
-- *session* came from and the trail ends there, because kundali_generated,
-- signed_in and payment_started exist only in visitor_events — which stored
-- document.referrer and no campaign at all. admin_analytics()'s `sources` is a
-- four-bucket regex over referrer hosts; it can separate "social" from "organic"
-- and can never separate two Instagram creatives.
--
-- Shape: the campaign is written onto the ONE `visit` row of a page load, by
-- track-visit, from a whitelisted `attribution` block on the request body. Same
-- posture as every other column here — the client proposes, the edge function
-- validates, nothing is written from the browser directly.
--
-- ── Two levels, deliberately ────────────────────────────────────────────────
-- visitor_events.utm_*     the campaign a SESSION landed on
-- user_profiles.first_utm_* the campaign that ACQUIRED a user, write-once
--
-- Both are needed because payment_orders has no session_id (009) and a payment
-- routinely happens in a later session than the click. Attributing revenue by
-- session would under-count every campaign that takes more than one sitting to
-- convert — which is all of them, at ₹99 with a signup in between.
--
-- 018 is applied in production. Everything here is additive and re-runnable.
-- See docs/CAMPAIGN-UTM-GUIDE.md for the naming convention these columns hold.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Session-level ───────────────────────────────────────────────────────────
alter table visitor_events add column if not exists utm_source      text;
alter table visitor_events add column if not exists utm_medium      text;
alter table visitor_events add column if not exists utm_campaign    text;
alter table visitor_events add column if not exists utm_content     text;
alter table visitor_events add column if not exists utm_term        text;
alter table visitor_events add column if not exists click_id        text;
alter table visitor_events add column if not exists click_id_source text;
alter table visitor_events add column if not exists landing_path    text;
-- Persistent per-browser id, from localStorage — unlike session_id, which dies
-- with the tab. It is what links the session that clicked the advert to the
-- session that came back two days later and paid.
alter table visitor_events add column if not exists visitor_id      text;

comment on column visitor_events.utm_source is
  'Campaign parameters, written only on the ''visit'' row of a page load. Lowercased [a-z0-9._-], max 64 chars, rejected (not truncated) if longer — see _shared/event-payload.ts normaliseUtm. Null on every other event verb and on untagged traffic. Naming convention: docs/CAMPAIGN-UTM-GUIDE.md.';

comment on column visitor_events.visitor_id is
  'Random per-browser id from localStorage. Carries nothing about the person; it exists so sessions from one browser can be recognised as one visitor across tabs and days.';

-- Partial on purpose: only a small fraction of rows is ever tagged, so the index
-- stays small while still serving the one query that matters — tagged rows in a
-- window, earliest first per session (the `attr` CTE below).
create index if not exists visitor_events_utm_idx
  on visitor_events (created_at desc, utm_source, utm_campaign)
  where utm_source is not null;

create index if not exists visitor_events_visitor_id_idx
  on visitor_events (visitor_id)
  where visitor_id is not null;

-- ── User-level: the permanent acquisition record ────────────────────────────
-- Not covered by the 180-day retention cron in 018, and that is the point: the
-- event log is a log, but "which campaign brought this paying customer" should
-- outlive it.
alter table user_profiles add column if not exists first_utm_source   text;
alter table user_profiles add column if not exists first_utm_medium   text;
alter table user_profiles add column if not exists first_utm_campaign text;
alter table user_profiles add column if not exists first_utm_content  text;
alter table user_profiles add column if not exists first_utm_term     text;
alter table user_profiles add column if not exists first_landing_path text;
alter table user_profiles add column if not exists first_visitor_id   text;
-- Both the write-once guard and the "when were they acquired" fact. NULL means
-- never stamped, which is NOT the same as 'direct' — see admin_campaigns below.
alter table user_profiles add column if not exists first_touch_at     timestamptz;

comment on column user_profiles.first_touch_at is
  'When this account''s first-touch campaign was recorded. NULL means it never was — either the user arrived untagged, or they signed up before 019 shipped. Reported as (pre-attribution), never as direct.';

create index if not exists user_profiles_first_campaign_idx
  on user_profiles (first_utm_campaign)
  where first_utm_campaign is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- stamp_first_touch — copy the browser's first touch onto the account, once
--
-- SECURITY INVOKER, not definer: 002's "users manage own profile" policy already
-- lets an owner update their own row, so no elevated privilege is warranted for
-- a user writing their own acquisition source.
--
-- UPDATE-only, never an upsert. AuthPage branches on whether a user_profiles row
-- exists to decide whether an account is real (and calls deleteGhostUser when it
-- is not); creating a row here would change which branch a sign-in takes. The
-- consequence is that a brand-new signup must call this AFTER the profile upsert
-- — see src/lib/utm.ts stampFirstTouchOnce for both call sites.
--
-- `first_touch_at is null` is the write-once guard, in SQL rather than in the
-- client, so calling it twice — or from both call sites, or after a re-login on
-- a differently-tagged link — cannot overwrite the original campaign.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function stamp_first_touch(
  p_source         text,
  p_medium         text,
  p_campaign       text,
  p_content        text,
  p_term           text,
  p_landing_path   text,
  p_visitor_id     text,
  p_first_touch_at timestamptz
)
returns boolean
language sql
volatile
security invoker
set search_path = public
as $$
  update user_profiles set
    first_utm_source   = p_source,
    first_utm_medium   = p_medium,
    first_utm_campaign = p_campaign,
    first_utm_content  = p_content,
    first_utm_term     = p_term,
    first_landing_path = p_landing_path,
    first_visitor_id   = p_visitor_id,
    -- Clamped, because this timestamp comes from the BROWSER's clock and
    -- admin_campaigns' `signups` CTE filters on it. A device set to 2030 stamps
    -- an acquisition date no window will ever contain, so its campaign reports
    -- revenue and paid users beside `Accounts created: 0`, permanently and with
    -- nothing on screen to explain it. A device set to 2019 does the same in the
    -- other direction. The floor is the client's 90-day TTL (utm.ts) plus slack
    -- for ordinary clock drift; nothing older can legitimately be sent.
    first_touch_at     = greatest(
                           least(coalesce(p_first_touch_at, now()), now()),
                           now() - interval '100 days'
                         )
  where id = auth.uid()
    and first_touch_at is null
  returning true;
$$;

revoke execute on function stamp_first_touch(text, text, text, text, text, text, text, timestamptz)
  from public, anon;
grant  execute on function stamp_first_touch(text, text, text, text, text, text, text, timestamptz)
  to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- click_network — the platform behind an ad click id
--
-- Google Ads auto-tagging appends `gclid` and nothing else; Meta appends
-- `fbclid`. Both arrive with no utm_source, and both used to be labelled
-- `direct` by the rollups below — so paid advertising was reported as untagged
-- traffic, in the one table whose purpose is telling paid traffic apart from
-- everything else. `click_id` was stored, admitted to the `attr` CTE, and then
-- read by nothing.
--
-- The names match what GA4 derives from the same parameters (google / cpc,
-- facebook / cpc), so the two reports can be compared without a translation
-- step. IMMUTABLE and defined before its callers: a `language sql` body is
-- parsed at CREATE time.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function click_network(p_click_id_source text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when p_click_id_source is null then null
           when p_click_id_source = 'gclid'  then 'google'
           when p_click_id_source = 'fbclid' then 'facebook'
           -- Never reached today (sanitiseAttribution whitelists the two above),
           -- but a null here would silently become a null source column.
           else 'ad'
         end;
$$;

-- Pure over its argument — reads no table and reveals nothing — but it sits in
-- the public schema, so PostgREST exposes it to any anon-key holder unless
-- revoked. Same posture as click_viewport_class in 018.
revoke execute on function click_network(text) from public, anon, authenticated;
grant  execute on function click_network(text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- admin_campaigns — the /admin → Analytics → Campaigns table
--
-- A separate function rather than another key on admin_analytics(): that one is
-- ~600 lines and every read of it would have to be re-tested to add a join here.
--
-- ── The one thing to understand before reading a row ────────────────────────
-- The left half is SESSION-level (sessions, kundalis, sign-ins, pay clicks),
-- counted from the campaign that session landed on. The right half is
-- USER-level (new accounts, paid, revenue), counted from that user's first-ever
-- tagged visit. So `paid` is NOT a subset of `sessions` in the same row, and the
-- panel says so on screen. The alternative — attributing payments by session —
-- would report near-zero paid for every campaign, because almost nobody lands
-- and pays in one sitting.
-- ═══════════════════════════════════════════════════════════════════════════
drop function if exists admin_campaigns(timestamptz, timestamptz, boolean);

create or replace function admin_campaigns(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now(),
  p_exclude_internal boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  -- Ordered rather than trusted, same as admin_analytics: an inverted range
  -- returns nothing rather than erroring, which reads as "no traffic".
  win as (
    select
      least(coalesce(p_from, now() - interval '30 days'), coalesce(p_to, now()))    as since,
      greatest(coalesce(p_to, now()), coalesce(p_from, now() - interval '30 days')) as until
  ),
  -- Copied verbatim from admin_analytics rather than shared, for the same reason
  -- admin_click_map copies it: the window is a parameter, so there is nothing to
  -- share short of a fourth function. If these two ever drift, the Campaigns
  -- table and the funnel above it describe different populations for the same
  -- week and the panel contradicts itself on screen — keep them identical.
  --
  -- Whole-session verdict, never per event: the Vikhroli office balances across
  -- three ISPs per request, so one visit's events carry several addresses.
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
  -- One attribution per session: the FIRST tagged row, mirroring how
  -- admin_analytics takes first_referrer. A Google sign-in returns to the app
  -- and writes a second `visit` row carrying the same stored campaign; taking
  -- the first makes that duplicate a no-op instead of a second attribution.
  attr as (
    select distinct on (session_id)
      session_id,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      click_id_source, landing_path, visitor_id
    from ev
    where utm_source is not null or click_id is not null
    order by session_id, created_at asc, seq asc nulls first
  ),
  sess as (
    select
      e.session_id,
      -- An ad click id with no utm_source is still paid traffic, not direct.
      coalesce(a.utm_source, click_network(a.click_id_source), 'direct') as source,
      coalesce(
        a.utm_medium,
        case when a.click_id_source is not null then 'cpc' end,
        '(none)'
      ) as medium,
      coalesce(a.utm_campaign, '(none)') as campaign,
      -- The creative, and the reason it is a grouping key rather than a column
      -- picked off one row: a campaign is normally run as several creatives at
      -- once (three Instagram images, two WhatsApp copy variants), and "which
      -- one worked" is the question the whole exercise exists to answer.
      -- Grouped away, three creatives collapse into one row that says only that
      -- the campaign ran. docs/CAMPAIGN-UTM-GUIDE.md promises this split.
      coalesce(a.utm_content,  '(none)') as content,
      bool_or(e.event = 'kundali_generated') as did_kundali,
      bool_or(e.event = 'signed_in')         as did_signin,
      bool_or(e.event = 'payment_started')   as did_pay_start
    from ev e
    left join attr a on a.session_id = e.session_id
    group by e.session_id, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.click_id_source
  ),
  sess_roll as (
    select
      source, medium, campaign, content,
      count(*)                              as sessions,
      count(*) filter (where did_kundali)   as kundali_generated,
      count(*) filter (where did_signin)    as signed_in,
      count(*) filter (where did_pay_start) as payment_started
    from sess
    group by source, medium, campaign, content
  ),
  -- ── The user half ─────────────────────────────────────────────────────────
  -- Labelled from user_profiles.first_utm_*, not from any session. Users with no
  -- stamp bucket as (pre-attribution) and are deliberately NOT merged into
  -- 'direct': "we never asked" is not "they came directly", and merging them
  -- would show a huge organic cohort appearing the day this shipped.
  paid_orders as (
    select
      o.user_id,
      o.amount,
      case when up.first_touch_at is null then '(pre-attribution)'
           else coalesce(up.first_utm_source, '(none)') end   as source,
      case when up.first_touch_at is null then '(pre-attribution)'
           else coalesce(up.first_utm_medium, '(none)') end   as medium,
      case when up.first_touch_at is null then '(pre-attribution)'
           else coalesce(up.first_utm_campaign, '(none)') end as campaign,
      case when up.first_touch_at is null then '(pre-attribution)'
           else coalesce(up.first_utm_content, '(none)') end  as content
    from payment_orders o
    join user_profiles up on up.id = o.user_id
    where o.status = 'completed'
      and o.created_at >= (select since from win)
      and o.created_at <= (select until from win)
      -- `not exists` rather than `not in`: internal_users is a UNION, and a NULL
      -- from either branch would make `not in` evaluate to NULL for every row and
      -- silently return zero orders.
      and (
        not p_exclude_internal
        or not exists (select 1 from internal_users u where u.user_id = o.user_id)
      )
  ),
  pay as (
    select
      source, medium, campaign, content,
      count(distinct user_id)      as paid_users,
      coalesce(sum(amount), 0)     as revenue
    from paid_orders
    group by source, medium, campaign, content
  ),
  -- Accounts stamped inside the window — the bridge between the two halves.
  signups as (
    select
      coalesce(first_utm_source,   '(none)') as source,
      coalesce(first_utm_medium,   '(none)') as medium,
      coalesce(first_utm_campaign, '(none)') as campaign,
      coalesce(first_utm_content,  '(none)') as content,
      count(*) as signed_up_users
    from user_profiles
    where first_touch_at >= (select since from win)
      and first_touch_at <= (select until from win)
      -- Same account filter as paid_orders, or the team's own test signups
      -- inflate a campaign that the paid column then shows nothing for.
      and (
        not p_exclude_internal
        or not exists (select 1 from internal_users u where u.user_id = user_profiles.id)
      )
    group by 1, 2, 3, 4
  ),
  -- FULL OUTER, so a campaign with revenue but no in-window sessions still
  -- appears — a September push that pays off in November is exactly the row
  -- worth reading, and a left join from sess_roll would hide it.
  rollup as (
    select
      source, medium, campaign, content,
      coalesce(s.sessions, 0)          as sessions,
      coalesce(s.kundali_generated, 0) as kundali_generated,
      coalesce(s.signed_in, 0)         as signed_in,
      coalesce(s.payment_started, 0)   as payment_started,
      coalesce(g.signed_up_users, 0)   as signed_up_users,
      coalesce(p.paid_users, 0)        as paid_users,
      coalesce(p.revenue, 0)           as revenue
    from sess_roll s
    full outer join pay     p using (source, medium, campaign, content)
    full outer join signups g using (source, medium, campaign, content)
  )
  select jsonb_build_object(
    'generated_at', now(),
    'from', (select since from win),
    'to',   (select until from win),

    'campaigns', (
      select coalesce(
        jsonb_agg(to_jsonb(r) order by r.sessions desc, r.revenue desc, r.campaign, r.content),
        '[]'::jsonb
      )
      from rollup r
    ),

    -- Declared source, as opposed to admin_analytics' referrer-host buckets.
    -- The panel labels them "tagged" and "referrer" for that reason.
    'sources', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'source',   source,
                 'sessions', sum(sessions)::int,
                 'revenue',  sum(revenue)
               ) as row
        from rollup
        group by source
      ) t
    ),

    'totals', jsonb_build_object(
      'tagged_sessions',   (select count(*) from sess where source <> 'direct'),
      'untagged_sessions', (select count(*) from sess where source =  'direct'),
      -- Paying users we cannot attribute because they predate the stamp. Shown
      -- so a low campaign revenue number is read as "not yet measurable" rather
      -- than "the campaign failed".
      'unattributed_paid_users',
        (select coalesce(sum(paid_users), 0)::int from pay where source = '(pre-attribution)')
    ),

    -- Mirrors admin_analytics so the two panels can be checked against each
    -- other: if the toggle moves one and not the other, the CTEs have drifted.
    'internal', jsonb_build_object(
      'excluded',         p_exclude_internal,
      'sessions_matched', (select count(*) from internal_sessions),
      'networks_active',  (select count(*) from internal_traffic where enabled and network is not null),
      'accounts_active',  (select count(*) from internal_traffic where enabled and user_id is not null)
    )
  );
$$;

-- Same posture as every other admin_* function in 018: SECURITY DEFINER in the
-- public schema is reachable by any anon-key holder unless revoked.
revoke execute on function admin_campaigns(timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant  execute on function admin_campaigns(timestamptz, timestamptz, boolean) to service_role;
-- ═══════════════════════════════════════════════════════════════════════════
-- ip_geo — approximate location per address, resolved once and cached
--
-- Why a cache rather than a lookup per visit: the provider is rate-limited and
-- metered, and the same handful of carrier egress addresses account for most of
-- our traffic. One row per address means a busy day costs a few lookups rather
-- than a few hundred, and a provider outage degrades to "no city" instead of to
-- dropped events.
--
-- ── Read the numbers this produces with suspicion ───────────────────────────
-- Indian mobile carriers NAT very large subscriber pools through a small number
-- of metro egress points, so Jio and Airtel users across a state routinely
-- resolve to one city. GA4 performs the same lookup and inherits the same flaw,
-- so the two will agree with each other and both be wrong in the same direction.
-- This is a regional hint, not a fact about where a person is.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists ip_geo (
  ip          inet primary key,
  city        text,
  region      text,
  country     text,
  -- Which provider placed this address. Not bookkeeping: the chain in
  -- _shared/geo.ts falls back to a second provider when the first fails, and the
  -- two do not always agree -- one IPv6 address resolves to Mumbai on ipinfo and
  -- Delhi on ipwho.is. A city distribution blended from two opinions cannot be
  -- read without knowing which is which.
  source      text,
  -- True when the provider placed the address at all -- a city OR just a
  -- country. False when it answered but could not place it, so a permanent
  -- failure is not retried on every visit. Distinct from "no row".
  resolved    boolean not null default true,
  resolved_at timestamptz not null default now()
);

comment on table ip_geo is
  'Cached IP -> approximate city, filled by track-visit via the provider chain in _shared/geo.ts (ipinfo, then keyless ipwho.is). Accuracy is limited by carrier NAT; see the migration header. Refreshed after GEO_TTL_DAYS in _shared/geo.ts.';

create index if not exists ip_geo_resolved_at_idx on ip_geo (resolved_at);

alter table ip_geo enable row level security;

-- Same posture as visitor_events: writes are service-role only (which bypasses
-- RLS), and admins may read. No anon or authenticated policy at all.
drop policy if exists "admins read ip geo" on ip_geo;
create policy "admins read ip geo" on ip_geo
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.is_admin = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- admin_audience — the audience half of /admin → Analytics
--
-- A third function rather than more keys on admin_analytics(), for the reason
-- admin_campaigns() is separate: that function is ~600 lines and every number
-- already read from it would have to be re-verified to add a join here.
--
-- Answers five questions the panel could not answer before:
--   • new vs returning visitors   (needs visitor_id, which only exists from 019)
--   • operating system            (already collected per row, never aggregated)
--   • engagement rate             (the inputs were there; the ratio was not)
--   • source / medium together    (one ranked list, tagged and untagged merged)
--   • city and region             (from the ip_geo cache defined above)
--
-- Defined AFTER ip_geo on purpose: a `language sql` body is parsed at CREATE
-- time, so the join below cannot resolve until that table exists.
--
-- `geo_available` reports what is actually in the data rather than a constant,
-- so the panel can explain an empty city table — geography is off entirely
-- unless IPINFO_TOKEN is set — instead of rendering a zero that looks like a
-- fact. See _shared/geo.ts, and read the carrier-NAT warning in the ip_geo
-- header before quoting any city number.
-- ═══════════════════════════════════════════════════════════════════════════
drop function if exists admin_audience(timestamptz, timestamptz, boolean);

create or replace function admin_audience(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now(),
  p_exclude_internal boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  win as (
    select
      least(coalesce(p_from, now() - interval '30 days'), coalesce(p_to, now()))    as since,
      greatest(coalesce(p_to, now()), coalesce(p_from, now() - interval '30 days')) as until
  ),
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
  ev as (
    select *
    from visitor_events
    where created_at >= (select since from win)
      and created_at <= (select until from win)
      and session_id not like 'canary-%'
      and (
        not p_exclude_internal
        or session_id not in (select session_id from internal_sessions)
      )
  ),
  sess as (
    select
      session_id,
      count(*) filter (where event in ('visit', 'page_view')) as views,
      coalesce(
        max(duration_ms) filter (where event = 'session_end'),
        (extract(epoch from max(created_at) - min(created_at)) * 1000)::integer
      ) as duration_ms,
      (array_agg(device     order by created_at desc) filter (where device     is not null))[1] as device,
      (array_agg(os         order by created_at desc) filter (where os         is not null))[1] as os,
      (array_agg(visitor_id order by created_at desc) filter (where visitor_id is not null))[1] as visitor_id,
      (array_agg(utm_source order by created_at asc)  filter (where utm_source is not null))[1] as utm_source,
      (array_agg(utm_medium order by created_at asc)  filter (where utm_medium is not null))[1] as utm_medium,
      -- Same reason admin_campaigns reads it: a gclid-only arrival is paid
      -- traffic, and bucketing it from the referrer would file Google Ads under
      -- organic search — the two panels would then disagree on the same session.
      (array_agg(click_id_source order by created_at asc) filter (where click_id_source is not null))[1] as click_id_source,
      (array_agg(referrer   order by created_at asc)  filter (where referrer   is not null))[1] as first_referrer,
      -- Geography is resolved per address, so it is read from the cache rather
      -- than from the event row: a session whose city arrived after its rows
      -- were written still reports one, with no backfill needed here.
      (array_agg(city    order by created_at desc) filter (where city    is not null))[1] as city,
      (array_agg(region  order by created_at desc) filter (where region  is not null))[1] as region,
      (array_agg(country order by created_at desc) filter (where country is not null))[1] as country,
      min(created_at) as first_seen
    from (
      -- Columns listed rather than `e.*`: the event row already has city/region/
      -- country of its own, so a star here would put two columns of each name in
      -- scope and every later reference would be ambiguous.
      select
        e.session_id, e.created_at, e.event, e.duration_ms,
        e.device, e.os, e.visitor_id,
        e.utm_source, e.utm_medium, e.click_id_source, e.referrer,
        coalesce(e.city,    g.city)    as city,
        coalesce(e.region,  g.region)  as region,
        coalesce(e.country, g.country) as country
      from ev e
      left join ip_geo g on g.ip = e.ip_address and g.resolved
    ) e
    group by session_id
  ),
  visitors as (
    select
      s.visitor_id,
      exists (
        select 1 from visitor_events prior
        where prior.visitor_id = s.visitor_id
          and prior.created_at < (select since from win)
      ) as seen_before
    from (select distinct visitor_id from sess where visitor_id is not null) s
  )
  select jsonb_build_object(
    'generated_at', now(),
    'from', (select since from win),
    'to',   (select until from win),

    'visitors', jsonb_build_object(
      'new',       (select count(*) from visitors where not seen_before),
      'returning', (select count(*) from visitors where seen_before),
      'unknown',   (select count(*) from sess where visitor_id is null),
      'identified',(select count(distinct visitor_id) from sess where visitor_id is not null)
    ),

    'engagement', jsonb_build_object(
      'sessions',        (select count(*) from sess),
      'engaged',         (select count(*) from sess where views > 1 or duration_ms >= 10000),
      'engagement_rate', (
        select case when count(*) = 0 then null
               else round(100.0 * count(*) filter (where views > 1 or duration_ms >= 10000) / count(*), 1)
               end
        from sess
      ),
      'avg_seconds', (select round(coalesce(avg(duration_ms), 0) / 1000.0, 1) from sess)
    ),

    'devices', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object('label', coalesce(device, 'unknown'), 'sessions', count(*)) as row
        from sess group by coalesce(device, 'unknown')
      ) t
    ),

    'os', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object('label', coalesce(os, 'unknown'), 'sessions', count(*)) as row
        from sess group by coalesce(os, 'unknown')
      ) t
    ),

    -- Region carried alongside, because "Thane" and "Nashik" mean little without
    -- it and two states can share a city name.
    'cities', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'city',     city,
                 'region',   coalesce(region, '—'),
                 'country',  coalesce(country, '—'),
                 'sessions', count(*)
               ) as row
        from sess
        where city is not null
        group by city, region, country
      ) t
    ),

    'source_medium', (
      select coalesce(jsonb_agg(row order by (row->>'sessions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'source',   source,
                 'medium',   medium,
                 'tagged',   tagged,
                 'sessions', count(*)
               ) as row
        from (
          select
            case
              when utm_source is not null then utm_source
              -- Before the referrer buckets, not after: an ad click arrives
              -- FROM google.com, so referrer bucketing would file every paid
              -- click as organic search.
              when click_id_source is not null then click_network(click_id_source)
              when first_referrer is null then '(direct)'
              else coalesce(nullif(regexp_replace(first_referrer, '^https?://(www\.)?([^/]+).*$', '\2'), ''), '(unknown)')
            end as source,
            case
              when utm_medium is not null then utm_medium
              when utm_source is not null then '(none)'
              when click_id_source is not null then 'cpc'
              when first_referrer is null then '(none)'
              when first_referrer ~* '(google|bing|duckduckgo|yahoo|ecosia)\.' then 'organic'
              when first_referrer ~* '(instagram|facebook|linkedin|twitter|x\.com|t\.co|whatsapp|youtube|reddit)' then 'social'
              else 'referral'
            end as medium,
            -- "The link declared where it came from", which an ad click id does
            -- just as much as a utm_source.
            (utm_source is not null or click_id_source is not null) as tagged
          from sess
        ) b
        group by source, medium, tagged
      ) t
    ),

    -- What the data actually contains, not a constant: false means either the
    -- provider is unconfigured or nothing has resolved yet, and the panel can
    -- then say so instead of rendering an empty card.
    'geo_available',      (select exists (select 1 from sess where city is not null)),
    'geo_sessions',       (select count(*) from sess where city is not null),
    'geo_cached_ips',     (select count(*) from ip_geo where resolved),
    -- Which provider resolved the cache. Whole-table, like geo_cached_ips beside
    -- it and NOT scoped to the window -- the panel labels it as such. This is how
    -- an operator notices the primary has quietly stopped answering: the ipinfo
    -- count stops growing while ipwho climbs.
    'geo_sources', (
      select coalesce(jsonb_agg(row order by (row->>'addresses')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'source',    coalesce(source, 'unknown'),
                 'addresses', count(*)
               ) as row
        from ip_geo where resolved
        group by coalesce(source, 'unknown')
      ) t
    ),

    'internal', jsonb_build_object(
      'excluded',         p_exclude_internal,
      'sessions_matched', (select count(*) from internal_sessions),
      'networks_active',  (select count(*) from internal_traffic where enabled and network is not null),
      'accounts_active',  (select count(*) from internal_traffic where enabled and user_id is not null)
    )
  );
$$;

revoke execute on function admin_audience(timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant  execute on function admin_audience(timestamptz, timestamptz, boolean) to service_role;
