/**
 * The pages analytics knows about, with a human name for each.
 *
 * One list, because three places used to decide independently which pages
 * existed and they had already drifted: click-tracking.ts sampled coordinates on
 * five paths, the heatmap picker showed only paths that already had rows (so a
 * page with no data yet was indistinguishable from a page that does not exist),
 * and the dev mock listed six in one field and three in another.
 *
 * The label matters as much as the path. `/auth` and `/kundali-auth` are both
 * sign-in screens and cannot be told apart from their paths in a dropdown, and
 * "Checkout" reads faster than "/payment" when you are looking for it.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 * `/admin` — trackingSuppressed() refuses to record it at all; operating the
 *            panel is us looking at the data.
 * `/app`   — a <Navigate>, not a page.
 * `*`      — the 404 route.
 * `/shared/:slug` — present, but only in its normalised form. See
 *            normalisePath() below for why the raw path must never be stored.
 */

export interface TrackedPage {
  path: string;
  label: string;
}

export const TRACKED_PAGES: readonly TrackedPage[] = [
  { path: "/", label: "Splash" },
  { path: "/home", label: "Landing" },
  { path: "/auth", label: "Sign in / Sign up" },
  { path: "/kundali-auth", label: "Sign in (from Kundali)" },
  { path: "/payment", label: "Checkout" },
  { path: "/kundali", label: "Financial Kundali" },
  { path: "/profile", label: "Profile & history" },
  { path: "/ai-chat", label: "AI Astrologer" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/chat", label: "Chat" },
  { path: "/business-timing", label: "Business timing" },
  { path: "/vedic-trading", label: "Vedic trading" },
  { path: "/boost-wealth", label: "Boost wealth" },
  { path: "/upcoming-features", label: "Upcoming features" },
  { path: "/services", label: "Services" },
  { path: "/coming-soon", label: "Coming soon" },
  { path: "/shared/:slug", label: "Shared kundali" },
  { path: "/privacy", label: "Privacy policy" },
  { path: "/terms", label: "Terms" },
  { path: "/disclaimer", label: "Disclaimer" },
  { path: "/refund-policy", label: "Refund policy" },
] as const;

const LABELS: Map<string, string> = new Map(TRACKED_PAGES.map((p) => [p.path, p.label]));

/** Human name for a path, falling back to the path itself for anything unknown. */
export function pageLabel(path: string): string {
  return LABELS.get(path) ?? path;
}

/**
 * Dynamic routes, collapsed to one bucket each.
 *
 * `/shared/abc123` and `/shared/def456` are the same *page* — one per shared
 * kundali. Stored raw, they would put one row in the pages table and one entry in
 * the heatmap picker for every share ever created, and a heatmap of a single
 * visitor's link is not a heatmap of anything. Collapsed here, at record time,
 * because the rows cannot be separated back out afterwards.
 */
const DYNAMIC_ROUTES: { match: RegExp; as: string }[] = [
  { match: /^\/shared\/[^/]+$/, as: "/shared/:slug" },
];

/**
 * The path to record for a location.
 *
 * Also strips a trailing slash, so `/home/` and `/home` are one page rather than
 * two rows that look like a bug in the table.
 */
export function normalisePath(pathname: string): string {
  if (!pathname) return "/";

  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;

  for (const route of DYNAMIC_ROUTES) {
    if (route.match.test(trimmed)) return route.as;
  }
  return trimmed;
}

/**
 * Pages where click coordinates are sampled for the heatmap.
 *
 * Every tracked page. It used to be five hand-picked ones, which meant the four
 * pages the operator most wanted a heatmap of could never produce one however
 * long the panel ran — and nothing on screen said why.
 *
 * Volume is not a concern at this breadth: sampling is a fraction of clicks (see
 * COORD_SAMPLE_RATE) and most of these pages see little traffic. click_points
 * also has its own 30-day retention, unlike the 180-day event log.
 */
export const COORD_PATHS: readonly string[] = TRACKED_PAGES.map((p) => p.path);

export function samplesCoordinates(path: string): boolean {
  return COORD_PATHS.includes(normalisePath(path));
}
