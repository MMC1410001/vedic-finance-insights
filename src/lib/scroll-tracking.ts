/**
 * Scroll depth — how far down a page people actually get.
 *
 * The gap this fills: the pages table already reports views, dwell and exit rate,
 * which says *that* people left a page but nothing about where they stopped
 * reading. On a page whose only interaction is scrolling — the legal pages, the
 * long landing sections, a generated report — every existing signal is blind. The
 * click heatmap is blind there too, by construction: it only knows about clicks.
 *
 * **First-party only.** These events are queued through queueEvent() and never
 * routed through analytics(), which is the app's one window.dataLayer writer. So
 * nothing here reaches GTM or GA4, and the agreed tag strings are untouched. See
 * ANALYTICS.md → "Admin-only behaviour signals".
 *
 * Four rows per page view at most, and only for depths actually reached: a visitor
 * who reads half a page emits 25 and 50, not 75 and 100. Milestones rather than a
 * continuous value because the question is "did they get to the pricing section",
 * which a bucket answers and a mean does not.
 */

import { queueEvent } from "./event-queue";
import { isUntrackedPath } from "./tracking-scope";
import { normalisePath } from "./tracked-pages";

/**
 * Percentages worth a row.
 *
 * 100 means the bottom of the document is on screen, not that the scroll offset
 * reached the document height — which is unreachable, since the last viewport of
 * a page cannot be scrolled past.
 */
const MILESTONES = [25, 50, 75, 100] as const;

/**
 * How long a depth must hold before it counts, in milliseconds.
 *
 * A momentum fling on a phone passes through every milestone on the way to the
 * footer, and counting those would report that everyone read everything. Debounced
 * on the trailing edge so only where the page came to rest is recorded.
 */
const SETTLE_MS = 400;

let installed = false;
let reached = new Set<number>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Depth of the deepest point currently visible, as a whole percentage. */
function currentDepth(): number {
  const doc = document.documentElement;
  const height = Math.max(doc.scrollHeight, window.innerHeight, 1);
  const seen = (window.scrollY || 0) + window.innerHeight;
  return Math.min(100, Math.round((seen / height) * 100));
}

function record(): void {
  const path = normalisePath(window.location.pathname);
  if (isUntrackedPath(path)) return;

  const depth = currentDepth();
  const doc = document.documentElement;

  for (const milestone of MILESTONES) {
    if (depth < milestone || reached.has(milestone)) continue;
    reached.add(milestone);
    queueEvent("scroll_depth", {
      // Explicit, like the click listener's: queueEvent would otherwise read the
      // raw location, and mid-transition the two can disagree about the page.
      path,
      props: {
        depth: milestone,
        // The page height this depth was a percentage of. The same reason
        // click_points carries doc_h: "50%" is not comparable between a 3,000px
        // page and a 9,000px one, and the admin panel needs to know which it was.
        doc_h: Math.round(Math.max(doc.scrollHeight, window.innerHeight, 1)),
      },
    });
  }
}

/**
 * A page whose content fits the viewport is 100% seen the moment it renders.
 *
 * Recorded on install rather than waiting for a scroll event that will never come
 * — otherwise every short page reports nothing at all, which reads identically to
 * "nobody scrolled" when in fact everybody saw all of it.
 */
function onScroll(): void {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(record, SETTLE_MS);
}

/**
 * Install the listeners. Idempotent — a remount must not double-count.
 *
 * passive: true because this handler never calls preventDefault, and a
 * non-passive scroll listener blocks the compositor on every frame of a scroll.
 * resize is included because rotating a phone changes both the viewport and the
 * document height, so the same scroll offset is a different depth.
 */
export function installScrollTracking(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  // The initial measurement, for the short-page case above. Deferred a frame so
  // the route being installed on has had a chance to lay out — measuring during
  // mount reports the height of an empty page.
  onScroll();
}

/**
 * Start a fresh page view: forget which milestones were reached.
 *
 * Called by RouteTracker on every route change. Without it a session reports 25%
 * once and then never again, however many pages it visits — the milestones would
 * be per session rather than per page, which is not a question anyone asks.
 */
export function resetScrollDepth(): void {
  reached = new Set();
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  // Re-measure for the new route, for the same short-page reason as on install.
  if (installed) onScroll();
}

/** Test seam. Not for application code. */
export function __resetScrollTracking(): void {
  if (installed && typeof window !== "undefined") {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  }
  installed = false;
  resetScrollDepth();
}
