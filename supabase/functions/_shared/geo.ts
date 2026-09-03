/**
 * Approximate location for an IP address, resolved once and cached.
 *
 * ── The three rules this module exists to enforce ───────────────────────────
 * 1. It must never delay or fail a visitor event. Geography is a nice-to-have;
 *    a `visit` row is a whole session. Every path here returns rather than
 *    throws, and the caller resolves in the background on a cache miss.
 * 2. It must never call the provider twice for the same address. One row per IP
 *    in ip_geo, with a TTL — most of our traffic arrives through a handful of
 *    carrier egress addresses, so the hit rate is very high after the first day.
 * 3. It must be off by default. With no IPINFO_TOKEN set, every function here
 *    no-ops and the panel reports that geography is unavailable. Nobody's IP
 *    reaches a third party because a secret was forgotten in one environment.
 *
 * ── What the numbers mean ───────────────────────────────────────────────────
 * Indian mobile carriers NAT very large subscriber pools through a few metro
 * egress points, so users across a state routinely resolve to one city. GA4 does
 * the same lookup and inherits the same flaw. Treat the output as a regional
 * hint, never as where a person is.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Re-resolve an address after this long. Allocations move, but not quickly. */
const GEO_TTL_DAYS = 60;
/** The provider gets this long and no more; we are already off the hot path. */
const LOOKUP_TIMEOUT_MS = 2_500;
const MAX_FIELD_LEN = 120;

export interface GeoPlace {
  city: string | null;
  region: string | null;
  country: string | null;
}

const EMPTY: GeoPlace = { city: null, region: null, country: null };

/** Configured at all? Read per call so a secret added later needs no redeploy. */
export function geoEnabled(): boolean {
  return !!Deno.env.get("IPINFO_TOKEN");
}

/** Private and reserved ranges never leave the building — the office, and localhost. */
export function isPrivateIp(ip: string): boolean {
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // Documentation ranges (RFC 5737) — our own sample data uses them.
  if (/^(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(ip)) return true;
  return /^(::1$|fc|fd|fe80:)/i.test(ip);
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > MAX_FIELD_LEN) return null;
  return v;
}

/**
 * The cached answer for an address, or null when there is none worth using.
 *
 * A local index lookup, so the caller can await it on the request path without
 * meaningfully delaying the insert. Rows past the TTL are treated as a miss.
 */
export async function cachedPlace(
  admin: SupabaseClient,
  ip: string,
): Promise<GeoPlace | null> {
  try {
    const { data, error } = await admin
      .from("ip_geo")
      .select("city, region, country, resolved, resolved_at")
      .eq("ip", ip)
      .maybeSingle();

    if (error || !data) return null;

    const age = Date.now() - new Date(data.resolved_at as string).getTime();
    if (age > GEO_TTL_DAYS * 86_400_000) return null;

    // A row that resolved to nothing is still an answer: it stops the provider
    // being asked again every visit for an address it cannot place.
    if (!data.resolved) return EMPTY;

    return {
      city: (data.city as string) ?? null,
      region: (data.region as string) ?? null,
      country: (data.country as string) ?? null,
    };
  } catch {
    return null;
  }
}

/* ────────────────────────────── the provider chain ─────────────────────────── */

/**
 * One geolocation provider.
 *
 * `lookup` returns null when THIS provider failed — a non-2xx, a timeout, a
 * malformed body — as distinct from a GeoPlace with null fields, which means it
 * answered and could not place the address. The chain treats those differently:
 * a failure moves to the next provider, an empty answer is a real result.
 */
interface GeoSource {
  name: GeoSourceName;
  enabled(): boolean;
  lookup(ip: string): Promise<GeoPlace | null>;
}

export type GeoSourceName = "ipinfo" | "ipwho";

/** One fetch with the shared timeout. Returns null for anything that is not a 2xx. */
async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Timeout, DNS, connection reset — indistinguishable from a bad response
    // as far as the chain is concerned, and none of them is worth an error.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The providers, in the order they are tried.
 *
 * ── ipinfo — the primary, and the only one behind the master switch ──────────
 * Paid-tier accuracy and the one we have a commercial relationship with.
 *
 * ── ipwho.is — the reason this chain exists ──────────────────────────────────
 * Keyless, so there is no token to lapse; the fallback cannot fail the same way
 * the primary just did. Its free tier permits commercial use and allows
 * 1,000/day, which the 60-day cache makes very hard to approach. Verified to
 * agree with ipinfo exactly on our own Mumbai egress address, and to handle
 * IPv6, which Indian mobile carriers increasingly hand out.
 *
 * Two things about it are load-bearing and were both found by testing it rather
 * than reading about it:
 *
 *   1. It answers **HTTP 200 with `success: false`** for a reserved range. A
 *      plain `res.ok` check would take that for a real answer and cache a row
 *      that blocks the address for the whole TTL. Hence the explicit flag test.
 *   2. Its `country` is the full name ("India") where ipinfo's is the 2-letter
 *      code ("IN"). The column already holds codes, so `country_code` is the
 *      field to read — otherwise one country becomes two rows in the Cities
 *      table and neither is right.
 */
const SOURCES: GeoSource[] = [
  {
    name: "ipinfo",
    enabled: () => !!Deno.env.get("IPINFO_TOKEN"),
    async lookup(ip) {
      const token = Deno.env.get("IPINFO_TOKEN");
      if (!token) return null;
      const body = await getJson(
        `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${token}`,
      );
      if (!body) return null;
      return {
        city: clean(body.city),
        region: clean(body.region),
        country: clean(body.country),
      };
    },
  },
  {
    name: "ipwho",
    // No key, so nothing to configure and nothing to expire. The chain as a
    // whole is still gated by geoEnabled() in the caller.
    enabled: () => true,
    async lookup(ip) {
      const body = await getJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (!body) return null;
      // Trap 1. A 200 is not an answer here.
      if (body.success !== true) return null;
      return {
        city: clean(body.city),
        region: clean(body.region),
        // Trap 2. `country` is "India"; the column holds "IN".
        country: clean(body.country_code),
      };
    },
  },
];

/**
 * Ask the providers in turn, write the result to the cache, and hand it back.
 *
 * Intended to be called in the background — see the caller in track-visit. It
 * swallows everything: a rate limit, a timeout, a malformed body and an outage
 * are all "no city", never an error the visitor could notice.
 *
 * ── Why a country-only answer does not end the chain ────────────────────────
 * The chain stops at the first result carrying a **city**, not the first result
 * at all. A provider that can name only the country has not answered the
 * question the panel asks, so the next one gets a turn — while that country is
 * kept as a floor in case nothing better arrives. Stopping at the first non-null
 * response would let a degraded primary permanently mask a working fallback.
 */
export async function resolveAndCache(
  admin: SupabaseClient,
  ip: string,
): Promise<GeoPlace> {
  // Rule 3 of this module, unchanged: no token, no lookups anywhere. The
  // fallback exists for a token that LAPSED, not for a project where nobody
  // ever opted in.
  if (!geoEnabled() || isPrivateIp(ip)) return EMPTY;

  let place = EMPTY;
  let source: GeoSourceName | null = null;

  for (const provider of SOURCES) {
    if (!provider.enabled()) continue;

    const answer = await provider.lookup(ip);
    // null means this provider failed. Move on without recording anything —
    // its failure must not become a cached "could not place it".
    if (answer === null) continue;

    // The first provider to answer at all sets the floor, so a country-only
    // reply is not thrown away when every later provider fails outright.
    if (source === null || (place.country === null && answer.country !== null)) {
      place = answer;
      source = provider.name;
    }

    if (answer.city !== null) {
      place = answer;
      source = provider.name;
      break;
    }
  }

  // Nothing answered at all. Write no row: an outage is not evidence that the
  // address cannot be placed, and caching it would suppress retries for 60 days.
  if (source === null) return EMPTY;

  try {
    await admin.from("ip_geo").upsert(
      {
        ip,
        ...place,
        source,
        // "The provider placed this address somewhere", not "it named a city".
        // Keying this on city alone cached a country-only answer as unresolved,
        // and cachedPlace() then returned EMPTY for it — so the first visit got
        // a country (backfillSession fires on either field) and every later
        // visit from the same address silently lost it.
        resolved: place.city !== null || place.country !== null,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "ip" },
    );
  } catch {
    /* the cache failing costs a repeat lookup, nothing more */
  }

  return place;
}

/**
 * The country the edge network already knows, from the request itself.
 *
 * The last tier of the chain, and deliberately NOT a GeoSource: it makes no
 * network call, so it cannot fail, cannot rate-limit and cannot expire. Whatever
 * happens to every paid and keyless provider above it, this keeps working.
 *
 * ── Why its result is never written to ip_geo ───────────────────────────────
 * Caching a country-only row would satisfy cachedPlace() for the full 60-day
 * TTL, so restoring a lapsed token would appear to do nothing for two months —
 * the cache would keep serving the degraded answer and no city lookup would ever
 * be attempted. Reading a header costs nothing on every single request, so there
 * is no reason to cache it and a very good reason not to.
 *
 * Header availability is not something we can assert from here: Supabase edge
 * functions sit behind Cloudflare (client-ip.ts already reads cf-connecting-ip),
 * which makes cf-ipcountry very likely present, but likely is not verified. So
 * this reads a small candidate list and returns null when none is there —
 * costing nothing either way, and the ip_geo.source counts in /admin report
 * empirically which tiers actually fire.
 */
export function headerCountry(req: Request): GeoPlace {
  for (const name of ["cf-ipcountry", "x-vercel-ip-country", "x-country-code"]) {
    const value = req.headers.get(name)?.trim().toUpperCase();
    // Cloudflare sends XX for "could not determine" and T1 for Tor.
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") {
      return { city: null, region: null, country: value };
    }
  }
  return EMPTY;
}

/**
 * Backfill the rows already written for a session once a lookup returns.
 *
 * The event is inserted before the provider is asked, so on a cache miss the
 * row lands with no city and this fills it in a moment later. Scoped to the one
 * session and to rows that have no city, so it can never overwrite a better
 * answer or touch anyone else's data.
 *
 * Scoped to `visit` as well, because that is where the cached path puts
 * geography and the invariant has to hold either way. Without it a session
 * resolved from cache carried a city on one row while a session resolved by
 * backfill carried it on every row so far — the same fact in two shapes,
 * depending only on whether the address happened to be cached. Today's
 * aggregates take any non-null per session and cannot tell the difference; the
 * first query that counts rows rather than sessions would.
 */
export async function backfillSession(
  admin: SupabaseClient,
  sessionId: string,
  place: GeoPlace,
): Promise<void> {
  if (!place.city && !place.country) return;
  try {
    await admin
      .from("visitor_events")
      .update({ city: place.city, region: place.region, country: place.country })
      .eq("session_id", sessionId)
      .eq("event", "visit")
      .is("city", null);
  } catch {
    /* analytics must never surface an error */
  }
}
