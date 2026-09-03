/**
 * Chatbot access policy — the single place that decides whether a user may
 * open the AI Astrologer, and what to tell them when they may not.
 *
 * The AI Astrologer is the one paid feature; /kundali became free in the
 * payment-removal change. Every entry point (kundali sidebar, floating widget,
 * footer, dashboard, upcoming-features) previously inlined
 * `hasPaid ? "/ai-chat" : "/payment"`, which could not tell "not signed in"
 * apart from "signed in but unpaid" and redirected silently either way.
 *
 * Pairs with PaidRoute, which enforces the same policy for direct URL hits.
 */

import type { UserState } from "./resolve-destination";

/** Why chatbot access was denied, or null when the user may proceed. */
export type ChatDenial = "auth" | "onboarding" | "payment" | null;

/** The full-page chat route, guarded by PaidRoute. */
export const CHAT_PATH = "/ai-chat";

/**
 * Evaluate a user's state against the chatbot's requirements.
 * Order matters: payment first, then authentication, then birth details.
 */
export function chatDenial(state: UserState): ChatDenial {
  // Check payment first - non-paid users should see payment prompt immediately
  if (!state.hasPaid) return "payment";
  // Only after payment is confirmed, check if they need to authenticate
  if (!state.isAuthenticated) return "auth";
  // Finally check if they have birth details
  if (!state.onboardingDone) return "onboarding";
  return null;
}

/** Where to send the user so they can resolve the denial. */
export function chatDestination(denial: ChatDenial): string {
  switch (denial) {
    // Straight to the offer. The AI Astrologer costs ₹99 whether or not you
    // have an account, so showing a bare sign-in wall first hides the actual
    // requirement. /payment is unguarded and its Pay button starts Google
    // sign-in, because an order cannot exist without a user id.
    case "auth":
      return "/payment";
    // Genuinely has no birth details on file, so the form is the right screen.
    // intent=ai-chat so resolveDestination returns them to the chat after.
    case "onboarding":
      return "/auth?intent=ai-chat";
    case "payment":
      return "/payment";
    default:
      return CHAT_PATH;
  }
}

/** User-facing explanation for the redirect. Shown as a toast. */
export const CHAT_DENIAL_MESSAGE: Record<Exclude<ChatDenial, null>, string> = {
  auth: "Sign in to unlock AI Astrologer for ₹99",
  onboarding: "Complete your profile to access AI Astrologer",
  payment: "Pay ₹99 to unlock AI Astrologer",
};
