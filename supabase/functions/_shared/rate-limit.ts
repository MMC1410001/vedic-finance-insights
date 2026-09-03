/**
 * Rate-limit key selection for generate-report.
 *
 * Split out of index.ts so it can be tested — that file calls serve() at import
 * time, so importing it from a test starts a server instead of running
 * assertions. Same reason event-payload.ts and client-ip.ts live here.
 *
 * ── Why more than one key ──────────────────────────────────────────────────
 * The original limit was 20 reports per IP per hour, and per-IP alone is the
 * wrong shape. An office or an Indian carrier NAT puts many people behind a
 * single address — this codebase already says so in VisitorSessions.tsx, where
 * shared IPs are called "a prompt to look, not evidence". Twenty reports across
 * a whole office is one busy afternoon, not abuse.
 *
 * So each caller is limited by the best key available for them:
 *
 *   signed in  → user_id.  Unforgeable, comes from a verified JWT, and entirely
 *                unaffected by who else shares the WiFi. This is the real limit.
 *   guest      → session_id, then ip_address.
 *
 * ── The honest position on guests ──────────────────────────────────────────
 * There is no good key for a guest, and pretending otherwise would be worse than
 * saying so. `session_id` lives in sessionStorage and is entirely client
 * controlled: clearing it is one line in a console. It is a speed bump against
 * runaway loops and honest mistakes, not a security boundary. `ip_address` is the
 * only signal the server observes and a client cannot forge, so it stays — but
 * with a ceiling high enough that a shared network never reaches it.
 *
 * Anything genuinely stronger (CAPTCHA, proof-of-work, device attestation) is a
 * different feature. Browser fingerprinting is off the table: the privacy policy
 * commits to session-scoped identifiers only.
 */

/** The correct limit, and the only one that is really a boundary. */
export const REPORTS_PER_USER_PER_HOUR = 20;

/** Trivially bypassed by design. Catches loops, not people. */
export const REPORTS_PER_SESSION_PER_HOUR = 10;

/**
 * Raised from 20. Deliberately loose: this exists to catch one machine hammering
 * the endpoint, not to ration a shared office. Set below what a scripted attack
 * would do and well above what a floor of real people would.
 */
export const REPORTS_PER_IP_PER_HOUR = 100;

export interface LimitCheck {
  /** Column on visitor_events to count against. */
  column: "user_id" | "session_id" | "ip_address";
  value: string;
  max: number;
  /** Named in the log line, so a breach says which rule and why. */
  label: string;
}

export interface Caller {
  userId: string | null;
  sessionId: string | null;
  ip: string | null;
}

/**
 * The checks to run for this caller, in order.
 *
 * A signed-in user is limited by their account and nothing else: adding an IP
 * check on top would reintroduce exactly the shared-network problem this is
 * fixing, since a whole office signed in from one address would share a budget.
 */
export function limitsFor(caller: Caller): LimitCheck[] {
  if (caller.userId) {
    return [{
      column: "user_id",
      value: caller.userId,
      max: REPORTS_PER_USER_PER_HOUR,
      label: "user",
    }];
  }

  const checks: LimitCheck[] = [];
  if (caller.sessionId) {
    checks.push({
      column: "session_id",
      value: caller.sessionId,
      max: REPORTS_PER_SESSION_PER_HOUR,
      label: "session",
    });
  }
  if (caller.ip) {
    checks.push({
      column: "ip_address",
      value: caller.ip,
      max: REPORTS_PER_IP_PER_HOUR,
      label: "ip",
    });
  }
  return checks;
}
