/**
 * The first-party analytics queue — the only thing in the app that writes an
 * analytics event.
 *
 * Why a queue at all: every event is one edge-function invoke, and a click-level
 * analytics system fires far too many to send one at a time. Batching keeps a
 * whole session to a handful of requests instead of dozens.
 *
 * Three flush triggers, in order of how often they fire:
 *   - size  — MAX_BATCH reached, so a burst of clicks never sits in memory
 *   - timer — FLUSH_INTERVAL_MS, so a quiet page still reports
 *   - exit  — pagehide / visibilitychange, which is the only chance to record
 *             session duration at all
 *
 * The exit flush uses navigator.sendBeacon because a normal fetch is cancelled
 * when the page goes away. sendBeacon cannot set headers, so those events arrive
 * without an Authorization header and therefore without a user_id. That is
 * already handled server-side: visitor_session_summary resolves a session's user
 * from the last non-null user_id on *any* event in that session, so one attributed
 * event is enough to attribute the whole session.
 *
 * Everything here is fire-and-forget. Analytics must never block a render, throw
 * into a component, or log an error on a visitor's console — same contract as
 * trackVisit() in visitor-tracking.ts, which now routes through this module.
 */

import { supabase } from "./supabase";
import { ensureSessionId } from "./visitor-tracking";
import { trackingSuppressed } from "./tracking-scope";
import { normalisePath } from "./tracked-pages";

/**
 * Events the server accepts. Kept in sync with ALLOWED_EVENTS in
 * supabase/functions/_shared/event-payload.ts — a verb missing there is counted as
 * `rejected` and silently dropped, which is indistinguishable from broken code.
 *
 * The last five are **first-party only**. They are queued from here and never
 * routed through analytics(), which is the app's only window.dataLayer writer — so
 * GTM and GA4 see nothing new and the 32 agreed tag strings are untouched. They
 * answer questions the /admin panel asks and nobody else does. See ANALYTICS.md →
 * "Admin-only behaviour signals".
 */
export type AnalyticsEvent =
  | "visit"
  | "page_view"
  | "session_end"
  | "click"
  | "kundali_generated"
  | "payment_started"
  | "signed_in"
  | "error"
  /** A click that hit nothing interactive — where people expect a control. */
  | "dead_click"
  /** Repeated clicks in one spot in quick succession — frustration. */
  | "rage_click"
  /** A 25/50/75/100% scroll milestone, once each per page view. */
  | "scroll_depth"
  /** A tagged CTA became genuinely visible — the denominator for its clicks. */
  | "cta_view"
  /** First focus of a named form field — where onboarding stalls. */
  | "field_focus";

/** A click's position, normalised so a phone and a desktop are comparable. */
export interface ClickPoint {
  x_pct: number;
  y_pct: number;
  selector: string | null;
  /**
   * The document height y_pct is a fraction OF, in CSS pixels.
   *
   * Without it a fraction is uninterpretable: the admin heatmap has to multiply it
   * by some height, and the only one it knows is the height of its own iframe,
   * which is a different page state to the visitor's. Carrying the divisor lets
   * the panel place the click at its real depth instead. Optional because rows
   * recorded before this existed have none.
   */
  doc_h?: number;
}

export interface QueuedEvent {
  event: AnalyticsEvent;
  path: string;
  /**
   * Tie-breaker for ordering, and the only thing that makes per-page dwell
   * correct.
   *
   * `visitor_events.created_at` defaults to `now()`, which in Postgres is
   * transaction time — and a whole batch is written by ONE multi-row insert, so
   * every row in it carries the identical timestamp to the microsecond. The
   * `views` CTE in migration 018 derives dwell with
   * `lead(duration_ms) over (order by created_at)` and the exit page with
   * `row_number() over (order by created_at desc)`; against a full tie both
   * order arbitrarily, so dwell values get shuffled between pages and the exit
   * lands on whichever row Postgres felt like returning first.
   *
   * A monotonic counter fixes it without trusting the client's clock the way an
   * `occurred_at` timestamp would: `created_at` stays server-authoritative and
   * this only ever disambiguates rows that already tie. Ties happen strictly
   * inside one batch, and a batch never spans a page load, so a module-level
   * counter is enough — it does not need to persist.
   */
  seq?: number;
  referrer: string | null;
  props?: Record<string, unknown>;
  viewport_w?: number;
  viewport_h?: number;
  duration_ms?: number;
  point?: ClickPoint;
}

const MAX_BATCH = 20;
const FLUSH_INTERVAL_MS = 10_000;
/** Hard ceiling so a runaway loop cannot grow the queue without bound. */
const MAX_QUEUED = 200;

const SESSION_START_KEY = "afSessionStart";

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let hooksInstalled = false;
/** See QueuedEvent.seq. Never reset outside the test seam. */
let seqCounter = 0;
/**
 * Set by endAnalyticsSession(), and never cleared for the life of the page.
 *
 * Sign-out clears `sessionId` and `afSessionStart` and then hard-redirects. The
 * redirect fires `pagehide`, which used to run finalise() one last time — and
 * with both keys gone that queued a session_end measuring ~0 ms, then minted a
 * brand-new session id to file it under. The result was a phantom zero-view
 * session counted as a bounce on every sign-out. Nothing may be recorded
 * between the sign-out and the navigation.
 */
let sessionEnded = false;

/**
 * Opt-out switch. Deliberately read through import.meta.env rather than a
 * runtime toggle so a build can ship with analytics off entirely.
 */
function disabled(): boolean {
  return import.meta.env.VITE_ANALYTICS_DISABLED === "true" || trackingSuppressed();
}

function endpoint(): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return base ? `${String(base).replace(/\/+$/, "")}/functions/v1/track-visit` : null;
}

/** Session start, persisted so a duration survives a route change. */
function sessionStartedAt(): number {
  try {
    const stored = sessionStorage.getItem(SESSION_START_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) return parsed;
    }
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

/** Milliseconds since this session's first tracked event. */
export function sessionDurationMs(): number {
  return Math.max(0, Date.now() - sessionStartedAt());
}

function scheduleFlush(): void {
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Add one event to the queue. Never throws, never awaits.
 *
 * Not deduped: the log is append-only and a repeat is signal, not noise. The one
 * exception is the caller's own guard against StrictMode double-invokes, which
 * belongs at the call site because only it knows what "once" means.
 */
export function queueEvent(
  event: AnalyticsEvent,
  extra: Partial<Omit<QueuedEvent, "event">> = {},
): void {
  if (sessionEnded || disabled()) return;

  try {
    sessionStartedAt(); // start the clock on the first event of the session

    queue.push({
      event,
      // Normalised, so every shared kundali does not become its own row in the
      // pages table. See normalisePath() in tracked-pages.ts.
      path: normalisePath(window.location.pathname),
      // Empty string on a direct visit; the edge function stores null for it.
      referrer: document.referrer || null,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      ...extra,
      // After the spread, not before: `path` is deliberately overridable by the
      // caller and this is deliberately not.
      seq: seqCounter++,
    });

    // Drop the oldest rather than the newest: recent behaviour is what anyone
    // reading the dashboard is actually looking at.
    if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);

    if (queue.length >= MAX_BATCH) void flushEvents();
    else scheduleFlush();
  } catch {
    /* sessionStorage or window unavailable — analytics is not worth an error */
  }
}

/**
 * Attach extra props to the most recently queued event.
 *
 * This is what lets the delegated click listener and analytics() cooperate. The
 * listener records the click in the capture phase (so a handler calling
 * stopPropagation cannot lose it); analytics() runs afterwards inside React's
 * own handler and names the click, enriching the row that is still sitting in
 * this queue. One row per click, with the authoritative tag on it.
 *
 * Guarded on the event type so a stray call cannot rewrite an unrelated row.
 */
export function enrichLastEvent(
  event: AnalyticsEvent,
  props: Record<string, unknown>,
): boolean {
  const last = queue[queue.length - 1];
  if (!last || last.event !== event) return false;
  last.props = { ...last.props, ...props };
  return true;
}

/**
 * Send everything queued. Resolves when the request has been handed off — not
 * when it lands, because no caller waits on analytics.
 *
 * `beacon` is for the page-exit path, where a normal request would be cancelled.
 */
export async function flushEvents(beacon = false): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;

  let session_id: string;
  try {
    session_id = ensureSessionId();
  } catch {
    queue = [];
    return;
  }

  if (beacon) {
    const url = endpoint();
    if (url && typeof navigator !== "undefined" && navigator.sendBeacon) {
      // Loop rather than send one batch and return. queueEvent() flushes the
      // moment the queue reaches MAX_BATCH, so today this runs exactly once —
      // but this is the page's last chance to send anything, and the previous
      // single-batch version was correct only by that coincidence. MAX_QUEUED is
      // 200; raising the cap, batching differently, or queueing by any route
      // that skips queueEvent would have dropped everything past the first 20,
      // silently and with nothing left to retry from.
      //
      // sendBeacon returns false when the payload is refused (the browser's
      // queue limit, ~64 KB). Stop there: the remainder cannot be sent either,
      // and looping on a refusal would spin until the page is gone.
      while (queue.length > 0) {
        const batch = queue.splice(0, MAX_BATCH);
        const sent = navigator.sendBeacon(
          url,
          // text/plain is a CORS-safelisted content type, so this needs no
          // preflight — which matters because a beacon fired during pagehide has
          // no time for a round trip. The function calls req.json() regardless.
          new Blob([JSON.stringify({ session_id, events: batch })], {
            type: "text/plain;charset=UTF-8",
          }),
        );
        if (!sent) return;
      }
      return;
    }
    // No sendBeacon (or no configured URL): fall through and try the normal
    // path. It will usually be cancelled, but a cancelled request is no worse
    // than not attempting one.
  }

  // Take the batch out of the queue before sending. A failed send is dropped
  // rather than retried: a retry queue that survives a failing endpoint turns
  // one broken deploy into an ever-growing request loop.
  const events = queue.splice(0, MAX_BATCH);

  try {
    // functions.invoke attaches the current session's JWT, which is what gives
    // these events a user_id. The beacon path above cannot.
    await supabase.functions.invoke("track-visit", { body: { session_id, events } });
  } catch {
    /* offline, blocked by an extension, or not deployed — all expected */
  }

  // A burst larger than one batch keeps draining.
  if (queue.length > 0) scheduleFlush();
}

/**
 * Register the page-exit flush. Idempotent, so calling it from a component that
 * remounts is safe.
 *
 * Both events are needed: pagehide is the reliable one on desktop, and iOS
 * Safari frequently never fires it — visibilitychange is the only signal there.
 * The session_end row is what turns a pile of timestamps into a duration.
 */
export function installFlushHooks(): void {
  if (hooksInstalled || typeof window === "undefined") return;
  hooksInstalled = true;

  /**
   * Suppression is checked HERE, at fire time, not at install time.
   *
   * RouteTracker installs these once, from a mount effect with no deps, so a
   * bail-out here would never be retried. A tab whose first load happened to be
   * /admin — suppressed by tracking-scope — therefore registered no exit
   * listeners at all, and once the user navigated into the app it recorded page
   * views and clicks but never a session_end, dropping the queued tail on exit.
   *
   * Deciding on the page the user is actually leaving is also simply the right
   * question. queueEvent() re-checks disabled() itself, so nothing leaks from a
   * suppressed page either way.
   */
  const finalise = () => {
    if (sessionEnded || disabled()) return;
    queueEvent("session_end", { duration_ms: sessionDurationMs() });
    void flushEvents(true);
  };

  window.addEventListener("pagehide", finalise);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") finalise();
  });
}

/**
 * End the current analytics session. Called on sign-out.
 *
 * `afSessionStart` is user-scoped in the same way `sessionId` is, and
 * sessionStorage survives the hard redirect in auth-context.tsx's SIGNED_OUT
 * handler. Left behind, the next user on that browser inherits the previous
 * user's start time and every session_end they emit reports a duration that
 * includes someone else's visit — which is the one number the whole panel is
 * read for. See the SIGNED_OUT list in auth-context.tsx; any future
 * user-scoped key in this module belongs here as well.
 *
 * The pending queue goes with it. Those events belong to the session that is
 * ending, and flushEvents() resolves the session id at send time — so a timer
 * firing in the gap between the key being cleared and the page navigating away
 * would mint a fresh id and file the departing user's clicks under it.
 */
export function endAnalyticsSession(): void {
  sessionEnded = true;
  queue = [];
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    sessionStorage.removeItem(SESSION_START_KEY);
  } catch {
    /* private mode — nothing was stored to begin with */
  }
}

/** Test seam. Not for application code. */
export function __resetQueue(): void {
  queue = [];
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  hooksInstalled = false;
  seqCounter = 0;
  sessionEnded = false;
}

/** Test seam. Not for application code. */
export function __peekQueue(): readonly QueuedEvent[] {
  return queue;
}
