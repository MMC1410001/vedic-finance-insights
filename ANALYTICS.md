# Analytics

How VedicFinance measures user behaviour: what is tracked, where the code lives, and what still depends on configuration outside this repo.

Introduced in `b274ca6` (GA4 + GTM snippet) and `a5792ec` (event tracking) on branch `analytics-mayur`. Microsoft Clarity added Aug 2026.

---

## Overview

VedicFinance measures behaviour in two independent systems, and the split matters:

**Third-party**, configured outside this repo:

1. **Google Analytics 4** (GA4) - Property `G-WJX6J34M3S` - Event tracking and conversions
2. **Google Tag Manager** (GTM) - Container `GTM-K8SZDDSJ` - Event routing
3. **Microsoft Clarity** - Session recordings, heatmaps, and user behavior insights

**First-party**, entirely in this repo and our own Postgres:

4. **`visitor_events` + `click_points`** - page views, clicks, session duration and
   the funnel, aggregated by `admin_analytics()` and read in **/admin → Analytics**
5. **Admin-only behaviour signals** - dead clicks, rage clicks, scroll depth, CTA
   impressions and form-field reach. Same tables, same panel, and deliberately
   invisible to GTM and GA4: they never call `analytics()`, so they cannot collide
   with the analytics team's tags. See **Admin-only behaviour signals** below.

The first-party system exists because of the sentence in bold further down: **GA4
currently receives nothing but pageviews.** Every named click tag stops at
`window.dataLayer` until someone builds its trigger in GTM, which nobody has. And
even fully configured, no external tool can join a click to `payment_orders` or
`kundli_reports` — so "of the guests who generated a kundali, how many then signed
in?" and "how many pay clicks became payments?" are unanswerable there by
construction.

Both run in parallel deliberately. GA4 and Clarity are the cross-check that the
first-party numbers are right; nothing gets switched off before they agree. What
the first-party system does **not** replace is Clarity's session replay — no DOM
recording is in scope.

---

## The mental model

Four pieces, in order:

```
                 ┌→  window.dataLayer  →  GTM  →  GA4
React code  ─────┤    (a JS array)      (router) (reports)
 (fires)         │
                 └→  event-queue  →  track-visit  →  visitor_events  →  /admin
                     (batched)       (edge fn)      (our Postgres)     (Analytics)
```

The top branch is third-party and depends on configuration outside this repo. The
bottom branch is entirely ours and depends on nothing external. They are described
separately below; a change to one does not affect the other.

- **`window.dataLayer`** is an ordinary JavaScript array in the browser. Pushing to it does nothing on its own — it is an out-tray.
- **GTM** (container `GTM-K8SZDDSJ`) watches that array. It only forwards events it has been explicitly configured to watch, via triggers created in the GTM web UI — **not** in this repo.
- **GA4** (property `G-WJX6J34M3S`) is the reporting dashboard. It only knows what reached it.

Both IDs are loaded by the snippet at the top of [`index.html`](../index.html), which also defines a global `gtag()` function. That snippet's `gtag('config', …)` call is what delivers the pageview — it stays, and it is the only thing currently reporting.

Microsoft Clarity is loaded **through GTM**, not directly in `index.html`. The Clarity tag lives inside container `GTM-K8SZDDSJ` and fires on all pages; you can see it in the browser's Network tab as a request to `https://www.clarity.ms/tag/<project-id>?ref=gtm`. There is no repo-side env var, no snippet, and no code change needed to turn Clarity on or off — that is entirely a GTM tag decision. This is a deliberate change from the earlier setup, which loaded Clarity twice (once directly, once via GTM); the direct loader was removed 25 Aug 2026 after it was found to be the source of duplicate initialisation.

### Two sinks, one call

`analytics()` writes to two places. The dataLayer push is unchanged and is still
the only thing GTM sees; the second sink is our own event log.

| Mechanism | Reaches GA4 without GTM setup? | Used by |
|---|---|---|
| `dataLayer.push({ event: 'gtm.click', 'gtm.text': 'Name' })` | **No** — needs a GTM trigger | the 31 named click tags (32 fire; see the unapproved one below) |
| `enrichLastEvent('click', { tag })` → `visitor_events` | n/a — never goes to GA4 | the same 32 tags, plus every other click |

The GTM half is what the analytics team asked for: `gtm.click` and `gtm.text` are GTM *built-in* names (`gtm.text` backs the native **Click Text** variable), so they can build triggers reading `Click Text equals Footer_PrivacyPolicy` with no custom variables. It keeps tag management in their hands.

The first-party half required **no call-site changes at all** — see
[The first-party event log](#the-first-party-event-log) for why, and for the
capture-then-enrich mechanism that keeps it at one row per click.

**The consequence is worth being blunt about: GA4 currently receives nothing but pageviews.** No conversion, no signup, no revenue. Every one of the 31 click tags is inert until someone builds its trigger in container `GTM-K8SZDDSJ`. See [Removed — the 8 GA4 conversions](#removed--the-8-ga4-conversions) for how that came to be, and [Proposed tags](#proposed-tags--awaiting-analytics-team-sign-off) for what needs building.

---

## Where the code lives

**[`src/lib/analytics.ts`](../src/lib/analytics.ts)** is the only file that touches `dataLayer`. Everything else imports from it.

```ts
export default function analytics(data = {}, eventName = 'gtm.click'): void
```

The default `eventName` covers clicks; pass a second argument for anything that isn't one (see [Adding a new tag](#adding-a-new-tag)).

The first-party half lives in five more modules:

| File | Job |
|---|---|
| [`src/lib/event-queue.ts`](../src/lib/event-queue.ts) | The batching queue. The **only** writer of an analytics event. Flushes on size, on a timer, and via `sendBeacon` on page exit |
| [`src/lib/click-tracking.ts`](../src/lib/click-tracking.ts) | One delegated `document` listener, **capture phase**. Derives a stable label per click and samples coordinates |
| [`src/components/RouteTracker.tsx`](../src/components/RouteTracker.tsx) | `page_view` per route change and `session_end` on exit. Renders nothing |
| [`src/lib/visitor-tracking.ts`](../src/lib/visitor-tracking.ts) | The **immediate**, unbatched path for the four funnel milestones |
| [`src/lib/utm.ts`](../src/lib/utm.ts) | Campaign capture: parses the landing URL, persists first/last touch, cleans the address bar, stamps the account |

Server side: [`supabase/functions/track-visit`](../supabase/functions/track-visit/index.ts) writes the rows, [`_shared/event-payload.ts`](../supabase/functions/_shared/event-payload.ts) validates them, [`_shared/user-agent.ts`](../supabase/functions/_shared/user-agent.ts) classifies device/browser/OS, and `admin_analytics()` / `admin_click_map()` in [migration 018](../supabase/migrations/018_visitor_events.sql) do the aggregation. [Migration 019](../supabase/migrations/019_visitor_attribution.sql) adds the campaign columns, `stamp_first_touch()` and `admin_campaigns()`.

---

## The first-party event log

Everything in this section is ours: our code, our Postgres, our admin panel. No
GTM configuration is involved and nothing here reaches GA4.

### Why it was built

GA4 reports pageviews and nothing else, and has for months. That alone would be
an argument for building triggers rather than a second system — but two questions
the product actually needs answered cannot be answered in GA4 at any level of
configuration:

- *Of the guests who generated a kundali, how many then signed in with Google?*
- *How many pay clicks became payments?*

Both are joins between behaviour and our own tables (`kundli_reports`,
`payment_orders`). GA4 has one side of each join and can never have the other.
Clarity has heatmaps but masks the IP and keeps the data on Microsoft's side.

### The schema

One append-only log, [migration 018](../supabase/migrations/018_visitor_events.sql):

| Event | Fired by | Carries |
|---|---|---|
| `visit` | `App.tsx`, immediately | the session's IP (server-observed) |
| `page_view` | `RouteTracker` | `props.from`, and `duration_ms` = dwell on the **previous** path |
| `session_end` | `RouteTracker`, on `pagehide` | `duration_ms` = the whole session |
| `click` | the delegated listener | `props.tag` (a GTM name) or `props.selector` (derived) |
| `kundali_generated` / `signed_in` / `payment_started` | `visitor-tracking.ts`, immediately | the funnel milestones |
| `error` | reserved | — |
| `dead_click` | the delegated listener | `props.selector` + a coordinate — a click that hit nothing interactive |
| `rage_click` | the delegated listener | `props.selector`, `props.dead` — 3+ clicks in one spot inside 700ms |
| `scroll_depth` | `scroll-tracking.ts` | `props.depth` (25/50/75/100), `props.doc_h` |
| `cta_view` | `cta-visibility.ts` | `props.tag` — a tagged CTA was genuinely seen |
| `field_focus` | `form-tracking.ts` | `props.form`, `props.field`, `props.order` |

The last five are **admin-only** — see the section below. They are queued straight
from `queueEvent()` and never routed through `analytics()`, so nothing about them
reaches `dataLayer`, GTM or GA4.

[Migration 019](../supabase/migrations/019_visitor_attribution.sql) adds nine more
columns to the same table — `utm_source/medium/campaign/content/term`, `click_id`,
`click_id_source`, `landing_path`, `visitor_id` — written onto the `visit` row
only. See [Campaign attribution (UTM)](#campaign-attribution-utm).

**Payment completion is deliberately absent.** It is read from
`payment_orders.status`, because a client-reported purchase is forgeable and
`Payment.tsx`'s `completeAndRedirect` is reached from six different paths.

Click coordinates go to a separate `click_points` table: 10-100x the volume, and
30-day retention against the log's 180. It carries `kind` (`click` / `dead` /
`rage`, derived server-side from the validated verb, never read from the body) and
`doc_h` (the document height `y_pct` is a fraction of).

Adding a verb is a **two-file** change and neither is a migration: the union in
[`src/lib/event-queue.ts`](../src/lib/event-queue.ts) and `ALLOWED_EVENTS` in
[`supabase/functions/_shared/event-payload.ts`](../supabase/functions/_shared/event-payload.ts).
There is deliberately no CHECK on the `event` column. A verb missing from the
server list is counted as `rejected` and dropped silently, which looks exactly
like broken code — so change both.

### Two paths, on purpose

**Immediate** (`visitor-tracking.ts`) — one request per event, sent at once. Only
the four milestones, where losing an event loses a conversion.

**Batched** (`event-queue.ts`) — page views and clicks collected and sent
together. These are high-volume and individually unimportant; one invoke each
would be dozens of requests per session.

The exit flush uses `navigator.sendBeacon`, because a normal request is cancelled
when the page goes away. sendBeacon cannot set headers, so those rows arrive with
**no `user_id`** — which is fine, and already handled: `visitor_session_summary`
resolves a session's user from the last non-null `user_id` on *any* event in that
session, so one attributed row attributes them all.

### Capture-then-enrich — read this before touching click tracking

This is the mechanism that instrumented all 32 existing tags without editing a
single call site, and it has two load-bearing details.

1. The delegated listener is on `document` in the **capture** phase. Not the
   bubble phase: several handlers call `stopPropagation()`, and a bubble-phase
   listener never runs for those clicks. Capture always sees it.
2. Capturing first means the listener cannot know the click's *name* — `analytics()`
   runs later, inside React's handler. So the listener queues the click with a
   derived selector, and `analytics()` calls `enrichLastEvent()` to add the
   authoritative tag to that row **while it is still in the queue**.

The result is one row per click, carrying both. Two separate writers would double
every named tag's count. `src/test/click-tracking.test.ts` holds both halves,
including the `stopPropagation` case.

### What is deliberately not tracked

- **Anything inside `/admin`, and anything embedded.** See
  [Nothing records itself](#nothing-records-itself) — this is enforced for every
  event type, not just clicks.
- **Clicks on non-interactive elements.** Otherwise the ranked table fills with
  body copy.
- **Coordinates outside a small path allowlist**, and only a fraction of clicks
  even there. A heatmap converges on a sample; `click_points` does not need every
  click.

### Reading it

**/admin → Analytics.** `admin_analytics(p_days)` returns the whole panel in one
round trip — funnel, the two headline ratios, engagement, per-path exit rates,
ranked clicks, devices, browsers, sources, a daily series.
`admin_click_map(path, device, days)` returns bucketed coordinates for the heatmap,
separately, so the main payload never carries thousands of points.

Two caveats the UI states on screen, and which any reader needs:

- **The last page of a session has no dwell measurement.** Nothing marks its end.
  It is excluded from the average rather than counted as zero.
- **Ordering within a session comes from `(created_at, seq)`, never `created_at`
  alone.** `created_at` defaults to `now()`, which is *transaction* time, and a
  queue flush is written by one multi-row insert — so every row in a batch shares
  a timestamp to the microsecond. The `views` CTE derives per-path dwell with
  `lead(duration_ms)` and the exit page with `row_number()`, and against a full
  tie both order arbitrarily: dwell values landed on the wrong paths and the exit
  landed on whichever row came back first. `seq` is a monotonic counter stamped by
  `queueEvent()` and carried through `track-visit`. A counter rather than a client
  timestamp, so `created_at` stays server-authoritative and a skewed client clock
  cannot reorder anything — it only ever breaks a tie. Null on rows written before
  the column existed, which is why the windows sort it `nulls first` / `nulls
  last`. **Any new ordering over `visitor_events` needs the same tie-break.**
- **Heatmap `y` is a real depth, not a guess — but only as good as `doc_h`.** `x`
  is a fraction of the layout width and is exact. `y` is a fraction of the
  *document* height the click was actually recorded against, carried on the point
  row as `click_points.doc_h`; before that column the panel had to guess, and its
  only available guess was the height of its own iframe — a different page state
  to the one the visitor clicked on. Where a page's height cannot be measured the
  panel says so in amber and the placement falls back to an estimate. The device
  buttons select the *viewport width* a click happened at, not the kind of
  machine — a desktop browser in a narrow window counts as mobile, because that is
  how the page laid out for them. Compare one class at a time.
- **The site funnel's last stage restarts the baseline.** The first four stages
  are counted per session from `visitor_events`; **Payment completed** is counted
  from `payment_orders`, which is a different population and not a subset of them.
  A browser event can be lost (blocked beacon, closed tab) while the order row is
  authoritative, and an order can complete in a window whose session began outside
  it — live data has read `Payment started 0` above `Payment completed 8`.
  Measured against sessions, that drew a band widening back out to 80% of the
  track and claimed "42.1% of sessions" for a stage the rows above said nobody
  reached. `FunnelSteps` groups instead, and each group's shares name their own
  baseline ("% of sessions", "% of payments") rather than a single fixed "of top".
  The Campaigns funnel splits at Accounts created for the same reason.

### Date ranges, and the timezone that decides them

Presets are **Today, Yesterday, 7d, 30d, 90d, Custom**. All of them are resolved
in the browser by `resolveRange()` in `analytics-format.ts` and sent to the server
as explicit `from`/`to` bounds — the RPCs take timestamps, not a day count,
because "1 Aug to 14 Aug" cannot be expressed as a number of days back from now.

Today and Yesterday are **calendar days in IST**. 7/30/90 stay **rolling**
(`now − N days`), which is what they already meant; making them calendar windows
would have silently moved every number anyone had already looked at.

**Pinned to Asia/Kolkata, not the viewer's timezone.** Otherwise "Today" means
something different for an admin who is travelling, and two people quote
different figures for the same word. The header states the window and names IST,
because neither is the reader's default assumption.

#### A bug this fixed

The daily series bucketed on `current_date`, which on Supabase is **UTC**. India
is UTC+5:30, so everything between 00:00 and 05:30 IST was counted against the
previous day — every late-night session sat on the wrong bar. Buckets now compare
`timezone('Asia/Kolkata', created_at)::date`. The harness test seeds an event at
02:00 IST and asserts which day it lands on, because that is the case that was
wrong.

### Which pages the heatmap covers

[`src/lib/tracked-pages.ts`](../src/lib/tracked-pages.ts) is the one list, with a
**label per path** — `/auth` and `/kundali-auth` are both sign-in screens and
cannot be told apart from their paths in a dropdown. Three places consume it:
coordinate sampling, the heatmap picker, and the dev mock.

It exists because those three used to decide independently and had drifted.
Sampling covered five hand-picked paths, so `/profile` and `/ai-chat` could never
produce a heatmap however long the panel ran — and the picker only listed paths
that *already had rows*, so "no data yet" and "not a page" looked identical. The
picker now lists every page with its count, and says `no clicks yet` rather than
omitting it. A test parses the routes out of `App.tsx` and fails if one is missing
from the catalogue, because the old failure was silent.

`/admin` is absent (`trackingSuppressed()` refuses it), as are `/app` (a
`<Navigate>`) and `*`.

**Dynamic routes are collapsed at record time.** `normalisePath()` maps
`/shared/abc123` → `/shared/:slug`. Stored raw, every shared kundali would be its
own row in the pages table and its own entry in the picker, and a heatmap of one
visitor's link is a heatmap of nothing. It has to happen on the way in — the rows
cannot be separated back out afterwards.

### What "no clicks yet" means, and why the count is per device

Two separate pipelines get conflated here, so the panel now says so in place:

- **Every click** is counted in the clicks table, from the delegated listener.
- **Positions** are a 25% sample (`COORD_SAMPLE_RATE`) written to `click_points`,
  which has its own 30-day retention against the event log's 180.

So a page can report no positions and still have plenty of clicks, and until
migration 018 is applied and `track-visit` deployed, *every* page reports none —
nothing has ever written a coordinate row.

`click_map_paths` groups by **path and device**, not path alone. It has to:
`admin_click_map` filters by device, so a path-only count sat next to a per-device
canvas and a page could read `1,840` in the picker and then draw an empty grid on
Mobile, with nothing on screen explaining the gap. A row with no points is absent
rather than zero — the SQL groups over `click_points`, so a path with no rows
cannot produce one — which means every consumer must read *missing* as zero.

A `null` device is its own bucket (an unclassifiable user agent), never "all
devices". Those points cannot be attributed to the class the canvas is showing.

#### The dev mock must not invent what it has just denied having

`mockPointCount()` is the single source of truth for "does this path have
positions" in the preview, read by both `click_map_paths` and `mockClickMap()`.

They used to answer it independently and disagreed, which produced a panel that
contradicted itself on screen: the picker printed `(no samples)` for `/disclaimer`
while the badge beside it read **2,087 clicks** and the canvas drew a dense
overlay. `mockClickMap` fabricated a full 40x40 grid for whatever path it was
handed and never consulted the list the picker was reading.

Two properties keep them honest, both tested:

- A path+device with no points returns **no cells**, which is what makes the
  empty-state overlay reachable in dev at all.
- The grid sums to **exactly** the promised count, by largest remainder. Rounding
  each cell independently misses by tens, and then the badge and the picker
  disagree again by a smaller margin — which is harder to notice, not better.

The decay across the catalogue is steep enough that the tail reports zero on
*mobile* too, not only on tablet. Mobile is the default device, so a distribution
that left every page populated there put the empty state one device-switch away
from ever being seen — and production starts with every page in it.

`mockPointCount()` is now keyed on **kind** as well as path and device, matching the
SQL's `group by path, class, kind`. `MIN_POINTS` is applied to the click volume
rather than to each kind, so a page that reports clicks also reports its much
smaller dead and rage counts — gating each kind separately left the dead-click
canvas empty on every page that was not extremely busy, which is the state that hid
the problem in the first place.

#### And it must not invent a heatmap at all

Two further faults, both fixed, both worse than the contradiction above because
neither said anything on screen:

- **The fallback fired on an empty result.** `ClickHeatmap` substituted the mock
  whenever the real query returned no cells — so a working deployment with little
  traffic showed invented hotspots instead of the empty state it already had an
  overlay for. The mock now stands in only for an **absent** pipeline: the request
  threw, or the overview payload is itself sample data.
- **`isSample` described the wrong payload.** It is computed from the *overview*
  request, so once migration 018 was applied the overview went real, `isSample` went
  false, and fabricated cells were drawn with no sample-data caption anywhere.
  Provenance is now tracked per map (`mapIsSample`), and it drives the caption, the
  count pill, and a repeated **SAMPLE DATA** watermark painted onto the canvas — a
  caption in the prose above does not travel with a screenshot.

And the fabricated shape is now a deliberate **test card**: a regular lattice with a
diagonal through it. It used to be three soft blobs placed roughly where a hero CTA,
a nav and a footer link sit, identical on all 21 pages. That is what a reader was
looking at when they reported clicks in regions of the page that hold no elements.
A plausible mock is worse than an obvious one.

### The heatmap preview

The click map is drawn over an iframe of the **real page**, same-origin, so it
can never be a stale screenshot. Three things about it are load-bearing:

- **No `sandbox` attribute**, matching `UserKundaliViewer`. It briefly said
  `sandbox="allow-scripts"`, and that was the cause of a reported blank grey
  panel: without `allow-same-origin` the frame gets an opaque origin, the SPA
  throws on its first `sessionStorage` access, and nothing renders at all.
- **The frame lays out at the device's width** (390 / 834 / 1440) and is
  CSS-scaled to fit. Rendering at the panel's own width put a *desktop* layout
  behind a heatmap of mobile clicks, which looks like an answer and is not one.
- **The page height is measured, not guessed.** The fallback aspect ratio puts
  every blob at the wrong depth, so the measured value replaces it and the UI says
  when the fallback is in use.

#### The coordinate model, and the three faults it replaced

The original scheme was: x and y each a fraction of the visitor's own document,
bucketed server-side into a 40x40 grid. All three parts of that were wrong in ways
that put heat where no element is:

- **The vertical grid was far too coarse.** A fortieth of a ~5,000px mobile page is
  a **125px** band, and the renderer draws at the band's centre with a radius of
  ~18px. A click on a real button was routinely painted in the gutter above or
  below it. x keeps 40 buckets — a page is only 390-1440px wide, so those are
  10-36px each — and y is now bucketed in **absolute 24px bands**.
- **y was a fraction of a height nobody recorded.** The panel had to multiply it by
  *some* height and the only one available was the height of its own iframe, which
  is a different page state to the visitor's — an open accordion, lazily loaded
  content, a longer report. `click_points.doc_h` now carries the divisor, so the
  real depth is recoverable. Rows older than that column fall back to fraction mode
  (200 buckets), and `median_doc_h` in the response says which mode was used. The
  panel warns when the previewed page's height is more than 20% from the recorded
  one, and reports clicks that fall below the canvas rather than clamping them into
  a false pile at the foot of the page.
- **x was divided by `scrollWidth`, not the layout width.** On any page with
  horizontal overflow — one wide table, one element a few pixels past the edge — x
  was compressed against a bigger number than the renderer expands by and the whole
  map drifted left. Capture now divides by `documentElement.clientWidth`.

There was a fourth, in the filter rather than the coordinates: `click_points.device`
is derived from the **User-Agent** in `track-visit`, so a desktop browser in a 500px
window was bucketed `desktop` and previewed at 1440px — every one of its
coordinates misplaced by nearly 3x. `click_viewport_class(viewport_w, device)` in
migration 018 buckets by the width the page actually laid out in, falling back to
the UA class only when no viewport was reported so no row is silently dropped. It
is one function because `admin_click_map` **and** `admin_analytics`'s
`click_map_paths` CTE must agree; when they did not, the picker's count sat beside a
canvas drawing something else.

The heatmap also has a **kind** toggle (Clicks / Dead clicks / Rage clicks), which
is what makes an empty region unambiguous — see the admin-only signals section.

The preview is a fixed-height scrolling window (520px). Sized to the whole page
it became a ~3000px element that pushed every section below it off screen. It is
also mounted lazily, on first scroll into view: it is a second copy of the whole
app, and building it on every `/admin` load made the panel measurably slower.

#### Pages that redirect themselves

`/home` was correct while `/auth` showed the kundali page and `/payment` showed
the AI chat, because both redirect a signed-in session on mount — `AuthPage`'s
mount effect sends an onboarded user to `/kundali`, and `Payment` sends a paid one
to `/ai-chat`. Nothing checked where the frame landed, so the overlay kept
claiming a page that was not there. Two halves fix it:

**1. The two known redirects are suppressed in preview.** `isHeatmapPreview()`
requires **three** conditions — `?embed=true`, `?preview=heatmap`, *and* a parent
frame **on our own origin**. The third is not belt-and-braces: `/payment` skipping
its `hasPaid` redirect puts the ₹99 offer back in front of a paid user, who could
start a second order. Inside the panel's `pointer-events: none` iframe that is
harmless; in a hand-typed tab it would be a regression. **Do not relax it to two
conditions** — there is a test on exactly that.

The third condition is *same-origin parent*, not merely "framed", and the
difference is the whole point. Being framed is something any page on the internet
can arrange, and both `ProtectedRoute` and `PaidRoute` return their children on
this answer — so "framed" alone let a hostile origin frame `/payment` straight
past the guard. Reading `window.parent.location.origin` throws `SecurityError`
cross-origin, and that throw is the signal: the `catch` returns **false**. (An
earlier version returned `true` there, reasoning that a throw proves the page is
framed and so the preview must be genuine. It proves the parent is someone
else's.) This holds without any help from `frame-ancestors` / `X-Frame-Options`,
which are set in `vercel.json` and in `public/serve.json` for the Render target
but must not be the thing the guard rests on.

**2. A mismatch is detected regardless.** The component compares the frame's own
`location.pathname` to the requested path and, when they differ, **hides the
canvas** and explains where it landed. Hiding rather than captioning is the point:
an overlay of `/auth`'s clicks drawn over the kundali page is the original defect,
and a warning above it leaves the misleading picture on screen. "Show the heatmap
without the page" is the honest fallback — the coordinates are real, only the
backdrop is unavailable.

The check is re-run on the height re-measure schedule, not once at `onLoad`. These
are **client-side** redirects that run in a React effect after the document loads,
so a single check at load time misses every one of them.

**3. The guards honour the preview too.** `ProtectedRoute` and `PaidRoute` were
originally left in place, and the consequence was worse than the banner suggested:
`getRedirectForRoute()` answers `/home` for anyone unauthenticated, so seven of the
21 catalogue pages — `/dashboard`, `/profile`, `/chat`, `/business-timing`,
`/vedic-trading`, `/upcoming-features`, `/ai-chat` — could never show their own
backdrop, and the Landing page appeared under each of their labels. Both guards now
return their children when `isHeatmapPreview()` is true, exactly as `AuthPage` and
`Payment` do. No paywall is weakened: the three conditions above still hold, and the
frame is `pointer-events: none`. An unauthenticated frame renders those pages in
their signed-out shape, which is the right *route* with empty data rather than a
different page.

**The frame is hidden on a mismatch, not just the canvas.** Hiding the canvas alone
was half a fix — the redirected page stayed on screen under the label it was not.
A residual mismatch now yields the warning card and a blank stage.

`/shared/:slug` is the one page with no previewable URL: it is the normalised bucket
covering every shared kundali, and framed literally it renders a lookup for a slug
of `":slug"`. The panel says so and draws the heatmap over a blank stage.

### Admin-only behaviour signals

Five events that exist for `/admin` and for nothing else. They answer questions the
tables above cannot, and **none of them reaches GTM, GA4 or Clarity.**

#### Why that separation is automatic rather than a rule to remember

`analytics()` in [`src/lib/analytics.ts`](../src/lib/analytics.ts) is the only thing
in the app that touches `window.dataLayer`, and its push is unconditional. So the
mechanism for "first-party only" is simply **not calling it**: these events go
straight to `queueEvent()`. There is no flag to set and nothing to opt out of, which
is the point — a flag would eventually be forgotten in one call site.

Clarity is unaffected either way: it is loaded *by* GTM as a page-level tag and
never reads `dataLayer`. Nothing in this repo can suppress it, and nothing here
needs to.

The 32 agreed click-tag strings, the `gtm.click` / `gtm.text` contract, and every
existing GTM trigger are untouched. `grep -rn "dataLayer" src/` should still hit
only `analytics.ts`; that grep is the proof.

#### The five

| Event | Where | The question it answers |
|---|---|---|
| `dead_click` | `click-tracking.ts` | People are clicking here and nothing happens |
| `rage_click` | `click-tracking.ts` | People are stabbing at this |
| `scroll_depth` | `scroll-tracking.ts` | Where reading stops |
| `cta_view` | `cta-visibility.ts` | Was the button ever actually seen |
| `field_focus` | `form-tracking.ts` | Which form field the flow dies on |

Plus one read-side addition that needed **no client event at all**: *last click
before leaving* is a CTE over the existing click rows, taking each session's final
one. The clicks table cannot show it, because it ranks by volume and is therefore
dominated by whatever everyone clicks on the way in. It is split by whether the
session reached checkout — the same control at the end of a converting session is
the end of a journey that worked, and at the end of one that did not, it is where
people gave up.

#### What each one is careful about

**`dead_click`** — previously discarded at the listener, which is why a cold region
of the heatmap was ambiguous: "nobody clicked here" and "people click here
constantly and nothing happens" drew the same picture, and only one of them is a
fault. Recorded at 15% and capped at 8 per page view, and only *with* a coordinate:
a dead click with no position has no name and no location, so a bare count teaches
nothing. The named element is the nearest identifiable ancestor — not a control, by
definition.

**`rage_click`** — 3+ clicks inside 700ms and 40px. Emitted **once per burst** (the
buffer is cleared when it fires), capped at 3 per page view. It is queued *before*
the click row, never after — see the queue-order rule below.

**`scroll_depth`** — 25/50/75/100, once each per page view, debounced 400ms on the
trailing edge. Without the debounce a momentum fling reports every milestone on the
way to the footer, i.e. that everyone read everything. A page that fits the viewport
reports 100 on install, because otherwise a short page reports nothing and that
reads identically to "nobody scrolled". Carries `doc_h` for the same reason
`click_points` does: 50% of a 3,000px page and 50% of a 9,000px one are not the same
thing. The denominator in `admin_analytics` is deliberately **every session that
opened the page**, not the sessions that reported a milestone — scoping it to
reporters divides by only the people who scrolled and puts every page at ~100%
reach, a plausible number that says the opposite of the truth.

**`cta_view`** — the denominator the clicks table has never had. A CTA with 40
clicks is excellent at 60 impressions and invisible at 6,000, and until now those
were the same row. Requires half the element on screen for a **full second**: first
intersection would credit a fling past every CTA it crosses, inflating the
denominator and making every CTA look worse than it is — failing in the direction
that causes wrong decisions. Watches `[data-af-tag]`, so everything already named
for the clicks table gets an impression with no new attribute, plus `[data-af-cta]`
for a control worth an impression that has no tag. Needs a `MutationObserver` as
well as the initial scan, because nearly every route is `React.lazy` behind
`<Suspense fallback={null}>`: at install time the page is genuinely empty and a
one-off `querySelectorAll` would find nothing on any route in the app. The SQL joins
views to clicks with a **full outer join** — a CTA can be clicked without an
impression (a fast click beats the dwell) and impressed without a click, which is
the interesting case; either one-sided join silently drops the other. `ctr` is
`null`, not `0`, when nothing was seen: an unknown rate, not a rejected control.

**`field_focus`** — a visitor who opens the birth-details form and abandons it is
absent from every existing count, because the funnel's first step is
`kundali_generated`. One capture-phase focus listener on the `<form>`, not an
`onFocus` on each of ten inputs — same reasoning as the delegated click listener,
and capture because `focus` does not bubble and React's synthetic `onFocus` can be
swallowed by a child calling `stopPropagation`. `data-af-field` on an ancestor
groups sub-inputs, so the dd/mm/yyyy trio plus its `sr-only` native picker report as
one `birth_date` rather than four unnamed inputs. There is no `field_abandon` event:
abandonment *is* the gap between one field's reach and the next one's.

#### Two constraints that shaped all of them

**Per-page-view state lives in module memory, never `sessionStorage`.** Every
user-scoped `sessionStorage` key has to be added by hand to the `SIGNED_OUT` list in
`auth-context.tsx`, and one forgotten key shows the previous user's state to the next
person on that browser. Nothing here is worth that risk, so `RouteTracker` calls
`resetPageInteractions()`, `resetScrollDepth()` and `resetCtaViews()` on every route
change instead, and `field_focus` is once-per-mount rather than once-per-session.

**Volume.** `track-visit` rate-limits 120 events per IP per minute. Hence: dead
clicks sampled and capped, `cta_view` once per tag per page view, `rage_click` once
per burst, `scroll_depth` four rows maximum. A landing page has a dozen tagged
controls, so an uncapped impression event alone could have spent the budget.

#### The queue-order rule

`enrichLastEvent()` names the event at the **tail** of the queue and refuses
anything that is not a `click`. So the `click` row must be the last thing the click
handler queues, and `rage_click` goes first. Reverse them and every named tag
doubles: the enrichment fails and `analytics()` writes a second, synthetic row
instead. There is a test on exactly this.

### Nothing records itself

`trackingSuppressed()` in [`src/lib/tracking-scope.ts`](../src/lib/tracking-scope.ts)
is consulted by **both** tracking paths before anything is recorded. Two contexts
are suppressed:

- **Embedded** (`?embed=true`, or any framed page). Without this, opening the
  heatmap writes `visit`, `page_view` and click rows — from the office IP, into
  the very table the panel is displaying. Looking at the data would change it.
  It also covers the landing page's `UserKundaliViewer`, which frames `/kundali`:
  someone scrolling the homepage has not visited the kundali page.
- **`/admin` and anything under it.** The click listener always skipped it;
  page views, session duration and sign-ins were still being recorded, so an
  admin session appeared as a real visitor. The internal-traffic filter would
  subtract most of that eventually — but only if someone remembered to add the
  office network. Not recording it is the more reliable half.

### Internal traffic — the team's own usage

The panel counts every visit, including ours. Two offices plus internal testing
inflate sessions, kundalis and clicks, so without a filter it cannot answer the
only question it exists for: how are *real users* behaving.

**A filter, not a blocklist.** Internal traffic is still recorded, and still
listed in full under Visitors & IPs, marked `internal`. All that changes is what
the Analytics aggregates subtract, and only while that section's toggle is on.

`internal_traffic` (migration 018) holds two kinds of rule — an office `network`
(a CIDR), or an `account` (a `user_id`, for the team testing from home where no
office IP applies). Managed in **/admin → IP Addresses → Internal traffic**.

#### Three findings that shaped it

**1. One address per office is not enough.** Measured from Vikhroli on 26 Aug
2026, three consecutive requests left by three different ISPs:

| IP | ISP |
|---|---|
| `27.107.167.94` | Tata Teleservices, AS17762 (rDNS says static) |
| `103.87.167.58` | Satellite Netcom, AS137166 |
| `206.84.224.70` | Vortex Netsol, AS136334 |

All three are seeded. A single-address filter would have caught about a third of
the traffic *while appearing to work*, which is worse than no filter.

**2. Matching is per SESSION, not per event.** Because the links rotate
per-request, one person's single visit carries several different addresses. An
event-level filter would leave every internal session partly counted — a
plausible-looking number that is wrong. `internal_sessions` in `admin_analytics()`
resolves a whole-session verdict first, and everything else derives from it.

**3. `payment_orders` has no IP**, so it is filtered by account instead: any user
who owns an internal session in the window, plus anyone explicitly listed. Skip
this and the funnel can report more completions than starts once the filter is
on, which reads as a broken funnel rather than a working filter.

#### Using it

**"Add my current IP"** is the primary control. A browser cannot read its own
public IP, so the `whoami-ip` action returns what the *server* saw for that
request. Given the rotating links, collecting an office's full set means clicking
it a few times from there — and once more from Goregaon, which has no entry yet.

Two guards worth knowing about, both in `_shared/internal-traffic.ts`:

- **Prefixes broader than /16 are refused.** `0.0.0.0/0` here would subtract every
  session and the panel would read as a collapse in traffic rather than a typo.
- **Public mail domains are refused** for the same reason on the account side —
  `@gmail.com` would hide a large share of real users.

**Adding a domain expands to explicit account rows at click time**, deliberately.
A live rule would mean an Admin API call on every analytics load and would pull
in accounts nobody reviewed. Someone who joins later is not added automatically;
click **Add all** again.

#### Reading the panel honestly

The toggle is **per-operator** (localStorage) and defaults to **Real users**. Two
admins can therefore be looking at different totals, which is why the notice
above the funnel always states the mode *and* the count — in both directions:

| State | Reads |
|---|---|
| filtering, matches | "Showing real users — 214 internal sessions hidden." |
| filtering, none | "Showing real users. No internal sessions matched in this period." |
| not filtering, matches | "Showing all traffic — 214 internal sessions counted…" (warn) |
| not filtering, none | "Showing all traffic, internal included. None matched…" |

The middle two are the ones that matter: they produce **identical totals**, so if
they also read identically nobody could tell whether the filter was working or
simply had nothing to do. That is how a filtered number gets quoted as a real
one. `describeInternal()` in `analytics-format.ts` owns this wording and
`src/test/internal-filter.test.ts` holds all four states apart.

### Kill switch

`VITE_ANALYTICS_DISABLED=true` stops the browser sending any first-party event. It
does not affect GA4, GTM or Clarity — those load from the snippet in `index.html`.

### Privacy

`src/pages/Privacy.tsx` discloses this under **Interaction Data**, naming pages,
clicks, click position and session duration, with both retention periods. Our own
analytics set no cookies — the session identifier lives in `sessionStorage` and is
discarded with the tab. If you add a field, update that section in the same commit.

---

## Campaign attribution (UTM)

Marketing links carry `?utm_source=…&utm_medium=…&utm_campaign=…`. The naming
convention marketing works to is [docs/CAMPAIGN-UTM-GUIDE.md](docs/CAMPAIGN-UTM-GUIDE.md);
this section is the mechanism.

**Why it had to be first-party.** GA4 reads UTMs off the URL by itself, and then
the trail ends: the events that matter — `kundali_generated`, `signed_in`,
`payment_started` — exist only in `visitor_events`, and GA4 cannot join to
`payment_orders` at all. GA4 can report traffic by source; it can never report a
conversion rate by source. Before 019 neither could we — `admin_analytics()`'s
`sources` is a four-bucket regex over referrer hosts, which separates "social"
from "organic" and cannot separate two Instagram creatives.

### The path a campaign takes

1. **`src/lib/utm.ts`, at module scope in `main.tsx`** — before render, before
   `<BrowserRouter>` reads the URL, before `trackVisit("visit")`, and before any
   component can start an OAuth redirect. It parses the five UTMs plus
   `gclid`/`fbclid`, normalises them, stores them, and strips them from the
   address bar with `history.replaceState` (keeping `intent`, `embed`, `preview`
   and anything else).
2. **`trackVisit("visit")`** attaches `visitAttribution()` to the request body as
   a sibling of `session_id` — the campaign when there is one, and the
   per-browser `visitor_id` always. Not `currentAttribution()`: that returns null
   for an untagged URL, which once made the visitor id conditional on the arrival
   being tagged and left new-vs-returning describing campaign traffic alone.
3. **`track-visit`** validates it with `sanitiseAttribution()` and writes it onto
   that one `visit` row.
4. **`stamp_first_touch`** copies the *first* touch onto `user_profiles`, once
   per account, permanently. It clamps the timestamp: that value is the browser's
   clock, and a skewed one would stamp an acquisition date outside every window
   the Campaigns table can ask for.
5. **`admin_campaigns()`** rolls the two levels into the Campaigns table.

An arrival carrying only `gclid` or `fbclid` — which is what Google Ads and Meta
auto-tagging produce on their own — has no `utm_source`, and `click_network()` in
019 is what stops it being labelled `direct`. It reports as `google / cpc` or
`facebook / cpc`, matching the names GA4 derives from the same parameters, in
both the Campaigns table and Audience's source/medium list. Before that helper
existed the id was stored, admitted to the `attr` CTE, and read by nothing, so
paid advertising appeared as untagged traffic in the one table built to tell
them apart.

### Three stores, three questions

| Key | Store | Answers |
|---|---|---|
| `afVisitorId` | localStorage | which browser is this, across sessions |
| `afFirstTouch` | localStorage, write-once, 90-day TTL | which campaign **acquired** them |
| `afLastTouch` | sessionStorage | which campaign started **this session** |

Persistence is not optional here. `sessionId` dies with the tab, so a WhatsApp
click on Monday and a signup on Wednesday would be unrelated. Worse, **no sign-in
call site forwards `window.location.search` into `signInWithOAuth`'s
`redirectTo`** — Google returns to a bare `/auth` — so a campaign that lived only
in the URL would be gone by the time an account exists. Capturing before the
redirect is what makes the round trip survivable.

Only `afLastTouch` and the `afFirstTouchStamped` latch are cleared on sign-out.
`afVisitorId` and `afFirstTouch` are deliberately kept: they describe the browser,
not the account, and clearing them would make every sign-out look like a new
visitor. The 90-day expiry is the shared-device mitigation.

### Six rules that will otherwise bite

1. **An untagged visit writes nothing.** It must not clear the session's last
   touch (that is what survives the OAuth return), and it must not claim first
   touch as `direct` — that would permanently mark someone as organic and make
   every campaign they later arrive from look barren.
2. **Values are rejected, not truncated.** Everything else in
   `_shared/event-payload.ts` clamps; UTMs do not. A clipped campaign name is a
   *different* campaign and would become a second row indistinguishable from a
   real one. Over 64 characters, or outside `[a-z0-9._-]`, arrives as null.
3. **Anything resembling PII is dropped whole**, not scrubbed — mail-merged
   `utm_content=someone@example.com` is the real case, and a scrubbed version
   would read as a plausible campaign name forever. Enforced on **both** ends:
   `src/lib/utm.ts` before sending, and `normaliseUtm()` in
   `_shared/event-payload.ts` on arrival, because `track-visit` is
   `verify_jwt=false` with CORS `*`. Privacy.tsx makes this promise to users, so
   it cannot live only in the browser.
4. **The campaign is on the `visit` row only.** It describes the session; putting
   it on `signed_in` too would let a later row disagree with the landing one.
5. **The two ends must normalise identically.** The client lowercases, hyphenates
   and strips to `[a-z0-9._-]`; the server then requires `^[a-z0-9]`. When those
   disagreed — the client kept a leading `_`, the server rejected it —
   `?utm_campaign=_promo` reached GA4 intact and was dropped from
   `visitor_events`, so the campaign existed in one report and not the other with
   no error on either side. Any change to one validator has to be made to both.
6. **`paid` is not a subset of `sessions` in a Campaigns row.** The left half is
   session-level, the right half user-level via `user_profiles.first_utm_*`.
   `payment_orders` has no `session_id` and payment routinely happens in a later
   session than the click, so a session join would report near-zero for every
   campaign. Users with no stamp read as `(pre-attribution)`, never as `direct`.

### GA4 side

Four dataLayer events now push through `analytics()`. Three are the proposals
already in [Removed — the 8 GA4 conversions](#removed--the-8-ga4-conversions);
`Campaign_Landing` is new and needs the same sign-off.

| Event | Fired from | Carries |
|---|---|---|
| `Campaign_Landing` | `main.tsx`, tagged arrivals only | `traffic_source/medium/campaign/content/term` |
| `Auth_LoginSuccess` | `auth-context.tsx`, `SIGNED_IN` | the same five |
| `Kundali_ReportGenerated` | `kundali-history.ts`, beside `trackVisit` | the same five |
| `Purchase_Confirmed` | `Payment.tsx`, inside `redirectedRef` | nested `ecommerce` + the five |

The parameters are named `traffic_*`, not `utm_*`: GA4 owns `utm_*` for its own
attribution, and a custom parameter colliding with one is how a report ends up
giving two answers to the same question.

**Still to do in the GTM console — none of it is code.** Data-layer variables for
the five parameters; four Custom Event triggers (exact match); GA4 event tags on
`G-WJX6J34M3S`, with the Ecommerce tag and *"Send Ecommerce data → Data Layer"*
for the purchase; the five parameters registered as **event-scoped custom
dimensions** (without this they exist in the payload and appear in no report);
and the three conversions marked as key events. Until then these events reach
`window.dataLayer` and stop, exactly like the click tags.

**Audit the container before comparing any two numbers.** `index.html` loads
`gtag.js` for `G-WJX6J34M3S` *and* the GTM container. If the container also holds
a GA4 config tag for the same ID, every pageview counts twice — which reads as
"the first-party pipeline is under-counting" rather than as the double-count it
is. Prefer removing the container's config tag so `index.html` stays the single
loader.

---

## Audience and geography

`admin_audience()` in 019 answers what `admin_analytics()` never did: new vs
returning visitors, operating system, engagement rate, source/medium as one
ranked list, and approximate city. It is a third function rather than more keys
on `admin_analytics()` for the same reason `admin_campaigns()` is separate —
that function is ~600 lines and every number already read from it would have to
be re-verified to add a join.

### New vs returning

Keyed on `visitor_id`, the per-browser id in localStorage. "Returning" means the
browser was seen **before the window opened**, judged against the whole table
rather than inside the window — otherwise someone who first arrived in June and
came back in September would read as new.

The id rides on the `visit` row's `attribution` block, and **every** visit sends
it — tagged or not. It was briefly attached only to campaign arrivals, because it
lived inside the campaign object and `currentAttribution()` returns null for an
untagged URL; that made new-vs-returning a statistic about marketing traffic
alone while the panel described the gap as a backlog. `visitAttribution()` in
`utm.ts` is what separates the two: browser identity always travels, the campaign
only when there is one.

Sessions recorded before that, and browsers that cannot write localStorage at all
(private windows, iOS Lockdown, "block all site data"), have no `visitor_id` and
are reported as `unknown` rather than folded into `new`. Folding them in would
invent first-time visitors.

### Geography — read it with suspicion

City comes from an IP lookup, cached per address in `ip_geo`.

**Three tiers, tried in order** — so a lapsed token degrades instead of stopping:

| Tier | Source | Gives | Fails how |
|---|---|---|---|
| 1 | ipinfo.io (needs `IPINFO_TOKEN`) | city + region + country | 403 on a bad or revoked token; 429 on quota |
| 2 | ipwho.is — **keyless**, so nothing to expire | city + region + country | 200 with `success:false`, or unreachable |
| 3 | `cf-ipcountry` on the request | country only | header simply absent |

The chain stops at the first answer carrying a **city**, not the first answer at
all — a country-only reply from tier 1 falls through so tier 2 can do better,
keeping that country as a floor. `ip_geo.source` records which provider won,
because the two do not always agree: one IPv6 address resolves to Mumbai on
ipinfo and Delhi on ipwho.is, and a blended table cannot be read without it. The
panel prints the breakdown, which is also how a lapsed token becomes visible —
the ipinfo count stops growing while ipwho climbs.

**Two traps in tier 2, both found by calling the live API rather than reading
about it.** They are asserted in `geo.test.ts`; do not "simplify" either away:

1. ipwho.is answers **HTTP 200 with `{"success": false}`** for a reserved range.
   A plain `res.ok` check takes that for a real answer and caches a row that
   blocks the address for the full 60-day TTL.
2. Its `country` is the full name (`"India"`) where ipinfo's is the code
   (`"IN"`). Read `country_code`, or one country becomes two rows in Cities.

**Tier 3 is never cached**, and that is deliberate. A country-only row would
satisfy `cachedPlace()` for 60 days, so restoring a token would appear to do
nothing for two months. Reading a header costs nothing per request, so there is
no reason to cache it and a good reason not to. Its availability is an inference
— Supabase edge functions sit behind Cloudflare — so the tier is written to cost
nothing when the header is absent, and the `source` counts report empirically
whether it ever fires.

**A failure writes no row at all.** An outage is not evidence that an address
cannot be placed, so nothing is cached and the next visit retries. Only a
provider that *answered* and could not place the address is cached as unresolved.

**Off unless `IPINFO_TOKEN` is set** in the edge-function secrets
(`supabase secrets set IPINFO_TOKEN=...`). The switch gates the **whole chain**,
keyless tier included: the fallback exists for a token that lapsed, not for a
project where nobody opted in. With no token nothing runs and no address reaches
any third party. `test:functions` carries `--allow-env` so that default can
actually be asserted.

The panel distinguishes *not configured* from *configured and failing* via
`geo_configured`, which only the edge runtime can answer — `admin_audience()`
runs in Postgres and cannot see the function's secrets. Without it a rejected
token eventually rendered as "IPINFO_TOKEN is not set", sending the reader to the
one place that was already correct.

**It never delays a visit.** The cache is read before the insert — a local
indexed lookup — and on a miss the provider is called *after* the response, with
the row backfilled by session. A provider outage costs a city, not a session.
Private, reserved and RFC 5737 documentation ranges are never sent at all.

**The accuracy caveat is the important part.** Indian mobile carriers NAT very
large subscriber pools through a few metro exchanges, so users across a state
routinely resolve to one city — Mumbai above all. GA4 performs the same lookup
and inherits the same flaw, so the two agree with each other and are wrong in
the same direction. The panel states this above the table rather than in a
footnote. Treat it as a regional hint; do not spend money on it.

### The three-slice cap on pie charts

`AdminChartColors.series` holds exactly three hues, per theme. That is a
measured ceiling: run through the dataviz palette validator with `--pairs all`
(what a pie needs, since any slice can sit beside any other), three hues pass
every check on both theme surfaces and a fourth fails colour-blind separation
and the normal-vision floor whichever hue is added. So each pie shows the top
two categories plus a neutral "Other", with the full ranked list as bars
beneath. The light theme also carries a non-dismissable contrast warning on the
third hue, which is why every slice is labelled and numbered.

---

## The 31 named click tags

Names come from the analytics team's "Missing Data Layers" document. **They are authoritative** — GTM matches these strings exactly. Do not "fix" spellings.

### Homepage

| Tag | Location |
|---|---|
| `VedicFinance_Logo` | [Navbar.tsx:223](../src/components/landing/Navbar.tsx#L223) |
| `VedicFinance_Homepage_ChatBot` | [FloatingAstrologerChat.tsx:242](../src/components/FloatingAstrologerChat.tsx#L242) |
| `VedicFinance_ChatwithAstrologer` | [FloatingAstrologerChat.tsx:226](../src/components/FloatingAstrologerChat.tsx#L226) |
| `Samplekundali_Chatbot` | [FloatingAstrologerChat.tsx:245](../src/components/FloatingAstrologerChat.tsx#L245) — fires *in addition to* `VedicFinance_Homepage_ChatBot` when the widget is opened from `/` or `/home` |
| `VedicFinance_Unlockyourkundali_1` | Hero's first CTA, and **it fires at a different moment per breakpoint** — deliberately. **Desktop (≥1024px):** a raw click on the submit button, via the form's `onSubmitClick` prop, so a press on an invalid form still counts ([Hero.tsx:518](../src/components/landing/Hero.tsx#L518)). **Mobile (<1024px):** unchanged — fires from `handleFormSubmit` only after validation passes ([Hero.tsx:341](../src/components/landing/Hero.tsx#L341)), because mobile has its own separate first CTA (`VedicFinance_Hero_ScrollToForm_Mobile`) already capturing intent. Desktop became click-fired on 20 Aug 2026; desktop counts before that date are submit-only and read lower |
| `VedicFinance_Unlockyourkundali_2` | [InsightPreview.tsx:173](../src/components/landing/InsightPreview.tsx#L173) |
| `Viewyourfinancialkundali_1` | [Hero.tsx:273](../src/components/landing/Hero.tsx#L273) — the paid-user variant of the hero CTA, which swaps to "View Your Financial Kundali" |
| `Viewyourfinancialkundali_2` | [InsightPreview.tsx:170](../src/components/landing/InsightPreview.tsx#L170) — paid-user variant of the same button |
| `UnlockKundali_Newhere` | [AuthPage.tsx:309](../src/pages/AuthPage.tsx#L309) and [KundaliAuthPage.tsx:132](../src/pages/KundaliAuthPage.tsx#L132) — both pages render the tab strip |
| `UnlockKundali_Alreadyauser` | [AuthPage.tsx:323](../src/pages/AuthPage.tsx#L323) and [KundaliAuthPage.tsx:146](../src/pages/KundaliAuthPage.tsx#L146) |
| `Login_ContinuewithGoogle` | [AuthPage.tsx:370](../src/pages/AuthPage.tsx#L370) and [KundaliAuthPage.tsx:201](../src/pages/KundaliAuthPage.tsx#L201) — sign-in tab only |
| `Signup_Continuewithgoogle` | [BirthDetailsForm.tsx:618](../src/components/vedicfinance/BirthDetailsForm.tsx#L618) — the sign-up tab's Google button, shared by `/auth` and `/kundali-auth`. **Note the lowercase `g`**, unlike its `Login_ContinuewithGoogle` sibling: that is the string the analytics team supplied, confirmed deliberate, and GTM matches it exactly |
| `UnlockKndali_Pay99` | [MethodStep.tsx:75](../src/components/payment/MethodStep.tsx#L75) |

### Header

| Tag | Location |
|---|---|
| `Header_Insights` | [Navbar.tsx:254](../src/components/landing/Navbar.tsx#L254) |
| `Header_Testimonials` | [Navbar.tsx:257](../src/components/landing/Navbar.tsx#L257) |
| `Header_FAQ` | [Navbar.tsx:260](../src/components/landing/Navbar.tsx#L260) |
| `VedicFinance_Nav_Kundali_Mobile` | [Navbar.tsx:271](../src/components/landing/Navbar.tsx#L271) |
| `VedicFinance_Nav_GetKundali_Desktop` | [Navbar.tsx:317](../src/components/landing/Navbar.tsx#L317) |

### Footer

| Tag | Location |
|---|---|
| `Footer_Terms&Conditions` | [Footer.tsx:74](../src/components/landing/Footer.tsx#L74) |
| `Footer_PrivacyPolicy` | [Footer.tsx:82](../src/components/landing/Footer.tsx#L82) |
| `Footer_Disclaimer` | [Footer.tsx:90](../src/components/landing/Footer.tsx#L90) |
| `Footer_RefundPolicy` | [Footer.tsx:98](../src/components/landing/Footer.tsx#L98) |
| `Footer_Services` | [Footer.tsx:116](../src/components/landing/Footer.tsx#L116) |
| `Footer_HowItWorks` | [Footer.tsx:125](../src/components/landing/Footer.tsx#L125) |
| `Footer_FAQ` | [Footer.tsx:136](../src/components/landing/Footer.tsx#L136) |
| `Footer_AIAstrologer` | [Footer.tsx:148](../src/components/landing/Footer.tsx#L148) |
| `Footer_Instagram` | [Footer.tsx:170](../src/components/landing/Footer.tsx#L170) |
| `Footer_Phone` | [Footer.tsx:187](../src/components/landing/Footer.tsx#L187) |
| `FooterServices_GenerateMyKundli` | [Services.tsx:65](../src/pages/Services.tsx#L65) — on `/services`, the page the footer's Services link leads to |

### Kundali page

| Tag | Location |
|---|---|
| `Kundali_DownloadPDF` | [FinancialKundali.tsx:261](../src/pages/FinancialKundali.tsx#L261) — inside `handleDownloadPdf`, *after* its double-click guard, so one call covers all three download buttons (sidebar expanded, sidebar collapsed, page header) and a rapid double-tap counts once. The sidebar buttons divert signed-out users to `/kundali-auth` before reaching the handler, so this measures downloads started by signed-in users |
| `Kundali_ShareKundali` | [KundaliSidebar.tsx:106](../src/components/kundali/KundaliSidebar.tsx#L106) — first line of `handleShareKundali`, before its auth gate, so it records the click itself; covers the expanded and collapsed share buttons |

**Scope:** Header and Footer render on many pages, so their tags fire everywhere, not just the homepage. GA4's `page_location` dimension is meant to segment them afterwards — but see the SPA pageview gap in [Open items](#open-items--these-need-people-not-code), which currently undermines that.

---

## Removed — the 8 GA4 conversions

There used to be a second delivery path: eight `track*` helpers calling `gtag('event', …)` directly, so conversions reached GA4 without waiting on GTM configuration. `11bf134` additionally mirrored them into the dataLayer under an `af_` prefix.

**All of it was removed.** Those events were added by one developer on their own initiative; the analytics team never requested them and never built anything against them. Removing them is the deliberate outcome of that, not an accident — this section exists so nobody re-adds them in six months believing they were lost.

| Removed event | Where its measurement went |
|---|---|
| `begin_checkout` | Already covered by the `UnlockKndali_Pay99` click tag — same button |
| `login` (the click) | Already covered by `Login_ContinuewithGoogle` |
| `qualify_lead` | Covered by `Signup_Continuewithgoogle` — **shipped** 20 Aug 2026 |
| `kundali_download` | Covered by `Kundali_DownloadPDF` — **shipped** 20 Aug 2026 |
| `kundali_shared` | Two surfaces, not one: the kundali sidebar shipped as `Kundali_ShareKundali` (20 Aug 2026); `/profile` is still only proposed, as `Profile_ShareLink` |
| `purchase` | `Purchase_Confirmed` — **pushed to `dataLayer` since 019**; still needs a Custom Event trigger in GTM |
| `login` / `sign_up` (the success) | `Auth_LoginSuccess` — **pushed since 019**; `Auth_SignupSuccess` is still only proposed. **Not clicks** |
| `kundali_generated` | `Kundali_ReportGenerated` — **pushed since 019**, from `kundali-history.ts` rather than the `/kundali` render, so it counts the same moment the first-party event does |

Three of those now reach `window.dataLayer` again — see [Campaign attribution (UTM)](#campaign-attribution-utm) for why and what they carry. **Until the GTM triggers exist, GA4 still reports no conversions and no revenue**; the pushes alone change nothing in a report.

### What went with them

`gaEvent()`, `clearEcommerce()`, the `DL_PREFIX` constant, the `window.gtag` type declaration, and the `debug_mode` dev flag that routed events to GA4's DebugView. The `gtag.js` snippet in [`index.html`](../index.html) stays — it still delivers the pageview.

Also removed: a `trackKundaliShared("profile_history")` call in `Profile.tsx`, added shortly before this to fix a genuine under-count. The gap it addressed is real and survives as the `Profile_ShareLink` proposal — only the implementation went.

---

## The three edit patterns

**1. Add an `onClick` where none existed** — footer links, header anchors:

```tsx
<a href="#insights" onClick={() => analytics({ 'gtm.text': 'Header_Insights' })} ...>
```

**2. Wrap an existing handler** — track first, then do the original thing:

```tsx
onClick={() => {
  analytics({ 'gtm.text': 'VedicFinance_Unlockyourkundali_1' });
  onPrimary();
}}
```

**3. Fire inside business logic** — for events that are not clicks. Pass a custom event name as the second argument, because `gtm.click`/`gtm.text` only works for real clicks:

```ts
analytics({ transaction_id, value, currency }, 'Purchase_Confirmed');
```

GTM matches these with a **Custom Event** trigger, not a Click Text one. See the [not-a-click proposals](#these-cannot-be-click-tags) for the three that need it.

---

## Placements that are load-bearing

Change these carelessly and the data goes wrong without any error.

**The chat FAB is a toggle.** The same button opens and closes the panel, so an unguarded handler counts closes as opens. The `if (!open)` check restricts it to the open transition. It also must live in the click handler, **not** inside the `setOpen` updater — React StrictMode double-invokes updaters in dev, which would double-count.

**One handler can serve several buttons.** PDF download has three trigger points (sidebar expanded, sidebar collapsed, mobile header) and share has two, but each funnels through a single handler. Tag the handler, not the buttons, or one action counts three times. The same trap applies to both chat send paths — button, Enter key and form submit all reach one `sendMessage`.

**`completeAndRedirect` in `Payment.tsx` is reached from 6 places** — widget callback, background poll, visibility regain, focus regain, resume poll, retry verify — and deduplicated by `redirectedRef`. Anything tracking a confirmed purchase must sit *after* that guard, and *before* `localStorage.removeItem(ORDER_ID_KEY)`, or the transaction id is already gone. This is why `Purchase_Confirmed` cannot be a click tag.

---

## Proposed tags — awaiting analytics team sign-off

A sweep of every live route (Aug 2026) found **~90 untagged interactive elements**. Existing coverage is concentrated on the landing page and footer; **the paid product now has no tracking at all.**

Nothing below is implemented. Names follow the established `Section_ElementName` convention and are proposals — **agree them with the analytics team before writing any code**, per "Adding a new tag" below.

### Implemented but unapproved — confirm or rename

One tag is live in the code without a name from the team's document, which breaks the rule above. It needs a decision, not new code.

| Tag in code | Element | File |
|---|---|---|
| `VedicFinance_Hero_ScrollToForm_Mobile` | The hero's promoted CTA on mobile (`lg:hidden`). It does not submit — it smooth-scrolls to the birth-details form below | [Hero.tsx:302](../src/components/landing/Hero.tsx#L302) |

Why it matters more than a naming nit: this button and the form's submit button carry **identical visible text** ("Unlock your Financial Kundali for ₹99 FREE"), so a trigger built on the native Click Text variable cannot separate them. The pushed `gtm.text` string is the only discriminator, and it is also the only tag on mobile that captures *raw intent* — `VedicFinance_Unlockyourkundali_1` fires only on a valid submit (see the Homepage table). Ask the team to confirm the string or supply their own, then update this row and move it into the authoritative list.

### Replacing the removed conversions

These restore what the deleted `track*` helpers were measuring. Build these before the rest.

| Proposed tag | Element | File |
|---|---|---|
| `Profile_ShareLink` | Share from Profile history — a **second, separate** share surface | [Profile.tsx:185](../src/pages/Profile.tsx#L185) |

#### These cannot be click tags

`gtm.text` matches GTM's built-in Click Text variable, which only exists on a real click. These three fire from application logic, so each needs its own event name and a **Custom Event** trigger.

| Proposed event | Why it isn't a click | File |
|---|---|---|
| `Purchase_Confirmed` | **The revenue event, and the one to build first.** Confirmation arrives asynchronously from Zoho via 6 different paths, deduplicated by `redirectedRef`. No click corresponds to it. Carries `transaction_id`, `value`, `currency`, `items` | [Payment.tsx:65](../src/pages/Payment.tsx#L65) |
| `Auth_LoginSuccess` / `Auth_SignupSuccess` | Fires after the Google OAuth **redirect back**, not on the button press. The click is tagged separately — the gap between click and success is the OAuth drop-off | [AuthPage.tsx:107](../src/pages/AuthPage.tsx#L107) |
| `Kundali_ReportGenerated` | Fires on render, once report data lands | [FinancialKundali.tsx](../src/pages/FinancialKundali.tsx) |

For `Purchase_Confirmed`, GTM's GA4 Ecommerce tag wants the fields **nested** under `ecommerce`, preceded by a reset push so values cannot leak between events, with *"Send Ecommerce data → Data Layer"* ticked:

```ts
analytics({ ecommerce: null }, 'Ecommerce_Clear');
analytics({ ecommerce: { transaction_id, value, currency, items } }, 'Purchase_Confirmed');
```

Getting this shape wrong fails **silently** — GA4 records that a purchase happened but with no amount, so revenue shows ₹0 while purchase counts look healthy.

### P1 — revenue and recovery

Checkout has one tag (`UnlockKndali_Pay99`) and no coverage of anything that happens when payment goes wrong.

| Proposed tag | Element | File |
|---|---|---|
| `Payment_RetryPayment` | "Retry payment" after a failed charge | [FailedStep.tsx:34](../src/components/payment/FailedStep.tsx#L34) |
| `Payment_CheckAgain` | "Check again" on the timeout screen | [Payment.tsx:495](../src/pages/Payment.tsx#L495) |
| `Payment_StartNewPayment` | "Start a new payment" on timeout | [Payment.tsx:505](../src/pages/Payment.tsx#L505) |
| `Payment_ContactSupport` | `mailto:` support link on timeout | [Payment.tsx:516](../src/pages/Payment.tsx#L516) |
| `Payment_Back` | "← Back" — the literal checkout-abandonment click | [CheckoutShell.tsx:54](../src/components/payment/CheckoutShell.tsx#L54) |
| `Payment_ExitViaLogo` | Logo exit from checkout — a second, distinct abandonment path | [CheckoutShell.tsx:20](../src/components/payment/CheckoutShell.tsx#L20) |
| `Payment_AlreadyPaid` | "Already paid? Click here…" — double-charge anxiety and support-load signal | [MethodStep.tsx:129](../src/components/payment/MethodStep.tsx#L129) |

`begin_checkout` fires on *every* Pay click, so first attempt and retry are currently indistinguishable. `Payment_RetryPayment` is what separates them.

### P1 — the sign-up CTA

| Proposed tag | Element | File |
|---|---|---|
| `Signup_Continuewithgoogle_Invalid` | Same button as the shipped `Signup_Continuewithgoogle`, but only when validation rejects the click — the two together give the sign-up drop-off | [BirthDetailsForm.tsx:206](../src/components/vedicfinance/BirthDetailsForm.tsx#L206) |
| `Signup_SelectBirthPlace` | Location autocomplete selection — supplies lat/lon, without which submit is blocked | [LocationSearch.tsx:139](../src/components/vedicfinance/LocationSearch.tsx#L139) |

The highest-volume gap in acquisition. `handleGoogle` early-returns when the form is invalid or coordinates are missing, so **an invalid click currently records nothing at all** — the click-to-`qualify_lead` drop-off is invisible. The second tag is what makes it measurable.

### P2 — auth funnel forks

| Proposed tag | Element | File |
|---|---|---|
| `UnlockKundali_CreateAccount_FromError` | "Create an account →" inside the sign-in error box | [AuthPage.tsx:506](../src/pages/AuthPage.tsx#L506) |
| `UnlockKundali_SignupLink` | "Sign up" under "Don't have an account?" | [AuthPage.tsx:543](../src/pages/AuthPage.tsx#L543) |
| `UnlockKundali_ExistingAccount_Continue` | "Continue to My Account" in the duplicate-account dialog | [AuthPage.tsx:588](../src/pages/AuthPage.tsx#L588) |
| `UnlockKundali_ExistingAccount_SwitchAccount` | "Go back and sign in with another account" | [AuthPage.tsx:599](../src/pages/AuthPage.tsx#L599) |
| `UnlockKundali_ExitViaLogo` | Logo exit from `/auth` — abandon-auth signal | [AuthPage.tsx:394](../src/pages/AuthPage.tsx#L394) |

The two tab buttons *are* tagged while these silent tab-switchers are not, so the funnel currently looks like users teleport between tabs.

### P2 — the paid product

| Proposed tag | Element | File |
|---|---|---|
| `Kundali_Section_<id>` | The 4 insight section nav buttons. Pass the section id as a parameter rather than minting 4 tags | [KundaliSidebar.tsx:159-191](../src/components/kundali/KundaliSidebar.tsx#L159-L191) |
| `Kundali_ChatwithAIAstrologer` | Sidebar → `/ai-chat` — cross-feature adoption | [KundaliSidebar.tsx:253](../src/components/kundali/KundaliSidebar.tsx#L253) |
| `Kundali_ProfileHistory` | Sidebar → `/profile` — return-visit behaviour | [KundaliSidebar.tsx:222](../src/components/kundali/KundaliSidebar.tsx#L222) |
| `Kundali_BoostYourWealth` | Upsell demand signal for an unbuilt feature | [KundaliSidebar.tsx:270](../src/components/kundali/KundaliSidebar.tsx#L270) |
| `Kundali_UpcomingInsights` | Roadmap demand signal | [KundaliSidebar.tsx:290](../src/components/kundali/KundaliSidebar.tsx#L290) |
| `Kundali_CardFeedback_Up` / `_Down` | Thumbs up/down across 10 cards — already writes to Supabase, never reaches GA4 | [CardFeedback.tsx:28](../src/components/financial-kundali/CardFeedback.tsx#L28), [:49](../src/components/financial-kundali/CardFeedback.tsx#L49) |
| `Kundali_FeedbackComment_Submit` | Free-text feedback send | [FeedbackPanel.tsx:106](../src/components/financial-kundali/FeedbackPanel.tsx#L106) |
| `Kundali_HowIsThisCalculated` | The ⓘ methodology tooltip — the strongest available "users don't trust the number" signal | [InsightInfoTooltip.tsx:158](../src/components/financial-kundali/InsightInfoTooltip.tsx#L158) |
| `Kundali_EmptyState_GetStarted` | A paid user hitting an empty report — defect signal plus recovery click | [FinancialKundali.tsx:1132](../src/pages/FinancialKundali.tsx#L1132) |

The 4 section buttons are the only signal of *which* insights paying users actually read — the highest-value untagged cluster in the product.

### P2 — churn and chat activation

| Proposed tag | Element | File |
|---|---|---|
| `Account_DeleteAccount` | "Clear Data & Delete Account" — hard deletion, currently unmeasured | [LogoutDialog.tsx:100](../src/components/LogoutDialog.tsx#L100) |
| `Account_SimpleLogout` | "Simple Log Out" | [LogoutDialog.tsx:87](../src/components/LogoutDialog.tsx#L87) |
| `AIChat_SendMessage` | Chat send — the activation event for `/ai-chat` | [AstroChat.tsx](../src/pages/AstroChat.tsx) `sendMessage` |
| `AIChat_SuggestedQuestion` | Suggested-question buttons | [AstroChat.tsx:419](../src/pages/AstroChat.tsx#L419) |
| `AIChat_CategoryFilter` | Category filter pills | [AstroChat.tsx:399](../src/pages/AstroChat.tsx#L399) |
| `AIChat_ResetChat` | Reset conversation | [AstroChat.tsx:469](../src/pages/AstroChat.tsx#L469) |
| `Homepage_ChatQuickChip` | The 3 floating-chat suggestion chips — zero-friction first message | [FloatingAstrologerChat.tsx:363](../src/components/FloatingAstrologerChat.tsx#L363) |
| `Homepage_ChatSendMessage` | Floating chat send | [FloatingAstrologerChat.tsx:377](../src/components/FloatingAstrologerChat.tsx#L377) |
| `Homepage_ChatSignInLink` | "Click here to sign in" rendered inside a chat reply for logged-out users — chat→auth handoff | [FloatingAstrologerChat.tsx:329](../src/components/FloatingAstrologerChat.tsx#L329) |

**Both chat sends must be tagged once inside `sendMessage`, not per control.** The button, the Enter key and the form `onSubmit` are three paths into the same function; tagging each would triple-count. Same hazard the chat FAB toggle already documents below.

### P3 — demand signals and secondary surfaces

| Proposed tag | Element | File |
|---|---|---|
| `VedicFinance_SampleKundali_ViewInBrowser` | Sample-report external link — high intent, and it **leaves the SPA**, so nothing downstream attributes back | [SampleKundaliViewer.tsx:124](../src/components/landing/SampleKundaliViewer.tsx#L124) |
| `VedicFinance_FAQ_<n>` | The 5 FAQ accordion triggers. Derive from the index, not the question text | [FAQ.tsx:50](../src/components/landing/FAQ.tsx#L50) |
| `VedicFinance_Nav_MoonSignBadge` | Moon-sign badge → `/kundali`; the returning paid user's re-entry click | [Navbar.tsx:222](../src/components/landing/Navbar.tsx#L222) |
| `BoostWealth_GetNotified` | "Get Notified" **writes to no backend** — analytics is the only way anyone learns it was clicked | [BoostWealth.tsx:90](../src/pages/BoostWealth.tsx#L90) |
| `Dashboard_FeatureCard_VedicTrading` | Feature card → ComingSoon; the click *is* the demand signal | [HomeNew.tsx:502](../src/pages/HomeNew.tsx#L502) |
| `Dashboard_FeatureCard_BusinessTiming` | Same | [HomeNew.tsx:533](../src/pages/HomeNew.tsx#L533) |
| `Dashboard_TryAnotherBirthChart` | Guest-path re-engagement | [HomeNew.tsx:312](../src/pages/HomeNew.tsx#L312) |
| `Dashboard_SignIn` / `Dashboard_Logout` | **One element, two meanings** — a login CTA for guests, a churn click for signed-in users. Needs two distinct tags | [HomeNew.tsx:320](../src/pages/HomeNew.tsx#L320) |
| `Profile_ViewKundali` | Return-to-report — the core repeat-usage metric | [Profile.tsx:632](../src/pages/Profile.tsx#L632) |
| `Shared_NotFound_GoHome` | Broken or expired share-link recovery. `/shared/:slug` is an acquisition surface, so its not-found rate is commercially meaningful | [SharedKundali.tsx:115](../src/pages/SharedKundali.tsx#L115) |
| `Legal_RefundPolicy_ContactSupport` | `mailto:` in "How to Request a Refund" — refund-intent signal | [RefundPolicy.tsx:68](../src/pages/RefundPolicy.tsx#L68) |

### Deliberately not tagged

Recorded so nobody re-raises them as gaps: theme switchers, sidebar collapse chevrons, mobile hamburgers and backdrop-dismiss overlays, date/time picker toggles and the AM/PM switch, carousel prev/next plus swipe and arrow-key handlers, the shared "Back" button in `LegalPageLayout`, and the non-interactive marquees (`AstroTicker`, `AstroSpecialties`).

Also deliberate: **the floating chat FAB's close is untagged on purpose.** `VedicFinance_Homepage_ChatBot` is guarded by `if (!open)` so closes are not counted as opens. It reads like a gap and is not one.

---

## Adding a new tag

1. Agree the exact name with the analytics team first. The string is a contract.
2. Import: `import analytics from "@/lib/analytics";`
3. Call it, preserving any existing handler:
   ```tsx
   onClick={() => {
     analytics({ 'gtm.text': 'Your_New_Name' });
     existingHandler();
   }}
   ```
4. For something that is **not a click** — a confirmed payment, a completed OAuth redirect, a report finishing — pass a custom event name instead of `gtm.text`, and tell the team it needs a **Custom Event** trigger rather than a Click Text one:
   ```ts
   analytics({ transaction_id, value }, 'Purchase_Confirmed');
   ```
   Do **not** reintroduce a direct `gtag()` call. See [Removed — the 8 GA4 conversions](#removed--the-8-ga4-conversions).
5. Tell the team to add the GTM trigger — every tag does nothing in **GA4** until they do.

### What happens on the first-party side

Nothing you need to do. Step 3's click was already recorded by the delegated
listener before your handler ran, and `analytics()` attaches your name to that
row — the tag appears in **/admin → Analytics** as soon as it ships, GTM trigger
or not. This is the half that works without anyone else's configuration.

Two cases where you do need to think about it:

- **Not a click** (step 4). Those go to `dataLayer` only. Filing a confirmed
  payment under a `click` verb would put a lie in the events table, so when one
  of those lands, call `queueEvent()` from `event-queue.ts` with a verb that
  describes it — and for payment specifically, don't: completion is read from
  `payment_orders`, because a client-reported purchase is forgeable.
- **Two controls with identical visible text.** The derived label is
  `tag:accessible-name`, so they collapse into one row. The hero has exactly this
  problem. Put `data-af-tag="Your_Name"` on the element to separate them.

**If the thing you want is for us only**, do not touch `analytics()` at all — its
`dataLayer` push is unconditional and there is no opt-out parameter. Call
`queueEvent()` directly and add the verb to both mirrors. See **Admin-only
behaviour signals** above for the five that already work this way, and resist
adding a `firstPartyOnly` flag to `analytics()`: a flag is a thing to remember, and
not calling the function is not.

---

## Microsoft Clarity Setup

Microsoft Clarity gives us session recordings, heatmaps and rage/dead-click insights without any code-level event work.

**On the overlap with our own dead/rage clicks:** ours are in the same Postgres as
`payment_orders` and `kundli_reports`, so they can be filtered by our internal-IP
rules and joined to whether the session paid — which is the entire reason the
first-party log exists. Clarity's cannot. The two are a cross-check, not a
duplication, and nothing in this repo affects Clarity either way: it is a GTM
page-level tag and never reads `dataLayer`.

### How it loads

Clarity loads **through GTM**, not through a snippet in `index.html`. The tag lives inside container `GTM-K8SZDDSJ` and its project ID is configured in GTM, not in this repo. Turning Clarity on or off, changing the project ID, or gating it by consent is all done in the GTM UI. The repo has zero moving parts for Clarity.

Verify it is live: DevTools → Network → filter `clarity` on any page. You should see `https://www.clarity.ms/tag/<project-id>?ref=gtm` (the `?ref=gtm` is what proves GTM is the loader), followed by `clarity.js` and a stream of `POST` beacons to `https://h.clarity.ms/collect` returning `204 No Content`.

### History — why it is not in index.html

Between Aug 24 and Aug 25 2026, Clarity was loaded twice: once by a direct snippet in `index.html` guarded by `VITE_CLARITY_PROJECT_ID`, and once again by the GTM tag inside `GTM-K8SZDDSJ`. Both fired on every pageview, producing duplicate `clarity.ms/tag/<id>` requests (one plain, one with `?ref=gtm`) and double initialisation. The direct snippet, the env var, the `injectEnvToHtml` behaviour it relied on, and the `scripts/verify-clarity.sh` helper were removed. GTM is now the single loader. If Clarity ever needs to be disabled temporarily, disable the tag inside `GTM-K8SZDDSJ` — do not add a snippet back.

### What Clarity captures

Automatically, without code changes:

- **Session recordings** — full DOM playback of user sessions
- **Heatmaps** — click, scroll and area, per URL
- **Rage clicks** — repeated clicks indicating frustration
- **Dead clicks** — clicks on non-interactive elements
- **Quick backs** — visitors leaving immediately after landing
- **Excessive scrolling** — up/down oscillation as a confusion signal

### Heatmap rendering — the marquee gotcha

Clarity reconstructs heatmap screenshots inside a headless iframe using the captured DOM plus the site's live CSS. Components that combine tripled/duplicated content with a JS-driven `translateX` marquee (and, in the worst case, `position: fixed`) can defeat that reconstruction — the tripled items lay out as a vertical stack and fill the frame, pushing the real page off-screen.

**Confirmed on `/home` (25 Aug 2026):** `src/components/landing/AstroTicker.tsx` was the primary offender. Its fixed 40px band, 21 tripled items and `animate-ticker-scroll` transform combined to hide the Hero entirely in the Clarity heatmap while still recording clicks correctly. Fix landed the same day.

**Preemptively guarded** at the same time (heatmaps not yet inspected, but pattern-match to the same failure mode):

- `src/components/landing/AstroSpecialties.tsx` — two `animate-ticker-scroll` rows (one reversed), each triplicated
- `src/components/landing/Testimonials.tsx` — **four** Framer-Motion marquees: two vertical columns on desktop (`col1Reviews` / `col2Reviews`, 12 cards each), two horizontal rows on mobile (`lg:hidden` fallback with the same data). Vertical columns are the highest-risk shape in the app — ~2160px of intrinsic height inside a single `overflow-hidden` wrapper is exactly the AstroTicker failure mode at 60× the height

The fix pattern, apply all three to any new marquee/ticker/infinite-scroll component:

- `data-clarity-mask="true"` on the outermost wrapper — Clarity blanks the region in screenshots but keeps click tracking intact. **This is the primary defense** — with the region masked, layout inside the region cannot spill into the heatmap regardless of what fails
- `data-clarity-region="<name>"` — names the region so it segments cleanly in the dashboard
- `flex-nowrap` on the tripled/duplicated strip — keeps items on one row (or one column, for vertical marquees — `flex-col flex-nowrap`) when Clarity's iframe context is incomplete
- The marquee's **inner** wrapper should have `overflow-hidden` (usually already present as `relative flex-1 overflow-hidden` or similar) — that clips the strip in real browsers

**Do not add `overflow: hidden` to the outermost wrapper as belt-and-braces.** The mask attribute already handles the Clarity case, and the outer wrapper may legitimately need to allow overflow — for example `AstroTicker` opens its zodiac-sign dropdown at `top-full` (below the 40px band), and clipping the outer wrapper hides the dropdown. This was tried on 25 Aug 2026, broke the mobile view, and had to be rolled back.

To find every current marquee at a glance:

```bash
grep -rE "animate-ticker-scroll|Framer.*animate.*x:.*-33|animate.*y:.*-33" src/
```

### Known limits — do not spend time trying to fix these

Clarity's screenshot reconstruction runs inside a headless iframe. Two categories of content are invisible to it by design; the click layer still works, only the visual overlay is empty in those regions.

- **`<canvas>` contents are not captured.** Everything drawn to a canvas — Lottie animations (`horoscope.lottie`, `scroll-down.lottie`, `shooting-star.lottie` in `Hero`, `HomeNew`, `HeroShowcase`), the interactive shader background, particle fields, starfield, neural-noise — appears as a blank rectangle in the heatmap. Clicks on the outer DOM wrapper are still recorded correctly; only the pixels are missing. Do not try to "fix" this by adding fallback DOM — it changes the visual for real users.
- **Iframe contents are not captured.** `SampleKundaliViewer` (react-pdf) and `UserKundaliViewer` (embeds `/kundali?embed=true`) will show blank rectangles where the embedded document sits. Same-origin technically, but Clarity's DOM snapshot does not traverse iframe boundaries. Clicks on the outer wrapper are tracked; clicks inside the embedded content are not.

Both are browser-level constraints, not Clarity bugs and not our bugs. Just do not build a dashboard around expecting data that will never exist inside those regions.

### Privacy & compliance

Clarity auto-masks password, credit-card and other sensitive inputs. Extra masking rules are set inside the Clarity dashboard rather than in code:

- Mask specific elements by data attribute (`data-clarity-mask="true"`)
- Block IP ranges or countries
- Wire up a cookie consent gate if/when we add one

### Verifying

1. Deploy or run `npm run dev`
2. Visit the site and navigate a few pages
3. Clarity dashboard → **Recordings** — first session should surface in 2–10 minutes; heatmaps take up to 24 hours
4. Sanity check in DevTools console: `typeof window.clarity` should return `"function"` (populated by GTM's tag)

---

## Verifying

**The code side**, no GA4 access needed:

```bash
npm run dev        # http://localhost:8080
```

F12 → Console → type `window.dataLayer`. Click things; the array grows. Each entry should carry the expected name.

Worth confirming specifically: open the chat bubble, then close it — exactly **one** `VedicFinance_Homepage_ChatBot` entry.

Also worth confirming: run birth details → auth → payment end to end. Nothing should push beyond the click tags themselves — no conversion events remain in the code.

**The delivery side:** GTM **Preview** mode is the only way to confirm a trigger actually matches. GA4 DebugView no longer helps for events, since nothing goes direct any more; only the pageview will appear.

**The first-party side**, which needs no GTM access at all. In the Network tab,
filter on `track-visit`: navigating between routes and clicking around should
produce a *handful* of requests, not one per interaction — if it is one per click,
batching is broken. Expand a request body and check the `events` array carries
`page_view` with a `from` path, and `click` with either a `tag` or a `selector`.
Closing the tab should fire one final beacon carrying `session_end`.

Then open **/admin → Analytics**. Until migration 018 and the edge functions are
deployed it renders labelled sample data; `?mockVisitors=0` shows the real
(currently failing) state instead.

```bash
npm test                 # 230 tests: analytics, event-queue, click-tracking, internal-filter, date-range, tracking-scope, tracked-pages
npm run test:functions   # 47 Deno tests: event-payload, user-agent, internal-traffic, rate-limit
npx playwright test      # 84 e2e (3 skipped until deploy), incl. admin-ranges-heatmap
npx tsc --noEmit -p tsconfig.app.json   # baseline: 4 pre-existing errors
npm run lint             # NOTE: exits 0 even on errors — read the count. Baseline is 88 problems.
```

---

## Open items — these need people, not code

**Nothing but pageviews reaches GA4.** This is now the whole dependency, not a partial one. All 31 click tags need triggers in container `GTM-K8SZDDSJ` built on `Click Text equals <name>`; until then every push lands in `dataLayer` and stops. With the 8 conversions removed, there is no longer a second route that works regardless.

**Revenue is unmeasured until `Purchase_Confirmed` exists.** Of everything waiting on the team, this is the one with a rupee value attached.

**No SPA pageview tracking *in GA4*.** `index.html` calls `gtag('config', …)` once on load, and nothing hooks route changes into the dataLayer. Every route past the landing page is missing its GA4 pageview — which also means `page_location` does **not** reliably segment the header/footer tags, contrary to the "Scope" note above. Fixable **entirely in GTM** with the built-in History Change trigger; no code change needed.

> Note: the first-party log *does* now record route changes (`RouteTracker` →
> `page_view`), so per-page numbers and drop-off are answerable in
> /admin → Analytics today. This item is specifically about GA4, where the gap
> remains.

**No `user_id` or login state in the dataLayer.** Nothing in `analytics.ts` or `auth-context.tsx` sets one, so paid and anonymous sessions cannot be distinguished in GA4 and cross-device journeys never join up.

> Note: first-party rows carry `user_id` whenever the request had a session JWT,
> and `visitor_session_summary` back-fills the rest of the session from it — so
> guest-versus-signed-in *is* separable in /admin. Cross-device still is not,
> there or in GA4.

**The first-party pipeline is deployed and collecting.** `018_visitor_events.sql` is applied and `track-visit` / `admin-user-management` are live, so `/admin → Analytics` reads real rows. The dev sample data still exists as a local fallback and is labelled as such; `?mockVisitors=0` turns it off. **Migration 019 (campaign attribution) is a separate deploy** — after `supabase db push`, redeploy both `track-visit` and `admin-user-management`, or the Campaigns table returns "Invalid action" while visits still record fine.

**`/shared/:slug` runs the full paid sidebar for anonymous visitors.** `isSharedView` hides Home/Profile/Logout, but Download PDF, Share, Chat with AI Astrologer, Boost Your Wealth and Upcoming Insights stay live for logged-out users on what is a **new-user acquisition** surface. Only download and share are instrumented, and neither carries a dimension saying the visitor was anonymous.

**`UnlockKndali_Pay99` is missing the "u"** — inconsistent with `UnlockKundali_Newhere` and `UnlockKundali_Alreadyauser` in the same list. Implemented exactly as supplied, since the GTM trigger must match. Worth confirming it was intentional.

**Possible pageview double-counting (pre-existing).** `index.html` loads a direct GA4 tag *and* the GTM container. If the container also holds a GA4 config tag for `G-WJX6J34M3S`, every pageview counts twice. Worth auditing the container.

**GTM's own click listener may overlap.** Our click tags push GTM's reserved `gtm.click`. A container with the built-in All Elements listener enabled also fires its own `gtm.click` per physical click. The two are distinguishable — ours has no `gtm.element`, and the native one's `gtm.text` is the visible label (`"Privacy Policy"`) rather than the tag (`Footer_PrivacyPolicy`) — so exact-match triggers are safe, but broad ones would catch both.

---

## Related history

**`origin/GA4-preet`** is an unmerged parallel implementation using the `react-ga4` package: direct-to-GA4, plus hooks for scroll depth, section visibility, engagement time and a global click catch-all.

**It was deliberately not merged.** It has no snippet in `index.html` and instead calls `ReactGA.initialize(import.meta.env.VITE_GA4_MEASUREMENT_ID)` in `main.tsx`. On this branch that would (a) fire nothing, because `VITE_GA4_MEASUREMENT_ID` is absent from `.env.example`, and (b) load `gtag.js` a second time, double-counting pageviews. It also collides on `src/lib/analytics.ts` with a different export shape.

Its *event design* was once ported here as the 8 `track*` helpers, but those have since been removed as unrequested, so the branches no longer line up. Its *transport* was never adopted.

Still available there if wanted later: `useScrollDepth`, `useSectionVisibility`, `useEngagementTracking`, `useUserIdentification`, and an `ai_chat_message` event.

---

## Rate limiting — why the key changed

`generate-report` capped reports at **20 per IP per hour**. Per-IP alone is the
wrong shape: an office or an Indian carrier NAT puts many people behind one
address, and 20 reports across a whole office is one busy afternoon. This
codebase already says as much in `VisitorSessions.tsx`, where a shared IP is
called "a prompt to look, not evidence".

Each caller is now limited by the best key available for them — see
[`_shared/rate-limit.ts`](../supabase/functions/_shared/rate-limit.ts):

| Caller | Key | Ceiling |
|---|---|---|
| Signed in | `user_id` from the verified JWT | 20/hr |
| Guest | `session_id` | 10/hr |
| Guest | `ip_address` | 100/hr (was 20) |
| From an office network | exempt | — |

A signed-in user is limited by their account **and nothing else**. Keeping an IP
check on top would put a whole office back on one shared budget, which is the
problem being fixed.

The office exemption reuses `internal_traffic` through the `is_internal_ip(inet)`
RPC, so exempting an office from rate limits and hiding it from the numbers are
one decision made in one place.

### The honest position on guests

There is no good key for a guest. `session_id` lives in `sessionStorage` and is
entirely client-controlled — clearing it is one line in a console. It is a speed
bump against runaway loops and honest mistakes, **not a security boundary**.
`ip_address` is the only signal the server observes and a client cannot forge, so
it stays, with a ceiling high enough that a shared network never reaches it.

Anything genuinely stronger — CAPTCHA, proof-of-work, device attestation — is a
different feature. Browser fingerprinting is off the table: the privacy policy
commits to session-scoped identifiers only.

**Still log-only.** `RATE_LIMIT_GENERATE_REPORT=enforce` turns on 429s; anything
else logs the breach and lets the request through. The log line names the rule
(`[user]`, `[session]`, `[ip]`) because "would hit ip" and "would hit user" call
for completely different responses. A week of real breach counts should set these
ceilings, not a guess.
