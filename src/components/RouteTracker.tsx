/**
 * Route and interaction tracking. Renders nothing.
 *
 * Must live inside <BrowserRouter> — it reads useLocation(). App.tsx mounts it
 * next to AuthProvider for that reason.
 *
 * Why it exists: before this, trackVisit("visit") fired once at App mount and
 * never again. One timestamp per session makes session duration, pages per
 * session, and "where do people drop off" all uncomputable — there is nothing to
 * measure the first event *against*. A page_view per route change, plus a
 * session_end on exit, is the minimum that makes those three answerable.
 *
 * The dwell convention is worth stating once, because the SQL depends on it:
 * a page_view's duration_ms is the time spent on the **previous** path, not the
 * one it names. admin_analytics() pulls it forward with lead(). The consequence
 * is that the last page of a session has no dwell measurement — nothing marks
 * its end — which is why session_end carries the session total separately.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { installClickTracking, resetPageInteractions } from "@/lib/click-tracking";
import { installScrollTracking, resetScrollDepth } from "@/lib/scroll-tracking";
import { installCtaVisibility, resetCtaViews } from "@/lib/cta-visibility";
import { installFlushHooks, queueEvent } from "@/lib/event-queue";
import { normalisePath } from "@/lib/tracked-pages";

export function RouteTracker() {
  const location = useLocation();
  const previous = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    installFlushHooks();
    installClickTracking();
    // Both are first-party only: they queue events and never touch dataLayer, so
    // GTM and GA4 see nothing new. See ANALYTICS.md → "Admin-only behaviour
    // signals".
    installScrollTracking();
    installCtaVisibility();
  }, []);

  useEffect(() => {
    // Normalised here too, so a page_view and its dwell are attributed to the
    // same bucket the click rows use.
    const path = normalisePath(location.pathname);
    const now = Date.now();
    const from = previous.current;

    // Same path twice means a search-param or hash change, or StrictMode's
    // double-invoke in dev. Neither is a page view.
    if (from?.path === path) return;

    previous.current = { path, at: now };

    /**
     * A new page view resets everything counted per page view.
     *
     * All three keep their state in module memory rather than sessionStorage,
     * precisely so there is no new user-scoped key to remember in the SIGNED_OUT
     * handler in auth-context.tsx — a forgotten key there shows the previous user's
     * state to the next person on that browser. The cost is that the reset has to
     * be called from here, which is the one place that knows a page view began.
     *
     * Placed before the early return below so the FIRST route resets too: this
     * effect returns without emitting a page_view for it (App's trackVisit covers
     * it), but the counters still belong to that page.
     */
    resetPageInteractions();
    resetScrollDepth();
    resetCtaViews();

    // The first route is already covered by App's trackVisit("visit"), which is
    // sent immediately because it is what records the session's IP. Emitting a
    // page_view for it too would double-count the landing page in every table.
    if (!from) return;

    queueEvent("page_view", {
      // Passed explicitly rather than left to queueEvent's window.location
      // default: the router is the authority on which route we are on, and the
      // two can disagree mid-transition.
      path,
      props: { from: from.path },
      duration_ms: now - from.at,
    });
  }, [location.pathname]);

  return null;
}
