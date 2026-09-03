/**
 * Analytics — two sinks, one call.
 *
 * **Sink 1, window.dataLayer (unchanged).** `analytics()` pushes to
 * `window.dataLayer` for the named click tags the analytics team specified.
 * `gtm.click` and `gtm.text` are GTM built-in names (`gtm.text` backs the native
 * Click Text variable), so the team can build triggers reading
 * `Click Text equals Footer_PrivacyPolicy` without needing a custom variable.
 *
 * Nothing on that path reaches GA4 on its own. A push lands in `dataLayer` and
 * stops until a matching trigger exists in container GTM-K8SZDDSJ. The only thing
 * currently reporting to GA4 (G-WJX6J34M3S) is the pageview from the gtag.js
 * snippet in index.html.
 *
 * **Sink 2, our own event log (added for /admin → Analytics).** The consequence
 * of sink 1 is that GA4 has received nothing but pageviews for months, and no
 * external tool can join a click to `payment_orders` anyway. So the same call now
 * also names a first-party row.
 *
 * It *names* rather than creates one. The click was already queued, in the
 * capture phase, by the delegated listener in click-tracking.ts — this call adds
 * the authoritative tag to that row. Which means every one of the 33 existing
 * tags became a first-party event without touching a single call site, and there
 * is still exactly one row per click. See enrichLastEvent() for the mechanism.
 *
 * The two sinks are independent on purpose: GTM's contract, and the team's exact
 * tag strings, are untouched by anything here. GA4 and Clarity keep running as a
 * cross-check until the first-party numbers are trusted.
 *
 * There used to be a third path — `track*` helpers calling `gtag()` directly.
 * It was removed; see the "Removed — the 8 GA4 conversions" note in
 * ANALYTICS.md before adding anything like it back.
 */

import { enrichLastEvent, queueEvent } from "./event-queue";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

/**
 * Mirror a named click into the first-party log.
 *
 * Only clicks. The non-click events (`Purchase_Confirmed`, `Auth_LoginSuccess`,
 * `Kundali_ReportGenerated`, `Campaign_Landing`) fire from application logic, and
 * filing them under a `click` verb would put a lie in the table. They have all
 * landed, and none of them writes a first-party row from here: each call site
 * already records the same moment through trackVisit() with the verb that
 * actually describes it. Payment completion in particular is read from
 * payment_orders, not from the browser, because a client-reported purchase is
 * forgeable.
 */
function mirrorToEventLog(data: Record<string, unknown>, eventName: string): void {
  if (eventName !== "gtm.click") return;

  const tag = data["gtm.text"];
  if (typeof tag !== "string" || !tag) return;

  // The delegated listener queued this click microseconds ago, so the normal
  // outcome is enrichment. It returns false when there is no click to name —
  // a programmatic call outside a real click, or a synthetic one in a test — and
  // then the tag is worth a row of its own rather than being dropped.
  if (!enrichLastEvent("click", { tag })) {
    queueEvent("click", { props: { tag, selector: null, synthetic: true } });
  }
}

export default function analytics(
  data: Record<string, unknown> = {},
  eventName: string = 'gtm.click'
): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...data,
  });

  // After the dataLayer push, never before: the GTM path is the one with an
  // external consumer, and it must not be affected by anything here.
  try {
    mirrorToEventLog(data, eventName);
  } catch {
    /* analytics must never break the click it is describing */
  }
}
