import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { geoEnabled, isPrivateIp } from "./geo.ts";

// Needs env access, which is why test:functions carries --allow-env. Worth the
// flag: "off unless explicitly configured" is the guarantee that keeps a
// forgotten secret in one environment from sending visitor IPs to a third party.
Deno.test("geo is off unless a token is configured", () => {
  // The default posture: no secret, no third party ever sees a visitor's IP.
  Deno.env.delete("IPINFO_TOKEN");
  assertEquals(geoEnabled(), false);

  Deno.env.set("IPINFO_TOKEN", "tok_test");
  assertEquals(geoEnabled(), true);
  Deno.env.delete("IPINFO_TOKEN");
});

Deno.test("private and reserved addresses are never sent to the provider", () => {
  // The office, localhost, and container networks. Sending these would leak our
  // own topology to a third party and buy nothing — they cannot be geolocated.
  for (const ip of ["10.0.0.4", "127.0.0.1", "192.168.0.63", "172.16.5.9", "172.31.255.1", "169.254.1.1"]) {
    assert(isPrivateIp(ip), `${ip} should be private`);
  }
  assert(isPrivateIp("::1"));
  assert(isPrivateIp("fd00::1"));
  assert(isPrivateIp("fe80::abcd"));
});

Deno.test("the documentation ranges our sample data uses are treated as private", () => {
  // dev-visitor-mock hands out RFC 5737 addresses. A dev machine must not spend
  // real lookups on them, and they resolve to nothing anyway.
  for (const ip of ["192.0.2.7", "198.51.100.10", "203.0.113.42"]) {
    assert(isPrivateIp(ip), `${ip} should be treated as private`);
  }
});

Deno.test("ordinary public addresses are allowed through", () => {
  for (const ip of ["49.36.183.12", "8.8.8.8", "172.15.0.1", "172.32.0.1", "2401:4900::1"]) {
    assertEquals(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

/**
 * A stand-in that records the filters a backfill would have applied.
 *
 * The chain is builder-style and only the last link is awaited, so each step
 * returns the recorder and `is()` resolves.
 */
function fakeUpdater() {
  const calls: { row: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  let current: { row: Record<string, unknown>; filters: [string, unknown][] };
  const chain = {
    eq(column: string, value: unknown) {
      current.filters.push([column, value]);
      return chain;
    },
    is(column: string, value: unknown) {
      current.filters.push([column, value]);
      return Promise.resolve({ error: null });
    },
  };
  return {
    calls,
    from(_table: string) {
      return {
        update(row: Record<string, unknown>) {
          current = { row, filters: [] };
          calls.push(current);
          return chain;
        },
      };
    },
  };
}

/**
 * Geography belongs on the `visit` row, the same one the cached path stamps.
 *
 * Without the event filter, a session resolved from cache carried a city on one
 * row while a session resolved by backfill carried it on every row written so
 * far — the same fact in two shapes, decided by whether the address happened to
 * be cached. Nothing reading it today can tell; the first query that counts rows
 * rather than sessions would, and would be wrong in a way nobody would question.
 */
Deno.test("a backfill touches only the visit row, matching the cached path", async () => {
  const { backfillSession } = await import("./geo.ts");
  const admin = fakeUpdater();

  await backfillSession(admin as never, "session-1", {
    city: "Mumbai",
    region: "Maharashtra",
    country: "IN",
  });

  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].filters, [
    ["session_id", "session-1"],
    ["event", "visit"],
    // Never overwrite a city that is already there.
    ["city", null],
  ]);
});

Deno.test("a backfill with nothing to say writes nothing at all", async () => {
  const { backfillSession } = await import("./geo.ts");
  const admin = fakeUpdater();

  await backfillSession(admin as never, "session-1", { city: null, region: null, country: null });

  assertEquals(admin.calls.length, 0);
});

/**
 * A stand-in for the Supabase client that records what would have been written.
 * Only the two calls resolveAndCache makes are implemented.
 */
function fakeAdmin() {
  const upserts: Record<string, unknown>[] = [];
  return {
    upserts,
    from(_table: string) {
      return {
        upsert(row: Record<string, unknown>) {
          upserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

async function withProvider(
  body: unknown,
  run: (admin: ReturnType<typeof fakeAdmin>) => Promise<void>,
) {
  const realFetch = globalThis.fetch;
  Deno.env.set("IPINFO_TOKEN", "tok_test");
  globalThis.fetch = () =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  const admin = fakeAdmin();
  try {
    await run(admin);
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete("IPINFO_TOKEN");
  }
}

Deno.test("a country-only answer is cached as resolved, so the country survives", async () => {
  // Regression: `resolved` was written as `city !== null`, so an address the
  // provider placed only to a country cached as unresolved. cachedPlace() then
  // returned EMPTY for it and admin_audience()'s `and g.resolved` join excluded
  // it — the first visit got a country (backfillSession fires on either field)
  // and every later visit from that address silently lost it.
  await withProvider({ country: "IN" }, async (admin) => {
    const { resolveAndCache } = await import("./geo.ts");
    const place = await resolveAndCache(admin as never, "49.36.1.1");
    assertEquals(place.country, "IN");
    assertEquals(place.city, null);
    assertEquals(admin.upserts.length, 1);
    assertEquals(admin.upserts[0].resolved, true);
    assertEquals(admin.upserts[0].country, "IN");
  });
});

Deno.test("an answer that places nothing is cached as unresolved, not retried forever", async () => {
  await withProvider({ bogus: true }, async (admin) => {
    const { resolveAndCache } = await import("./geo.ts");
    const place = await resolveAndCache(admin as never, "49.36.1.2");
    assertEquals(place.city, null);
    assertEquals(place.country, null);
    // Still written: "asked and got nothing" is an answer worth remembering.
    assertEquals(admin.upserts.length, 1);
    assertEquals(admin.upserts[0].resolved, false);
  });
});

Deno.test("a full answer is cached as resolved", async () => {
  await withProvider({ city: "Pune", region: "Maharashtra", country: "IN" }, async (admin) => {
    const { resolveAndCache } = await import("./geo.ts");
    const place = await resolveAndCache(admin as never, "49.36.1.3");
    assertEquals(place.city, "Pune");
    assertEquals(admin.upserts[0].resolved, true);
  });
});

/* ─────────────────────────── the provider chain ──────────────────────────── */

/**
 * Route each provider to its own canned response, and record the call order.
 *
 * A single blanket stub cannot express what these tests are about: whether the
 * SECOND provider was reached at all. `calls` is the assertion that matters for
 * short-circuiting — a chain that always queries everything would still return
 * the right answer while doubling our external traffic.
 */
async function withChain(
  routes: { ipinfo?: { status: number; body: unknown }; ipwho?: { status: number; body: unknown } },
  run: (ctx: { admin: ReturnType<typeof fakeAdmin>; calls: string[] }) => Promise<void>,
  opts: { token?: string | null } = {},
) {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  const token = opts.token === undefined ? "tok_test" : opts.token;
  if (token === null) Deno.env.delete("IPINFO_TOKEN");
  else Deno.env.set("IPINFO_TOKEN", token);

  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    const which = url.includes("ipinfo.io") ? "ipinfo" : url.includes("ipwho.is") ? "ipwho" : "other";
    calls.push(which);
    const route = routes[which as "ipinfo" | "ipwho"];
    // No route configured means that provider is unreachable, which is a
    // network failure rather than an answer — the same as an outage.
    if (!route) return Promise.reject(new Error("unreachable"));
    return Promise.resolve(new Response(JSON.stringify(route.body), { status: route.status }));
  }) as typeof globalThis.fetch;

  const admin = fakeAdmin();
  try {
    await run({ admin, calls });
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete("IPINFO_TOKEN");
  }
}

const PUNE = { city: "Pune", region: "Maharashtra", country: "IN" };

Deno.test("the primary answering with a city ends the chain", async () => {
  // Not just "the answer is right" — the fallback must not be queried at all.
  // A chain that asks everyone every time doubles our outbound traffic and burns
  // the free tier we are relying on as a safety net.
  await withChain(
    { ipinfo: { status: 200, body: PUNE }, ipwho: { status: 200, body: { success: true, city: "Delhi" } } },
    async ({ admin, calls }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.1");
      assertEquals(place.city, "Pune");
      assertEquals(calls, ["ipinfo"]);
      assertEquals(admin.upserts[0].source, "ipinfo");
    },
  );
});

Deno.test("a rejected token falls through to the keyless provider", async () => {
  // The whole point of the chain: 403 is what a lapsed or revoked ipinfo token
  // returns, verified against the live API.
  await withChain(
    {
      ipinfo: { status: 403, body: { status: 403, error: { title: "Unknown token" } } },
      ipwho: { status: 200, body: { success: true, city: "Mumbai", region: "Maharashtra", country_code: "IN" } },
    },
    async ({ admin, calls }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.2");
      assertEquals(place, { city: "Mumbai", region: "Maharashtra", country: "IN" });
      assertEquals(calls, ["ipinfo", "ipwho"]);
      assertEquals(admin.upserts[0].source, "ipwho");
      assertEquals(admin.upserts[0].resolved, true);
    },
  );
});

Deno.test("ipwho.is answering 200 with success:false is NOT treated as an answer", async () => {
  // Trap, found by calling the live API: a reserved range comes back as HTTP 200
  // with {"success": false}. Checking only res.ok would cache that as a real
  // "could not place it" and block the address for the whole 60-day TTL.
  await withChain(
    {
      ipinfo: { status: 403, body: {} },
      ipwho: { status: 200, body: { ip: "10.0.0.1", success: false, message: "Reserved range" } },
    },
    async ({ admin, calls }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.3");
      assertEquals(place, { city: null, region: null, country: null });
      assertEquals(calls, ["ipinfo", "ipwho"]);
      // Nothing answered, so nothing is written: an outage is not evidence that
      // the address cannot be placed.
      assertEquals(admin.upserts.length, 0);
    },
  );
});

Deno.test("ipwho.is country is stored as the 2-letter code, not the full name", async () => {
  // Trap: ipwho.is sends country:"India" AND country_code:"IN". The column holds
  // ipinfo's codes, so reading the wrong field splits one country into two rows
  // in the Cities table.
  await withChain(
    {
      ipinfo: { status: 500, body: {} },
      ipwho: { status: 200, body: { success: true, city: "Pune", region: "Maharashtra", country: "India", country_code: "IN" } },
    },
    async ({ admin }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.4");
      assertEquals(place.country, "IN");
      assertEquals(admin.upserts[0].country, "IN");
    },
  );
});

Deno.test("a country-only primary does not mask a fallback that knows the city", async () => {
  // The chain stops at the first result carrying a CITY, not the first result at
  // all. Stopping at any non-null answer would let a degraded primary
  // permanently suppress a working fallback.
  await withChain(
    {
      ipinfo: { status: 200, body: { country: "IN" } },
      ipwho: { status: 200, body: { success: true, city: "Nagpur", region: "Maharashtra", country_code: "IN" } },
    },
    async ({ admin, calls }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.5");
      assertEquals(place.city, "Nagpur");
      assertEquals(calls, ["ipinfo", "ipwho"]);
      assertEquals(admin.upserts[0].source, "ipwho");
    },
  );
});

Deno.test("a country-only primary is kept when the fallback fails outright", async () => {
  // The floor must survive. Falling through for a better answer must not discard
  // the adequate one we already had.
  await withChain(
    { ipinfo: { status: 200, body: { country: "IN" } } }, // no ipwho route: unreachable
    async ({ admin }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.6");
      assertEquals(place.country, "IN");
      assertEquals(admin.upserts[0].source, "ipinfo");
      assertEquals(admin.upserts[0].resolved, true);
    },
  );
});

Deno.test("every provider failing writes no row, so retries are not suppressed", async () => {
  await withChain({}, async ({ admin, calls }) => {
    const { resolveAndCache } = await import("./geo.ts");
    const place = await resolveAndCache(admin as never, "49.36.2.7");
    assertEquals(place, { city: null, region: null, country: null });
    assertEquals(calls, ["ipinfo", "ipwho"]);
    assertEquals(admin.upserts.length, 0);
  });
});

Deno.test("the master switch still gates the WHOLE chain, keyless provider included", async () => {
  // The fallback exists for a token that lapsed, not for a project where nobody
  // opted in. With no token set, no address may reach any third party.
  await withChain(
    { ipwho: { status: 200, body: { success: true, city: "Pune", country_code: "IN" } } },
    async ({ admin, calls }) => {
      const { resolveAndCache } = await import("./geo.ts");
      const place = await resolveAndCache(admin as never, "49.36.2.8");
      assertEquals(place, { city: null, region: null, country: null });
      assertEquals(calls, []);
      assertEquals(admin.upserts.length, 0);
    },
    { token: null },
  );
});

/* ─────────────────────────── the header floor ────────────────────────────── */

Deno.test("headerCountry reads the country the edge network already knows", async () => {
  const { headerCountry } = await import("./geo.ts");
  const req = (h: Record<string, string>) => new Request("https://x.test", { headers: h });

  assertEquals(headerCountry(req({ "cf-ipcountry": "IN" })).country, "IN");
  assertEquals(headerCountry(req({ "cf-ipcountry": "in" })).country, "IN");
  assertEquals(headerCountry(req({ "x-country-code": "GB" })).country, "GB");
  // City and region are never guessed from a country header.
  assertEquals(headerCountry(req({ "cf-ipcountry": "IN" })).city, null);
});

Deno.test("headerCountry rejects Cloudflare's non-answers rather than storing them", async () => {
  const { headerCountry } = await import("./geo.ts");
  const req = (h: Record<string, string>) => new Request("https://x.test", { headers: h });

  // XX is "could not determine" and T1 is Tor — both would read as real
  // countries in the Cities table.
  assertEquals(headerCountry(req({ "cf-ipcountry": "XX" })).country, null);
  assertEquals(headerCountry(req({ "cf-ipcountry": "T1" })).country, null);
  assertEquals(headerCountry(req({ "cf-ipcountry": "INDIA" })).country, null);
  // And absence is simply absence — the tier is optional by design.
  assertEquals(headerCountry(req({})).country, null);
});
