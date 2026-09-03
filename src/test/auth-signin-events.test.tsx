import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * What a sign-in is allowed to count.
 *
 * supabase-js does NOT emit SIGNED_IN only when someone signs in — it re-emits
 * it on a token refresh and when a backgrounded tab regains focus. Everything
 * hanging off that event therefore had to be de-duplicated, or the funnel's
 * "Signed in" stage counted refreshes and Auth_LoginSuccess could exceed the
 * Login_ContinuewithGoogle clicks it is meant to be divided by — an OAuth
 * drop-off rate above 100%.
 *
 * These drive the real AuthProvider through a fake auth channel rather than
 * testing an extracted helper, because the thing that matters is which of the
 * three side effects fire, and how many times.
 */

let notify: (event: string, session: unknown) => void = () => {};

/** Fire an auth event the way supabase-js would, inside act so React settles. */
const emit = (event: string, session: unknown) =>
  act(() => {
    notify(event, session);
  });

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
        notify = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

vi.mock("@/lib/visitor-tracking", () => ({ trackVisit: vi.fn() }));
vi.mock("@/lib/event-queue", () => ({ endAnalyticsSession: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ default: vi.fn() }));
vi.mock("@/lib/utm", () => ({
  campaignParams: vi.fn(() => null),
  stampFirstTouchOnce: vi.fn(() => Promise.resolve()),
}));

import { AuthProvider } from "@/lib/auth-context";
import { trackVisit } from "@/lib/visitor-tracking";
import analytics from "@/lib/analytics";
import { stampFirstTouchOnce } from "@/lib/utm";

const tracked = vi.mocked(trackVisit);
const tagged = vi.mocked(analytics);
const stamped = vi.mocked(stampFirstTouchOnce);

const session = (id: string) => ({ user: { id } });

/** Sign-in tags only, ignoring anything else pushed to the dataLayer. */
const loginTags = () => tagged.mock.calls.filter(([, name]) => name === "Auth_LoginSuccess");
const signedInRows = () => tracked.mock.calls.filter(([verb]) => verb === "signed_in");

async function mount() {
  // await, so the getSession() promise the provider kicks off on mount settles
  // inside act rather than landing mid-assertion.
  await act(async () => {
    render(<AuthProvider>{null}</AuthProvider>);
  });
}

describe("SIGNED_IN, which supabase-js re-emits on refresh and tab focus", () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    tracked.mockClear();
    tagged.mockClear();
    stamped.mockClear();
    await mount();
  });

  it("counts a genuine sign-in once", () => {
    emit("SIGNED_IN", session("user-a"));
    expect(signedInRows()).toHaveLength(1);
    expect(loginTags()).toHaveLength(1);
  });

  it("does not count the same user again on a refresh or a tab focus", () => {
    emit("SIGNED_IN", session("user-a"));
    emit("SIGNED_IN", session("user-a"));
    emit("SIGNED_IN", session("user-a"));
    expect(signedInRows()).toHaveLength(1);
    expect(loginTags()).toHaveLength(1);
  });

  it("counts a different account on the same tab", () => {
    emit("SIGNED_IN", session("user-a"));
    emit("SIGNED_IN", session("user-b"));
    expect(signedInRows()).toHaveLength(2);
    expect(loginTags()).toHaveLength(2);
  });

  it("counts again after a sign-out, because the latch is cleared", () => {
    emit("SIGNED_IN", session("user-a"));
    emit("SIGNED_OUT", null);
    emit("SIGNED_IN", session("user-a"));
    expect(signedInRows()).toHaveLength(2);
    expect(loginTags()).toHaveLength(2);
  });

  it("clears the latch key by name on sign-out", () => {
    emit("SIGNED_IN", session("user-a"));
    expect(sessionStorage.getItem("afSignedInCounted")).toBe("user-a");
    emit("SIGNED_OUT", null);
    expect(sessionStorage.getItem("afSignedInCounted")).toBeNull();
  });

  // Deliberately NOT de-duplicated. The RPC is idempotent in SQL
  // (`first_touch_at is null`) and this is the retry a brand-new signup depends
  // on: the UPDATE matches nothing until save-birth-details has created the
  // profile row. Suppressing it would cost real attribution to save a call that
  // already returns null.
  it("still retries the first-touch stamp on every emission", () => {
    emit("SIGNED_IN", session("user-a"));
    emit("SIGNED_IN", session("user-a"));
    expect(stamped).toHaveBeenCalledTimes(2);
  });

  it("counts a session with no user id rather than dropping it", () => {
    // Nothing to key the latch on, so the old behaviour stands: better a
    // possible double-count than a sign-in that is never recorded at all.
    emit("SIGNED_IN", {});
    expect(signedInRows()).toHaveLength(1);
  });
});

/**
 * What must NOT survive a sign-out.
 *
 * The handler clears an explicit list of keys, which means the list is the
 * whole safety mechanism and a key missing from it is invisible until two
 * people share a browser. These assert the user-scoped ones by name.
 */
describe("SIGNED_OUT clears everything scoped to the departing user", () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    await mount();
  });

  // The one that leaked. Hero and the onboarding form park birth details here
  // while Google OAuth round trips; if the flow was abandoned nothing consumed
  // them, and they outlived the sign-out because sessionStorage survives the
  // hard redirect. AuthPage's pending branch then wrote one person's name,
  // birth date, time and place onto the NEXT person's profile, set
  // onboarding_done, and routed them to a chart cast for a stranger.
  it("drops birth details captured before an account existed", () => {
    sessionStorage.setItem(
      "pendingBirthData",
      JSON.stringify({ full_name: "Someone Else", birth_date: "1990-01-01" }),
    );
    emit("SIGNED_OUT", null);
    expect(sessionStorage.getItem("pendingBirthData")).toBeNull();
  });

  it("drops the report, the request and the session id", () => {
    for (const key of ["kundliReport", "kundliRequest", "sessionId", "vedicfinanceChat"]) {
      sessionStorage.setItem(key, "x");
    }
    emit("SIGNED_OUT", null);
    for (const key of ["kundliReport", "kundliRequest", "sessionId", "vedicfinanceChat"]) {
      expect(sessionStorage.getItem(key), `${key} survived sign-out`).toBeNull();
    }
  });

  it("drops the pending order and the purchase latch that goes with it", () => {
    localStorage.setItem("vedicfinance:pendingOrderId", "order-1");
    localStorage.setItem("vedicfinance:purchaseTracked", "order-1");
    emit("SIGNED_OUT", null);
    expect(localStorage.getItem("vedicfinance:pendingOrderId")).toBeNull();
    expect(localStorage.getItem("vedicfinance:purchaseTracked")).toBeNull();
  });

  it("drops this session's campaign but keeps the browser's identity", () => {
    sessionStorage.setItem("afLastTouch", JSON.stringify({ utm_source: "whatsapp" }));
    localStorage.setItem("afVisitorId", "visitor-1");
    localStorage.setItem("afFirstTouch", JSON.stringify({ utm_source: "whatsapp" }));

    emit("SIGNED_OUT", null);

    expect(sessionStorage.getItem("afLastTouch")).toBeNull();
    // Kept on purpose: these describe the browser, not the account. Clearing
    // them would make every sign-out look like a brand-new visitor.
    expect(localStorage.getItem("afVisitorId")).toBe("visitor-1");
    expect(localStorage.getItem("afFirstTouch")).not.toBeNull();
  });
});
