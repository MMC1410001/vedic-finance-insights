/**
 * Deno tests for getClientIp. Run with:  npm run test:functions
 *
 * This is the first Deno-side test in the repo. It exists because header parsing
 * is the one piece of the IP pipeline with real branching, it is pure, and
 * getting it wrong writes wrong addresses into visitor_events silently — the
 * failure mode is bad data, not an error anyone would notice.
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getClientIp } from "./client-ip.ts";

const reqWith = (headers: Record<string, string>) =>
  new Request("https://example.test/", { headers });

Deno.test("prefers cf-connecting-ip over the forwarded chain", () => {
  const { ip } = getClientIp(reqWith({
    "cf-connecting-ip": "203.0.113.7",
    "x-forwarded-for": "10.0.0.1, 203.0.113.7",
  }));
  assertEquals(ip, "203.0.113.7");
});

Deno.test("prefers x-real-ip over the forwarded chain", () => {
  const { ip } = getClientIp(reqWith({
    "x-real-ip": "203.0.113.9",
    "x-forwarded-for": "198.51.100.1",
  }));
  assertEquals(ip, "203.0.113.9");
});

Deno.test("falls back to the leftmost x-forwarded-for entry", () => {
  const { ip } = getClientIp(reqWith({
    "x-forwarded-for": "198.51.100.1, 10.0.0.1, 10.0.0.2",
  }));
  assertEquals(ip, "198.51.100.1");
});

Deno.test("returns the whole chain so a forged leftmost entry stays visible", () => {
  const { ip, chain } = getClientIp(reqWith({
    "x-forwarded-for": "1.1.1.1, 203.0.113.7",
  }));
  assertEquals(ip, "1.1.1.1");
  assertEquals(chain, "1.1.1.1, 203.0.113.7");
});

Deno.test("handles a single-entry chain with surrounding whitespace", () => {
  const { ip } = getClientIp(reqWith({ "x-forwarded-for": "  198.51.100.4  " }));
  assertEquals(ip, "198.51.100.4");
});

Deno.test("accepts IPv6", () => {
  const { ip } = getClientIp(reqWith({
    "x-forwarded-for": "2001:db8::1, 10.0.0.1",
  }));
  assertEquals(ip, "2001:db8::1");
});

Deno.test("returns null when no header carries an address", () => {
  const { ip, chain } = getClientIp(reqWith({}));
  assertEquals(ip, null);
  assertEquals(chain, null);
});

// A garbage header must not become a row. Postgres would reject it on the `inet`
// column, but that failure surfaces as a lost event, not as a visible error.
Deno.test("rejects non-IP junk and falls through to the next candidate", () => {
  const { ip } = getClientIp(reqWith({
    "cf-connecting-ip": "not-an-ip",
    "x-forwarded-for": "198.51.100.5",
  }));
  assertEquals(ip, "198.51.100.5");
});

Deno.test("rejects an out-of-range IPv4 octet", () => {
  const { ip } = getClientIp(reqWith({ "x-forwarded-for": "999.1.1.1" }));
  assertEquals(ip, null);
});

Deno.test("rejects an empty forwarded chain", () => {
  const { ip } = getClientIp(reqWith({ "x-forwarded-for": "" }));
  assertEquals(ip, null);
});
