/**
 * CTA impressions — was the button ever actually seen?
 *
 * The gap this fills: the clicks table gives a numerator with no denominator. A
 * CTA with 40 clicks might be shown to 60 people and be excellent, or shown to
 * 6,000 and be invisible, and those two situations are indistinguishable today.
 * "Dropoff button" is not answerable from clicks alone — a button nobody clicks
 * and a button nobody reaches look the same.
 *
 * **First-party only.** Queued through queueEvent(), never through analytics() —
 * the app's one window.dataLayer writer — so nothing here reaches GTM or GA4 and
 * the agreed tag strings are untouched. See ANALYTICS.md → "Admin-only behaviour
 * signals".
 *
 * ── What counts as seen ─────────────────────────────────────────────────────
 * Half the element on screen for a full second. Not first intersection: a fling
 * to the footer crosses every CTA on the way and would report each as seen, which
 * would inflate the denominator and make every CTA look worse than it is —
 * failing in the direction that causes wrong decisions.
 *
 * One row per tag per page view. A CTA scrolled past, back to, and past again is
 * one impression, and the cap is also what keeps a sticky header CTA from
 * emitting on every scroll reversal. track-visit rate-limits 120 events per IP per
 * minute; a landing page has a dozen tagged controls, so this matters.
 */

import { queueEvent } from "./event-queue";
import { isUntrackedPath } from "./tracking-scope";
import { normalisePath } from "./tracked-pages";

/**
 * What this watches.
 *
 * `[data-af-tag]` is the existing convention — click-tracking.ts already treats it
 * as the authoritative name for an element, so anything already named for the
 * clicks table gets an impression for free, with no new attribute to remember.
 * `[data-af-cta]` is for a control worth an impression that has no tag.
 */
const WATCHED = "[data-af-tag], [data-af-cta]";

const VISIBLE_RATIO = 0.5;
const DWELL_MS = 1000;

let observer: IntersectionObserver | null = null;
let scanner: MutationObserver | null = null;
let seen = new Set<string>();
/** Pending "has it held for a second yet" timers, keyed by element. */
const pending = new Map<Element, ReturnType<typeof setTimeout>>();

function nameOf(el: Element): string | null {
  return el.getAttribute("data-af-tag") || el.getAttribute("data-af-cta") || null;
}

function report(el: Element): void {
  const tag = nameOf(el);
  if (!tag || seen.has(tag)) return;

  const path = normalisePath(window.location.pathname);
  if (isUntrackedPath(path)) return;

  seen.add(tag);
  queueEvent("cta_view", { path, props: { tag } });
}

function onIntersect(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const el = entry.target;
    const held = pending.get(el);

    if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
      if (held === undefined) {
        pending.set(
          el,
          setTimeout(() => {
            pending.delete(el);
            report(el);
          }, DWELL_MS),
        );
      }
      continue;
    }

    // Left the viewport before the second was up: it was scrolled past, not read.
    if (held !== undefined) {
      clearTimeout(held);
      pending.delete(el);
    }
  }
}

/** Observe everything currently in the document that we are not already watching. */
function scan(): void {
  if (!observer) return;
  for (const el of Array.from(document.querySelectorAll(WATCHED))) {
    // IntersectionObserver.observe is idempotent per element, so re-observing an
    // element already registered is a no-op rather than a double count.
    observer.observe(el);
  }
}

/**
 * Install the observers. Idempotent — a remount must not double-count.
 *
 * A MutationObserver as well as the initial scan, because almost every route in
 * this app is React.lazy behind <Suspense fallback={null}>: at install time the
 * page is genuinely empty, and a one-off querySelectorAll would find nothing on
 * every route in the app. Watching for added nodes is the only way to catch a CTA
 * that arrives with the chunk.
 */
export function installCtaVisibility(): void {
  if (observer || typeof window === "undefined") return;
  if (typeof IntersectionObserver !== "function") return;

  observer = new IntersectionObserver(onIntersect, {
    threshold: [0, VISIBLE_RATIO, 1],
  });

  scan();

  if (typeof MutationObserver === "function") {
    scanner = new MutationObserver(scan);
    scanner.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Start a fresh page view: forget which CTAs were seen, and drop the elements of
 * the page being left.
 *
 * Called by RouteTracker on every route change. Without the reset the "once per
 * tag" rule would be once per session, so a CTA present on three pages would only
 * ever be credited an impression on the first of them.
 */
export function resetCtaViews(): void {
  seen = new Set();
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  // The previous route's nodes are unmounted; re-scanning picks up the new ones as
  // they arrive, and the observer holds only weak references to the old.
  observer?.disconnect();
  scan();
}

/** Test seam. Not for application code. */
export function __resetCtaVisibility(): void {
  observer?.disconnect();
  scanner?.disconnect();
  observer = null;
  scanner = null;
  seen = new Set();
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
}
