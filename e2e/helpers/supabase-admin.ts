/**
 * Service-role helpers for e2e fixtures.
 *
 * Every one of these talks to the PRODUCTION Supabase project — there is only
 * one, and `npm run dev` points at it. Hence the QA_PREFIX marker on everything
 * created here and the cleanup() that must run even when a spec fails.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();

export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error("e2e needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env");
}

/** Project ref, used to build the localStorage key supabase-js reads. */
export const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

/**
 * Every row and user this suite creates carries this prefix.
 *
 * Letters and spaces only: BirthDetailsForm's full_name schema permits
 * [A-Za-z spaces hyphens apostrophes] and the field silently strips anything
 * else, so a numeric timestamp cannot be used as the unique marker — it arrives
 * in the database with the digits removed.
 */
export const QA_PREFIX = "QA Probe";

/** Digit-free unique run tag, since the name field rejects numbers. */
export function runTag(): string {
  return String(Date.now()).split("").map((d) => "abcdefghij"[Number(d)]).join("");
}

export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * A genuinely new auth user. Created with a password because the app is
 * Google-OAuth-only and Playwright cannot drive Google's consent screen; the
 * resulting session is a real JWT subject to the same RLS as any other user.
 */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `qa-e2e-${label}-${Date.now()}@vedicfinance-qa.invalid`;
  const password = `Qa!${Math.random().toString(36).slice(2)}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Grant admin. Reversed in cleanup(); the panel is gated on this flag. */
export async function setAdmin(userId: string, isAdmin: boolean) {
  // The profile row is created by the app on first sign-in, which has not
  // happened yet for a freshly minted user — upsert so the flag lands anyway.
  const { error } = await admin
    .from("user_profiles")
    .upsert({ id: userId, is_admin: isAdmin }, { onConflict: "id" });
  if (error) throw new Error(`setAdmin failed: ${error.message}`);
}

export async function findKundalis(fullName: string) {
  const { data, error } = await admin
    .from("kundli_reports")
    .select("id, user_id, full_name, share_slug, session_id, created_at")
    .eq("full_name", fullName);
  if (error) throw new Error(`findKundalis failed: ${error.message}`);
  return data ?? [];
}

/** Rows this suite has created, whatever the spec named them. */
export async function findAllQaKundalis() {
  const { data, error } = await admin
    .from("kundli_reports")
    .select("id, user_id, full_name")
    .like("full_name", `${QA_PREFIX}%`);
  if (error) throw new Error(`findAllQaKundalis failed: ${error.message}`);
  return data ?? [];
}

/**
 * Order matters: kundli_reports.user_id is ON DELETE SET NULL, so removing the
 * users first would orphan the rows rather than delete them.
 */
export async function cleanup(userIds: string[]) {
  const { error: rowErr } = await admin
    .from("kundli_reports")
    .delete()
    .like("full_name", `${QA_PREFIX}%`);
  if (rowErr) console.error("cleanup: row delete failed:", rowErr.message);

  for (const id of userIds) {
    await admin.from("user_profiles").delete().eq("id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`cleanup: deleteUser ${id} failed:`, error.message);
  }
}

/* ─────────────────────── visitor_events page fixtures ────────────────────── */

/**
 * Marker on every seeded visitor_events row, so a run that crashes before its
 * teardown can still be swept later. Lives in `props` rather than in the
 * session_id because admin_analytics() groups and filters on session_id and must
 * see these rows as ordinary traffic — the point of the fixture is that they
 * reach the pages table exactly as a real visit would.
 *
 * Deliberately NOT the `canary-` session prefix: admin_analytics() excludes that
 * (`session_id not like 'canary-%'`), which is the opposite of what is wanted.
 */
export const QA_VISIT_MARK = "e2e-pages-fixture";

/**
 * Put one page view on each given path so the pages table has them to list.
 *
 * Why this exists: `the pages table lists the footer pages, named` asserts that
 * /terms, /privacy, /disclaimer, /refund-policy and /services appear with their
 * friendly labels. That table only lists paths somebody actually visited in the
 * window, and on a low-traffic production database three of those five have had
 * no traffic in 30 days — so the test could not pass on its own. site-health
 * visits two of them, but it runs AFTER this spec alphabetically, so even that
 * only ever helped a subsequent run.
 *
 * `ip_address` is null on purpose. The internal-traffic filter matches on
 * `ip_address <<= network`, which requires a non-null address — so a null one
 * can never be swept up by whatever ranges the office has registered, and the
 * fixture cannot silently vanish when the panel is set to "Real users".
 *
 * Two rows per path: `views` counts visit/page_view rows, and the second gives
 * the dwell window something to measure rather than leaving every row an exit.
 */
export async function seedPageViews(paths: string[]): Promise<void> {
  const sessionId = crypto.randomUUID();
  const rows = paths.flatMap((path, i) =>
    (["visit", "page_view"] as const).map((event, j) => ({
      session_id: sessionId,
      ip_address: null,
      path,
      event,
      // Ordered so `lead()` has something to read and the last row is the exit.
      seq: i * 2 + j,
      duration_ms: 4_000,
      device: "desktop",
      props: { qa: QA_VISIT_MARK },
    })),
  );

  const { error } = await admin.from("visitor_events").insert(rows);
  if (error) throw new Error(`seedPageViews failed: ${error.message}`);
}

/* ───────────────────────── internal_traffic fixtures ────────────────────────── */

/**
 * Remove internal-traffic rules this suite created.
 *
 * Scoped to an explicit list of networks and nothing else. Every value the specs
 * pass is an RFC 5737 documentation range (TEST-NET-1/2/3), which is reserved
 * and never routable — so this can never take a real office network with it,
 * which is the fear that left the original teardown as a `console.warn`.
 *
 * A warning was not a teardown. When the round-trip spec failed between adding a
 * rule and removing it, the rule stayed in the production filter, and every
 * later run of that test then skipped itself: the add was refused as a
 * duplicate, no new row appeared, and the spec read that as "018 is not
 * deployed". One stranded fixture disabled its own regression test
 * indefinitely, and said so only in a log line nobody reads.
 *
 * Swept unconditionally rather than from a per-run list, for the same reason
 * cleanupQaVisits() is: the run that needs cleaning up is the one that already
 * died.
 */
export async function cleanupInternalFixtures(networks: string[]): Promise<void> {
  if (networks.length === 0) return;
  const { error } = await admin.from("internal_traffic").delete().in("network", networks);
  if (error) console.error("cleanupInternalFixtures failed:", error.message);
}

/** Whether a fixture rule is still present — so teardown can assert it is gone. */
export async function countInternalFixtures(networks: string[]): Promise<number> {
  if (networks.length === 0) return 0;
  const { count, error } = await admin
    .from("internal_traffic")
    .select("id", { count: "exact", head: true })
    .in("network", networks);
  if (error) throw new Error(`countInternalFixtures failed: ${error.message}`);
  return count ?? 0;
}

/* ──────────────────────── click_points heatmap fixtures ─────────────────────── */

/**
 * Session-id prefix on every seeded click point.
 *
 * click_points has no `props` column, so the marker cannot live where
 * QA_VISIT_MARK does. A prefix on session_id is the next best thing: unique
 * enough to sweep by, and — unlike `canary-` — not excluded by any of the
 * rollups, which matters because the whole point is that these rows are counted.
 *
 * They also survive the internal-traffic filter for free: `internal_sessions` is
 * derived from visitor_events, and these session ids appear in no visitor_events
 * row, so `session_id not in (internal_sessions)` is true whichever ranges the
 * office has registered.
 */
export const QA_CLICK_SESSION_PREFIX = "qa-clicks-";

/**
 * Put coordinate samples on one path, at two viewport widths.
 *
 * Why this exists: `switching device changes the counts the picker reports`
 * asserts that the picker's figure for /home MOVES between Mobile and Tablet.
 * That is a claim about the panel, but with no fixture it was really a claim
 * about production traffic — and it failed the moment /home had no sampled
 * clicks in either band, which on a 25% sample rate and a quiet month is an
 * ordinary state, not a defect. The assertion meant to catch that
 * (`expect(onMobile).toMatch(/clicks/i)`) is satisfied by the string "no clicks
 * yet", so the real condition surfaced one line later as a confusing equality
 * error about two identical strings.
 *
 * Deliberately unequal counts: equal ones would let a path-only regression — the
 * exact bug this test was written for — pass again.
 *
 * viewport_w is what decides the band, via click_viewport_class(): under 600 is
 * mobile, under 1024 is tablet. `device` is set to match so the row is not
 * self-contradictory, but the width is what the rollup reads.
 */
export async function seedClickPoints(path: string): Promise<void> {
  const sessionId = `${QA_CLICK_SESSION_PREFIX}${crypto.randomUUID()}`;
  const bands: { device: string; viewport_w: number; points: number }[] = [
    { device: "mobile", viewport_w: 390, points: 3 },
    { device: "tablet", viewport_w: 800, points: 1 },
  ];

  const rows = bands.flatMap((band) =>
    Array.from({ length: band.points }, (_, i) => ({
      session_id: sessionId,
      path,
      device: band.device,
      viewport_w: band.viewport_w,
      viewport_h: 800,
      doc_h: 2400,
      // Spread a little so they are not all one blob, and safely inside 0-1.
      x_pct: 0.5,
      y_pct: 0.2 + i * 0.1,
      kind: "click",
    })),
  );

  const { error } = await admin.from("click_points").insert(rows);
  if (error) throw new Error(`seedClickPoints failed: ${error.message}`);
}

/** Fixture click points still in the table, swept by prefix rather than by id. */
export async function countQaClickPoints(): Promise<number> {
  const { count, error } = await admin
    .from("click_points")
    .select("id", { count: "exact", head: true })
    .like("session_id", `${QA_CLICK_SESSION_PREFIX}%`);
  if (error) throw new Error(`countQaClickPoints failed: ${error.message}`);
  return count ?? 0;
}

/** Remove them, by prefix, so a run that died mid-test is swept by the next. */
export async function cleanupQaClickPoints(): Promise<void> {
  const { error } = await admin
    .from("click_points")
    .delete()
    .like("session_id", `${QA_CLICK_SESSION_PREFIX}%`);
  if (error) console.error("cleanupQaClickPoints failed:", error.message);
}

/** Every fixture row still in the table, by marker rather than by id. */
export async function countQaVisits(): Promise<number> {
  const { count, error } = await admin
    .from("visitor_events")
    .select("id", { count: "exact", head: true })
    .contains("props", { qa: QA_VISIT_MARK });
  if (error) throw new Error(`countQaVisits failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Remove them. Swept by marker, not by the ids of this run, so a previous run
 * that died mid-test does not leave invented page views in the real analytics.
 */
export async function cleanupQaVisits(): Promise<void> {
  const { error } = await admin
    .from("visitor_events")
    .delete()
    .contains("props", { qa: QA_VISIT_MARK });
  if (error) console.error("cleanupQaVisits failed:", error.message);
}
