import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ALLOWED_EVENTS,
  clamp,
  clampInt,
  clampPct,
  MAX_BATCH,
  normaliseUtm,
  readEvents,
  sanitiseAttribution,
  sanitiseProps,
  UUID_RE,
} from "./event-payload.ts";

Deno.test("readEvents treats the single-event body as a one-element batch", () => {
  const events = readEvents({
    session_id: "x",
    event: "kundali_generated",
    path: "/kundali",
    referrer: null,
  });
  assertEquals(events.length, 1);
  assertEquals(events[0].event, "kundali_generated");
  assertEquals(events[0].path, "/kundali");
});

Deno.test("readEvents passes a batch through", () => {
  const events = readEvents({
    session_id: "x",
    events: [{ event: "page_view" }, { event: "click" }],
  });
  assertEquals(events.length, 2);
});

// A caller controls the array length, so the cap has to be enforced on read
// rather than trusted from the client's own MAX_BATCH constant.
Deno.test("readEvents caps an oversized batch instead of writing all of it", () => {
  const events = readEvents({
    session_id: "x",
    events: Array.from({ length: 500 }, () => ({ event: "click" })),
  });
  assertEquals(events.length, MAX_BATCH);
});

Deno.test("readEvents on an empty body yields one event that defaults later", () => {
  const events = readEvents({});
  assertEquals(events.length, 1);
  assertEquals(events[0].event, undefined);
});

Deno.test("the allowlist covers the client's verbs and nothing else", () => {
  for (const event of [
    "visit", "page_view", "session_end", "click",
    "kundali_generated", "payment_started", "signed_in", "error",
  ]) {
    assert(ALLOWED_EVENTS.has(event), `${event} should be allowed`);
  }
  // Completion is read from payment_orders, never reported by the browser.
  assert(!ALLOWED_EVENTS.has("payment_completed"));
  assert(!ALLOWED_EVENTS.has("drop table"));
});

Deno.test("sanitiseProps keeps scalars and truncates long strings", () => {
  const props = sanitiseProps({
    tag: "UnlockKndali_Pay99",
    clicks: 3,
    sampled: true,
    nothing: null,
    long: "x".repeat(1_000),
  });
  assertEquals(props?.tag, "UnlockKndali_Pay99");
  assertEquals(props?.clicks, 3);
  assertEquals(props?.sampled, true);
  assertEquals(props?.nothing, null);
  assertEquals((props?.long as string).length, 300);
});

// Nesting is how a byte cap gets defeated, and nothing reads it.
Deno.test("sanitiseProps drops nested objects and arrays", () => {
  const props = sanitiseProps({ tag: "ok", nested: { a: 1 }, list: [1, 2, 3] });
  assertEquals(Object.keys(props ?? {}), ["tag"]);
});

Deno.test("sanitiseProps caps the number of keys", () => {
  const wide: Record<string, number> = {};
  for (let i = 0; i < 100; i++) wide[`k${i}`] = i;
  assertEquals(Object.keys(sanitiseProps(wide) ?? {}).length, 20);
});

// Rejected outright rather than truncated: half a serialised object in a jsonb
// column is indistinguishable from real data once written.
Deno.test("sanitiseProps rejects a payload that is still too large after key capping", () => {
  const heavy: Record<string, string> = {};
  for (let i = 0; i < 20; i++) heavy[`key${i}`] = "y".repeat(300);
  assertEquals(sanitiseProps(heavy), null);
});

Deno.test("sanitiseProps returns null for non-objects and empty results", () => {
  assertEquals(sanitiseProps(null), null);
  assertEquals(sanitiseProps("string"), null);
  assertEquals(sanitiseProps([1, 2]), null);
  assertEquals(sanitiseProps({}), null);
  // An object of only unusable values is the same as no props.
  assertEquals(sanitiseProps({ fn: { deep: true } }), null);
});

Deno.test("clamp truncates and rejects non-strings", () => {
  assertEquals(clamp("abcdef", 3), "abc");
  assertEquals(clamp("", 10), null);
  assertEquals(clamp(42, 10), null);
  assertEquals(clamp(null, 10), null);
});

Deno.test("clampInt rounds, floors at zero and caps at the maximum", () => {
  assertEquals(clampInt(12.6, 100), 13);
  assertEquals(clampInt(500, 100), 100);
  assertEquals(clampInt(-1, 100), null);
  assertEquals(clampInt(Number.NaN, 100), null);
  assertEquals(clampInt("30", 100), null);
});

Deno.test("clampPct holds a coordinate inside 0-1", () => {
  assertEquals(clampPct(0.5), 0.5);
  assertEquals(clampPct(1.4), 1);
  assertEquals(clampPct(-0.2), 0);
  assertEquals(clampPct(Number.POSITIVE_INFINITY), null);
  assertEquals(clampPct(null), null);
  // Five decimals matches the numeric(6,5) column, so no value is silently
  // rounded by Postgres after passing validation here.
  assertEquals(clampPct(0.123456789), 0.12346);
});

Deno.test("UUID_RE accepts the client's session id and rejects arbitrary keys", () => {
  assert(UUID_RE.test("11111111-2222-3333-4444-555555555555"));
  assert(!UUID_RE.test("sample-session-1"));
  assert(!UUID_RE.test("canary-abc"));
});

Deno.test("normaliseUtm lowercases and trims a good value", () => {
  assertEquals(normaliseUtm("WhatsApp"), "whatsapp");
  assertEquals(normaliseUtm("  2026-09-diwali  "), "2026-09-diwali");
  assertEquals(normaliseUtm("story_3.b"), "story_3.b");
});

Deno.test("normaliseUtm rejects rather than truncates", () => {
  // A clipped campaign name is a DIFFERENT campaign: it would become a second
  // row in the report indistinguishable from a real one.
  assertEquals(normaliseUtm("c".repeat(65)), null);
  assertEquals(normaliseUtm("c".repeat(64)), "c".repeat(64));
});

Deno.test("normaliseUtm rejects anything outside the agreed charset", () => {
  assertEquals(normaliseUtm("diwali sale"), null);
  assertEquals(normaliseUtm("ravi@example.com"), null);
  assertEquals(normaliseUtm("-leading"), null);
  assertEquals(normaliseUtm(""), null);
  assertEquals(normaliseUtm(123), null);
  assertEquals(normaliseUtm(null), null);
  assertEquals(normaliseUtm({ utm_source: "x" }), null);
});

Deno.test("sanitiseAttribution keeps the good fields and nulls the bad", () => {
  const row = sanitiseAttribution({
    utm_source: "WhatsApp",
    utm_medium: "message",
    utm_campaign: "2026-09-diwali",
    utm_term: "not a term",
    landing_path: "/home",
    visitor_id: "11111111-2222-3333-4444-555555555555",
  });
  assert(row);
  assertEquals(row.utm_source, "whatsapp");
  assertEquals(row.utm_campaign, "2026-09-diwali");
  // One bad value must not cost the others — a report split by source is still
  // useful when utm_term happened to be junk.
  assertEquals(row.utm_term, null);
  assertEquals(row.landing_path, "/home");
});

Deno.test("sanitiseAttribution rejects a non-object or an all-invalid block", () => {
  assertEquals(sanitiseAttribution("whatsapp"), null);
  assertEquals(sanitiseAttribution(["whatsapp"]), null);
  assertEquals(sanitiseAttribution(null), null);
  assertEquals(sanitiseAttribution({}), null);
  assertEquals(sanitiseAttribution({ utm_source: "a b", utm_term: 42 }), null);
});

Deno.test("sanitiseAttribution requires a click id and its network together", () => {
  const orphanId = sanitiseAttribution({ utm_source: "google", click_id: "Cj0KCQ" });
  assert(orphanId);
  assertEquals(orphanId.click_id, null);
  assertEquals(orphanId.click_id_source, null);

  const orphanSource = sanitiseAttribution({ utm_source: "google", click_id_source: "gclid" });
  assert(orphanSource);
  assertEquals(orphanSource.click_id_source, null);

  const paired = sanitiseAttribution({ click_id: "Cj0KCQiA_Xy", click_id_source: "gclid" });
  assert(paired);
  // Ad click ids are case-significant, so this one is validated, not lowercased.
  assertEquals(paired.click_id, "Cj0KCQiA_Xy");
  assertEquals(paired.click_id_source, "gclid");

  const madeUpNetwork = sanitiseAttribution({ click_id: "abc", click_id_source: "ttclid" });
  assertEquals(madeUpNetwork, null);
});

Deno.test("sanitiseAttribution requires a UUID visitor id", () => {
  const bad = sanitiseAttribution({ utm_source: "whatsapp", visitor_id: "abc" });
  assert(bad);
  // An arbitrary string here would let a caller invent a visitor whose sessions
  // roll up together.
  assertEquals(bad.visitor_id, null);
});

Deno.test("readEvents ignores attribution, which is a body key not an event field", () => {
  const events = readEvents({
    session_id: "x",
    event: "visit",
    path: "/home",
    referrer: null,
    attribution: { utm_source: "whatsapp" },
  });
  assertEquals(events.length, 1);
  assertEquals(Object.keys(events[0]).sort(), ["event", "path", "props", "referrer"]);
});

Deno.test("normaliseUtm rejects values that look like a person, not an advert", () => {
  // The client drops these before sending. This file repeats the rule because
  // track-visit is verify_jwt=false with CORS `*` — the browser is not the only
  // thing that can post here — and because Privacy.tsx promises it.
  assertEquals(normaliseUtm("ravi@gmail.com"), null);
  assertEquals(normaliseUtm("ravi%40gmail.com"), null);
  assertEquals(normaliseUtm("9876543210"), null);
  assertEquals(normaliseUtm("lead-9876543210"), null);
});

Deno.test("normaliseUtm keeps short digit runs, which are campaign years not phone numbers", () => {
  assertEquals(normaliseUtm("diwali-2026"), "diwali-2026");
  assertEquals(normaliseUtm("q4-2026"), "q4-2026");
});

Deno.test("normaliseUtm rejects a leading underscore, matching the client", () => {
  // src/lib/utm.ts strips these before sending; anything still carrying one did
  // not come from our client.
  assertEquals(normaliseUtm("_promo"), null);
  assertEquals(normaliseUtm("diwali_2026"), "diwali_2026");
});
