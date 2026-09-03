/**
 * Centralized route resolution utility.
 *
 * Given the current user state, returns the correct destination path.
 * Every CTA, guard, and redirect should use this single function so
 * routing logic is deterministic and lives in one place.
 */

export interface UserState {
  /** Whether the user is authenticated (has a Supabase session) */
  isAuthenticated: boolean;
  /** Whether onboarding (birth details) is complete */
  onboardingDone: boolean;
  /** Whether the user has paid */
  hasPaid: boolean;
}

export type Intent = "kundali" | "ai-chat" | null;

/**
 * Resolve where the user should be directed based on their current state.
 *
 * @param state - Current user state from DB/auth context
 * @param intent - Optional intent (e.g. "kundali" or "ai-chat" from CTA clicks)
 * @returns The path to navigate to
 */
export function resolveDestination(state: UserState, intent?: Intent): string {
  if (!state.isAuthenticated) {
    // Not logged in — send to auth with intent preserved
    return intent ? `/auth?intent=${intent}` : "/auth";
  }

  if (!state.onboardingDone) {
    // Logged in but hasn't completed birth details
    return intent ? `/auth?intent=${intent}` : "/auth";
  }

  // Kundali is free for onboarded users — no payment required
  if (intent === "kundali") {
    return "/kundali";
  }

  // AI chatbot requires payment
  if (intent === "ai-chat") {
    return state.hasPaid ? "/ai-chat" : "/payment";
  }

  // Default: go to kundali (free for onboarded users)
  return "/kundali";
}

/**
 * Check if the user's current state satisfies the minimum requirement for a route.
 *
 * Route requirements:
 * - "auth"     → user must be authenticated
 * - "onboarded" → user must be authenticated + onboarding complete
 * - "paid"     → user must be authenticated + onboarded + paid
 */
export type RouteRequirement = "auth" | "onboarded" | "paid";

export function getRedirectForRoute(
  state: UserState,
  requirement: RouteRequirement
): string | null {
  switch (requirement) {
    case "auth":
      if (!state.isAuthenticated) return "/home";
      return null; // meets requirement

    case "onboarded":
      if (!state.isAuthenticated) return "/home";
      if (!state.onboardingDone) return "/auth";
      return null;

    case "paid":
      if (!state.isAuthenticated) return "/home";
      if (!state.onboardingDone) return "/auth";
      if (!state.hasPaid) return "/payment";
      return null;
  }
}
