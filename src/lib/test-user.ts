/**
 * Test user utilities for test@vedicfinance.ai
 *
 * When this email logs in, all their stored data (onboarding, payment, birth details,
 * kundali reports, etc.) is automatically cleared so they start fresh every session.
 */

import { supabase } from "@/lib/supabase";

export const TEST_EMAILS = [
  "test@vedicfinance.ai",
  "rushipatil105678@gmail.com",
];

const ADMIN_PASSWORD = "test123";

/**
 * Check if a given email is a designated test account.
 */
export function isTestUser(email: string | undefined | null): boolean {
  if (!email) return false;
  return TEST_EMAILS.some((t) => t.toLowerCase() === email.toLowerCase());
}

/**
 * Clears all data for the test user so they experience a fresh session
 * (onboarding → payment → kundali from scratch).
 *
 * Calls the admin-user-management edge function with "reset-payment" action
 * which resets: user_profiles (has_paid, onboarding_done), payment_orders,
 * user_birth_details, user_astrosign, user_financial_profile.
 *
 * Also deletes their kundali reports so they get a fresh kundali.
 */
export async function clearTestUserData(userId: string): Promise<void> {
  try {
    // Reset payment + onboarding + birth details
    await supabase.functions.invoke("admin-user-management", {
      body: {
        action: "reset-payment",
        userId,
        adminPassword: ADMIN_PASSWORD,
      },
    });

    // Also delete their kundali reports for a fully fresh experience
    await supabase.functions.invoke("admin-user-management", {
      body: {
        action: "delete-kundalis",
        userId,
        adminPassword: ADMIN_PASSWORD,
      },
    });

    // Clear all sessionStorage to wipe any cached data
    sessionStorage.removeItem("kundliRequest");
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    sessionStorage.removeItem("lastKundaliSlug");
    sessionStorage.removeItem("lastKundaliId");
    sessionStorage.removeItem("luxuryAnalysis");
    sessionStorage.removeItem("investmentBaskets");
    sessionStorage.removeItem("sessionId");
    sessionStorage.removeItem("pendingBirthData");
    // Clear financialSummary cache entries
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("financialSummary_")) {
        sessionStorage.removeItem(key);
      }
    }

    console.log("[TestUser] Data cleared for test@vedicfinance.ai, fresh session ready");
  } catch (err) {
    console.error("[TestUser] Failed to clear test user data:", err);
  }
}
