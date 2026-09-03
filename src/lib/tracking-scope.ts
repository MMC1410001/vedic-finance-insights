/**
 * Should this page report analytics at all?
 *
 * Two reasons it should not — being embedded, and being the admin panel. Both
 * are contexts where recording would describe us rather than a user.
 *
 * See also isHeatmapPreview() at the foot of this file, which answers a
 * different question about the same iframe: not "should this be recorded" but
 * "should this page skip its own redirect so the heatmap is honest".
 *
 * Its own module to avoid a cycle: event-queue.ts imports ensureSessionId from
 * visitor-tracking.ts, so visitor-tracking.ts cannot import back from
 * event-queue.ts. Both need this answer.
 *
 * `?embed=true` is the existing convention — FloatingAstrologerChat and
 * FinancialKundali already honour it.
 *
 * Analytics has to honour it as well, and the reason is not cosmetic: the /admin
 * heatmap renders the real page in an iframe so the click map has something to
 * sit on. Without this guard, opening the heatmap writes visit, page_view and
 * click rows — from the office IP, into the very table the panel is reading.
 * Looking at the data would change it.
 *
 * It is also right for the landing page's UserKundaliViewer, which embeds
 * /kundali: someone scrolling the homepage has not visited the kundali page.
 */
export function isEmbedded(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("embed") === "true") return true;
    // Belt and braces for a frame that was not given the flag.
    return window.self !== window.top;
  } catch {
    // Reading window.top cross-origin throws — which itself means framed.
    return true;
  }
}

/**
 * Paths that are not product usage.
 *
 * /admin is us looking at the data. Counting our own navigation would inflate
 * the very numbers being read — and unlike a real visitor's session there is
 * nothing to learn from it. The click listener has always skipped /admin; this
 * extends the same rule to page views, session duration and sign-ins, which were
 * still being recorded.
 *
 * The internal-traffic filter would eventually subtract most of these anyway,
 * but only if someone remembered to add the office network. Not recording them
 * is the more reliable half.
 */
const UNTRACKED_PREFIXES = ["/admin"];

export function isUntrackedPath(pathname: string): boolean {
  return UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The single question both tracking paths ask before recording anything. */
export function trackingSuppressed(): boolean {
  try {
    return isEmbedded() || isUntrackedPath(window.location.pathname);
  } catch {
    return true;
  }
}

/**
 * Is this page being rendered as the backdrop of the /admin heatmap?
 *
 * Requires **all three** conditions, and the third is the one that matters:
 *
 *   1. ?embed=true      — the existing convention for "framed by us"
 *   2. ?preview=heatmap — this specific use, not embedding in general
 *   3. framed by US     — a parent frame on our own origin
 *
 * Callers use it to skip a self-redirect so the heatmap shows the page it claims
 * to. /auth sends an onboarded session to /kundali and /payment sends a paid user
 * to /ai-chat, which is why the heatmap for those two showed the wrong page
 * entirely.
 *
 * ── Why the frame check is not belt-and-braces ─────────────────────────────
 * /payment skipping its `hasPaid` redirect means a paid user sees the ₹99 offer
 * again, and could start a second order. Inside the panel's iframe that is
 * harmless — it is `pointer-events: none` and nothing can be clicked. In a normal
 * tab it would be a real regression, so a hand-typed
 * `?embed=true&preview=heatmap` must not be enough: without a parent frame this
 * returns false and the ordinary redirect happens.
 *
 * ── Why "framed" alone is not the condition ────────────────────────────────
 * Being framed is something ANY page on the internet can arrange, so on its own
 * it is not evidence of anything: `<iframe src="…/payment?embed=true&preview=
 * heatmap">` on a hostile origin satisfied it for free, and both route guards
 * render `children` on the strength of this answer. What we actually mean is
 * "framed by the /admin panel", and the checkable form of that is a parent on
 * our own origin — reading `window.parent.location.origin` throws SecurityError
 * cross-origin, which is precisely the signal we want.
 *
 * The `catch` therefore returns FALSE. An earlier version returned true on the
 * reasoning that a throw proves the page is framed and so the preview must be
 * genuine; that is backwards for a check whose whole job is deciding whether to
 * skip a guard. A throw proves the parent is someone else's.
 *
 * This does not depend on `frame-ancestors` / `X-Frame-Options` being served.
 * Those headers are set in vercel.json and in public/serve.json for the Render
 * target, and they are worth having, but the guard must hold without them.
 *
 * Do not relax this to two conditions.
 */
export function isHeatmapPreview(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") !== "true") return false;
    if (params.get("preview") !== "heatmap") return false;
    // Not framed at all — a hand-typed URL in a real tab.
    if (window.self === window.top) return false;
    // Framed by whom? Only our own origin may skip a guard.
    return window.parent.location.origin === window.location.origin;
  } catch {
    // Cross-origin parent: the read above threw, so this frame is somebody
    // else's. Fail closed — see the block comment.
    return false;
  }
}
