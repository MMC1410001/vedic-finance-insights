/**
 * Visitor tracking — records server-observed IP + context per anonymous session.
 *
 * The IP itself is resolved by the track-visit edge function from request
 * headers; nothing here sends one, because a browser cannot read its own public
 * IP and a client-supplied value would be forgeable anyway.
 *
 * Every call is fire-and-forget. Tracking must never block a render or surface
 * an error, so failures are swallowed.
 *
 * This module is the **immediate** path: one request per event, sent the moment
 * it happens. It is for the handful of milestones where losing an event would
 * lose a conversion — a saved kundali, a sign-in, a payment attempt, and the
 * first page load (which is what establishes the session's IP).
 *
 * The **batched** path is event-queue.ts, and it handles everything chatty: page
 * views, clicks, session duration. Those are high-volume, individually
 * unimportant, and would be one edge-function invoke each if they came through
 * here. Both paths write to the same visitor_events table and share the session
 * id minted below.
 */

import { supabase } from "./supabase";
import { trackingSuppressed } from "./tracking-scope";
import { normalisePath } from "./tracked-pages";
import { visitAttribution } from "./utm";

/** The one sessionStorage key that identifies an anonymous visitor. */
const SESSION_ID_KEY = "sessionId";

export type VisitorEvent =
  | "visit"
  | "kundali_generated"
  | "payment_started"
  | "signed_in";

/**
 * Returns the current anonymous session id, minting one if absent.
 *
 * Single home for logic that used to be duplicated in vedicfinance-api.ts,
 * kundali-history.ts and report-store.ts. It must stay persistent, not a
 * throwaway: it is the key getUserKundalis() uses to claim a guest's orphaned
 * kundli_reports row at signup, and the key visitor_events joins on.
 *
 * Cleared on SIGNED_OUT in auth-context.tsx — a new user on the same browser
 * gets a new id.
 */
export function ensureSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  return sessionId;
}

/**
 * Record one visitor event. Never awaited by callers, never throws.
 *
 * Deliberately not deduped client-side: the table is an append-only log, and
 * repeat rows for one session are the signal for how often someone returns.
 */
export function trackVisit(event: VisitorEvent = "visit"): void {
  try {
    // Same guard as the batched path: nothing is recorded from inside an
    // embed (the /admin heatmap frames real pages) or from /admin itself.
    // See tracking-scope.ts.
    if (trackingSuppressed()) return;

    const session_id = ensureSessionId();

    void supabase.functions
      .invoke("track-visit", {
        body: {
          session_id,
          event,
          // Normalised, matching the batched path — otherwise the same visit
          // reports two different page names for the same page.
          path: normalisePath(window.location.pathname),
          // Empty string on a direct visit; the edge function stores null for it.
          referrer: document.referrer || null,
          // Campaign fields AND the per-browser visitor id, on the `visit` row
          // only. Attribution describes the session, not the event — repeating
          // it on signed_in/payment_started would add nothing and would let a
          // later row disagree with the landing one about where the session came
          // from. Sits beside session_id rather than inside the event for the
          // same reason, and because readEvents() drops unknown keys from the
          // single body shape.
          //
          // visitAttribution(), not currentAttribution(): an untagged arrival
          // has no campaign but is still a browser we need to recognise on its
          // next visit. See the note in utm.ts.
          attribution: event === "visit" ? visitAttribution() : undefined,
        },
      })
      .catch(() => {
        /* analytics is not worth a console error on every offline visit */
      });
  } catch {
    /* sessionStorage or crypto unavailable (private mode edge cases) — skip */
  }
}
