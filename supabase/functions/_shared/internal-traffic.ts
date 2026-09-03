/**
 * Validation for the internal-traffic filter (office networks and team accounts).
 *
 * Split out of admin-user-management/index.ts so it can be tested: that file
 * calls serve() at import time, so importing it from a test starts a server
 * instead of running assertions. Same reason event-payload.ts and client-ip.ts
 * live here.
 *
 * These rules decide which sessions get subtracted from the Analytics panel, so
 * a bad entry does not throw — it quietly changes what every number means. Both
 * guards below exist because of that.
 */

/**
 * Widest prefix accepted.
 *
 * A `/0` here would match every address on earth and zero the entire panel, and
 * the failure mode is the dangerous kind: the panel would show "no users" rather
 * than an error, and read as a collapse in traffic rather than a typo. Even a
 * `/8` is 16 million addresses — far more than an office. /16 is generous for
 * the largest plausible corporate range while still being obviously bounded.
 *
 * IPv6 is far denser, so its equivalent bound is much longer: a /32 there is
 * already an entire ISP allocation.
 */
export const MIN_IPV4_PREFIX = 16;
export const MIN_IPV6_PREFIX = 32;

export interface CidrCheck {
  ok: boolean;
  /** Normalised value to store, e.g. "27.107.167.94" -> "27.107.167.94/32". */
  value?: string;
  /** Operator-facing reason. Shown in the admin UI verbatim. */
  error?: string;
}

function validIpv4Octets(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/**
 * Zero the bits to the right of the prefix.
 *
 * Postgres `cidr` — the column type on internal_traffic.network — rejects any
 * value with host bits set: `'27.107.167.94/24'::cidr` is an error, not a
 * widening. So the natural operator move (read your own address off "Add my
 * current IP", widen it to the office range) used to pass every check here and
 * then come back as a raw 22P02 from the database, which is the exact outcome
 * this module's header says it exists to prevent.
 *
 * Masking rather than rejecting: `27.107.167.94/24` has one unambiguous reading,
 * and `27.107.167.0/24` is written back into the field so the operator sees
 * precisely what will be matched.
 */
function maskIpv4(host: string, prefix: number): string {
  const octets = host.split(".").map(Number);
  const value = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  // `<<` is mod-32 in JS, so a /0 would shift by 32 and leave the value intact.
  // MIN_IPV4_PREFIX rules /0 out long before here; the guard keeps that true if
  // the bound ever moves.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const masked = (value & mask) >>> 0;
  return [masked >>> 24, (masked >>> 16) & 255, (masked >>> 8) & 255, masked & 255].join(".");
}

/**
 * Expand an IPv6 address to its eight groups.
 *
 * Returns null for anything malformed. This is also the real syntax check:
 * the character-class test above accepts strings like ":::" that no expansion
 * can make sense of, and Postgres would reject those the same way it rejects
 * host bits.
 */
function expandIpv6(host: string): number[] | null {
  const halves = host.split("::");
  if (halves.length > 2) return null;

  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const groups = part.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if (head === null || tail === null) return null;

  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    // "::" must stand for at least one group, or it is just a stray colon pair.
    if (fill < 1) return null;
    return [...head, ...Array(fill).fill(0), ...tail];
  }

  return head.length === 8 ? head : null;
}

/**
 * Re-compress eight groups to the canonical `::` form (RFC 5952).
 *
 * The longest run of two or more zero groups collapses, leftmost wins a tie, no
 * leading zeros. Postgres would accept the expanded form too, but this value is
 * echoed straight back into the admin UI and stored in a table an operator reads
 * — `2405:201:1::1` is the address they typed, `2405:201:1:0:0:0:0:1` is a
 * puzzle.
 */
function compressIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;

  for (let i = 0; i <= groups.length; i++) {
    if (i < groups.length && groups[i] === 0) {
      if (runStart === -1) runStart = i;
      continue;
    }
    if (runStart !== -1) {
      const len = i - runStart;
      // Strictly greater, so the leftmost of two equal runs is kept.
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }

  const hex = groups.map((g) => g.toString(16));
  // A single zero group is written as "0"; "::" must stand for at least two.
  if (bestLen < 2) return hex.join(":");

  const head = hex.slice(0, bestStart).join(":");
  const tail = hex.slice(bestStart + bestLen).join(":");
  return `${head}::${tail}`;
}

/** The IPv6 counterpart of maskIpv4. */
function maskIpv6(groups: number[], prefix: number): string {
  const masked = groups.map((g, i) => {
    const bitsBefore = i * 16;
    if (prefix >= bitsBefore + 16) return g;
    if (prefix <= bitsBefore) return 0;
    const keep = prefix - bitsBefore;
    return (g & ((0xffff << (16 - keep)) & 0xffff)) >>> 0;
  });
  return compressIpv6(masked);
}

/**
 * Accept a single address or a CIDR range, and normalise it.
 *
 * A bare address becomes an explicit /32 (or /128) rather than being left for
 * Postgres to widen, and a range is masked down to its network address, so what
 * the operator sees in the table is exactly what will be matched. Postgres
 * `cidr` is still the final authority — this exists to turn a typo into a
 * readable message instead of a 500 from the database.
 */
export function checkCidr(input: unknown): CidrCheck {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "Enter an IP address or range." };
  }

  const raw = input.trim();
  const [host, prefixPart, ...extra] = raw.split("/");
  if (extra.length > 0) return { ok: false, error: `"${raw}" has more than one "/".` };

  const isIpv6 = host.includes(":");

  let ipv6Groups: number[] | null = null;
  if (isIpv6) {
    ipv6Groups = expandIpv6(host);
    if (ipv6Groups === null) {
      return { ok: false, error: `"${raw}" is not a valid IPv6 address.` };
    }
  } else if (!validIpv4Octets(host)) {
    return { ok: false, error: `"${raw}" is not a valid IPv4 address.` };
  }

  const maxPrefix = isIpv6 ? 128 : 32;
  const minPrefix = isIpv6 ? MIN_IPV6_PREFIX : MIN_IPV4_PREFIX;

  let prefix = maxPrefix;
  if (prefixPart !== undefined) {
    if (!/^\d{1,3}$/.test(prefixPart)) {
      return { ok: false, error: `"${raw}" has an invalid prefix length.` };
    }
    prefix = Number(prefixPart);
    if (prefix > maxPrefix) {
      return { ok: false, error: `/${prefix} is not valid for ${isIpv6 ? "IPv6" : "IPv4"}.` };
    }
    if (prefix < minPrefix) {
      return {
        ok: false,
        error:
          `/${prefix} is too broad: it would hide far more than an office and ` +
          `could empty the whole panel. Use /${minPrefix} or narrower.`,
      };
    }
  }

  // Masked, not passed through — see maskIpv4() for why the database would
  // otherwise refuse a perfectly reasonable entry.
  const network = isIpv6 ? maskIpv6(ipv6Groups!, prefix) : maskIpv4(host, prefix);

  return { ok: true, value: `${network}/${prefix}` };
}

/**
 * Normalise an email-domain rule.
 *
 * Accepts "example.com" or "@example.com" and returns the bare domain, lowercased.
 * Rejects anything with an `@` in the middle: a full address is a different
 * request (add one account) and silently treating it as a domain would expand to
 * everyone who shares it.
 */
export function checkDomain(input: unknown): { ok: boolean; value?: string; error?: string } {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "Enter a domain, e.g. example.com" };
  }

  const domain = input.trim().toLowerCase().replace(/^@/, "");

  if (domain.includes("@")) {
    return { ok: false, error: `"${input}" looks like an address, not a domain.` };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return { ok: false, error: `"${input}" is not a valid domain.` };
  }
  // A public mailbox provider would expand to a large share of real users.
  const PUBLIC = ["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me"];
  if (PUBLIC.includes(domain)) {
    return { ok: false, error: `${domain} is a public mail provider: that would hide real users.` };
  }

  return { ok: true, value: domain };
}

/** Emails matching a domain rule. Exported for testing the matcher directly. */
export function matchesDomain(email: string | null | undefined, domain: string): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${domain}`);
}
