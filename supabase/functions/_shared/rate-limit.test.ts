import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  limitsFor,
  REPORTS_PER_IP_PER_HOUR,
  REPORTS_PER_SESSION_PER_HOUR,
  REPORTS_PER_USER_PER_HOUR,
} from "./rate-limit.ts";

// The correction this module exists for: a signed-in user is limited by their
// account and NOT additionally by IP. Keeping an IP check here would put a whole
// office back on one shared budget, which is the bug being fixed.
Deno.test("a signed-in caller is limited by account alone", () => {
  const checks = limitsFor({ userId: "u1", sessionId: "s1", ip: "27.107.167.94" });
  assertEquals(checks.length, 1);
  assertEquals(checks[0].column, "user_id");
  assertEquals(checks[0].value, "u1");
  assertEquals(checks[0].max, REPORTS_PER_USER_PER_HOUR);
});

Deno.test("a guest is limited by session first, then IP", () => {
  const checks = limitsFor({ userId: null, sessionId: "s1", ip: "49.36.1.1" });
  assertEquals(checks.map((c) => c.column), ["session_id", "ip_address"]);
  assertEquals(checks[0].max, REPORTS_PER_SESSION_PER_HOUR);
  assertEquals(checks[1].max, REPORTS_PER_IP_PER_HOUR);
});

Deno.test("a guest with no session falls back to IP alone", () => {
  const checks = limitsFor({ userId: null, sessionId: null, ip: "49.36.1.1" });
  assertEquals(checks.map((c) => c.column), ["ip_address"]);
});

// Nothing to key on. Returning no checks means the request proceeds — a rate
// limiter that blocked when it could not identify anyone would deny every
// caller behind a proxy that strips headers.
Deno.test("an unidentifiable caller yields no checks rather than a block", () => {
  assertEquals(limitsFor({ userId: null, sessionId: null, ip: null }), []);
});

// The whole point of the change: the IP ceiling has to be loose enough that a
// shared office or a carrier NAT never reaches it in normal use.
Deno.test("the IP ceiling is far looser than the per-user one", () => {
  assertEquals(REPORTS_PER_IP_PER_HOUR > REPORTS_PER_USER_PER_HOUR * 4, true);
  // And the session gate is the tightest, because it is the cheapest to bypass
  // and therefore the one that should never block a real person for long.
  assertEquals(REPORTS_PER_SESSION_PER_HOUR < REPORTS_PER_USER_PER_HOUR, true);
});
