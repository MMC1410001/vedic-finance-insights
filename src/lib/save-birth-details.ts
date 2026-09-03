/**
 * saveBirthDetails — persist a user's birth details and mark onboarding done.
 *
 * Writes both rows that the rest of the app treats as "this user is onboarded":
 *   - user_birth_details — the chart inputs
 *   - user_profiles      — onboarding_done, and the row itself
 *
 * The user_profiles row matters beyond onboarding: there is no handle_new_user
 * trigger, so nothing else creates it. payment-webhook and payment-status mark
 * payment with `.update({has_paid:true}).eq("id", user_id)`, which silently
 * affects 0 rows when the row is missing — so without this write a real payment
 * never unlocks anything.
 *
 * Callers: AuthPage (its own OAuth return + birth form) and FinancialKundali
 * (the /kundali-auth OAuth return, which lands on /kundali and used to write
 * nothing at all).
 */

import { supabase } from "./supabase";
import { stampFirstTouchOnce } from "./utm";
import type { ReportRequest } from "./vedicfinance-types";

export async function saveBirthDetails(userId: string, req: ReportRequest): Promise<void> {
  const now = new Date().toISOString();

  await supabase.from("user_birth_details").upsert({
    id: userId,
    full_name: req.full_name || "",
    birth_date: req.birth_date,
    birth_time: req.birth_time,
    birth_time_accuracy: req.birth_time_accuracy,
    birth_place: req.birth_place,
    latitude: req.latitude,
    longitude: req.longitude,
    timezone: req.timezone,
    updated_at: now,
  });

  await supabase.from("user_profiles").upsert({
    id: userId,
    onboarding_done: true,
    updated_at: now,
  });

  // Now that the row exists, record which campaign acquired this account. The
  // SIGNED_IN handler already tried; for a brand-new user that UPDATE matched
  // nothing, because the row above is what creates it. Write-once is enforced in
  // SQL, so calling it from both places cannot double-write.
  void stampFirstTouchOnce();
}

/**
 * Persist the birth details a guest already entered before signing in.
 *
 * A visitor can generate a full kundali with no account; those details live in
 * `sessionStorage.kundliRequest`. Once they sign in, that request has to reach
 * the database or `onboarding_done` stays false and every guard treats them as
 * a fresh user — which is what made the AI Astrologer re-ask for details the
 * visitor had already typed.
 *
 * Returns true when details were found and written, so callers that need to
 * route on the result can await it rather than racing the write.
 */
export async function persistGuestBirthDetails(userId: string): Promise<boolean> {
  const raw = sessionStorage.getItem("kundliRequest");
  if (!raw) return false;
  try {
    await saveBirthDetails(userId, JSON.parse(raw) as ReportRequest);
    return true;
  } catch {
    // Malformed JSON, or the write failed — non-critical, AuthPage's birth form
    // remains the fallback.
    return false;
  }
}
