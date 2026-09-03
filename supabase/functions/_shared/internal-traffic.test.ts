import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { checkCidr, checkDomain, matchesDomain, MIN_IPV4_PREFIX } from "./internal-traffic.ts";

Deno.test("a bare address is stored as an explicit /32", () => {
  // Normalised rather than left to Postgres, so the row an operator reads back
  // is exactly what will be matched.
  assertEquals(checkCidr("27.107.167.94"), { ok: true, value: "27.107.167.94/32" });
});

Deno.test("a range is accepted and preserved", () => {
  assertEquals(checkCidr("103.87.167.0/24"), { ok: true, value: "103.87.167.0/24" });
  assertEquals(checkCidr(" 206.84.224.0/22 "), { ok: true, value: "206.84.224.0/22" });
});

// The guard that matters most. 0.0.0.0/0 in this table would subtract every
// session, and the panel would show "no users" rather than an error — a collapse
// in traffic is a far more believable reading than a typo.
Deno.test("refuses a prefix broad enough to empty the panel", () => {
  for (const bad of ["0.0.0.0/0", "10.0.0.0/8", "103.0.0.0/12"]) {
    const result = checkCidr(bad);
    assert(!result.ok, `${bad} should be rejected`);
    assert(result.error!.includes(`/${MIN_IPV4_PREFIX}`), "the error should say what is acceptable");
  }
  // The boundary itself is allowed.
  assert(checkCidr("103.87.0.0/16").ok);
});

Deno.test("rejects malformed addresses with a readable reason", () => {
  for (const bad of ["", "   ", "not-an-ip", "27.107.167", "27.107.167.999", "1.2.3.4/33", "1.2.3.4/x", "1.2.3.4/24/8"]) {
    const result = checkCidr(bad);
    assert(!result.ok, `${bad} should be rejected`);
    assert((result.error ?? "").length > 0, `${bad} should explain itself`);
  }
  assertEquals(checkCidr(null).ok, false);
  assertEquals(checkCidr(42).ok, false);
});

Deno.test("handles IPv6, where the equivalent bound is far longer", () => {
  assertEquals(checkCidr("2405:201:1::1"), { ok: true, value: "2405:201:1::1/128" });
  assert(checkCidr("2405:201::/48").ok);
  // A /32 is already an entire ISP allocation in v6, so anything shorter is out.
  assert(!checkCidr("2405::/16").ok);
});

Deno.test("a domain rule accepts either form and lowercases it", () => {
  assertEquals(checkDomain("@example.com"), { ok: true, value: "example.com" });
  assertEquals(checkDomain("example.com"), { ok: true, value: "example.com" });
  assertEquals(checkDomain(" vedicfinance.ai "), { ok: true, value: "vedicfinance.ai" });
});

// Expanding a full address as a domain would add everyone who shares it.
Deno.test("a full address is not a domain", () => {
  const result = checkDomain("mayur@example.com");
  assert(!result.ok);
  assert(result.error!.includes("address"));
});

// The other way to accidentally hide every real user.
Deno.test("refuses public mail providers", () => {
  for (const domain of ["gmail.com", "@yahoo.com", "outlook.com", "icloud.com"]) {
    const result = checkDomain(domain);
    assert(!result.ok, `${domain} should be rejected`);
    assert(result.error!.includes("real users"));
  }
});

Deno.test("rejects malformed domains", () => {
  for (const bad of ["", "example", ".com", "example..com", "-example.com", "example.com-"]) {
    assert(!checkDomain(bad).ok, `${bad} should be rejected`);
  }
});

Deno.test("matchesDomain compares the domain, not a substring", () => {
  assert(matchesDomain("mayur@example.com", "example.com"));
  assert(matchesDomain("MAYUR@example.com", "example.com"));
  assert(!matchesDomain("mayur@notexample.com.evil.com", "example.com"));
  // "example.com" appearing in the local part must not match.
  assert(!matchesDomain("example.com@gmail.com", "example.com"));
  assert(!matchesDomain(null, "example.com"));
});

Deno.test("masks host bits, because Postgres cidr rejects a value that has them", () => {
  // The natural operator move: read your own address off "Add my current IP",
  // widen it to the office range. This used to pass validation and then come
  // back as a raw 22P02 from the database.
  assertEquals(checkCidr("27.107.167.94/24"), { ok: true, value: "27.107.167.0/24" });
  assertEquals(checkCidr("103.87.167.203/16"), { ok: true, value: "103.87.0.0/16" });
  // A prefix that does not land on an octet boundary.
  assertEquals(checkCidr("192.168.130.7/23"), { ok: true, value: "192.168.130.0/23" });
  assertEquals(checkCidr("10.20.30.40/26"), { ok: true, value: "10.20.30.0/26" });
  // Already a network address — unchanged.
  assertEquals(checkCidr("103.87.167.0/24"), { ok: true, value: "103.87.167.0/24" });
  // A full-length prefix keeps every bit.
  assertEquals(checkCidr("27.107.167.94/32"), { ok: true, value: "27.107.167.94/32" });
});

Deno.test("masks IPv6 host bits too, and keeps the compressed form", () => {
  assertEquals(checkCidr("2405:201:1:abcd::5/48"), { ok: true, value: "2405:201:1::/48" });
  assertEquals(checkCidr("2405:201:1:2:3:4:5:6/64"), { ok: true, value: "2405:201:1:2::/64" });
  // A single zero group is written out; "::" stands for two or more.
  assertEquals(checkCidr("2405:0:1:2:3:4:5:6/128"), {
    ok: true,
    value: "2405:0:1:2:3:4:5:6/128",
  });
});

Deno.test("rejects IPv6 that no expansion can make sense of", () => {
  // The old character-class check accepted all of these and left Postgres to
  // produce the error message.
  for (const bad of [":::", "2405::1::2", "2405:201:1:2:3:4:5", "2405:20g::1", "::12345"]) {
    assert(!checkCidr(bad).ok, `${bad} should be rejected`);
  }
});
