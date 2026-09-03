/**
 * KundaliAuthPage — Simple Google sign-in page shown when users try to access
 * locked kundali features (Download, Share, Upcoming Insights, Risk Section).
 *
 * Clean design with a white card, "Continue with Google" button.
 * After sign-in, user is redirected back to /kundali.
 */

import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { persistGuestBirthDetails } from "@/lib/save-birth-details";
import { USER_STATUS_KEY } from "@/hooks/useUserStatus";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";
import BirthDetailsForm from "@/components/vedicfinance/BirthDetailsForm";
import analytics from "@/lib/analytics";
import type { ReportRequest } from "@/lib/vedicfinance-types";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const KundaliAuthPage = () => {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [googleLoading, setGoogleLoading] = useState(false);
  // Set when the AI Astrologer sent the user here. Only "ai-chat" is honoured.
  const intent = searchParams.get("intent") === "ai-chat" ? "ai-chat" : null;
  const [forwarding, setForwarding] = useState(false);
  const [activeTab, setActiveTab] = useState<"signup" | "signin">(
    (searchParams.get("tab") as "signup" | "signin") || "signin"
  );
  const [birthDetailsData, setBirthDetailsData] = useState<ReportRequest | null>(null);

  // Chat intent: the guest already entered birth details to generate their
  // kundali, so write those to the profile BEFORE forwarding. Skip it and
  // onboarding_done stays false, PaidRoute reports "onboarding", and the user
  // lands right back on the birth-details form this flow exists to avoid.
  // Awaited, not fire-and-forget — the next guard reads the row immediately.
  useEffect(() => {
    if (authLoading || !user || intent !== "ai-chat" || forwarding) return;
    setForwarding(true);
    (async () => {
      await persistGuestBirthDetails(user.id);
      await queryClient.invalidateQueries({ queryKey: [USER_STATUS_KEY, user.id] });
      // /ai-chat is PaidRoute: it forwards to /payment when unpaid, which is
      // the correct next step rather than something to pre-empt here.
      navigate("/ai-chat", { replace: true });
    })();
  }, [authLoading, user, intent, forwarding, queryClient, navigate]);

  // Already authenticated with no chat intent — this page has nothing to do.
  // Declarative rather than a navigate() call in the render body, which fired
  // repeatedly.
  if (!authLoading && user && !intent) {
    return <Navigate to="/kundali" replace />;
  }

  const handleBirthDetailsSubmit = (data: ReportRequest) => {
    // Store birth details
    setBirthDetailsData(data);
    sessionStorage.setItem("kundliRequest", JSON.stringify(data));
  };

  const handleGoogleSignIn = async (data?: ReportRequest) => {
    setGoogleLoading(true);
    
    // If birth details were provided, store them
    if (data) {
      sessionStorage.setItem("kundliRequest", JSON.stringify(data));
    }
    
    // Deliberately no sessionStorage "authMode" write. This flow returns to
    // /kundali, which never clears that flag — and a stale authMode="signin"
    // makes AuthPage treat the next visit as a failed sign-in, deleting the
    // just-created account and hard-reloading the page.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // With a chat intent, come back here so the effect above can persist the
        // guest's birth details and forward on. Otherwise return to /kundali,
        // which runs the same persistence itself.
        redirectTo: intent
          ? `${window.location.origin}/kundali-auth?intent=${intent}`
          : `${window.location.origin}/kundali`,
      },
    });
    if (error) {
      setGoogleLoading(false);
    }
  };

  if (authLoading || forwarding) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f6f4f2" }}>
        <span className="h-8 w-8 rounded-full border-2 border-[#F2C572] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: "#f6f4f2" }}>
      {/* Logo top-left — in flow on mobile so the tall signup card cannot slide
          under it; absolute from md up, as before. */}
      <Link to="/home" className="relative self-start mt-6 ml-6 md:absolute md:top-6 md:left-6 md:mt-0 md:ml-0 z-20 flex items-center gap-2.5">
        <img src={vedicfinanceLogo} alt="VedicFinance" className="h-8 w-8" loading="lazy" decoding="async" />
        <span className="flex items-baseline select-none">
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "#1A0A2E", letterSpacing: "-0.5px" }}>Astro</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem", color: "#a22c1c" }}>Fin</span>
        </span>
      </Link>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {/* Tabs — New Here? / Already a User? */}
          <div
            className="flex rounded-t-2xl overflow-hidden"
            style={{ background: "#f9f7f5", borderBottom: "1px solid #eee" }}
          >
            <button
              onClick={() => {
                analytics({ 'gtm.text': 'UnlockKundali_Newhere' });
                setActiveTab("signup");
              }}
              className="flex-1 py-3.5 text-sm font-bold transition-all duration-300"
              style={{
                color: activeTab === "signup" ? "#1A0A2E" : "#8B7A94",
                background: activeTab === "signup" ? "#fff" : "transparent",
                borderBottom: activeTab === "signup" ? "2.5px solid #D4A017" : "2.5px solid transparent",
              }}
            >
              New Here?
            </button>
            <button
              onClick={() => {
                analytics({ 'gtm.text': 'UnlockKundali_Alreadyauser' });
                setActiveTab("signin");
              }}
              className="flex-1 py-3.5 text-sm font-bold transition-all duration-300"
              style={{
                color: activeTab === "signin" ? "#1A0A2E" : "#8B7A94",
                background: activeTab === "signin" ? "#fff" : "transparent",
                borderBottom: activeTab === "signin" ? "2.5px solid #D4A017" : "2.5px solid transparent",
              }}
            >
              Already a User?
            </button>
          </div>

          {/* Card body */}
          <div
            className="rounded-b-2xl px-6 py-8 flex flex-col items-center gap-5"
            style={{
              background: "#fff",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            {/* Birth Details Form - New Users only */}
            {activeTab === "signup" && (
              <>
                <p className="text-sm leading-relaxed text-center" style={{ color: "#4A3F55" }}>
                  Sign up with your Google account to unlock all features and save your financial kundali.
                </p>
                
                <div className="w-full">
                  <BirthDetailsForm
                    onSubmit={handleBirthDetailsSubmit}
                    onGoogleSignIn={handleGoogleSignIn}
                    loading={false}
                    showAuth={true}
                    googleLoading={googleLoading}
                    compact={true}
                    initialValues={birthDetailsData}
                  />
                </div>
                {/* No "Already have an account? Sign in" toggle — the tab strip
                    above is the switch, and a second one only duplicated it. */}
              </>
            )}

            {/* Sign In - Existing Users */}
            {activeTab === "signin" && (
              <>
                <p className="text-sm leading-relaxed max-w-xs text-center" style={{ color: "#4A3F55" }}>
                  Welcome back! Sign in with your Google account to access your financial kundali.
                </p>

                {/* Continue with Google button */}
                <button
                  onClick={() => {
                    analytics({ 'gtm.text': 'Login_ContinuewithGoogle' });
                    handleGoogleSignIn();
                  }}
                  disabled={googleLoading}
                  className="w-full max-w-xs h-12 rounded-full text-sm font-bold flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] hover:brightness-105 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                    color: "#2A0E4A",
                    boxShadow: "0 6px 20px rgba(242,197,114,0.4)",
                  }}
                >
                  {googleLoading ? (
                    <span className="h-5 w-5 rounded-full border-2 border-[#2A0E4A]/30 border-t-[#2A0E4A] animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon />
                      Continue with Google
                    </>
                  )}
                </button>
                {/* No "Don't have an account? Sign up" toggle — same reason. */}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KundaliAuthPage;
