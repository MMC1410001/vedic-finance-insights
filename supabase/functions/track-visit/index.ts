/**
 * track-visit — writes visitor_events rows with the caller's server-observed IP.
 *
 * Unauthenticated by design (verify_jwt = false): guests are the whole point.
 * If an Authorization header happens to carry a real user JWT we attach the
 * user_id, but a missing or anon-key header is the normal case, not an error.
 *
 * This endpoint must never affect what the user sees. Every failure path returns
 * 200 with { ok: false } — the client fires and forgets.
 *
 * ── Two body shapes ─────────────────────────────────────────────────────────
 * Single:  { session_id, event, path, referrer, attribution? }
 * Batch:   { session_id, events: [{ event, path, referrer, props, ... }, …] }
 *
 * The single shape is the original and is still used by the immediate path in
 * visitor-tracking.ts, for the milestones where losing an event would lose a
 * conversion. The batch shape serves event-queue.ts, which collects page views
 * and clicks and sends them together — otherwise a browsing session would be
 * dozens of separate invokes.
 *
 * Note the batch arrives from navigator.sendBeacon on page exit, which cannot
 * set headers. Those rows therefore have no user_id, and that is fine:
 * visitor_session_summary resolves a session's user from the last non-null
 * user_id on any event in the session, so one attributed row covers all of them.
 *
 * ── The third body key ──────────────────────────────────────────────────────
 * `attribution` carries the campaign the session landed on (utm_*, an ad click
 * id, the landing path and a per-browser visitor id). It sits beside session_id
 * because it describes the session, and it is written onto the `visit` row only.
 * A forged or malformed block costs its own fields and nothing else — the event
 * is still written, because a dropped visit loses a whole session.
 *
 * ── Geography ───────────────────────────────────────────────────────────────
 * The `visit` row also carries an approximate city, resolved from the IP. The
 * cache is read before the insert (a local indexed lookup); on a miss the
 * provider is called AFTER the response, and the row is backfilled. So the
 * visitor never waits on it, and a provider outage costs a city, not a session.
 * Off entirely unless IPINFO_TOKEN is set — see _shared/geo.ts.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/client-ip.ts";
import { classifyUserAgent } from "../_shared/user-agent.ts";
import { backfillSession, cachedPlace, geoEnabled, headerCountry, isPrivateIp, resolveAndCache } from "../_shared/geo.ts";
import {
  ALLOWED_EVENTS,
  clamp,
  clampInt,
  clampPct,
  MAX_DURATION_MS,
  POINT_KIND,
  readEvents,
  sanitiseAttribution,
  sanitiseProps,
  UUID_RE,
} from "../_shared/event-payload.ts";

/**
 * Per-IP write cap. The function is CORS `*` and unauthenticated, so without
 * this anyone can inflate the table at will. In-memory and per-isolate, so it is
 * a speed bump against casual abuse, not a real rate limiter — the durable
 * per-IP limit lives in generate-report, counting rows.
 *
 * Counted in *events*, not requests, so batching cannot be used to slip past it.
 */
const WRITES_PER_IP_PER_MINUTE = 120;

const writeCounts = new Map<string, { count: number; windowStart: number }>();

function overWriteCap(ip: string, now: number, cost: number): boolean {
  const entry = writeCounts.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    writeCounts.set(ip, { count: cost, windowStart: now });
    // Bound the map: an isolate that lives long enough to see thousands of IPs
    // should not hold them all.
    if (writeCounts.size > 5_000) {
      for (const [key, value] of writeCounts) {
        if (now - value.windowStart > 60_000) writeCounts.delete(key);
      }
    }
    return cost > WRITES_PER_IP_PER_MINUTE;
  }
  entry.count += cost;
  return entry.count > WRITES_PER_IP_PER_MINUTE;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ip, chain } = getClientIp(req);
    const now = Date.now();

    // sendBeacon posts text/plain to dodge a CORS preflight it has no time for,
    // so the content type is never checked — req.json() parses the body either way.
    const body = await req.json().catch(() => ({}));

    // session_id must be the UUID the client already mints for kundli_reports.
    // Rejecting anything else keeps the table joinable and stops an open
    // endpoint from being filled with arbitrary keys.
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    if (!UUID_RE.test(sessionId)) {
      return json({ ok: false, reason: "invalid_session_id" }, 400);
    }

    const incoming = readEvents(body);
    if (incoming.length === 0) return json({ ok: false, reason: "no_events" }, 400);

    // Session-level, so read from the body rather than from an event.
    const attribution = sanitiseAttribution(body.attribution);

    // Whether this request carries the one row a session's geography goes on.
    const wantsGeo = geoEnabled() && !!ip && !isPrivateIp(ip) &&
      incoming.some((item) => (typeof item.event === "string" ? item.event : "visit") === "visit");

    // Charged per event, before any work, so a 50-event batch costs 50.
    if (ip && overWriteCap(ip, now, incoming.length)) {
      return json({ ok: false, reason: "rate_limited" });
    }

    const userAgent = req.headers.get("user-agent");
    const { device, browser, os } = classifyUserAgent(userAgent);

    const eventRows: Record<string, unknown>[] = [];
    const pointRows: Record<string, unknown>[] = [];
    let rejected = 0;

    for (const item of incoming) {
      const event = typeof item.event === "string" ? item.event : "visit";
      if (!ALLOWED_EVENTS.has(event)) {
        // One bad event in a batch must not discard the good ones — the client
        // cannot retry, so the rest would simply be lost.
        rejected += 1;
        continue;
      }

      const path = clamp(item.path, 512);

      eventRows.push({
        session_id: sessionId,
        ip_address: ip,
        ip_chain: clamp(chain, 512),
        user_agent: clamp(userAgent, 512),
        referrer: clamp(item.referrer, 512),
        path,
        event,
        props: sanitiseProps(item.props),
        viewport_w: clampInt(item.viewport_w, 20_000),
        viewport_h: clampInt(item.viewport_h, 20_000),
        device,
        browser,
        os,
        // Ordering tie-breaker within a batch. `created_at` is now(), which is
        // transaction time, so every row this insert writes shares one
        // timestamp — without this the dwell and exit-page windows in
        // admin_analytics() have nothing to order by. See QueuedEvent.seq.
        seq: clampInt(item.seq, 2_000_000_000),
        // Capped at 6 hours: a larger figure is a backgrounded tab, not
        // attention, and would drag every average it touches.
        duration_ms: clampInt(item.duration_ms, MAX_DURATION_MS),
        // One row per page load carries the campaign. Spread onto `visit` only:
        // the session is already attributed by that row, and stamping later
        // events too would create rows that could disagree with it.
        ...(event === "visit" && attribution ? attribution : {}),
      });

      // Coordinates go to their own table — 10-100x the volume, 30-day retention.
      const point = item.point as Record<string, unknown> | undefined;
      const x = clampPct(point?.x_pct);
      const y = clampPct(point?.y_pct);
      if (path && x !== null && y !== null) {
        pointRows.push({
          session_id: sessionId,
          path,
          device,
          viewport_w: clampInt(item.viewport_w, 20_000),
          viewport_h: clampInt(item.viewport_h, 20_000),
          x_pct: x,
          y_pct: y,
          // The height y_pct is a fraction of. Without it the admin panel has to
          // guess, and its only available guess is the height of its own iframe —
          // a different page state to the one the visitor clicked on.
          doc_h: clampInt(point?.doc_h, 200_000),
          selector: clamp(point?.selector, 300),
          // Derived from the already-validated verb rather than read from the body,
          // so a point row can never disagree with its event row about what kind of
          // click it was.
          kind: POINT_KIND[event] ?? "click",
        });
      }
    }

    if (eventRows.length === 0) {
      return json({ ok: false, reason: "unknown_event", rejected }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Best-effort user attribution. functions.invoke sends the anon key when
    // signed out, which resolves to no user — expected, not a failure. A beacon
    // sends no header at all, which is also expected; see the header comment.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const { data } = await supabaseAdmin.auth.getUser(jwt);
      userId = data?.user?.id ?? null;
    }

    // A local indexed read, not the provider — fast enough to sit on the request
    // path, and after the first day almost every address is already here.
    const cached = wantsGeo && ip ? await cachedPlace(supabaseAdmin, ip) : null;

    const { error } = await supabaseAdmin
      .from("visitor_events")
      .insert(
        eventRows.map((row) => ({
          ...row,
          user_id: userId,
          // Geography goes on the `visit` row only, same as attribution: it
          // describes where the session came from, not each thing it did.
          ...(cached && row.event === "visit"
            ? { city: cached.city, region: cached.region, country: cached.country }
            : {}),
        })),
      );

    if (error) {
      console.error(`track-visit insert failed [${error.code ?? "no-code"}]: ${error.message}`);
      return json({ ok: false, reason: "insert_failed" });
    }

    // Written after the events, and its failure is not the caller's problem: a
    // missing heatmap point is a cosmetic loss, a missing funnel event is not.
    if (pointRows.length > 0) {
      const { error: pointError } = await supabaseAdmin.from("click_points").insert(pointRows);
      if (pointError) {
        console.error(`track-visit click_points failed [${pointError.code ?? "no-code"}]: ${pointError.message}`);
      }
    }

    // Cache miss: ask the provider AFTER the rows are safely written, and after
    // this response has been handed back. The visitor waits for nothing, and an
    // outage or a rate limit costs a city rather than a session. waitUntil keeps
    // the isolate alive for it; without that API the promise is simply left to
    // run and may be cut short, which is an acceptable loss for a city.
    if (wantsGeo && ip && !cached) {
      // The floor: the country the edge network put on this very request. Read
      // now, while the request still exists — the background task below outlives
      // it. Costs nothing, cannot fail, and is what remains when every provider
      // is down or every token has lapsed. Never cached; see headerCountry().
      const fromHeader = headerCountry(req);
      const task = resolveAndCache(supabaseAdmin, ip)
        .then((place) =>
          backfillSession(
            supabaseAdmin,
            sessionId,
            // A provider answer always wins. This only fills the gap where the
            // whole chain came back with nothing at all.
            place.city !== null || place.country !== null ? place : fromHeader,
          )
        )
        .catch(() => {
          /* never surfaces: geography is not worth a failed request */
        });
      const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
        .EdgeRuntime;
      if (typeof runtime?.waitUntil === "function") runtime.waitUntil(task);
    }

    return json({ ok: true, written: eventRows.length, points: pointRows.length, rejected });
  } catch (e) {
    // Swallowed on purpose: analytics must never surface an error to the user.
    console.error("track-visit unhandled:", e instanceof Error ? e.message : e);
    return json({ ok: false, reason: "error" });
  }
});
