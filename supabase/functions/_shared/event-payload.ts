/**
 * Validation and normalisation for analytics event payloads.
 *
 * Split out of track-visit/index.ts so it can be tested: that file calls serve()
 * at import time, so importing it from a test starts a server instead of running
 * assertions. Same reason client-ip.ts lives here.
 *
 * Everything in this module treats the input as hostile. track-visit is CORS `*`
 * and unauthenticated — guests are the point — so the body is the one part of a
 * row a caller fully controls, and props is the one field whose *shape* they
 * control. The rule throughout is to reject or clamp rather than store a partly
 * valid value, because a truncated object in a jsonb column is indistinguishable
 * from real data once it is written.
 */

/** One request can never write more than this, however many it claims. */
export const MAX_BATCH = 50;
/** Cap on the serialised props object, so a forged body cannot bloat a row. */
export const MAX_PROPS_BYTES = 2_000;
export const MAX_PROPS_KEYS = 20;
/** 6 hours. More than that is a backgrounded tab, not attention. */
export const MAX_DURATION_MS = 21_600_000;
/** Campaign values. Over-length is rejected rather than clamped — see normaliseUtm. */
export const MAX_UTM_LEN = 64;
export const MAX_CLICK_ID_LEN = 128;

/**
 * Events the client is allowed to record.
 *
 * Payment *completion* is deliberately absent. It is read from
 * payment_orders.status, because a client-reported purchase is forgeable and
 * Payment.tsx's completeAndRedirect is reached from six different paths.
 *
 * Kept in sync with the AnalyticsEvent union in src/lib/event-queue.ts. An event
 * missing here is silently counted as `rejected` by track-visit, so the two lists
 * drifting looks exactly like "the feature does not work".
 *
 * The last five are **first-party only**: they are queued by queueEvent() and
 * never passed through analytics(), so nothing about them reaches window.dataLayer,
 * GTM, or GA4. They exist for the /admin panel alone. See ANALYTICS.md →
 * "Admin-only behaviour signals".
 */
export const ALLOWED_EVENTS = new Set([
  "visit",
  "page_view",
  "session_end",
  "click",
  "kundali_generated",
  "payment_started",
  "signed_in",
  "error",
  "dead_click",
  "rage_click",
  "scroll_depth",
  "cta_view",
  "field_focus",
]);

/**
 * Which click_points.kind an event verb writes.
 *
 * Only verbs that carry a coordinate appear. Everything else falls back to
 * "click", and events with no `point` never reach the table at all.
 *
 * Derived server-side from the validated verb on purpose: the client could
 * otherwise label a dead click as a real one, and the heatmap's whole value is
 * that the two can be told apart.
 */
export const POINT_KIND: Record<string, string> = {
  click: "click",
  dead_click: "dead",
  rage_click: "rage",
};

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IncomingEvent {
  event?: unknown;
  path?: unknown;
  /** Client-side ordering tie-breaker. See QueuedEvent.seq in event-queue.ts. */
  seq?: unknown;
  referrer?: unknown;
  props?: unknown;
  viewport_w?: unknown;
  viewport_h?: unknown;
  duration_ms?: unknown;
  point?: unknown;
}

/** Keeps a forged header or a very long URL from bloating a row. */
export function clamp(value: unknown, max: number): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.slice(0, max);
}

/** Non-negative integers only; anything else becomes null rather than a bad row. */
export function clampInt(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0) return null;
  return Math.min(n, max);
}

/** A 0-1 coordinate, or null. Out-of-range values are clamped, not rejected. */
export function clampPct(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, Number(value.toFixed(5))));
}

/**
 * Accept a props object only if it is small and shallow.
 *
 * Nested objects and arrays are dropped rather than truncated: nesting is how a
 * byte cap gets defeated, and nothing reading this column needs it.
 */
export function sanitiseProps(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_PROPS_KEYS);
  const out: Record<string, unknown> = {};

  for (const [key, raw] of entries) {
    if (typeof raw === "string") out[key] = raw.slice(0, 300);
    else if (typeof raw === "number" || typeof raw === "boolean" || raw === null) out[key] = raw;
  }

  if (Object.keys(out).length === 0) return null;
  return JSON.stringify(out).length > MAX_PROPS_BYTES ? null : out;
}

/* ─────────────────────────── campaign attribution ─────────────────────────── */

const UTM_RE = /^[a-z0-9][a-z0-9._-]*$/;
const CLICK_ID_RE = /^[A-Za-z0-9_.-]+$/;

/**
 * Anything that looks like it identifies a person rather than an advert.
 *
 * The mirror of LOOKS_LIKE_PII in src/lib/utm.ts, and the reason this file
 * repeats the client's rules at all: track-visit is verify_jwt=false with CORS
 * `*`, so the browser is not the only thing that can post here. Leaving this one
 * rule out made the endpoint accept a bare phone number — the mail-merge case
 * the client-side check was written for — while Privacy.tsx tells users that
 * "where a link contains anything resembling personal information, that value is
 * discarded rather than stored".
 *
 * Dropped whole, never scrubbed: a scrubbed value still reads as a plausible
 * campaign name in a report and nobody would notice it was somebody's email.
 */
const LOOKS_LIKE_PII = /@|%40|\d{7,}/;

export interface IncomingAttribution {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  click_id?: unknown;
  click_id_source?: unknown;
  landing_path?: unknown;
  visitor_id?: unknown;
}

/**
 * A campaign value, or null. Rejects — never truncates.
 *
 * The odd one out in this file, which clamps everything else. A clipped path is
 * still that path, but a clipped campaign name is a *different* campaign: it
 * would become a second row in the report that looks exactly like a real one,
 * and nothing downstream could tell the two apart. Better to lose one field of
 * one row than to invent a campaign.
 *
 * The client normalises to the same shape before sending; this repeats it
 * because the client is not the only possible caller of an open endpoint.
 */
export function normaliseUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Tested against the raw value, before trimming or lowercasing, so an encoded
  // `%40` is caught the same way the client catches it.
  if (LOOKS_LIKE_PII.test(value)) return null;
  const v = value.trim().toLowerCase();
  if (!v || v.length > MAX_UTM_LEN || !UTM_RE.test(v)) return null;
  return v;
}

/**
 * Whitelist the campaign block that rides alongside session_id.
 *
 * Per-field: one bad value must not cost the others, because a report split by
 * source is still useful when utm_term happened to be junk. All-null returns
 * null so the row keeps its columns empty rather than storing a shell object.
 */
export function sanitiseAttribution(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const a = value as IncomingAttribution;
  const source = typeof a.click_id_source === "string" ? a.click_id_source : "";
  const clickId =
    typeof a.click_id === "string" &&
    a.click_id.length <= MAX_CLICK_ID_LEN &&
    CLICK_ID_RE.test(a.click_id)
      ? a.click_id
      : null;
  // An id with no network, or a network with no id, is half a fact. Neither half
  // can be read without the other, so both go.
  const paired = clickId !== null && (source === "gclid" || source === "fbclid");

  const row = {
    utm_source: normaliseUtm(a.utm_source),
    utm_medium: normaliseUtm(a.utm_medium),
    utm_campaign: normaliseUtm(a.utm_campaign),
    utm_content: normaliseUtm(a.utm_content),
    utm_term: normaliseUtm(a.utm_term),
    click_id: paired ? clickId : null,
    click_id_source: paired ? source : null,
    // A truncated path is still a usable path, so this one clamps.
    landing_path: clamp(a.landing_path, 512),
    // Same validator as session_id: an arbitrary string here would let a caller
    // invent a visitor whose sessions roll up together.
    visitor_id:
      typeof a.visitor_id === "string" && UUID_RE.test(a.visitor_id) ? a.visitor_id : null,
  };

  return Object.values(row).some((v) => v !== null) ? row : null;
}

/**
 * Normalise either body shape into a list.
 *
 * Single:  { session_id, event, path, referrer }        — the immediate path
 * Batch:   { session_id, events: [ … ] }                — the queued path
 *
 * The single shape is the batch shape with one element, so nothing downstream
 * has to handle two cases.
 *
 * `attribution` is deliberately NOT read here. It belongs to the session rather
 * than to any one event, and the single-shape branch below silently drops keys
 * it does not name — exactly the trap a top-level campaign field would fall
 * into. track-visit reads body.attribution itself.
 */
export function readEvents(body: Record<string, unknown>): IncomingEvent[] {
  if (Array.isArray(body.events)) {
    return body.events.slice(0, MAX_BATCH) as IncomingEvent[];
  }
  return [{
    event: body.event,
    path: body.path,
    referrer: body.referrer,
    props: body.props,
  }];
}
