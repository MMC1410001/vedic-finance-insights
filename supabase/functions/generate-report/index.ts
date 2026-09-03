import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/client-ip.ts";
import {
  limitsFor,
  REPORTS_PER_IP_PER_HOUR,
  REPORTS_PER_SESSION_PER_HOUR,
  REPORTS_PER_USER_PER_HOUR,
} from "../_shared/rate-limit.ts";
import { buildChart, buildD9, computeDasha, computeTransits, computeScores, buildReport } from "./engine.ts";

// ── Per-IP rate limit ───────────────────────────────────────────────────────
// This function is verify_jwt = false with Access-Control-Allow-Origin: *, so it
// is open to anyone on the internet and does real ephemeris work per call. A
// genuine user generates one or two reports; the cap is set well above that.
//
// Every call writes a 'report_requested' row to visitor_events and the cap
// counts those rows — so the ledger covers direct API hammering, not just calls
// that came from our own UI.
//
// Set RATE_LIMIT_GENERATE_REPORT=enforce in the function secrets to return 429.
// Anything else (including unset) logs the breach and lets the request through,
// which is the intended posture until the real traffic distribution is known.
// Re-exported so existing importers keep working; the values and the reasoning
// now live in _shared/rate-limit.ts, where they can be tested.
export { REPORTS_PER_IP_PER_HOUR, REPORTS_PER_SESSION_PER_HOUR, REPORTS_PER_USER_PER_HOUR };

const enforcing = () =>
  Deno.env.get("RATE_LIMIT_GENERATE_REPORT") === "enforce";

/**
 * The service-role client used for the ledger, or null when there is nothing to
 * write. Returning null instead of throwing on missing env is deliberate: the
 * ledger is bookkeeping, and chart generation must not depend on it.
 *
 * A function rather than an inline expression so its type is inferred — an
 * explicit `ReturnType<typeof createClient>` annotation resolves the Database
 * generic to its constraint and types every insert payload as `never`.
 */
function makeLedger(internalCall: boolean) {
  if (internalCall) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ip, chain } = getClientIp(req);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // chat, luxury-analysis and investment-baskets all fan back in here through
    // _shared/get-report.ts, which sends the service-role key as `apikey`. Those
    // arrive from Supabase's own network, so one shared internal address would
    // otherwise burn the whole per-IP budget for every user at once. The browser
    // only ever holds the anon key, so this cannot be forged from the client.
    const internalCall = !!serviceKey && req.headers.get("apikey") === serviceKey;

    const ledger = makeLedger(internalCall);

    const body = await req.json();

    // Rate limit. Wrapped so a Postgres hiccup can never stop a user getting
    // their chart — a rate limiter must fail open on a paid feature.
    //
    // Keyed per caller rather than per address: see _shared/rate-limit.ts for
    // why per-IP alone was wrong, and for the honest position on guests.
    let overLimit = false;
    try {
      if (ledger) {
        // Office networks are exempt outright. The same internal_traffic rules
        // that keep the team out of the Analytics numbers keep them out of the
        // rate limiter, so exempting an office is one decision in one place.
        let internal = false;
        if (ip) {
          const { data } = await ledger.rpc("is_internal_ip", { p_ip: ip });
          internal = data === true;
        }

        if (!internal) {
          // Best-effort identity. A guest has no JWT, which is expected — the
          // limits below account for that rather than treating it as an error.
          let userId: string | null = null;
          const authHeader = req.headers.get("Authorization");
          if (authHeader && !internalCall) {
            const jwt = authHeader.replace(/^Bearer\s+/i, "");
            const { data } = await ledger.auth.getUser(jwt);
            userId = data?.user?.id ?? null;
          }

          const sessionId = typeof body.session_id === "string" ? body.session_id : null;
          const since = new Date(Date.now() - 3_600_000).toISOString();

          for (const check of limitsFor({ userId, sessionId, ip })) {
            const { count } = await ledger
              .from("visitor_events")
              .select("id", { count: "exact", head: true })
              .eq(check.column, check.value)
              .eq("event", "report_requested")
              .gte("created_at", since);

            if ((count ?? 0) >= check.max) {
              overLimit = true;
              // Names the rule, not just the number: "would hit ip" and "would
              // hit user" call for completely different responses.
              console.warn(
                `rate limit ${enforcing() ? "hit" : "would hit"} [${check.label}] ` +
                  `for ${check.value}: ${count} reports in 1h (max ${check.max})`,
              );
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error("rate-limit check failed, allowing request:", e instanceof Error ? e.message : e);
    }

    if (overLimit && enforcing()) {
      return new Response(
        JSON.stringify({ detail: "Too many reports from this network. Try again in an hour." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 },
      );
    }

    // Not awaited: the ledger row must not add latency to chart generation.
    if (ledger) {
      // "direct-api" for callers that hit the endpoint without going through the
      // app — they have no sessionStorage, so there is no session to join on.
      // They still need a row, because they are the traffic worth catching.
      const sessionId = typeof body.session_id === "string" ? body.session_id : null;
      void ledger
        .from("visitor_events")
        .insert({
          session_id: sessionId ?? "direct-api",
          ip_address: ip,
          ip_chain: chain?.slice(0, 512) ?? null,
          user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
          event: "report_requested",
        })
        .then(({ error }) => {
          if (error) console.error(`ledger insert failed: ${error.message}`);
        });
    }

    const { birth_date, birth_time, timezone, birth_time_accuracy, latitude, longitude } = body;

    if (!birth_date || !birth_time) {
      return new Response(
        JSON.stringify({ detail: "birth_date and birth_time are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const tz = typeof timezone === "number" ? timezone : 5.5;
    const accuracy = birth_time_accuracy ?? "exact";
    const lat = typeof latitude === "number" ? latitude : 28.6139; // default Delhi
    const lon = typeof longitude === "number" ? longitude : 77.2090;

    // 1. Build D1 chart (with proper Lagna from lat/lon)
    const { jd, rawPlanets, lagnaSignNum, d1 } = buildChart(birth_date, birth_time, tz, lat, lon);

    // 2. Build D9 (Navamsa) chart
    const d9 = buildD9(rawPlanets, lagnaSignNum);

    // 3. Compute Vimshottari Dasha
    const dasha = computeDasha(rawPlanets["Moon"], birth_date, birth_time);

    // 4. Compute current transits
    const transits = computeTransits(rawPlanets, lagnaSignNum);

    // 5. Financial scoring
    const { scores, log } = computeScores(d1, dasha, transits);

    // 6. Build full report
    const report = buildReport(d1, d9, dasha, transits, scores, log, accuracy);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ detail: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
