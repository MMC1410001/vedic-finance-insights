import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/require-paid-user.ts";
import { fetchAllAuthUsers, fetchEmailMap } from "../_shared/auth-emails.ts";
import { checkCidr, checkDomain, matchesDomain } from "../_shared/internal-traffic.ts";
import { getClientIp } from "../_shared/client-ip.ts";
import { geoEnabled } from "../_shared/geo.ts";
// The same pattern track-visit validates session ids against.
import { UUID_RE } from "../_shared/event-payload.ts";

/**
 * Read a window from the request, defaulting to the last 30 days.
 *
 * Bounds rather than a day count, because a custom "1 Aug to 14 Aug" cannot be
 * expressed as one. The presets are resolved in the browser (in IST) and arrive
 * here already converted, so this layer has no preset vocabulary of its own.
 *
 * Capped at 366 days and ordered: an inverted or absurd range would not error,
 * it would return an empty panel that reads as "no traffic".
 */
function readWindow(from: unknown, to: unknown): { from: string; to: string } {
  const parse = (value: unknown): number | null => {
    if (typeof value !== "string" || !value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  };

  const now = Date.now();
  const MAX_MS = 366 * 86_400_000;

  let start = parse(from) ?? now - 30 * 86_400_000;
  let end = parse(to) ?? now;
  if (start > end) [start, end] = [end, start];
  if (end - start > MAX_MS) start = end - MAX_MS;

  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

// ── Attribution: which account does a kundali belong to? ─────────────────────
// kundli_reports.user_id is set at insert time, or by a client-side claim in
// src/lib/kundali-history.ts that only works in the tab that generated the row
// and only when the user later opens /profile or /kundali. sessionStorage is
// tab-scoped and is wiped on sign-out and by "Try another", so a large share of
// real users' kundalis sit at user_id NULL forever. The admin panel's per-user
// expansion filtered on user_id alone, so those rows appeared under nobody.
//
// These maps let the panel *display* the likely owner. Nothing here writes
// user_id: both signals below can be wrong, and a wrong write would hand one
// person's chart to another account, which RLS would then expose to them.

// deno-lint-ignore no-explicit-any
type AdminClient = any;

/** How a row was attributed. Precedence is linked > session > birth_details. */
export type MatchKind = "linked" | "session" | "birth_details" | "none";

interface Attribution {
  emailByUser: Map<string, string>;
  /** visitor_events.session_id -> user_id, stamped by the signed_in event. */
  userBySession: Map<string, string>;
  /** "date|time|place" -> user_id. Colliding keys are dropped, not guessed. */
  userByBirthKey: Map<string, string>;
}

const birthKey = (date: unknown, time: unknown, place: unknown) =>
  `${date ?? ""}|${time ?? ""}|${place ?? ""}`;

/**
 * `.in()` becomes a URL query string, so a few hundred UUIDs in one call would
 * blow the request-line limit. 100 keeps each request small.
 */
const IN_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The session ids visitor_events has recorded for one account. */
async function sessionsForUser(supabaseAdmin: AdminClient, userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("visitor_events")
      .select("session_id")
      .eq("user_id", userId);

    if (error) {
      console.warn(`sessionsForUser: visitor_events unavailable (${error.message})`);
      return [];
    }
    const ids = (data ?? []).map((r: { session_id: string }) => r.session_id).filter(Boolean) as string[];
    return [...new Set(ids)];
  } catch (e) {
    console.warn("sessionsForUser threw:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Attribution for a specific set of rows.
 *
 * Scoped to those rows' session ids on purpose: visitor_events gains a row per
 * page load, so an unfiltered scan here would work fine today and quietly become
 * the slowest thing in the admin panel.
 */
async function buildAttribution(supabaseAdmin: AdminClient, sessionIds: string[]): Promise<Attribution> {
  const emailByUser = await fetchEmailMap(supabaseAdmin);

  // The stronger signal, and entirely server-side: track-visit stamps user_id
  // onto the guest's own session_id at sign-in, and kundli_reports carries the
  // same session_id. Immune to sessionStorage loss — but only exists for traffic
  // after 018_visitor_events.sql is applied.
  const userBySession = new Map<string, string>();
  for (const batch of chunk([...new Set(sessionIds)].filter(Boolean), IN_CHUNK)) {
    try {
      const { data, error } = await supabaseAdmin
        .from("visitor_events")
        .select("session_id, user_id")
        .not("user_id", "is", null)
        .in("session_id", batch);

      if (error) {
        // Most likely the table does not exist yet. Matching degrades to birth
        // details; the kundali list must still render.
        console.warn(`buildAttribution: visitor_events unavailable (${error.message})`);
        break;
      }
      for (const row of data ?? []) {
        if (row.session_id && row.user_id) userBySession.set(row.session_id, row.user_id);
      }
    } catch (e) {
      console.warn("buildAttribution: visitor_events query threw:", e instanceof Error ? e.message : e);
      break;
    }
  }

  // The weaker signal, but it works retroactively over all history:
  // kundli_reports and user_birth_details are populated from the same three
  // request fields, so an exact match is meaningful. It is still a heuristic —
  // a chart a guest generated for a friend matches the guest.
  const userByBirthKey = new Map<string, string>();
  const collidingKeys = new Set<string>();
  const { data: birthRows } = await supabaseAdmin
    .from("user_birth_details")
    .select("id, birth_date, birth_time, birth_place");

  for (const row of birthRows ?? []) {
    const key = birthKey(row.birth_date, row.birth_time, row.birth_place);
    const existing = userByBirthKey.get(key);
    if (existing && existing !== row.id) {
      // Two accounts with identical birth details. Guessing between two real
      // people is worse than admitting we cannot tell.
      collidingKeys.add(key);
    } else {
      userByBirthKey.set(key, row.id);
    }
  }
  for (const key of collidingKeys) userByBirthKey.delete(key);

  return { emailByUser, userBySession, userByBirthKey };
}

interface SessionIdentity {
  email: string | null;
  full_name: string | null;
  /** Where the name came from. A registered account name and a name typed into a
   *  guest kundali form are not the same kind of fact, and the UI says so. */
  name_source: "account" | "kundali" | null;
  /** Distinct names seen on this session. >1 means the visitor generated charts
   *  for other people, so `full_name` is the latest of several, not "the user". */
  name_count: number;
}

/**
 * Resolve who each visitor session belongs to.
 *
 * Neither email nor name lives on visitor_events, so both are joins:
 *   - email      -> auth.users, via the Admin Auth API (the only source)
 *   - name, user -> user_birth_details.full_name
 *   - name, guest-> kundli_reports.full_name, keyed on session_id
 *
 * Scoped to the rows being returned rather than scanning either table: this runs
 * on every load of the admin panel.
 */
async function resolveSessionIdentities(
  supabaseAdmin: AdminClient,
  // Only these two fields are read, so the narrow shape is the honest signature
  // and avoids an `any` the linters would flag.
  rows: { session_id: string; user_id: string | null }[],
): Promise<Map<string, SessionIdentity>> {
  const out = new Map<string, SessionIdentity>();
  if (!rows.length) return out;

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const guestSessionIds = [
    ...new Set(rows.filter((r) => !r.user_id).map((r) => r.session_id).filter(Boolean)),
  ] as string[];

  const emailByUser = userIds.length ? await fetchEmailMap(supabaseAdmin) : new Map<string, string>();

  // Account names. Same source list-users reads.
  const nameByUser = new Map<string, string>();
  for (const batch of chunk(userIds, IN_CHUNK)) {
    const { data } = await supabaseAdmin
      .from("user_birth_details")
      .select("id, full_name")
      .in("id", batch);
    for (const row of data ?? []) {
      if (row.full_name) nameByUser.set(row.id, row.full_name);
    }
  }

  // Guest names, from whatever they generated in that session. Ordered oldest
  // first so the last write wins and `latest` ends up being the newest name.
  const guestNames = new Map<string, { latest: string; distinct: Set<string> }>();
  for (const batch of chunk(guestSessionIds, IN_CHUNK)) {
    const { data } = await supabaseAdmin
      .from("kundli_reports")
      .select("session_id, full_name, created_at")
      .in("session_id", batch)
      .not("full_name", "is", null)
      .order("created_at", { ascending: true });
    for (const row of data ?? []) {
      const entry = guestNames.get(row.session_id) ?? { latest: row.full_name, distinct: new Set<string>() };
      entry.latest = row.full_name;
      entry.distinct.add(row.full_name);
      guestNames.set(row.session_id, entry);
    }
  }

  for (const r of rows) {
    if (r.user_id) {
      const name = nameByUser.get(r.user_id) ?? null;
      out.set(r.session_id, {
        email: emailByUser.get(r.user_id) || null,
        full_name: name,
        name_source: name ? "account" : null,
        name_count: name ? 1 : 0,
      });
    } else {
      const g = guestNames.get(r.session_id);
      out.set(r.session_id, {
        email: null,
        full_name: g?.latest ?? null,
        name_source: g ? "kundali" : null,
        name_count: g ? g.distinct.size : 0,
      });
    }
  }

  return out;
}

/** Adds email + match provenance to one kundli_reports row. */
// deno-lint-ignore no-explicit-any
function decorateKundali(row: any, attr: Attribution) {
  if (row.user_id) {
    return {
      ...row,
      email: attr.emailByUser.get(row.user_id) || null,
      match: "linked" as MatchKind,
      matched_user_id: null,
      matched_email: null,
    };
  }

  // Admin-generated rows are unattributed by design (generate-kundali inserts
  // them with user_id null) and carry real birth details, which would otherwise
  // match them to whichever user the admin was testing against.
  if (row.is_admin_generated) {
    return { ...row, email: null, match: "none" as MatchKind, matched_user_id: null, matched_email: null };
  }

  const bySession = row.session_id ? attr.userBySession.get(row.session_id) : undefined;
  const byBirth = attr.userByBirthKey.get(birthKey(row.birth_date, row.birth_time, row.birth_place));
  const matchedUserId = bySession ?? byBirth;

  return {
    ...row,
    email: null,
    match: (bySession ? "session" : byBirth ? "birth_details" : "none") as MatchKind,
    matched_user_id: matchedUserId ?? null,
    matched_email: matchedUserId ? attr.emailByUser.get(matchedUserId) || null : null,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Verify the caller is a signed-in admin ───────────────────────────
    // This function runs with the service-role key and can list and delete
    // users, so it is gated on server-verified identity. It previously took a
    // shared `adminPassword` from the request body, compared against
    // `ADMIN_SECRET || "test123"` — the password shipped in the client bundle,
    // and an unset ADMIN_SECRET meant "test123" unlocked everything.
    const gate = await requireUser(req, { requireAdmin: true });
    if (gate.response) return gate.response;

    const body = await req.json();
    const {
      action,
      userId,
      kundaliIds,
      // birth fields for generate-kundali
      full_name,
      birth_date,
      birth_time,
      birth_time_accuracy,
      birth_place,
      latitude,
      longitude,
      timezone,
      // delete-admin-kundali
      kundaliId,
      // set-admin
      isAdmin,
      // get-kundali-by-slug
      shareSlug,
      // list-all-kundalis
      limit,
      // canary-cleanup
      sessionId,
      // list-visitor-sessions
      ip,
      // analytics-overview / campaigns-overview / audience-overview / click-map
      from,
      to,
      path,
      device,
      excludeInternal,
      // click-map only: 'click' | 'dead' | 'rage'
      kind,
      // internal-traffic management
      network,
      label,
      note,
      domain,
      email,
      entryId,
      enabled,
    } = body;

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing required field: action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validActions = ["reset-payment", "delete-user", "list-users", "delete-kundalis", "list-orphans", "cleanup-orphans", "generate-kundali", "list-admin-kundalis", "list-all-kundalis", "delete-admin-kundali", "set-admin", "get-kundali-by-slug", "pipeline-health", "rls-snapshot", "canary-cleanup", "list-visitor-sessions", "analytics-overview", "campaigns-overview", "audience-overview", "click-map", "list-internal-traffic", "add-internal-network", "add-internal-account", "sync-internal-domain", "set-internal-enabled", "remove-internal-entry", "whoami-ip", "list-admins"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // `list-all-kundalis` takes userId as an OPTIONAL filter, so it must not trip
    // the "Missing required field: userId" guard below.
    const noUserIdRequired = ["list-users", "delete-kundalis", "list-orphans", "cleanup-orphans", "generate-kundali", "list-admin-kundalis", "list-all-kundalis", "delete-admin-kundali", "get-kundali-by-slug", "pipeline-health", "rls-snapshot", "canary-cleanup", "list-visitor-sessions", "analytics-overview", "campaigns-overview", "audience-overview", "click-map", "list-internal-traffic", "add-internal-network", "add-internal-account", "sync-internal-domain", "set-internal-enabled", "remove-internal-entry", "whoami-ip", "list-admins",
      // set-admin now accepts an email instead of a userId and resolves it
      // itself, so it must clear this guard — which runs BEFORE the handler and
      // would otherwise reject every email-only grant with "Missing required
      // field: userId". The handler enforces "one or the other" in its place.
      "set-admin"];
    if (!noUserIdRequired.includes(action) && !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Create service role client ───────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── 4. Execute action ───────────────────────────────────────────────────
    if (action === "list-users") {
      // Fetch all user profiles (bypasses RLS)
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, has_paid, onboarding_done, is_admin, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch profiles: ${profilesError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch names from user_birth_details
      const { data: birthDetails } = await supabaseAdmin
        .from("user_birth_details")
        .select("id, full_name");

      // Fetch latest kundali share_slug per user
      const { data: kundalis } = await supabaseAdmin
        .from("kundli_reports")
        .select("user_id, share_slug, created_at")
        .order("created_at", { ascending: false });

      const kundaliMap = new Map<string, string>();
      if (kundalis) {
        for (const k of kundalis) {
          if (k.user_id && !kundaliMap.has(k.user_id)) {
            kundaliMap.set(k.user_id, k.share_slug);
          }
        }
      }

      // Emails come from auth.users; no profile table holds them. Paged, because
      // the bare listUsers() this used to call stops at 50 users and every
      // account past that rendered with a null email.
      const emailMap = await fetchEmailMap(supabaseAdmin);

      const nameMap = new Map<string, string>();
      if (birthDetails) {
        for (const bd of birthDetails) {
          nameMap.set(bd.id, bd.full_name);
        }
      }

      const users = (profiles ?? []).map((p: any) => ({
        id: p.id,
        has_paid: p.has_paid ?? false,
        onboarding_done: p.onboarding_done ?? false,
        is_admin: p.is_admin ?? false,
        created_at: p.created_at,
        full_name: nameMap.get(p.id) || null,
        email: emailMap.get(p.id) || null,
        share_slug: kundaliMap.get(p.id) || null,
      }));

      return new Response(
        JSON.stringify({ success: true, users }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── set-admin: grant or revoke the is_admin flag ─────────────────────────
    // Updated to support granting admin access BEFORE a user generates kundalis.
    // Creates a user_profiles row if it doesn't exist, making admin access fully
    // independent of kundali generation or onboarding completion.
    if (action === "set-admin") {
      // Accepts an email as well as a userId. Everything below — self-demotion,
      // last-admin, must-exist — applies identically either way; only the
      // lookup differs.
      let targetUserId: string | null = typeof userId === "string" && userId ? userId : null;

      if (!targetUserId && typeof email === "string" && email.includes("@")) {
        const wanted = email.trim().toLowerCase();
        const all = await fetchAllAuthUsers(supabaseAdmin);
        const match = all.find((u: { email?: string | null }) => (u.email ?? "").toLowerCase() === wanted);
        if (!match) {
          return new Response(
            JSON.stringify({
              error: `No account for ${email}. They must sign in to VedicFinance at least once before they can be made an admin.`,
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        targetUserId = match.id;
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "set-admin requires a userId or an email address." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (typeof isAdmin !== "boolean") {
        return new Response(
          JSON.stringify({ error: "set-admin requires isAdmin to be true or false" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Refuse self-demotion. There is no other way back in from the UI, so a
      // mis-click would lock the panel and leave SQL as the only recovery.
      if (targetUserId === gate.user!.id && isAdmin === false) {
        return new Response(
          JSON.stringify({ error: "You cannot remove your own admin access. Ask another admin." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Refuse to remove the last admin, whoever is asking.
      if (isAdmin === false) {
        const { data: admins } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("is_admin", true);

        if ((admins ?? []).length <= 1) {
          return new Response(
            JSON.stringify({ error: "Cannot remove the last admin." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Check if user exists in auth.users first
      const { data: authUser, error: authCheckErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (authCheckErr || !authUser.user) {
        return new Response(
          JSON.stringify({ error: "User not found in auth.users. They must sign in at least once." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // UPDATE first, INSERT only if there is genuinely no profile row.
      //
      // NOT an upsert, and the previous code being one was a live way to revoke
      // a paying customer's access. supabase-js has no "update only these
      // columns" option: `onConflict` sends Prefer: resolution=merge-duplicates,
      // which is ON CONFLICT (id) DO UPDATE SET for *every* column in the
      // payload. The has_paid: false / onboarding_done: false pair was written
      // as insert-only defaults and was not — so promoting an existing customer
      // to admin set has_paid back to false, cleared onboarding, and reset
      // created_at. PaidRoute would then put them in front of the ₹99 offer
      // again. Demoting did the same.
      //
      // The insert keeps admin access independent of having onboarded or paid,
      // which is why the upsert was reached for in the first place.
      const setAdminFlag = () =>
        supabaseAdmin
          .from("user_profiles")
          .update({ is_admin: isAdmin })
          .eq("id", targetUserId)
          .select("id");

      let { data: updated, error: adminErr } = await setAdminFlag();

      if (!adminErr && (updated ?? []).length === 0) {
        const { error: insertErr } = await supabaseAdmin
          .from("user_profiles")
          .insert({
            id: targetUserId,
            is_admin: isAdmin,
            // Genuine defaults now: this branch only runs when no row exists.
            has_paid: false,
            onboarding_done: false,
            created_at: new Date().toISOString(),
          });

        if (insertErr) {
          // 23505 means the row appeared between the update and the insert —
          // a concurrent sign-in creating the profile. The update is now the
          // right operation, so run it again rather than reporting a conflict
          // the operator can do nothing about.
          if (insertErr.code === "23505") {
            ({ data: updated, error: adminErr } = await setAdminFlag());
          } else {
            adminErr = insertErr;
          }
        }
      }

      if (adminErr) {
        return new Response(
          JSON.stringify({ error: `Failed to update admin flag: ${adminErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "set-admin", userId: targetUserId, isAdmin }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── delete-kundalis: delete kundali reports WITHOUT affecting user profile ──
    // This action specifically DOES NOT touch user_profiles, so admin access and
    // other user settings are preserved. Only the kundali reports themselves are
    // removed. Use this instead of delete-user when you want to clear kundali
    // history without removing the user account or admin privileges.
    if (action === "delete-kundalis") {
      if (kundaliIds && Array.isArray(kundaliIds) && kundaliIds.length > 0) {
        const { error: delErr } = await supabaseAdmin
          .from("kundli_reports")
          .delete()
          .in("id", kundaliIds);

        if (delErr) {
          return new Response(
            JSON.stringify({ error: `Failed to delete kundalis: ${delErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (userId) {
        const { error: delErr } = await supabaseAdmin
          .from("kundli_reports")
          .delete()
          .eq("user_id", userId);

        if (delErr) {
          return new Response(
            JSON.stringify({ error: `Failed to delete kundalis: ${delErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Missing kundaliIds or userId for delete-kundalis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }

      return new Response(
        JSON.stringify({ success: true, action: "delete-kundalis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset-payment") {
      // Without this, `.eq("id", undefined)` builds `id=eq.undefined`, every
      // statement below fails its uuid cast, each failure is only console.error'd,
      // and the endpoint still answers { success: true }.
      if (typeof userId !== "string" || !UUID_RE.test(userId)) {
        return new Response(
          JSON.stringify({ error: "reset-payment requires a valid userId." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reset payment status in user_profiles
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .update({ has_paid: false, onboarding_done: false })
        .eq("id", userId);

      // Reported, not just logged. This is the one statement that decides
      // whether the reset happened at all — the point of the whole action is
      // re-testing the payment flow with the same account, and a green toast
      // over a user who is still has_paid sends the tester down a false trail.
      // The deletes below are cleanup; their failures stay advisory.
      if (profileError) {
        console.error("Error updating user_profiles:", profileError);
        return new Response(
          JSON.stringify({ error: `Failed to reset payment status: ${profileError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete payment orders
      const { error: ordersError } = await supabaseAdmin
        .from("payment_orders")
        .delete()
        .eq("user_id", userId);

      if (ordersError) {
        console.error("Error deleting payment_orders:", ordersError);
      }

      // Delete user birth details
      const { error: birthError } = await supabaseAdmin
        .from("user_birth_details")
        .delete()
        .eq("id", userId);

      if (birthError) {
        console.error("Error deleting user_birth_details:", birthError);
      }

      // Delete user astrosign
      const { error: astroError } = await supabaseAdmin
        .from("user_astrosign")
        .delete()
        .eq("id", userId);

      if (astroError) {
        console.error("Error deleting user_astrosign:", astroError);
      }

      // Delete user financial profile
      const { error: finError } = await supabaseAdmin
        .from("user_financial_profile")
        .delete()
        .eq("id", userId);

      if (finError) {
        console.error("Error deleting user_financial_profile:", finError);
      }

      // Named so the panel can say which side tables did not clear, instead of
      // reporting a clean reset that left rows behind.
      const cleanupWarnings = [
        ordersError && `payment_orders: ${ordersError.message}`,
        birthError && `user_birth_details: ${birthError.message}`,
        astroError && `user_astrosign: ${astroError.message}`,
        finError && `user_financial_profile: ${finError.message}`,
      ].filter(Boolean);

      return new Response(
        JSON.stringify({
          success: true,
          action: "reset-payment",
          userId,
          ...(cleanupWarnings.length > 0 ? { warnings: cleanupWarnings } : {}),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-user") {
      // Same reasoning as reset-payment: an unvalidated id turns every delete
      // below into a silent no-op, and deleteUser() then fails with a message
      // about auth rather than about the input.
      if (typeof userId !== "string" || !UUID_RE.test(userId)) {
        return new Response(
          JSON.stringify({ error: "delete-user requires a valid userId." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Hard delete: explicitly remove ALL user data, then delete auth user ──

      // 1. Delete kundli_reports (uses ON DELETE SET NULL, so won't auto-delete)
      const { error: reportsErr } = await supabaseAdmin
        .from("kundli_reports")
        .delete()
        .eq("user_id", userId);
      if (reportsErr) console.error("Error deleting kundli_reports:", reportsErr);

      // 2. Delete card_feedback
      const { error: feedbackErr } = await supabaseAdmin
        .from("card_feedback")
        .delete()
        .eq("user_id", userId);
      if (feedbackErr) console.error("Error deleting card_feedback:", feedbackErr);

      // 3. Delete payment_orders
      const { error: ordersErr } = await supabaseAdmin
        .from("payment_orders")
        .delete()
        .eq("user_id", userId);
      if (ordersErr) console.error("Error deleting payment_orders:", ordersErr);

      // 4. Delete user_birth_details
      const { error: birthErr } = await supabaseAdmin
        .from("user_birth_details")
        .delete()
        .eq("id", userId);
      if (birthErr) console.error("Error deleting user_birth_details:", birthErr);

      // 5. Delete user_astrosign
      const { error: astroErr } = await supabaseAdmin
        .from("user_astrosign")
        .delete()
        .eq("id", userId);
      if (astroErr) console.error("Error deleting user_astrosign:", astroErr);

      // 6. Delete user_financial_profile
      const { error: finErr } = await supabaseAdmin
        .from("user_financial_profile")
        .delete()
        .eq("id", userId);
      if (finErr) console.error("Error deleting user_financial_profile:", finErr);

      // 7. Delete user_profiles
      const { error: profileErr } = await supabaseAdmin
        .from("user_profiles")
        .delete()
        .eq("id", userId);
      if (profileErr) console.error("Error deleting user_profiles:", profileErr);

      // 8. Finally, delete the auth user (removes from auth.users completely)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete auth user: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "delete-user", userId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── list-orphans: find auth users with no user_profiles row ────────────
    if (action === "list-orphans") {
      // Paged rather than a single perPage: 1000 request — same reasoning as
      // list-users, one order of magnitude further out.
      const authUsers = await fetchAllAuthUsers(supabaseAdmin);

      // Get all profile IDs
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id");
      const profileIds = new Set((profiles ?? []).map((p: any) => p.id));

      // Orphans = auth users with no matching profile row
      const orphans = authUsers
        .filter((u) => !profileIds.has(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
        }));

      return new Response(
        JSON.stringify({ success: true, orphans }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── cleanup-orphans: delete all ghost auth users with no profile row ───
    if (action === "cleanup-orphans") {
      const authUsers = await fetchAllAuthUsers(supabaseAdmin);

      // Get all profile IDs
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id");
      const profileIds = new Set((profiles ?? []).map((p: any) => p.id));

      // Orphan IDs = auth users with no matching profile row
      const orphanIds = authUsers
        .filter((u) => !profileIds.has(u.id))
        .map((u) => u.id);

      if (orphanIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, deleted: 0, message: "No orphaned users found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete each orphan from auth.users — the ON DELETE CASCADE handles all
      // related table rows automatically
      let deleted = 0;
      const errors: string[] = [];
      for (const orphanId of orphanIds) {
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(orphanId);
        if (delErr) {
          errors.push(`${orphanId}: ${delErr.message}`);
        } else {
          deleted++;
        }
      }

      return new Response(
        JSON.stringify({
          success: errors.length === 0,
          deleted,
          total: orphanIds.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── generate-kundali: generate report + save to DB with is_admin_generated ─
    if (action === "generate-kundali") {
      // Validate required birth fields
      if (!birth_date || !birth_time || !birth_place || latitude === undefined || longitude === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required birth fields: birth_date, birth_time, birth_place, latitude, longitude" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Call the generate-report edge function internally ─────────────────
      const reportUrl = `${supabaseUrl}/functions/v1/generate-report`;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      const reportRes = await fetch(reportUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          birth_date,
          birth_time,
          birth_time_accuracy: birth_time_accuracy ?? "exact",
          birth_place,
          latitude: Number(latitude),
          longitude: Number(longitude),
          timezone: typeof timezone === "number" ? timezone : 5.5,
        }),
      });

      if (!reportRes.ok) {
        const errText = await reportRes.text();
        console.error("generate-report call failed:", errText);
        return new Response(
          JSON.stringify({ error: `Report generation failed: ${errText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const report = await reportRes.json();

      // ── Generate a unique share slug ───────────────────────────────────────
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let shareSlug = "adm-";
      for (let i = 0; i < 8; i++) {
        shareSlug += chars[Math.floor(Math.random() * chars.length)];
      }

      // ── Save to kundli_reports using service role (bypasses RLS) ──────────
      const { data: saved, error: saveErr } = await supabaseAdmin
        .from("kundli_reports")
        .insert({
          user_id: null,
          full_name: full_name ?? null,
          share_slug: shareSlug,
          session_id: `admin-${crypto.randomUUID()}`,
          birth_date,
          birth_time,
          birth_place,
          is_admin_generated: true,
          financial_phase: report.summary?.financial_phase ?? null,
          confidence_lvl: report.summary?.confidence_level ?? null,
          time_window: report.summary?.time_window ?? null,
          primary_insight: report.summary?.primary_insight ?? null,
          scores: report.scores,
          dashboard: report.dashboard,
          timeline: report.timeline,
          reasoning: report.reasoning,
          confidence: report.confidence,
          d1_chart: report.d1_chart,
          d9_chart: report.d9_chart,
          dasha: report.dasha,
          transits: report.transits,
        })
        .select("id, share_slug")
        .single();

      if (saveErr) {
        console.error("Failed to save admin kundali:", saveErr);
        return new Response(
          JSON.stringify({ error: `Failed to save kundali: ${saveErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          id: saved.id,
          shareSlug: saved.share_slug,
          report,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── list-admin-kundalis: fetch all is_admin_generated=true records ────────
    if (action === "list-admin-kundalis") {
      const { data: records, error: listErr } = await supabaseAdmin
        .from("kundli_reports")
        .select("id, full_name, share_slug, birth_date, birth_time, birth_place, financial_phase, confidence_lvl, created_at")
        .eq("is_admin_generated", true)
        .order("created_at", { ascending: false });

      if (listErr) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch admin kundalis: ${listErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, kundalis: records ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── list-all-kundalis: every kundali, service-role (bypasses RLS) ─────────
    // The admin panel used to read kundli_reports directly from the browser, under
    // the admin's own JWT, which made the list silently dependent on two things
    // staying true: the "admins read all reports" policy existing, and the caller's
    // user_profiles.is_admin flag being set. Both hold today, but the panel had no
    // way to tell a policy/flag problem from an empty table — it rendered
    // "No kundalis generated yet." either way. Reading through the service role
    // removes that dependency; the caller is already gated by requireUser above.
    if (action === "list-all-kundalis") {
      const rowLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 2000) : 500;
      // session_id is returned so the panel can join each row to its
      // visitor_events IP — it is not displayed on its own.
      const KUNDALI_COLS =
        "id, user_id, full_name, share_slug, birth_date, birth_time, birth_place, financial_phase, is_admin_generated, created_at, session_id";

      const baseQuery = () =>
        supabaseAdmin
          .from("kundli_reports")
          .select(KUNDALI_COLS)
          .order("created_at", { ascending: false })
          // Canary probes are diagnostics, not traffic — never show them to operators.
          .not("session_id", "like", "canary-%")
          .limit(rowLimit);

      // userId is an optional filter — used by the per-user expansion in the panel.
      let query = baseQuery();
      if (userId) query = query.eq("user_id", userId);

      const { data: records, error: listErr } = await query;

      if (listErr) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch kundalis: ${listErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // deno-lint-ignore no-explicit-any
      const rows: any[] = [...(records ?? [])];

      // For a per-user request, also pull the orphans that attribution says
      // belong to this user. Without this the expansion shows nothing for anyone
      // whose client-side claim never ran — which is most guests and every user
      // who signed up in a fresh tab.
      if (userId) {
        const sessionIds = await sessionsForUser(supabaseAdmin, userId);

        const { data: birthRow } = await supabaseAdmin
          .from("user_birth_details")
          .select("birth_date, birth_time, birth_place")
          .eq("id", userId)
          .maybeSingle();

        // Only claim a birth-detail match if this user's key is unambiguous. Two
        // accounts sharing a birth key means we cannot tell whose chart it is,
        // and guessing between two real people is worse than saying nothing.
        let birthKeyIsOurs = false;
        if (birthRow) {
          const { data: sameKey } = await supabaseAdmin
            .from("user_birth_details")
            .select("id")
            .eq("birth_date", birthRow.birth_date)
            .eq("birth_time", birthRow.birth_time)
            .eq("birth_place", birthRow.birth_place);
          birthKeyIsOurs = (sameKey ?? []).length === 1;
        }

        // deno-lint-ignore no-explicit-any
        const orphanBatches: any[][] = [];

        // Chunked for the same reason as buildAttribution: a long-lived account
        // can accumulate many sessions, and they all land in the query string.
        for (const batch of chunk(sessionIds, IN_CHUNK)) {
          const { data } = await baseQuery()
            .is("user_id", null)
            .eq("is_admin_generated", false)
            .in("session_id", batch);
          orphanBatches.push(data ?? []);
        }

        if (birthKeyIsOurs && birthRow) {
          const { data } = await baseQuery()
            .is("user_id", null)
            .eq("is_admin_generated", false)
            .eq("birth_date", birthRow.birth_date)
            .eq("birth_time", birthRow.birth_time)
            .eq("birth_place", birthRow.birth_place);
          orphanBatches.push(data ?? []);
        }

        // A row can match on both signals; de-dupe by id.
        const seen = new Set(rows.map((r) => r.id));
        for (const batch of orphanBatches) {
          for (const row of batch) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            rows.push(row);
          }
        }

        rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      }

      // Built last, so the visitor_events read is bounded by the rows actually
      // being returned rather than scanning the whole table.
      const attr = await buildAttribution(
        supabaseAdmin,
        rows.map((r) => r.session_id).filter(Boolean),
      );

      return new Response(
        JSON.stringify({ success: true, kundalis: rows.map((r) => decorateKundali(r, attr)) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── list-visitor-sessions: IP-level visitor log ───────────────────────────
    // Reads the visitor_session_summary rollup, so the panel does no aggregation
    // client-side. Service-role on purpose, same reasoning as list-all-kundalis:
    // the caller is already gated by requireUser({ requireAdmin: true }) above,
    // and reading under the admin's own JWT would make the list quietly depend on
    // the "admins read all visitor events" policy still being attached.
    //
    // Also returns the two aggregates the panel leads with, computed here because
    // both need a full scan the browser should never do:
    //   - distinct IPs in the last 24h
    //   - IPs seen against more than one user_id (the account-farming signal)
    if (action === "list-visitor-sessions") {
      const rowLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 2000) : 500;

      let query = supabaseAdmin
        .from("visitor_session_summary")
        .select("session_id, first_seen_at, last_seen_at, event_count, distinct_ips, last_ip, user_id, last_user_agent, events")
        .order("last_seen_at", { ascending: false })
        .limit(rowLimit);

      if (ip) query = query.eq("last_ip", ip);
      if (sessionId) query = query.eq("session_id", sessionId);

      const { data: sessions, error: sessErr } = await query;

      if (sessErr) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch visitor sessions: ${sessErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const since24h = new Date(Date.now() - 86_400_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("visitor_events")
        .select("ip_address, user_id")
        .gte("created_at", since24h)
        .limit(20_000);

      const ipsToday = new Set<string>();
      // ip -> set of user ids seen from it. Guests (null user_id) are excluded:
      // one IP with many anonymous sessions is a shared office or a carrier NAT,
      // not evidence of anything.
      const usersPerIp = new Map<string, Set<string>>();

      for (const row of recent ?? []) {
        if (!row.ip_address) continue;
        ipsToday.add(row.ip_address);
        if (!row.user_id) continue;
        const users = usersPerIp.get(row.ip_address) ?? new Set<string>();
        users.add(row.user_id);
        usersPerIp.set(row.ip_address, users);
      }

      const sharedIps = [...usersPerIp.entries()]
        .filter(([, users]) => users.size > 1)
        .map(([address, users]) => ({ ip: address, user_count: users.size, userIds: [...users] }))
        .sort((a, b) => b.user_count - a.user_count);

      // Who each session belongs to: email for signed-in, name-from-kundali for
      // guests. Without this the panel can show that an address exists but not
      // whose it is, which is the whole point of the table.
      const identities = await resolveSessionIdentities(supabaseAdmin, sessions ?? []);

      // Which of these are ours. Marked, never hidden — the whole point of this
      // table is that internal traffic stays inspectable; only the Analytics
      // aggregates subtract it. Resolved through an RPC because a session's
      // last_ip is one address and a Vikhroli session carries several.
      const sessionIds = (sessions ?? []).map((row: { session_id: string }) => row.session_id);
      const { data: internalIds, error: internalErr } = sessionIds.length
        ? await supabaseAdmin.rpc("admin_internal_sessions", { p_session_ids: sessionIds })
        : { data: [], error: null };

      if (internalErr) {
        // Not fatal: an unmarked table is still usable, whereas failing the whole
        // request over a badge would hide the sessions themselves.
        console.error(`list-visitor-sessions internal lookup failed: ${internalErr.message}`);
      }

      const internalSet = new Set<string>(
        ((internalIds ?? []) as unknown[]).map((row) =>
          typeof row === "string" ? row : (row as { session_id?: string })?.session_id ?? ""
        ).filter(Boolean)
      );

      const decorated = (sessions ?? []).map((row: { session_id: string }) => ({
        ...row,
        internal: internalSet.has(row.session_id),
        ...(identities.get(row.session_id) ?? {
          email: null,
          full_name: null,
          name_source: null,
          name_count: 0,
        }),
      }));

      // Name the accounts behind a shared address. `usersPerIp` already holds
      // the ids, so this is a map lookup, not another query — and "which two
      // accounts" is the actionable half of that warning.
      const emailForShared = sharedIps.length
        ? await fetchEmailMap(supabaseAdmin)
        : new Map<string, string>();
      const sharedIpsOut = sharedIps.map(({ ip: address, user_count, userIds }) => ({
        ip: address,
        user_count,
        emails: userIds.map((id) => emailForShared.get(id) || id).sort(),
      }));

      return new Response(
        JSON.stringify({
          success: true,
          sessions: decorated,
          summary: {
            distinct_ips_24h: ipsToday.size,
            shared_ips: sharedIpsOut,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── pipeline-health: per-stream freshness, volume, 30-day series, alerts ──
    // Per-stream on purpose. The 2026-08-18 guest-save breakage was invisible in
    // aggregate: guest saves went to zero while signed-in held at ~30/day, so any
    // combined "kundalis today" number stayed green for three days.
    if (action === "pipeline-health") {
      const { data: health, error: healthErr } = await supabaseAdmin.rpc("admin_pipeline_health");

      if (healthErr) {
        return new Response(
          JSON.stringify({ error: `Failed to compute pipeline health: ${healthErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Open alerts AND recently-resolved ones. Returning only the open set made
      // self-healing outages invisible: a break at 02:00 that recovered by 08:00
      // left a spotless panel by the time anyone looked, so an intermittent fault
      // could repeat indefinitely without ever being seen.
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: alerts, error: alertErr } = await supabaseAdmin
        .from("pipeline_alerts")
        .select("id, stream, severity, message, hours_since, detected_at, resolved_at")
        .or(`resolved_at.is.null,detected_at.gte.${since}`)
        .order("detected_at", { ascending: false })
        .limit(50);

      if (alertErr) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch alerts: ${alertErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, health, alerts: alerts ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── list-admins: who can get into this panel ─────────────────────────────
    // Its own action rather than filtering list-users in the browser: the user
    // table is capped and paged, so an admin past the cap would simply not
    // appear — and a missing name on this particular list is the kind of gap
    // nobody notices until it matters.
    if (action === "list-admins") {
      const { data: rows, error: adminListErr } = await supabaseAdmin
        .from("user_profiles")
        .select("id, is_admin")
        .eq("is_admin", true);

      if (adminListErr) {
        return new Response(
          JSON.stringify({ error: `Failed to list admins: ${adminListErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Email and sign-in history live only in auth.users.
      const authUsers = await fetchAllAuthUsers(supabaseAdmin);
      const byId = new Map(authUsers.map((u: { id: string }) => [u.id, u]));

      const admins = (rows ?? []).map((row: { id: string }) => {
        const account = byId.get(row.id) as
          | { email?: string | null; created_at?: string; last_sign_in_at?: string | null }
          | undefined;
        return {
          id: row.id,
          email: account?.email ?? null,
          created_at: account?.created_at ?? null,
          last_sign_in_at: account?.last_sign_in_at ?? null,
          // Marked so the UI can disable removing yourself with the reason on
          // the control, rather than letting the click fail server-side.
          is_self: row.id === gate.user!.id,
        };
      });

      admins.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

      return new Response(
        JSON.stringify({ success: true, admins }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Internal traffic: which sessions are ours rather than a user's ───────
    // A filter, never a blocklist. Nothing here stops a row being recorded and
    // nothing hides it from the Visitors panel — these rules only decide what
    // the Analytics aggregates subtract while the operator has the filter on.
    if (action === "list-internal-traffic") {
      const { data: entries, error: listErr } = await supabaseAdmin
        .from("internal_traffic")
        .select("id, kind, network, user_id, label, note, enabled, created_at")
        .order("kind", { ascending: true })
        .order("created_at", { ascending: true });

      if (listErr) {
        return new Response(
          JSON.stringify({ error: `Failed to list internal traffic: ${listErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Account rows are stored by user_id (stable), but an operator can only
      // recognise an email. Resolved here because email lives solely in
      // auth.users, which is unreachable from the browser and from SQL.
      const hasAccounts = (entries ?? []).some((e: { user_id: string | null }) => e.user_id);
      const emailMap = hasAccounts ? await fetchEmailMap(supabaseAdmin) : new Map<string, string>();

      const decorated = (entries ?? []).map((entry: { user_id: string | null }) => ({
        ...entry,
        email: entry.user_id ? emailMap.get(entry.user_id) ?? null : null,
      }));

      return new Response(
        JSON.stringify({ success: true, entries: decorated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── whoami-ip: the address the server sees THIS request coming from ──────
    // A browser cannot read its own public IP, so without this the operator has
    // to look it up on a third-party site and copy it across. It matters more
    // than convenience here: the Vikhroli office balances across three ISPs, so
    // the address changes between requests and the only reliable way to collect
    // them all is to keep clicking this from each office.
    if (action === "whoami-ip") {
      const { ip, chain } = getClientIp(req);
      return new Response(
        JSON.stringify({ success: true, ip, chain }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add-internal-network") {
      const checked = checkCidr(network);
      if (!checked.ok) {
        return new Response(
          JSON.stringify({ error: checked.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("internal_traffic")
        .insert({
          kind: "network",
          network: checked.value,
          label: typeof label === "string" && label.trim() ? label.trim().slice(0, 60) : "Internal",
          note: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
          added_by: gate.user!.id,
        })
        .select("id, kind, network, label, note, enabled, created_at")
        .single();

      if (insErr) {
        // 23505 is the partial unique on network. Already covered is a success
        // from the operator's point of view, not an error to puzzle over.
        if (insErr.code === "23505") {
          return new Response(
            JSON.stringify({ success: true, alreadyPresent: true, network: checked.value }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `Failed to add network: ${insErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, entry: inserted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add-internal-account") {
      let targetId: string | null = typeof userId === "string" && userId ? userId : null;

      if (!targetId) {
        if (typeof email !== "string" || !email.includes("@")) {
          return new Response(
            JSON.stringify({ error: "Provide a userId or an email address." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const wanted = email.trim().toLowerCase();
        const all = await fetchAllAuthUsers(supabaseAdmin);
        const match = all.find((u: { email?: string | null }) => (u.email ?? "").toLowerCase() === wanted);
        if (!match) {
          return new Response(
            JSON.stringify({ error: `No account found for ${email}.` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        targetId = match.id;
      }

      const { error: insErr } = await supabaseAdmin.from("internal_traffic").insert({
        kind: "account",
        user_id: targetId,
        label: typeof label === "string" && label.trim() ? label.trim().slice(0, 60) : "Team",
        note: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
        added_by: gate.user!.id,
      });

      if (insErr && insErr.code !== "23505") {
        return new Response(
          JSON.stringify({ error: `Failed to add account: ${insErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, userId: targetId, alreadyPresent: insErr?.code === "23505" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── sync-internal-domain: expand @example.com to account rows ────────────
    // Expanded at click time into explicit rows rather than stored as a live
    // rule, deliberately. A live rule would mean an Admin API call on every
    // analytics load just to re-resolve it, and it would silently pull in
    // accounts nobody reviewed. Explicit rows are visible, individually
    // removable, and re-running this is how a new joiner gets added.
    if (action === "sync-internal-domain") {
      const checked = checkDomain(domain);
      if (!checked.ok) {
        return new Response(
          JSON.stringify({ error: checked.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const all = await fetchAllAuthUsers(supabaseAdmin);
      const matching = all.filter((u: { email?: string | null }) => matchesDomain(u.email, checked.value!));

      if (matching.length === 0) {
        return new Response(
          JSON.stringify({ success: true, domain: checked.value, added: 0, accounts: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // upsert on the partial unique, so re-running only adds what is new and
      // never disturbs a row someone has since disabled or re-labelled.
      const { error: upErr } = await supabaseAdmin
        .from("internal_traffic")
        .upsert(
          matching.map((u: { id: string; email?: string | null }) => ({
            kind: "account",
            user_id: u.id,
            label: "Team",
            note: `Matched @${checked.value}`,
            added_by: gate.user!.id,
          })),
          { onConflict: "user_id", ignoreDuplicates: true }
        );

      if (upErr) {
        return new Response(
          JSON.stringify({ error: `Failed to sync domain: ${upErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          domain: checked.value,
          added: matching.length,
          accounts: matching.map((u: { email?: string | null }) => u.email).filter(Boolean),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Disable rather than delete is the recommended path: it keeps the note
    // explaining what an address was, which is the only way to tell a stale
    // entry from a live one a year later.
    if (action === "set-internal-enabled") {
      if (typeof entryId !== "string" || !entryId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: entryId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updErr } = await supabaseAdmin
        .from("internal_traffic")
        .update({ enabled: enabled === true })
        .eq("id", entryId);

      if (updErr) {
        return new Response(
          JSON.stringify({ error: `Failed to update entry: ${updErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, entryId, enabled: enabled === true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove-internal-entry") {
      if (typeof entryId !== "string" || !entryId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: entryId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: delErr } = await supabaseAdmin
        .from("internal_traffic")
        .delete()
        .eq("id", entryId);

      if (delErr) {
        return new Response(
          JSON.stringify({ error: `Failed to remove entry: ${delErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, entryId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── analytics-overview: the whole /admin Analytics section, one round trip ──
    // Aggregated in Postgres rather than the browser, and not only for speed: the
    // funnel's last step is a join against payment_orders, which the client
    // cannot read for other users at all. See admin_analytics() in 018.
    if (action === "analytics-overview") {
      const window = readWindow(from, to);

      // Defaults to true when the client says nothing: the panel exists to
      // describe real users, so that is the safer default for any caller.
      const hideInternal = excludeInternal !== false;

      const { data: analytics, error: analyticsErr } = await supabaseAdmin.rpc("admin_analytics", {
        p_from: window.from,
        p_to: window.to,
        p_exclude_internal: hideInternal,
      });

      if (analyticsErr) {
        return new Response(
          JSON.stringify({ error: `Failed to compute analytics: ${analyticsErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, analytics }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── campaigns-overview: the Campaigns table under Analytics ───────────────
    // Its own action and its own RPC rather than another key on the payload
    // above: admin_analytics() is ~600 lines and every existing number would
    // have to be re-verified to add a join to it. See admin_campaigns() in 019.
    if (action === "campaigns-overview") {
      const window = readWindow(from, to);

      const { data: campaigns, error: campaignsErr } = await supabaseAdmin.rpc("admin_campaigns", {
        p_from: window.from,
        p_to: window.to,
        // Must match what analytics-overview was asked for, or the Campaigns
        // table and the funnel above it describe different populations.
        p_exclude_internal: excludeInternal !== false,
      });

      if (campaignsErr) {
        return new Response(
          JSON.stringify({ error: `Failed to compute campaigns: ${campaignsErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, campaigns }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── audience-overview: who they are, not what they did ────────────────────
    // Separate from analytics-overview for the same reason campaigns is: adding
    // to admin_analytics() would mean re-verifying every number already read
    // from it. See admin_audience() in 019.
    if (action === "audience-overview") {
      const window = readWindow(from, to);

      const { data: audience, error: audienceErr } = await supabaseAdmin.rpc("admin_audience", {
        p_from: window.from,
        p_to: window.to,
        // Must match what analytics-overview was asked for, or the two halves of
        // one screen describe different populations.
        p_exclude_internal: excludeInternal !== false,
      });

      if (audienceErr) {
        return new Response(
          JSON.stringify({ error: `Failed to compute audience: ${audienceErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Whether the provider is CONFIGURED, which Postgres cannot know — the
      // secret lives in the edge runtime. Reported alongside admin_audience's
      // geo_available (whether anything actually RESOLVED) so the panel can tell
      // "not set up" apart from "set up and failing".
      //
      // Without it the two states are indistinguishable, and the panel told the
      // operator to set a secret that was already set: a rejected token returns
      // 403, nothing is cached, and after the window rolls past the last good
      // lookup the Cities card reverts to "IPINFO_TOKEN is not set" — sending
      // whoever reads it to the wrong place entirely.
      return new Response(
        JSON.stringify({
          success: true,
          audience: audience && typeof audience === "object"
            ? { ...audience, geo_configured: geoEnabled() }
            : audience,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── click-map: bucketed click coordinates for one page ────────────────────
    // Its own action so the payload above never carries thousands of points for a
    // heatmap the operator may never open.
    if (action === "click-map") {
      if (typeof path !== "string" || !path) {
        return new Response(
          JSON.stringify({ error: "Missing required field: path" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const window = readWindow(from, to);

      const { data: clickMap, error: mapErr } = await supabaseAdmin.rpc("admin_click_map", {
        p_path: path,
        // null means every device class, which is what the RPC treats as "all".
        p_device: typeof device === "string" && device ? device : null,
        p_from: window.from,
        p_to: window.to,
        // Must match what analytics-overview was asked for, or the heatmap and
        // the funnel describe different populations for the same window.
        p_exclude_internal: excludeInternal !== false,
        // Allow-listed rather than passed through: p_kind reaches a SQL comparison,
        // and an unrecognised string would silently return an empty map that reads
        // as "nobody clicked here".
        p_kind: kind === "dead" || kind === "rage" ? kind : "click",
      });

      if (mapErr) {
        return new Response(
          JSON.stringify({ error: `Failed to compute click map: ${mapErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, clickMap }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── rls-snapshot: the live policy map for the tables that matter ──────────
    // pg_policies is not reachable through PostgREST, hence the RPC. Migration
    // 013: "the migration files are not the whole truth about this database."
    if (action === "rls-snapshot") {
      const { data: policies, error: rlsErr } = await supabaseAdmin.rpc("admin_rls_snapshot");

      if (rlsErr) {
        return new Response(
          JSON.stringify({ error: `Failed to read RLS snapshot: ${rlsErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, policies: policies ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── canary-cleanup: delete the probe row the write canary just inserted ───
    // Deletes by the exact session_id handed in, never by a `canary-%` wildcard —
    // a wildcard delete triggered from the browser is a footgun. The hourly cron
    // job sweeps any stragglers a closed tab left behind.
    if (action === "canary-cleanup") {
      if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("canary-")) {
        return new Response(
          JSON.stringify({ error: "canary-cleanup requires a sessionId beginning with 'canary-'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: deleted, error: delErr } = await supabaseAdmin
        .from("kundli_reports")
        .delete()
        .eq("session_id", sessionId)
        .select("id");

      if (delErr) {
        return new Response(
          JSON.stringify({ error: `Failed to clean up canary: ${delErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // The count is the real assertion: it proves the anon insert actually landed
      // rather than merely returning without an error.
      return new Response(
        JSON.stringify({ success: true, deleted: deleted?.length ?? 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── delete-admin-kundali: hard-delete a single admin-generated record ─────
    if (action === "delete-admin-kundali") {
      if (!kundaliId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: kundaliId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: delErr } = await supabaseAdmin
        .from("kundli_reports")
        .delete()
        .eq("id", kundaliId)
        .eq("is_admin_generated", true); // safety: only delete admin-generated records

      if (delErr) {
        return new Response(
          JSON.stringify({ error: `Failed to delete: ${delErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "delete-admin-kundali", kundaliId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── get-kundali-by-slug: fetch any kundali by share_slug for admin viewing ─
    if (action === "get-kundali-by-slug") {
      if (!shareSlug) {
        return new Response(
          JSON.stringify({ error: "Missing required field: shareSlug" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: kundali, error: fetchErr } = await supabaseAdmin
        .from("kundli_reports")
        .select("*")
        .eq("share_slug", shareSlug)
        .single();

      if (fetchErr || !kundali) {
        return new Response(
          JSON.stringify({ error: `Kundali not found: ${fetchErr?.message || "No record with that slug"}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, kundali }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("admin-user-management error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
