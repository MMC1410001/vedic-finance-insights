/**
 * Sample visitor/IP rows for previewing the admin UI in development.
 *
 * Why this exists: the IP tracking pipeline needs migration 018 applied and the
 * edge functions deployed before any real row exists, which makes the Visitors
 * panel and the kundali IP column impossible to look at while building them.
 * This fills that gap without writing anything to a database that live users
 * share.
 *
 * Three hard rules, in order of importance:
 *   1. It is stripped from production builds — `import.meta.env.DEV` is a
 *      compile-time constant, so the early return lets the bundler drop this
 *      whole module from a `vite build`.
 *   2. It requires explicit opt-in even in dev, so it never surprises anyone.
 *   3. Any UI showing it MUST label it as sample data. A preview that looks like
 *      production data is worse than no preview.
 */

import { TRACKED_PAGES } from "./tracked-pages";

/** Opt-OUT: `?mockVisitors=0` to see the real (empty) state instead. */
const FLAG_KEY = "vedicfinance:mockVisitors";

/**
 * On by default in development.
 *
 * It was opt-in via `?mockVisitors=1` at first, which meant the panel just
 * showed an error and three zeroes to anyone who did not already know the flag
 * existed — the exact situation the preview was meant to fix. This module is
 * dropped from production builds entirely, so a second gate bought nothing.
 */
export function mockVisitorsEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const param = new URLSearchParams(window.location.search).get("mockVisitors");
    if (param === "0") {
      localStorage.setItem(FLAG_KEY, "0");
      return false;
    }
    if (param === "1") {
      localStorage.removeItem(FLAG_KEY);
      return true;
    }
    return localStorage.getItem(FLAG_KEY) !== "0";
  } catch {
    // No localStorage (private window): still show the preview.
    return true;
  }
}

/**
 * This dev machine's LAN address, so the first row is recognisably "me" rather
 * than another anonymous documentation IP — it makes the column format and the
 * shared-IP panel easier to sanity-check.
 *
 * A LAN address on purpose: it is not routable, so it cannot be mistaken for a
 * real visitor's public IP or acted on. Change it freely; it is dev-only and
 * never reaches a production bundle.
 */
const THIS_MACHINE_IP = "192.168.0.63";

export interface MockVisitorSession {
  session_id: string;
  first_seen_at: string;
  last_seen_at: string;
  event_count: number;
  distinct_ips: number;
  last_ip: string | null;
  user_id: string | null;
  last_user_agent: string | null;
  events: string[];
  email: string | null;
  full_name: string | null;
  name_source: "account" | "kundali" | null;
  name_count: number;
  /** Matches an office network or internal account. Marked, never hidden. */
  internal: boolean;
}

/**
 * Deterministic 32-bit hash. Deliberately not Math.random(): the same session id
 * must produce the same IP on every reload, or the preview reshuffles under you
 * and the kundali list stops agreeing with the Visitors panel.
 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const UA = [
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
];

const SAMPLE_NAMES = [
  "Aarti Deshpande",
  "Rohit Nair",
  "Sneha Iyer",
  "Vikram Rao",
  "Meera Joshi",
  "Kabir Malhotra",
  "Ananya Bose",
  "Farhan Qureshi",
];

/** RFC 2606 reserved domain — cannot resolve, cannot belong to anyone. */
const sampleEmail = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;

const EVENT_SETS = [
  ["visit"],
  ["visit", "kundali_generated"],
  ["visit", "kundali_generated", "signed_in"],
  ["visit", "kundali_generated", "payment_started"],
];

/**
 * Build sample sessions for the given kundali session ids, so the IP column in
 * the kundali list joins to something.
 *
 * Uses documentation/test ranges only (TEST-NET-2 198.51.100.0/24 and TEST-NET-3
 * 203.0.113.0/24, RFC 5737) so a sample row can never be mistaken for, or acted
 * on as, a real address.
 */
export function mockVisitorSessions(sessionIds: string[]): {
  sessions: MockVisitorSession[];
  summary: {
    distinct_ips_24h: number;
    shared_ips: { ip: string; user_count: number; emails: string[] }[];
  };
} {
  const ids = sessionIds.filter(Boolean).slice(0, 60);
  const now = Date.now();

  const sessions: MockVisitorSession[] = ids.map((session_id, i) => {
    const h = hash(session_id);
    // Row 0 is this machine, so there is always one row whose origin is obvious.
    if (i === 0) {
      return {
        session_id,
        first_seen_at: new Date(now - 2 * 3600 * 1000).toISOString(),
        last_seen_at: new Date(now - 4 * 60 * 1000).toISOString(),
        event_count: 4,
        distinct_ips: 1,
        last_ip: THIS_MACHINE_IP,
        user_id: null,
        last_user_agent: UA[2],
        events: ["visit", "kundali_generated"],
        email: null,
        full_name: SAMPLE_NAMES[0],
        name_source: "kundali",
        // Two names on one session, so the "+1" path is visible in the preview.
        name_count: 2,
        // This row is the developer's own machine, so it is internal by
        // definition — and it makes the badge visible in the preview.
        internal: true,
      };
    }
    // Every 7th session is forced onto one shared address so the
    // "IPs with 2+ accounts" panel has something to show.
    const shared = i % 7 === 3;
    const ip = shared ? "203.0.113.42" : `198.51.100.${(h % 200) + 10}`;
    const signedIn = h % 3 !== 0;
    const lastSeen = now - (h % (36 * 3600 * 1000));
    const firstSeen = lastSeen - ((h % 9) + 1) * 3600 * 1000;
    const name = SAMPLE_NAMES[h % SAMPLE_NAMES.length];
    // One guest in five has no kundali, so the "—" state shows up too.
    const guestHasName = !signedIn && h % 5 !== 0;

    return {
      session_id,
      first_seen_at: new Date(firstSeen).toISOString(),
      last_seen_at: new Date(lastSeen).toISOString(),
      event_count: (h % 5) + 1,
      distinct_ips: h % 11 === 0 ? 2 : 1,
      last_ip: ip,
      // A stable fake uuid — never a real auth.users id. Derived from the name
      // index, not the raw hash, so one identity maps to exactly one account:
      // otherwise two rows could share an email under different user_ids, which
      // real accounts cannot do, and the shared-IP panel would report a higher
      // account count than the number of emails it can name.
      user_id: signedIn
        ? `00000000-0000-4000-8000-${String(h % SAMPLE_NAMES.length).padStart(12, "0")}`
        : null,
      last_user_agent: UA[h % UA.length],
      events: EVENT_SETS[h % EVENT_SETS.length],
      email: signedIn ? sampleEmail(name) : null,
      full_name: signedIn || guestHasName ? name : null,
      name_source: signedIn ? "account" : guestHasName ? "kundali" : null,
      name_count: signedIn || guestHasName ? 1 : 0,
      // Every 6th row internal, so both the badged and unbadged states are
      // visible without needing real office traffic.
      internal: h % 6 === 0,
    };
  });

  const distinct = new Set(sessions.map((s) => s.last_ip).filter(Boolean));
  const onSharedIp = sessions.filter((s) => s.last_ip === "203.0.113.42" && s.user_id);
  const sharedUsers = new Set(onSharedIp.map((s) => s.user_id));
  const sharedEmails = [...new Set(onSharedIp.map((s) => s.email).filter(Boolean))] as string[];

  return {
    sessions,
    summary: {
      distinct_ips_24h: distinct.size,
      shared_ips:
        sharedUsers.size > 1
          ? [{ ip: "203.0.113.42", user_count: sharedUsers.size, emails: sharedEmails.sort() }]
          : [],
    },
  };
}

// ── Analytics dashboard preview ──────────────────────────────────────────────
// Same three rules as above: dropped from production builds, opt-out flag
// respected, and the UI that renders it must say it is sample data.
//
// Deterministic like the session mock, and for the same reason: a dashboard whose
// funnel reshuffles on every reload is impossible to lay out against.

/**
 * Paths the real app actually has, so the pages table looks like the product.
 *
 * The whole catalogue, in catalogue order — which is already roughly descending
 * by expected traffic (entry routes first, legal pages last), so the view counts
 * below can decay with the index and produce a realistic long tail rather than
 * six tidy rows.
 *
 * It used to be six hardcoded paths filtered out of the catalogue, which is why
 * the footer pages (/terms, /privacy, /disclaimer, /refund-policy) never appeared
 * in the preview's pages table. They were tracked all along — Footer.tsx reaches
 * them with a react-router <Link>, so RouteTracker records a page_view, and the
 * pages CTE in migration 018 groups every path it finds with no allow-list. Only
 * the mock was hiding them.
 */
const MOCK_PATHS = TRACKED_PAGES.map((p) => p.path);

/** Device classes, and their share of traffic. Matches the devices block below. */
const DEVICE_SHARE: Record<string, number> = { mobile: 0.68, desktop: 0.27, tablet: 0.05 };

/**
 * The width each band is previewed at — must match DEVICE_WIDTH in ClickHeatmap.
 * Only used to derive a believable page height for the sample y_px depths.
 */
const DEVICE_WIDTH_PX: Record<string, number> = { mobile: 390, tablet: 834, desktop: 1440 };

/**
 * What fraction of a page's sampled clicks each kind accounts for.
 *
 * **The one source of truth for that question**, read by both
 * `mockAnalytics().click_map_paths` and `mockClickMap()` — same reason
 * mockPointCount() is shared. When the picker and the canvas answered
 * independently they disagreed, and the panel contradicted itself on screen.
 */
const KIND_SHARE: Record<string, number> = { click: 1, dead: 0.12, rage: 0.03 };

/**
 * Below this, a path+device reports nothing at all.
 *
 * Not arbitrary: coordinates are a 25% sample (COORD_SAMPLE_RATE), so a page with
 * a handful of visits on one device genuinely produces no rows. It also
 * guarantees the tail of the catalogue reports zero, which the picker and the
 * empty-state overlay both need to render — mocking only populated pages is what
 * left that branch untested.
 */
const MIN_POINTS = 6;

/**
 * How many click coordinates the mock has for a path on a device.
 *
 * **The one source of truth for that question in the preview**, read by both
 * `mockAnalytics().click_map_paths` and `mockClickMap()`.
 *
 * They used to answer it independently, and disagreed: click_map_paths listed six
 * paths, so the picker printed "(no samples)" for /disclaimer — and mockClickMap
 * then fabricated a full 40x40 grid for it anyway, so the badge beside that label
 * read "2,087 clicks". The panel contradicted itself on screen, which is worse
 * than either number being wrong.
 *
 * Per device because migration 018 groups click_map_paths by path AND device,
 * matching admin_click_map's own device filter — and now per KIND as well, for the
 * same reason: the heatmap can map dead clicks, so a count that summed both kinds
 * would sit beside a canvas drawing one.
 */
export function mockPointCount(
  path: string,
  device: string | null,
  kind: string = "click",
): number {
  const index = MOCK_PATHS.indexOf(path);
  if (index < 0) return 0;

  const kindShare = KIND_SHARE[kind];
  if (kindShare === undefined) return 0;

  // Decays with catalogue position: ~2,400 for the entry route down to single
  // digits for the legal pages. Steep enough that the tail crosses MIN_POINTS on
  // *mobile* too, not only on tablet — mobile is the default device, so a decay
  // that left every page populated there put the empty state one device-switch
  // away from ever being seen. Production starts with every page empty.
  const base = Math.round(2400 * Math.pow(0.75, index));

  if (device === null) {
    // No device means every bucket, which is the sum — not a fourth value.
    return Object.keys(DEVICE_SHARE).reduce(
      (sum, d) => sum + mockPointCount(path, d, kind),
      0,
    );
  }

  const share = DEVICE_SHARE[device];
  if (share === undefined) return 0;

  // MIN_POINTS is applied to the CLICK volume, not to each kind, so a page that
  // reports clicks also reports its (much smaller) dead and rage counts. Gating
  // each kind separately would have left the dead-click canvas empty on every page
  // that was not extremely busy — which is the state that hid the problem.
  const points = Math.round(base * share);
  if (points < MIN_POINTS) return 0;
  return Math.max(1, Math.round(points * kindShare));
}

/** A representative slice of the 33 real GTM tag names. */
const MOCK_TAGS = [
  "VedicFinance_Unlockyourkundali_1",
  "Signup_Continuewithgoogle",
  "UnlockKndali_Pay99",
  "Header_FAQ",
  "Kundali_DownloadPDF",
  "VedicFinance_Homepage_ChatBot",
  "Footer_PrivacyPolicy",
  "Kundali_ShareKundali",
];

export function mockAnalytics(
  range: { from: Date; to: Date } = { from: new Date(Date.now() - 30 * 86_400_000), to: new Date() },
  excludeInternal = true,
) {
  // Whole days spanned, so the sample series matches whatever window is asked
  // for — including Today, which must produce exactly one bar rather than 30.
  const days = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000),
  );
  const seed = (key: string) => hash(`analytics:${key}`);

  // A funnel that narrows, because one that does not would hide a layout bug in
  // the chart — each step has to be smaller than the one above it.
  // Internal traffic makes the numbers larger when it is NOT filtered out. The
  // two modes must differ, or the toggle appears to do nothing in dev — which is
  // precisely when someone is checking whether it works.
  const internalSessions = 214;
  const sessions = 900 + (seed("sessions") % 300) + (excludeInternal ? 0 : internalSessions);
  const kundali = Math.round(sessions * 0.42);
  const signedIn = Math.round(kundali * 0.55);
  const payStarted = Math.round(signedIn * 0.38);
  const completed = Math.round(payStarted * 0.61);

  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(range.to.getTime() - (days - 1 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const n = seed(day);
    return {
      day,
      sessions: 20 + (n % 25),
      views: 55 + (n % 70),
      kundalis: 6 + (n % 12),
      signins: 3 + (n % 7),
      payments: n % 5,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    days,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    funnel: {
      sessions,
      kundali_generated: kundali,
      signed_in: signedIn,
      payment_started: payStarted,
      payment_completed: completed,
      paying_users: completed,
      revenue: completed * 99,
    },
    guest_to_google: {
      generated_as_guest: kundali,
      then_signed_in: signedIn,
      already_signed_in: Math.round(kundali * 0.18),
    },
    payment: {
      clicks: payStarted + 40,
      sessions: payStarted,
      orders: payStarted,
      completed,
      failed: Math.round(payStarted * 0.12),
      expired: payStarted - completed - Math.round(payStarted * 0.12),
      pending: 3,
      revenue: completed * 99,
    },
    engagement: {
      sessions,
      avg_seconds: 142.6,
      median_seconds: 96.4,
      bounce_pct: 38.2,
      views_per_session: 3.14,
      identified: signedIn,
      anonymous: sessions - signedIn,
    },
    pages: MOCK_PATHS.map((path, i) => {
      const n = seed(path);
      // Geometric decay rather than the old linear `400 - i * 55`, which went
      // negative from the eighth page on and would have printed negative views
      // now that the catalogue supplies all 21.
      const views = Math.max(2, Math.round(430 * Math.pow(0.82, i)) + (n % 25));
      const exits = Math.round(views * (0.15 + (n % 30) / 100));
      return {
        path,
        views,
        sessions: Math.max(1, Math.round(views * 0.72)),
        avg_seconds: 20 + (n % 90),
        exits,
        exit_pct: Number(((exits / views) * 100).toFixed(1)),
      };
    }),
    events: MOCK_TAGS.map((label, i) => {
      const n = seed(label);
      return {
        label,
        tagged: true,
        clicks: 320 - i * 32 + (n % 25),
        sessions: 210 - i * 22 + (n % 18),
        users: 90 - i * 9 + (n % 10),
      };
    }).concat([
      // One untagged row, because the real table will always have them and the
      // UI has to show that they are different from a named tag.
      { label: "button:Continue", tagged: false, clicks: 74, sessions: 61, users: 22 },
    ]),
    devices: [
      { device: "mobile", sessions: Math.round(sessions * 0.68) },
      { device: "desktop", sessions: Math.round(sessions * 0.27) },
      { device: "tablet", sessions: Math.round(sessions * 0.05) },
    ],
    browsers: [
      { browser: "Chrome", sessions: Math.round(sessions * 0.61) },
      { browser: "Safari", sessions: Math.round(sessions * 0.28) },
      { browser: "Firefox", sessions: Math.round(sessions * 0.07) },
      { browser: "Edge", sessions: Math.round(sessions * 0.04) },
    ],
    sources: [
      { source: "direct", sessions: Math.round(sessions * 0.44) },
      { source: "organic", sessions: Math.round(sessions * 0.31) },
      { source: "social", sessions: Math.round(sessions * 0.19) },
      { source: "referral", sessions: Math.round(sessions * 0.06) },
    ],
    daily,
    // One row per path+device, and rows with no points are OMITTED — exactly what
    // the SQL does, because it groups over click_points and a path with no rows
    // cannot produce one. The picker therefore has to treat "absent" as zero in
    // dev the same way it must in production.
    click_map_paths: MOCK_PATHS.flatMap((path) =>
      Object.keys(DEVICE_SHARE).flatMap((device) =>
        // One row per kind as well, matching the SQL's `group by path, class, kind`.
        // Dead clicks are a fraction of real ones and rage clicks a fraction of
        // those, which is the shape the panel has to lay out against — and it makes
        // the kind toggle reachable in dev.
        Object.keys(KIND_SHARE)
          .map((kind) => ({
            path,
            device,
            kind,
            points: mockPointCount(path, device, kind),
          }))
          .filter((row) => row.points > 0),
      ),
    ),
    // ── Admin-only behaviour signals ──
    // Mocked for the same reason as everything above: without these the five new
    // cards render their empty states in dev and there is no way to lay them out.
    // Deterministic, and labelled as sample data by the panel that shows them.
    scroll_depth: MOCK_PATHS.map((path, i) => {
      const n = seed(`scroll:${path}`);
      const sessions = Math.max(3, Math.round(320 * Math.pow(0.84, i)) + (n % 20));
      // A decay that is steeper on some pages than others, so the warn threshold
      // on the 100% column is reachable in the preview.
      const d25 = Math.round(sessions * (0.62 + (n % 20) / 100));
      const d50 = Math.round(d25 * (0.55 + (n % 25) / 100));
      const d75 = Math.round(d50 * (0.5 + (n % 30) / 100));
      const d100 = Math.round(d75 * (0.3 + (n % 40) / 100));
      const p = (v: number) => Number(((v / sessions) * 100).toFixed(1));
      return {
        path,
        sessions,
        d25,
        d50,
        d75,
        d100,
        d25_pct: p(d25),
        d50_pct: p(d50),
        d75_pct: p(d75),
        d100_pct: p(d100),
      };
    }),
    cta_funnel: MOCK_TAGS.map((tag, i) => {
      const n = seed(`cta:${tag}`);
      const seenSessions = 640 - i * 58 + (n % 40);
      const clickedSessions = Math.round(seenSessions * (0.03 + (n % 12) / 100));
      return {
        tag,
        seen_sessions: seenSessions,
        clicks: Math.round(clickedSessions * 1.2),
        clicked_sessions: clickedSessions,
        ctr: Number(((clickedSessions / seenSessions) * 100).toFixed(1)),
      };
    }).concat([
      // Clicked but never recorded as seen — the full-outer-join case, and the one
      // that renders a dash rather than a rate.
      { tag: "Kundali_ShareKundali", seen_sessions: 0, clicks: 14, clicked_sessions: 11, ctr: null },
    ]),
    friction: MOCK_PATHS.slice(0, 6).flatMap((path) => {
      const n = seed(`friction:${path}`);
      return [
        {
          kind: "dead" as const,
          path,
          selector: "div:#hero-copy",
          events: 40 + (n % 60),
          sessions: 20 + (n % 30),
        },
        {
          kind: "rage" as const,
          path,
          selector: "button:Unlock your Kundali",
          events: 4 + (n % 9),
          sessions: 3 + (n % 6),
        },
      ];
    }),
    // One form, its fields in the order the real one presents them, decaying — the
    // shape the card is laid out against.
    form_fields: ["full_name", "birth_date", "birth_time", "birth_place"].map(
      (field, i) => ({
        form: "birth-details",
        field,
        sessions: Math.round(480 * Math.pow(0.72, i)),
        position: i + 1,
      }),
    ),
    exit_clicks: MOCK_TAGS.slice(0, 6).map((label, i) => {
      const n = seed(`exit:${label}`);
      const sessions = 90 - i * 12 + (n % 10);
      return {
        label,
        path: MOCK_PATHS[i % MOCK_PATHS.length],
        sessions,
        // A minority converted, so both readings of the column are visible.
        converted: Math.round(sessions * (0.05 + (n % 25) / 100)),
      };
    }),
    internal: {
      excluded: excludeInternal,
      // Reported whether or not the filter is on, matching admin_analytics().
      // The panel has to be able to say "214 hidden" and "214 included" — if the
      // mock only supplied it in one mode, the other branch would go untested.
      sessions_matched: internalSessions,
      networks_active: 3,
      accounts_active: 6,
    },
  };
}

// ── Campaigns preview ────────────────────────────────────────────────────────
// Same three rules again: dropped from production builds, opt-out flag
// respected, and CampaignsPanel labels it as sample data.
//
// Every row here exists to make one branch of the funnel reachable without
// running a real campaign. Keep that in mind before "tidying" the numbers:
//
//   whatsapp/message   two creatives of one campaign, one clearly better
//   instagram/story    story-1 vs story-2: near-identical reach, a third of the
//                      outcome — the comparison utm_content exists to make
//   google/cpc         a <25% drop at one step, so the warn colour appears, and
//                      the only row with no creative, so '(none)' is exercised
//   instagram/story    2026-07-launch: revenue with ZERO in-window sessions —
//                      the full-outer-join row, which is the only way to see
//                      the empty-top-half note and the second group carrying
//                      the whole story
//   direct             excluded from the funnel, present in the table
//   (pre-attribution)  paid users with no first touch, likewise
//
// Values are literals rather than seeded arithmetic: the funnel is read by eye
// against the table beside it, and a reviewer needs to be able to check the two
// agree without recomputing a hash.

interface MockCampaignRow {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  sessions: number;
  kundali_generated: number;
  signed_in: number;
  payment_started: number;
  signed_up_users: number;
  paid_users: number;
  revenue: number;
}

const MOCK_CAMPAIGN_ROWS: MockCampaignRow[] = [
  // ── One campaign, four creatives ──
  // The preview's headline case. story-1 earns and story-2 does not, off almost
  // the same session count — which is the comparison a campaign is run to make
  // and is invisible if the creatives are read as one row.
  {
    source: "whatsapp", medium: "message", campaign: "2026-09-diwali-kundali", content: "broadcast-1",
    sessions: 486, kundali_generated: 214, signed_in: 96, payment_started: 31,
    signed_up_users: 96, paid_users: 19, revenue: 1881,
  },
  {
    source: "whatsapp", medium: "message", campaign: "2026-09-diwali-kundali", content: "broadcast-2",
    sessions: 402, kundali_generated: 121, signed_in: 44, payment_started: 12,
    signed_up_users: 44, paid_users: 6, revenue: 594,
  },
  {
    source: "instagram", medium: "story", campaign: "2026-09-diwali-kundali", content: "story-1",
    sessions: 352, kundali_generated: 148, signed_in: 61, payment_started: 19,
    signed_up_users: 61, paid_users: 11, revenue: 1089,
  },
  {
    // Nearly the same reach as story-1 and a third of the outcome. The row that
    // makes the case for tagging utm_content at all.
    source: "instagram", medium: "story", campaign: "2026-09-diwali-kundali", content: "story-2",
    sessions: 338, kundali_generated: 74, signed_in: 22, payment_started: 5,
    signed_up_users: 22, paid_users: 3, revenue: 297,
  },
  {
    source: "instagram", medium: "bio", campaign: "2026-09-diwali-kundali", content: "bio-link",
    sessions: 94, kundali_generated: 38, signed_in: 17, payment_started: 6,
    signed_up_users: 17, paid_users: 4, revenue: 396,
  },
  {
    // 44 of 213 is 20.7% — under the 25% threshold, so the drop-off warning is
    // visible in the preview without anyone having to engineer one. Also the
    // only row with no creative, so the '(none)' rendering path is exercised.
    source: "google", medium: "cpc", campaign: "2026-08-search-brand", content: "(none)",
    sessions: 213, kundali_generated: 44, signed_in: 21, payment_started: 4,
    signed_up_users: 21, paid_users: 2, revenue: 198,
  },
  {
    // The row the FULL OUTER JOIN in admin_campaigns exists for: its clicks
    // happened before this window, and it is still earning. Reaching this state
    // with real data means waiting weeks, which is why it is mocked.
    source: "instagram", medium: "story", campaign: "2026-07-launch", content: "story-3",
    sessions: 0, kundali_generated: 0, signed_in: 0, payment_started: 0,
    signed_up_users: 0, paid_users: 4, revenue: 396,
  },
  {
    source: "direct", medium: "(none)", campaign: "(none)", content: "(none)",
    sessions: 1240, kundali_generated: 402, signed_in: 151, payment_started: 44,
    signed_up_users: 0, paid_users: 0, revenue: 0,
  },
  {
    source: "(pre-attribution)", medium: "(pre-attribution)",
    campaign: "(pre-attribution)", content: "(pre-attribution)",
    sessions: 0, kundali_generated: 0, signed_in: 0, payment_started: 0,
    signed_up_users: 0, paid_users: 27, revenue: 2673,
  },
];

/** Internal sessions, added to the top campaign when the filter is OFF. */
const MOCK_CAMPAIGN_INTERNAL = 214;

export function mockCampaigns(
  range: { from: Date; to: Date } = { from: new Date(Date.now() - 30 * 86_400_000), to: new Date() },
  excludeInternal = true,
) {
  // The two modes must differ, for the same reason mockAnalytics makes them
  // differ: a toggle that changes nothing in dev looks broken exactly when
  // someone is checking whether it works. Office traffic lands on the campaign
  // the team clicks through while testing, so it goes on the first row.
  const campaigns = MOCK_CAMPAIGN_ROWS.map((row, i) =>
    i === 0 && !excludeInternal
      ? {
          ...row,
          sessions: row.sessions + MOCK_CAMPAIGN_INTERNAL,
          kundali_generated: row.kundali_generated + Math.round(MOCK_CAMPAIGN_INTERNAL * 0.6),
          signed_in: row.signed_in + Math.round(MOCK_CAMPAIGN_INTERNAL * 0.3),
        }
      : row,
  );

  const tagged = campaigns.filter(
    (r) => r.source !== "direct" && r.source !== "(pre-attribution)",
  );

  // Derived, never hand-written: the cards above the table and the funnel below
  // it would otherwise be free to disagree, which is the class of bug the mock
  // is supposed to help find rather than introduce.
  const bySource = new Map<string, { sessions: number; revenue: number }>();
  for (const row of campaigns) {
    const entry = bySource.get(row.source) ?? { sessions: 0, revenue: 0 };
    entry.sessions += row.sessions;
    entry.revenue += row.revenue;
    bySource.set(row.source, entry);
  }

  return {
    generated_at: new Date().toISOString(),
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    campaigns: [...campaigns].sort((a, b) => b.sessions - a.sessions || b.revenue - a.revenue),
    sources: [...bySource.entries()]
      .map(([source, v]) => ({ source, sessions: v.sessions, revenue: v.revenue }))
      .sort((a, b) => b.sessions - a.sessions),
    totals: {
      tagged_sessions: tagged.reduce((sum, r) => sum + r.sessions, 0),
      untagged_sessions: campaigns
        .filter((r) => r.source === "direct")
        .reduce((sum, r) => sum + r.sessions, 0),
      unattributed_paid_users: campaigns
        .filter((r) => r.source === "(pre-attribution)")
        .reduce((sum, r) => sum + r.paid_users, 0),
    },
    internal: {
      excluded: excludeInternal,
      sessions_matched: MOCK_CAMPAIGN_INTERNAL,
      networks_active: 3,
      accounts_active: 6,
    },
  };
}

// ── Audience preview ─────────────────────────────────────────────────────────
// Shaped so every branch of AudiencePanel is reachable: more than three devices
// and more than three operating systems, so the pies exercise their "Other"
// slice and the bar lists show a tail the pie cannot; a non-zero `unknown` so
// the pre-019 caveat renders; and both tagged and referrer-derived sources.

export function mockAudience(excludeInternal = true) {
  const internal = excludeInternal ? 0 : MOCK_CAMPAIGN_INTERNAL;
  const sessions = 1885 + internal;

  // The last bucket takes the remainder rather than its own rounded share, so
  // every split sums to `sessions` exactly. Rounding each share independently
  // left devices totalling 1,886 against 1,885 sessions — a one-row discrepancy
  // that is meaningless in sample data and reads as a real bug to anyone
  // checking the panel's arithmetic.
  const split = (shares: [string, number][]) => {
    const rows = shares.slice(0, -1).map(([label, share]) => ({
      label,
      sessions: Math.round(sessions * share),
    }));
    const used = rows.reduce((sum, r) => sum + r.sessions, 0);
    return [...rows, { label: shares[shares.length - 1][0], sessions: sessions - used }];
  };

  const devices = split([
    ["mobile", 0.62],
    ["desktop", 0.29],
    ["tablet", 0.07],
    ["unknown", 0.02],
  ]);

  const os = split([
    ["Android", 0.48],
    ["Windows", 0.27],
    ["iOS", 0.14],
    ["Macintosh", 0.08],
    ["Linux", 0.03],
  ]);

  return {
    generated_at: new Date().toISOString(),
    visitors: {
      new: 1204 + internal,
      returning: 412,
      // Non-zero on purpose: the caveat about pre-019 sessions has to be visible.
      unknown: 269,
      identified: 1616,
    },
    engagement: {
      sessions,
      engaged: Math.round(sessions * 0.436),
      engagement_rate: 43.6,
      avg_seconds: 131.4,
    },
    devices,
    os,
    source_medium: [
      { source: "(direct)", medium: "(none)", tagged: false, sessions: 812 },
      { source: "whatsapp", medium: "message", tagged: true, sessions: 486 },
      { source: "instagram", medium: "story", tagged: true, sessions: 352 },
      { source: "google.com", medium: "organic", tagged: false, sessions: 121 },
      { source: "instagram", medium: "bio", tagged: true, sessions: 94 },
      { source: "l.facebook.com", medium: "social", tagged: false, sessions: 20 },
    ],
    // Deliberately lopsided: this is what carrier NAT actually produces, and a
    // tidy spread would hide the very caveat the panel is trying to make.
    cities: [
      { city: "Mumbai", region: "Maharashtra", country: "IN", sessions: 1182 },
      { city: "Pune", region: "Maharashtra", country: "IN", sessions: 173 },
      { city: "Thane", region: "Maharashtra", country: "IN", sessions: 96 },
      { city: "Nagpur", region: "Maharashtra", country: "IN", sessions: 61 },
      { city: "Bengaluru", region: "Karnataka", country: "IN", sessions: 48 },
      { city: "Lucknow", region: "Uttar Pradesh", country: "IN", sessions: 34 },
      { city: "Dubai", region: "Dubai", country: "AE", sessions: 12 },
    ],
    geo_available: true,
    geo_sessions: 1606,
    geo_cached_ips: 214,
    // The preview shows the resolved case; the two empty states are covered by
    // audience-panel.test.tsx rather than by toggling this.
    geo_configured: true,
    // Both providers present, because a blended cache is the realistic state
    // once the chain has ever fallen back.
    geo_sources: [
      { source: "ipinfo", addresses: 186 },
      { source: "ipwho", addresses: 28 },
    ],
  };
}

/**
 * Sample internal-traffic rules, so the management card is developable before
 * migration 018 is applied. Uses the RFC 5737 documentation ranges rather than
 * the real office addresses — a sample row must never be something an operator
 * could act on by mistake.
 */
export function mockInternalTraffic() {
  return [
    { id: "mock-net-1", kind: "network", network: "198.51.100.10/32", user_id: null, email: null,
      label: "Vikhroli", note: "SAMPLE: Tata Teleservices", enabled: true, created_at: new Date().toISOString() },
    { id: "mock-net-2", kind: "network", network: "198.51.100.11/32", user_id: null, email: null,
      label: "Vikhroli", note: "SAMPLE, Satellite Netcom", enabled: true, created_at: new Date().toISOString() },
    { id: "mock-net-3", kind: "network", network: "203.0.113.0/24", user_id: null, email: null,
      label: "Goregaon", note: "SAMPLE, range", enabled: false, created_at: new Date().toISOString() },
    { id: "mock-acc-1", kind: "account", network: null, user_id: "mock-user-1",
      email: "sample.one@example.com", label: "Team", note: "SAMPLE", enabled: true, created_at: new Date().toISOString() },
    { id: "mock-acc-2", kind: "account", network: null, user_id: "mock-user-2",
      email: "sample.two@example.com", label: "Team", note: "SAMPLE", enabled: true, created_at: new Date().toISOString() },
  ];
}

/** Mirrors ClickMap in src/components/admin/ClickHeatmap.tsx. */
export interface MockClickMap {
  path: string;
  device: string | null;
  kind: string;
  total: number;
  cells: { x: number; y: number; y_px: number; n: number }[];
  max_n: number;
  median_doc_h: number | null;
}

/**
 * Sample heatmap cells — a **test card**, not a plausible heatmap.
 *
 * It used to be three soft blobs placed roughly where a hero CTA, a nav and a
 * footer link sit, plus sparse noise. That was the reported defect: it looked
 * exactly like real user behaviour, it was identical on all 21 pages, and the
 * panel drew it with no sample-data caption whenever the overview payload was
 * real. Someone reading it concluded that visitors were clicking regions of the
 * page that hold no elements at all.
 *
 * So the shape is now deliberately artificial: a regular lattice with a diagonal
 * through it. It still exercises everything the renderer needs — a colour ramp
 * with a real maximum, overlapping blobs, a sparse tail, the "densest spots"
 * list — while being impossible to mistake for a person's clicks. Paired with
 * the SAMPLE DATA watermark in ClickHeatmap's paint().
 *
 * The total is **not** whatever the shape happens to add up to. It is exactly
 * mockPointCount(), distributed over the cells — so the badge above the canvas,
 * the number in the picker, and the drawn points are one figure seen three ways.
 *
 * A path+device with no points returns no cells at all, which is what makes the
 * "No sampled clicks for …" overlay reachable in dev.
 */
export function mockClickMap(
  path: string,
  device: string | null,
  kind: string = "click",
): MockClickMap {
  const target = mockPointCount(path, device, kind);
  if (target === 0) {
    // Explicitly typed rather than inferred: an inferred `cells: never[]` here and
    // a populated `cells` below make the return a union, and callers then cannot
    // reduce over cells without narrowing first.
    return { path, device, kind, total: 0, cells: [], max_n: 0, median_doc_h: null };
  }

  // Pass 1 — the SHAPE only. These are relative weights, not click counts.
  const shape: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < 40; i++) {
    for (let j = 0; j < 40; j++) {
      const x = (i + 0.5) / 40;
      const y = (j + 0.5) / 40;
      let w = 0;

      // A lattice every 8th cell: evenly spaced, which no real page produces.
      if (i % 8 === 4 && j % 8 === 4) w += 40;
      // A diagonal, so the ramp has a mid-range band and the "densest spots"
      // list is not 6 identical rows.
      if (Math.abs(i - j) <= 1) w += 12;
      // A regular border, so edge clamping is visible.
      if (i === 0 || i === 39 || j === 0 || j === 39) w += 3;

      if (w > 0) shape.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), w });
    }
  }

  // Pass 2 — hand out exactly `target` clicks by largest remainder, so the cells
  // sum to the target with no drift. Rounding each cell independently would miss
  // by tens, and then the badge and the picker would disagree again.
  const totalWeight = shape.reduce((sum, c) => sum + c.w, 0);
  const quotas = shape.map((c) => {
    const exact = (target * c.w) / totalWeight;
    const whole = Math.floor(exact);
    return { x: c.x, y: c.y, n: whole, remainder: exact - whole };
  });

  let left = target - quotas.reduce((sum, c) => sum + c.n, 0);
  // Ties broken by position, not by iteration order, so the result is stable.
  const byRemainder = [...quotas].sort(
    (a, b) => b.remainder - a.remainder || a.y - b.y || a.x - b.x,
  );
  for (const cell of byRemainder) {
    if (left <= 0) break;
    cell.n += 1;
    left -= 1;
  }

  /**
   * A plausible page height for the band, so the preview exercises the SAME code
   * path production uses — admin_click_map returns absolute y_px depths, and the
   * renderer prefers them over the fraction. A mock that only emitted fractions
   * would leave the pixel branch untested in the one place it is easy to look at.
   */
  const docHeight = Math.round((DEVICE_WIDTH_PX[device ?? "mobile"] ?? 390) * 5.2);

  const cells = quotas
    .filter((c) => c.n > 0)
    .map(({ x, y, n }) => ({
      x,
      y,
      // Snapped to the same 24px bands the SQL uses, so the two agree on what a
      // cell centre is.
      y_px: Math.floor((y * docHeight) / 24) * 24 + 12,
      n,
    }))
    .sort((a, b) => b.n - a.n);

  return {
    path,
    device,
    kind,
    total: cells.reduce((sum, c) => sum + c.n, 0),
    cells,
    max_n: cells.reduce((max, c) => Math.max(max, c.n), 0),
    median_doc_h: docHeight,
  };
}
