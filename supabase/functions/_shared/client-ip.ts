/**
 * Client IP resolution for edge functions.
 *
 * The browser cannot read its own public IP, and anything a client puts in a
 * request body is trivially forged — so the IP is only ever taken from headers
 * set by the infrastructure in front of the function. Never read it from the body.
 *
 * Header order below is most-trustworthy first. `cf-connecting-ip` and
 * `x-real-ip` are set by the proxy and overwrite whatever the client sent.
 * `x-forwarded-for` is a chain the client can prefix, so its leftmost entry is
 * a hint, not a fact — which is why `chain` is returned and stored alongside.
 */

export interface ClientIp {
  /** Best guess at the caller's address, or null if no header carried one. */
  ip: string | null;
  /** Raw x-forwarded-for chain, kept so a forged leftmost entry stays detectable. */
  chain: string | null;
}

/** Rejects obvious junk so a forged header can't write garbage into an `inet` column. */
function looksLikeIp(value: string): boolean {
  if (!value) return false;
  // IPv4, optionally with a port suffix already stripped by the caller.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((o) => Number(o) <= 255);
  }
  // IPv6 — loose on purpose; Postgres `inet` is the real validator.
  return /^[0-9a-fA-F:]+$/.test(value) && value.includes(":");
}

export function getClientIp(req: Request): ClientIp {
  const chain = req.headers.get("x-forwarded-for");

  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    chain?.split(",")[0],
  ];

  for (const raw of candidates) {
    const value = raw?.trim();
    if (value && looksLikeIp(value)) return { ip: value, chain };
  }

  return { ip: null, chain };
}
