/**
 * Kundali History — persist generated kundalis to Supabase for profile & sharing.
 */

import { supabase } from "./supabase";
import { ensureSessionId, trackVisit } from "./visitor-tracking";
import analytics from "./analytics";
import { campaignParams } from "./utm";
import type { ReportRequest, ReportResponse } from "./vedicfinance-types";

export interface KundaliRecord {
  id: string;
  user_id: string | null;
  full_name: string | null;
  share_slug: string;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  session_id: string;
  scores: ReportResponse["scores"];
  dasha: ReportResponse["dasha"];
  d1_chart: ReportResponse["d1_chart"];
  d9_chart: ReportResponse["d9_chart"];
  timeline: ReportResponse["timeline"];
  transits: ReportResponse["transits"];
  financial_phase: string;
  confidence_lvl: string;
  primary_insight: string;
  created_at: string;
}

/** Generate a short unique slug for sharing */
function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

/**
 * Save a generated kundali report to the database.
 *
 * The id and share_slug are generated client-side on purpose, so the insert needs
 * no RETURNING clause. Chaining `.select()` here made PostgREST issue
 * `INSERT ... RETURNING`, and Postgres applies SELECT policies to returned rows —
 * a guest row (user_id NULL, is_shared false) matches no policy after migration
 * 012/013, so every guest save failed. Signed-in saves were unaffected, which is
 * why the breakage went unnoticed. See migrations 012_rls_hardening.sql.
 */
export async function saveKundaliReport(
  req: ReportRequest,
  report: ReportResponse,
  userId?: string,
): Promise<{ id: string; shareSlug: string } | null> {
  const id = crypto.randomUUID();
  const shareSlug = generateSlug();
  // Persist the sessionId, don't just mint a throwaway one: it is the key
  // getUserKundalis() uses to claim a guest's orphaned row at signup.
  const sessionId = ensureSessionId();

  const { error } = await supabase
    .from("kundli_reports")
    .insert({
      id,
      user_id: userId ?? null,
      full_name: req.full_name ?? null,
      share_slug: shareSlug,
      session_id: sessionId,
      birth_date: req.birth_date,
      birth_time: req.birth_time,
      birth_place: req.birth_place,
      is_admin_generated: false,
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
    });

  if (error) {
    // Loud on purpose: this used to fail silently for every guest for three days.
    console.error(
      `Failed to save kundali report [${error.code ?? "no-code"}]: ${error.message}`,
      { details: error.details, hint: error.hint, guest: !userId },
    );
    return null;
  }

  // Fire-and-forget: records the IP behind this generation, keyed on the same
  // sessionId the row above carries.
  trackVisit("kundali_generated");
  // The same moment, for GTM. Deliberately here rather than on the /kundali
  // render ANALYTICS.md proposes: firing both from one place is what lets the
  // GA4 count and the first-party count be checked against each other. Not a
  // click, so it needs a Custom Event trigger.
  analytics({ ...campaignParams() }, "Kundali_ReportGenerated");

  return { id, shareSlug };
}

/** Fetch all kundalis for a user */
export async function getUserKundalis(userId: string, skipAutoClaim = false): Promise<KundaliRecord[]> {
  // Auto-claim orphaned guest reports ONLY if not in admin context
  // When skipAutoClaim is true (e.g., from admin panel), we don't want to
  // accidentally claim guest kundalis that we're trying to inspect/test.
  if (!skipAutoClaim) {
    // Try to claim any orphaned reports (requires UPDATE policy on DB)
    const sessionId = sessionStorage.getItem("sessionId");
    if (sessionId) {
      await supabase
        .from("kundli_reports")
        .update({ user_id: userId })
        .is("user_id", null)
        .eq("session_id", sessionId);
    }

    const lastId = sessionStorage.getItem("lastKundaliId");
    if (lastId) {
      await supabase
        .from("kundli_reports")
        .update({ user_id: userId })
        .eq("id", lastId)
        .is("user_id", null);
    }

    // Try to claim by birth details
    try {
      const { data: birthData } = await supabase
        .from("user_birth_details")
        .select("birth_date, birth_time, birth_place")
        .eq("id", userId)
        .single();

      if (birthData) {
        await supabase
          .from("kundli_reports")
          .update({ user_id: userId })
          .is("user_id", null)
          .eq("birth_date", birthData.birth_date)
          .eq("birth_time", birthData.birth_time)
          .eq("birth_place", birthData.birth_place);
      }
    } catch {
      // Non-critical
    }
  }

  // Fetch reports owned by this user
  const { data, error } = await supabase
    .from("kundli_reports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false});

  if (error) {
    console.error("Failed to fetch user kundalis:", error.message);
    return [];
  }

  return (data ?? []) as KundaliRecord[];
}

/**
 * Mark a report as publicly shareable.
 *
 * Every report carries a share_slug from creation — it is the lookup key — but
 * the row stays private until this flips is_shared. Before migration 012 the
 * RLS policy was `share_slug is not null`, which matched every row and made all
 * 294 reports world-readable. Call this only when the user actively shares.
 */
export async function markKundaliShared(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("kundli_reports")
    .update({ is_shared: true })
    .eq("id", id);

  if (error) {
    console.error("Failed to mark kundali shared:", error.message);
    return false;
  }
  return true;
}

/** Fetch a single kundali by share slug (public — only if is_shared) */
export async function getKundaliBySlug(slug: string): Promise<KundaliRecord | null> {
  const { data, error } = await supabase
    .from("kundli_reports")
    .select("*")
    .eq("share_slug", slug)
    .single();

  if (error) {
    console.error("Failed to fetch shared kundali:", error.message);
    return null;
  }

  return data as KundaliRecord;
}

/** Fetch a single kundali by share slug via admin API (bypasses RLS) */
export async function getKundaliBySlugAdmin(slug: string): Promise<KundaliRecord | null> {
  try {
    console.log('[Admin API] Fetching kundali with slug:', slug);
    const { data, error } = await supabase.functions.invoke("admin-user-management", {
      body: { action: "get-kundali-by-slug", shareSlug: slug },
    });

    console.log('[Admin API] Response:', { success: data?.success, hasKundali: !!data?.kundali, error: error?.message || data?.error });

    if (error || !data?.success || !data?.kundali) {
      console.error("Failed to fetch kundali via admin API:", error?.message || data?.error);
      return null;
    }

    console.log('[Admin API] Successfully fetched kundali for:', data.kundali.full_name);
    return data.kundali as KundaliRecord;
  } catch (err) {
    console.error("Admin kundali fetch failed:", err);
    return null;
  }
}

/** Fetch a single kundali by ID */
export async function getKundaliById(id: string): Promise<KundaliRecord | null> {
  const { data, error } = await supabase
    .from("kundli_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to fetch kundali:", error.message);
    return null;
  }

  return data as KundaliRecord;
}
