/**
 * Tests for the chatbot access policy.
 *
 * The AI Astrologer is the only paid feature. Before this policy existed, every
 * entry point inlined `hasPaid ? "/ai-chat" : "/payment"`, which could not tell
 * an anonymous visitor apart from a signed-in unpaid one — so anonymous users
 * were silently bounced to /home with no explanation.
 *
 * The order is **payment, then auth, then birth details** — see chat-access.ts.
 * That is deliberate and it is what these tests assert: the feature costs ₹99
 * whether or not you have an account, so the price is the honest first thing to
 * show. A sign-in wall in front of it hides the actual requirement and makes the
 * account feel like the product.
 *
 * Three tests here used to assert the opposite order and failed for months. They
 * were the stale half of a file that contradicted itself — the chatDestination
 * test below asserted the ₹99-first behaviour and passed the whole time.
 */

import { describe, it, expect } from "vitest";
import {
  chatDenial,
  chatDestination,
  CHAT_DENIAL_MESSAGE,
  CHAT_PATH,
} from "@/lib/chat-access";
import type { UserState } from "@/lib/resolve-destination";

const anonymous: UserState = { isAuthenticated: false, onboardingDone: false, hasPaid: false };
const notOnboarded: UserState = { isAuthenticated: true, onboardingDone: false, hasPaid: false };
const unpaid: UserState = { isAuthenticated: true, onboardingDone: true, hasPaid: false };
const paid: UserState = { isAuthenticated: true, onboardingDone: true, hasPaid: true };

describe("chatDenial", () => {
  it("denies an anonymous visitor for payment, showing the price before any wall", () => {
    // Not "auth". ₹99 is what actually stands between this visitor and the
    // feature; the account is a means to it. /payment is unguarded and its Pay
    // button starts Google sign-in, so nothing is skipped by leading with price.
    expect(chatDenial(anonymous)).toBe("payment");
  });

  it("denies an unpaid signed-in user for payment whether or not they have birth details", () => {
    expect(chatDenial(notOnboarded)).toBe("payment");
    expect(chatDenial(unpaid)).toBe("payment");
  });

  it("asks for birth details only once payment is settled", () => {
    // The onboarding branch is reachable only after hasPaid, which is the whole
    // point of the ordering: never ask for a birth chart before the thing that
    // gates it.
    expect(chatDenial({ isAuthenticated: true, onboardingDone: false, hasPaid: true })).toBe("onboarding");
  });

  it("allows a fully paid user", () => {
    expect(chatDenial(paid)).toBeNull();
  });

  it("keeps the auth branch as a fallback that real state cannot reach", () => {
    // hasPaid is read from user_profiles, so a paid row implies an account and
    // this combination should never occur in practice. Asserted anyway: the
    // branch exists, and if the ordering is ever rearranged this is the test
    // that notices the fallback stopped being a fallback.
    expect(chatDenial({ isAuthenticated: false, onboardingDone: true, hasPaid: true })).toBe("auth");
  });
});

describe("chatDestination", () => {
  it("sends signed-out users straight to the ₹99 offer, not a sign-in wall", () => {
    // The AI Astrologer costs ₹99 with or without an account, so the price is
    // shown first. /payment is unguarded; its Pay button starts Google sign-in.
    expect(chatDestination("auth")).toBe("/payment");
  });

  it("never sends a signed-out user to the birth-details form", () => {
    // /auth is that form. A guest arriving from /kundali has already entered
    // those details to generate the chart, so it would ask twice.
    expect(chatDestination("auth")).not.toContain("/auth");
  });

  it("sends users with no birth details to the form", () => {
    // intent=ai-chat so resolveDestination returns them to the chat afterwards
    expect(chatDestination("onboarding")).toBe("/auth?intent=ai-chat");
    expect(chatDestination("onboarding")).toContain("intent=ai-chat");
  });

  it("puts both signed-out and unpaid users on the same paywall", () => {
    expect(chatDestination("auth")).toBe(chatDestination("payment"));
  });

  it("sends unpaid users to /payment", () => {
    expect(chatDestination("payment")).toBe("/payment");
  });

  it("sends allowed users to the chat itself", () => {
    expect(chatDestination(null)).toBe(CHAT_PATH);
  });

  it("never sends a denied user to /home", () => {
    // The original bug: anonymous chatbot clicks landed on the homepage
    for (const denial of ["auth", "onboarding", "payment"] as const) {
      expect(chatDestination(denial)).not.toBe("/home");
    }
  });
});

describe("CHAT_DENIAL_MESSAGE", () => {
  it("has a non-empty message for every denial reason", () => {
    for (const denial of ["auth", "onboarding", "payment"] as const) {
      expect(CHAT_DENIAL_MESSAGE[denial].length).toBeGreaterThan(0);
    }
  });

  it("tells unpaid users that payment is what's missing", () => {
    // Matches "pay", not "payment": the copy is "Pay ₹99 to unlock AI
    // Astrologer", which states the requirement plainly — the assertion was
    // failing on the exact noun rather than on the meaning. Checking the price
    // too, since that is the part a user acts on.
    expect(CHAT_DENIAL_MESSAGE.payment.toLowerCase()).toMatch(/\bpay/);
    expect(CHAT_DENIAL_MESSAGE.payment).toContain("99");
  });
});
