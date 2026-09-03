/**
 * Delegated click capture — "which elements do people actually click?"
 *
 * One listener on the document rather than an onClick on every element, because
 * the alternative is editing ~90 call sites (ANALYTICS.md counted them) and then
 * remembering to edit every new one.
 *
 * It runs in the **capture** phase on purpose. A handler that calls
 * stopPropagation() — and several do — would stop a bubble-phase listener from
 * ever seeing the click. Capture always sees it first.
 *
 * Capturing first also means this listener cannot know the click's *name*: the
 * agreed GTM tag strings are pushed by analytics() from inside React's own
 * handler, which runs later. So the flow is record-then-enrich: this file queues
 * the click with a derived selector, and analytics() calls enrichLastEvent() to
 * put the authoritative tag on the row while it is still in the queue. One row
 * per click, named where a name exists.
 *
 * ── The queue-order rule ────────────────────────────────────────────────────
 * enrichLastEvent() names the event at the TAIL of the queue and refuses if it is
 * not a `click`. So the `click` row must be the last thing this handler queues.
 * Anything else it emits for the same gesture — a rage_click — goes first.
 * Reverse them and every named tag doubles: the enrichment fails and analytics()
 * falls back to writing a second, synthetic row.
 *
 * ── Two extra signals, first-party only ─────────────────────────────────────
 * dead_click and rage_click are queued straight from here and never routed
 * through analytics(), so nothing about them reaches window.dataLayer, GTM or
 * GA4. They exist because a cold region of the heatmap used to be ambiguous:
 * "nobody clicked here" and "people tried and there was no control" produced the
 * same picture, and only one of them is a bug. See ANALYTICS.md.
 */

import { queueEvent, type ClickPoint } from "./event-queue";
import { isUntrackedPath } from "./tracking-scope";
import { normalisePath, samplesCoordinates } from "./tracked-pages";

/**
 * Fraction of clicks that also record a coordinate, on the paths below. The
 * funnel needs every click; a heatmap converges on a sample, and click_points is
 * the highest-volume table in the schema.
 */
const COORD_SAMPLE_RATE = 0.25;

/**
 * Fraction of clicks-on-nothing that are recorded, and the per-page-view ceiling.
 *
 * Lower than COORD_SAMPLE_RATE and capped, because these are cheap to produce in
 * bulk: dismissing an overlay, a mis-tap while scrolling, a double-tap to zoom.
 * The question they answer — "is there a spot people keep pressing that does
 * nothing?" — converges on a sample, and track-visit rate-limits 120 events per IP
 * per minute, which one restless visitor could otherwise spend on its own.
 */
const DEAD_SAMPLE_RATE = 0.15;
const DEAD_MAX_PER_VIEW = 8;

/**
 * A rage click: this many clicks inside RAGE_RADIUS_PX and RAGE_WINDOW_MS.
 *
 * Not sampled — rare by construction — but capped per page view so a stuck
 * element cannot fill a batch on its own.
 */
const RAGE_MIN_CLICKS = 3;
const RAGE_WINDOW_MS = 700;
const RAGE_RADIUS_PX = 40;
const RAGE_MAX_PER_VIEW = 3;

const INTERACTIVE = "a, button, [role='button'], input, select, textarea, label, summary, [data-af-tag]";

/** Trim and collapse whitespace so "Unlock  your\n Kundali" is one stable string. */
function normaliseText(value: string | null | undefined, max = 60): string | null {
  if (!value) return null;
  const flat = value.replace(/\s+/g, " ").trim();
  return flat ? flat.slice(0, max) : null;
}

/**
 * A human-readable, reasonably stable identifier for an element.
 *
 * Deliberately not a CSS path. Tailwind class lists are long, unstable and
 * meaningless to read in a table, and an nth-child path breaks the moment
 * anything is inserted above. Tag plus accessible name survives both and is
 * legible in the dashboard without a lookup.
 */
export function describeElement(el: Element): { selector: string; text: string | null } {
  const tag = el.tagName.toLowerCase();
  const explicit = el.getAttribute("data-af-tag");
  if (explicit) return { selector: explicit, text: normaliseText(el.textContent) };

  const name =
    normaliseText(el.getAttribute("aria-label")) ??
    normaliseText(el.getAttribute("alt")) ??
    normaliseText(el.getAttribute("title")) ??
    normaliseText(el.textContent, 40) ??
    normaliseText(el.getAttribute("name")) ??
    (el.id ? `#${el.id}` : null);

  return {
    selector: name ? `${tag}:${name}` : tag,
    text: normaliseText(el.textContent),
  };
}

/**
 * Normalise a click to 0-1 of the page box it was given.
 *
 * pageX/pageY rather than clientX/clientY so a click below the fold lands where
 * it belongs on the heatmap instead of at the top of the page. Scaled rather than
 * stored raw so a 390px phone and a 1440px desktop can be compared — which is the
 * entire reason the columns are fractions.
 *
 * Which box to divide by is the caller's decision, and it is not obvious; see the
 * handler below for why the width is the layout viewport while the height is the
 * full scroll height.
 */
export function normalisePoint(
  pageX: number,
  pageY: number,
  docWidth: number,
  docHeight: number,
): { x_pct: number; y_pct: number } {
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  return {
    x_pct: Number(clamp(pageX / Math.max(docWidth, 1)).toFixed(5)),
    y_pct: Number(clamp(pageY / Math.max(docHeight, 1)).toFixed(5)),
  };
}

/**
 * Build the coordinate for a click.
 *
 * Shared by the real and the dead path so the two cannot disagree about what a
 * position means — a dead-click map drawn in a different coordinate space to the
 * click map would be worse than not having one.
 */
function pointFor(event: MouseEvent, selector: string | null): ClickPoint {
  const doc = document.documentElement;

  /**
   * Width: the LAYOUT viewport, not scrollWidth.
   *
   * The admin heatmap multiplies x back out by a fixed device width (390 / 834 /
   * 1440). Dividing by scrollWidth here meant that on any page with horizontal
   * overflow — one wide table, one element a few pixels past the edge — every x was
   * compressed against a larger number than the renderer expands by, and the whole
   * map drifted left. clientWidth is the box CSS actually laid the page out in, so
   * the two agree.
   */
  const docWidth = doc.clientWidth || window.innerWidth || 1;
  /** Height: the full scroll height, which is what y is a fraction of. */
  const docHeight = Math.max(doc.scrollHeight, window.innerHeight, 1);

  const { x_pct, y_pct } = normalisePoint(event.pageX, event.pageY, docWidth, docHeight);

  // doc_h travels with the point so the admin can place it by absolute depth.
  // y_pct alone is a fraction of THIS visitor's page height, and the heatmap draws
  // against the height it measures in its own iframe — any difference (an open
  // accordion, lazily loaded content, a longer report) displaced every blob, worst
  // at the bottom of the page.
  return { x_pct, y_pct, selector, doc_h: Math.round(docHeight) };
}

// ── Per-page-view state ─────────────────────────────────────────────────────
// Module memory, reset by RouteTracker on every route change. Deliberately NOT
// sessionStorage: every user-scoped key there has to be added by hand to the
// SIGNED_OUT list in auth-context.tsx, and one forgotten key leaks the previous
// user's state to the next person on that browser. Nothing here is worth that.
let deadThisView = 0;
let rageThisView = 0;
/** Recent clicks, for the rage burst test. Trimmed on every click. */
let recent: { t: number; x: number; y: number }[] = [];

/**
 * Start a fresh page view. Called by RouteTracker alongside its page_view.
 *
 * Without it the caps are per session rather than per page, so a visitor who rage
 * clicked on the landing page would be silently exempt for the rest of their
 * visit — and the recent-click buffer would let a click on one page pair with a
 * click on the next to fabricate a burst that never happened.
 */
export function resetPageInteractions(): void {
  deadThisView = 0;
  rageThisView = 0;
  recent = [];
}

/**
 * Is this click the tail of a burst in one spot?
 *
 * Clears the buffer when it fires, so a fourth and fifth click do not each report
 * their own burst — one gesture, one row.
 */
function isRageBurst(event: MouseEvent): boolean {
  const now = Date.now();
  recent = recent.filter((c) => now - c.t < RAGE_WINDOW_MS);

  const near = recent.filter(
    (c) => Math.hypot(c.x - event.pageX, c.y - event.pageY) <= RAGE_RADIUS_PX,
  ).length;

  recent.push({ t: now, x: event.pageX, y: event.pageY });
  // Cap the buffer: a long press-and-hold on a touch device can emit a lot.
  if (recent.length > 12) recent = recent.slice(-12);

  if (near < RAGE_MIN_CLICKS - 1) return false;
  recent = [];
  return true;
}

let handler: ((event: Event) => void) | null = null;

/**
 * Install the listener. Idempotent — a remount must not double-count.
 */
export function installClickTracking(): void {
  if (handler || typeof document === "undefined") return;

  handler = (raw: Event) => {
      try {
        const event = raw as MouseEvent;
        const path = normalisePath(window.location.pathname);
        // Shared with the other two tracking paths, so "not product usage" is
        // decided once rather than in three places that could drift.
        if (isUntrackedPath(path)) return;

        const target = event.target as Element | null;
        if (!target || typeof target.closest !== "function") return;

        const samples = samplesCoordinates(path);
        // Only interactions get a `click` row. Without this, every click on a
        // paragraph of text becomes one and the ranked table fills with body copy.
        // Resolved once — both branches below need the answer.
        const el = target.closest(INTERACTIVE);

        // Queued BEFORE the click row below, never after — enrichLastEvent() names
        // the tail of the queue and refuses anything that is not a `click`. See the
        // queue-order rule in the header.
        if (rageThisView < RAGE_MAX_PER_VIEW && isRageBurst(event)) {
          rageThisView += 1;
          const rageSelector = el ? describeElement(el).selector : null;
          queueEvent("rage_click", {
            path,
            props: { selector: rageSelector, dead: !el },
            point: samples ? pointFor(event, rageSelector) : undefined,
          });
        }

        if (!el) {
          /**
           * A click that hit nothing interactive.
           *
           * Previously dropped entirely, which made the heatmap ambiguous in the one
           * way that matters: an area with no heat could mean nobody clicked there,
           * or it could mean people click there constantly and nothing happens. The
           * second is a design fault and was invisible.
           *
           * Only recorded with a position, because a dead click without one has no
           * name and no location — there is nothing to learn from a bare count.
           */
          if (
            samples &&
            deadThisView < DEAD_MAX_PER_VIEW &&
            Math.random() < DEAD_SAMPLE_RATE
          ) {
            deadThisView += 1;
            // The nearest thing that can be named, so the row says *what* was
            // clicked instead of only where. Not a control, by definition.
            const near = target.closest("[id], [class], section, article, div");
            queueEvent("dead_click", {
              path,
              props: {
                selector: near ? describeElement(near).selector : target.tagName.toLowerCase(),
                tag: null,
              },
              point: pointFor(event, null),
            });
          }
          return;
        }

        const { selector, text } = describeElement(el);

        const point =
          samples && Math.random() < COORD_SAMPLE_RATE ? pointFor(event, selector) : undefined;

        queueEvent("click", {
          // Passed explicitly: queueEvent would otherwise read the raw location
          // and the click row would disagree with the click_points row about
          // which page it happened on.
          path,
          props: { selector, text, sampled: Boolean(point) },
          point,
        });
      } catch {
        /* never let instrumentation break a click the user meant to make */
      }
  };

  // capture: true — see the header comment. This is load-bearing.
  document.addEventListener("click", handler, true);
}

/**
 * Test seam. Not for application code.
 *
 * Detaches rather than only clearing the flag: leaving the old listener bound
 * while allowing a reinstall stacks one listener per reset, and every click then
 * counts once per stacked listener.
 */
export function __resetClickTracking(): void {
  if (handler && typeof document !== "undefined") {
    document.removeEventListener("click", handler, true);
  }
  handler = null;
  resetPageInteractions();
}
