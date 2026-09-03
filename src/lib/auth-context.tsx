import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { trackVisit } from "./visitor-tracking";
import { endAnalyticsSession } from "./event-queue";
import analytics from "./analytics";
import { campaignParams, stampFirstTouchOnce } from "./utm";

/**
 * Which user this tab has already counted a sign-in for.
 *
 * Not a cache and not user data — a de-duplication latch, because supabase-js
 * re-emits SIGNED_IN on token refresh and on tab focus. Listed in the
 * SIGNED_OUT handler below like every other session-scoped key.
 */
const SIGNED_IN_KEY = "afSignedInCounted";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN") {
        sessionStorage.removeItem("guestMode");
        // SIGNED_IN is NOT "someone just logged in". supabase-js emits it again
        // on a token refresh and when a backgrounded tab regains focus, so
        // everything below used to fire several times for one sign-in: the
        // funnel's "Signed in" stage counted refreshes, and Auth_LoginSuccess
        // could exceed the Login_ContinuewithGoogle clicks it is meant to be
        // divided by — an OAuth drop-off rate above 100%.
        //
        // Keyed by user id so that a genuine account switch on the same tab is
        // still counted, and held in sessionStorage so it dies with the tab
        // rather than suppressing tomorrow's sign-in. Cleared on SIGNED_OUT
        // below, so signing out and back in counts twice, correctly.
        const alreadyCounted =
          !!s?.user?.id && sessionStorage.getItem(SIGNED_IN_KEY) === s.user.id;

        if (!alreadyCounted) {
          if (s?.user?.id) {
            try {
              sessionStorage.setItem(SIGNED_IN_KEY, s.user.id);
            } catch { /* private mode: at worst this counts twice, as before */ }
          }
          // Runs before sessionId is ever cleared, so this row carries both the
          // guest's sessionId and the new user_id — it is the link that ties a
          // guest's earlier anonymous visits to an account.
          trackVisit("signed_in");
          // The success half of the sign-in funnel. The button click is tagged
          // separately (Login_ContinuewithGoogle); the gap between the two is the
          // OAuth drop-off. Not a click itself — it fires after the redirect
          // back — so it needs a Custom Event trigger. See ANALYTICS.md →
          // "These cannot be click tags".
          analytics({ ...campaignParams() }, "Auth_LoginSuccess");
        }

        // Deliberately OUTSIDE the guard. This one is idempotent in SQL
        // (`first_touch_at is null`) and is the retry that a brand-new signup
        // depends on — the UPDATE matches nothing until save-birth-details has
        // created the profile row. Suppressing it on a refresh would cost real
        // attribution to save an RPC that already returns null. See utm.ts.
        void stampFirstTouchOnce();
      }
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("guestMode");
        // Clear all kundali-related session data to prevent stale data leaking to next user
        sessionStorage.removeItem("kundliRequest");
        sessionStorage.removeItem("kundliReport");
        sessionStorage.removeItem("kundliReportKey");
        sessionStorage.removeItem("lastKundaliSlug");
        sessionStorage.removeItem("lastKundaliId");
        sessionStorage.removeItem("luxuryAnalysis");
        sessionStorage.removeItem("investmentBaskets");
        sessionStorage.removeItem("sessionId");
        // Birth details captured before an account existed — the Hero form and
        // the onboarding form both park them here while Google OAuth round
        // trips. Nothing consumed them if the flow was abandoned, and they
        // survive the hard redirect below, so the next person to sign up on this
        // browser had them written onto THEIR profile by AuthPage's pending
        // branch: someone else's name, birth date, time and place, with
        // onboarding_done set, and no form ever shown to correct it.
        sessionStorage.removeItem("pendingBirthData");
        // This session's campaign and the once-per-session stamp latch. Both are
        // session-scoped and both survive the hard redirect below, so leaving
        // them would attribute the next person's session to the campaign the
        // departing user arrived from.
        sessionStorage.removeItem("afLastTouch");
        sessionStorage.removeItem("afFirstTouchStamped");
        // The "this tab has already counted a sign-in for this user" latch. Must
        // go, or signing out and straight back in — the same person or a
        // different one — would not be counted as a sign-in at all.
        sessionStorage.removeItem(SIGNED_IN_KEY);
        // Deliberately KEPT: `afVisitorId` and `afFirstTouch` in localStorage.
        // They describe the browser, not the account. Clearing them would make
        // every sign-out look like a brand-new visitor and break the whole point
        // of first-touch attribution — that a click today and a purchase on
        // Wednesday are the same person. The 90-day expiry in utm.ts is the
        // shared-device mitigation; see the note there.
        // Clears `afSessionStart` and drops anything still queued. Without it
        // the next user on this browser inherits the previous user's start time,
        // and every session_end they send reports a duration covering someone
        // else's visit — see endAnalyticsSession() in event-queue.ts.
        endAnalyticsSession();
        // AI Astrologer conversation — see chat-store.ts
        sessionStorage.removeItem("vedicfinanceChat");
        // Clear persisted moon sign so the zodiac badge doesn't show for the next user
        localStorage.removeItem("moonSign");
        // A pending payment order must not resume for the next user on this browser
        localStorage.removeItem("vedicfinance:pendingOrderId");
        // The "already reported this purchase" latch that goes with it. Order
        // ids are unique so keeping it would be harmless, but it belongs to the
        // departing user's order and nothing here should outlive them.
        localStorage.removeItem("vedicfinance:purchaseTracked");
        // Clear any financialSummary cache keys
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("financialSummary_")) {
            sessionStorage.removeItem(key);
          }
        }
        // Hard redirect clears all React state and avoids re-auth loops
        const redirectTo = sessionStorage.getItem("signOutRedirect") || "/home";
        sessionStorage.removeItem("signOutRedirect");
        window.location.href = redirectTo;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
