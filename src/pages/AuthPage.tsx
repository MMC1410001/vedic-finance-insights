import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";


import BirthDetailsForm from "@/components/vedicfinance/BirthDetailsForm";
import { useAuth } from "@/lib/auth-context";
import { isHeatmapPreview } from "@/lib/tracking-scope";
import { supabase } from "@/lib/supabase";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import { isTestUser, clearTestUserData } from "@/lib/test-user";
import { saveBirthDetails } from "@/lib/save-birth-details";
import analytics from "@/lib/analytics";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const PENDING_BIRTH_KEY = "pendingBirthData";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/**
 * Fire-and-forget ghost user cleanup.
 * Uses fetch with keepalive:true so the request survives the imminent page
 * unload triggered by supabase.auth.signOut() → window.location.href redirect.
 * The standard supabase.functions.invoke() path is cancelled by the browser
 * when the page navigates away, leaving orphan auth.users rows.
 */
function deleteGhostUser(userId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const adminPassword = "test123";
  try {
    fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: "delete-user", userId, adminPassword }),
    });
    // Intentionally not awaited — keepalive ensures the browser sends it
    // even after the page navigates away
  } catch {
    // Ignore — best-effort cleanup
  }
}

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // "intent" query param: "kundali" means user clicked Get Kundali (should go to payment after auth)
  // no intent means user just clicked Sign In (should go home after auth)
  const intent = searchParams.get("intent"); // "kundali" | null
  const tabParam = searchParams.get("tab"); // "signin" | null

  const [kundliRequest, setKundliRequest] = useState<ReportRequest | null>(null);
  const [checking, setChecking] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showExistingAccountDialog, setShowExistingAccountDialog] = useState(false);
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signup" | "signin">(
    (tabParam as "signup" | "signin") || "signup"
  );

  // ── Handle returning user (Google redirect back or existing session) ──
  useEffect(() => {
    if (authLoading) return;

    // The /admin heatmap renders this page in an iframe to draw the click map
    // over it. This effect would send an already-onboarded session straight to
    // /kundali, so the heatmap labelled "/auth" showed the kundali page instead —
    // a wrong answer that looks like a right one. Skipped only inside that frame;
    // see isHeatmapPreview(), which also requires the page to actually be framed.
    if (isHeatmapPreview()) {
      setChecking(false);
      return;
    }

    if (!user) return;

    setChecking(true);

    // ── Test user auto-clear: wipe all data on every login so they start fresh ──
    if (isTestUser(user.email)) {
      clearTestUserData(user.id).then(() => {
        // After clearing, show the birth form
        setChecking(false);
      });
      return;
    }

    const pendingRaw = sessionStorage.getItem(PENDING_BIRTH_KEY);
    // Check stored intent from before OAuth redirect
    const storedIntent = sessionStorage.getItem("authIntent");
    // Check if this was a sign-in attempt (no birth data expected)
    const wasSignIn = sessionStorage.getItem("authMode") === "signin";
    // Check if this was a sign-up attempt
    const wasSignUp = sessionStorage.getItem("authMode") === "signup";

    // Check if user already completed onboarding
    Promise.all([
      supabase.from("user_profiles").select("onboarding_done, has_paid").eq("id", user.id).single(),
      supabase.from("user_birth_details").select("*").eq("id", user.id).single(),
    ]).then(async ([profile, birth]) => {
      if (profile.data?.onboarding_done && birth.data) {
        // Already completed onboarding — set session data
        sessionStorage.setItem("kundliRequest", JSON.stringify({
          full_name: birth.data.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "",
          birth_date: birth.data.birth_date,
          birth_time: birth.data.birth_time,
          birth_time_accuracy: birth.data.birth_time_accuracy,
          birth_place: birth.data.birth_place,
          latitude: birth.data.latitude,
          longitude: birth.data.longitude,
          timezone: birth.data.timezone,
        }));
        sessionStorage.removeItem("kundliReport");
        sessionStorage.removeItem("kundliReportKey");
        sessionStorage.removeItem(PENDING_BIRTH_KEY);
        sessionStorage.removeItem("authIntent");
        sessionStorage.removeItem("authMode");

        // If user tried to sign up but already has an account, show popup
        if (wasSignUp) {
          setExistingAccountEmail(user.email ?? null);
          setShowExistingAccountDialog(true);
          setChecking(false);
          return;
        }

        // Route: onboarded → kundali (Kundali is free)
        navigate("/kundali", { replace: true });
      } else if (wasSignIn && !profile.data?.onboarding_done) {
        // User tried to sign in but has no account/onboarding — sign them out and redirect back with error
        sessionStorage.removeItem("authMode");
        sessionStorage.removeItem("authIntent");
        // Store error message and redirect target BEFORE signing out so they survive the redirect
        sessionStorage.setItem("signOutRedirect", "/auth?tab=signin");
        sessionStorage.setItem("authSignInError", "No account found. Please sign up to create an account.");
        // Fire ghost-user cleanup with keepalive so it survives the imminent page unload
        deleteGhostUser(user.id);
        await supabase.auth.signOut();
        // Note: auth-context will hard-redirect to /auth via signOutRedirect
        return;
      } else if (pendingRaw) {
        // Returning from Google with pending birth data — save and finish
        try {
          const pending: ReportRequest = JSON.parse(pendingRaw);
          setKundliRequest(pending);
          await saveBirthDetails(user.id, pending);
          sessionStorage.removeItem(PENDING_BIRTH_KEY);
          sessionStorage.removeItem("authMode");
          sessionStorage.setItem("kundliRequest", JSON.stringify(pending));
          sessionStorage.removeItem("authIntent");

          // Route: onboarded → kundali (Kundali is free)
          navigate("/kundali", { replace: true });
        } catch {
          setChecking(false);
        }
      } else if (wasSignIn) {
        // User tried to sign in but account doesn't exist (deleted or never created)
        sessionStorage.removeItem("authMode");
        sessionStorage.removeItem("authIntent");
        sessionStorage.setItem("signOutRedirect", "/auth?tab=signin");
        sessionStorage.setItem("authSignInError", "No account found. Please sign up to create an account.");
        // Fire ghost-user cleanup with keepalive so it survives the imminent page unload
        deleteGhostUser(user.id);
        await supabase.auth.signOut();
        return;
      } else {
        // Authenticated but no onboarding data — show birth form
        setChecking(false);
      }
    }).catch(async () => {
      if (wasSignIn) {
        // Sign-in attempt but profile lookup failed — account doesn't exist
        sessionStorage.removeItem("authMode");
        sessionStorage.removeItem("authIntent");
        sessionStorage.setItem("signOutRedirect", "/auth?tab=signin");
        sessionStorage.setItem("authSignInError", "No account found. Please sign up to create an account.");
        // Fire ghost-user cleanup with keepalive so it survives the imminent page unload
        deleteGhostUser(user.id);
        await supabase.auth.signOut();
        return;
      }
      if (pendingRaw) {
        try {
          const pending: ReportRequest = JSON.parse(pendingRaw);
          sessionStorage.removeItem(PENDING_BIRTH_KEY);
          sessionStorage.removeItem("authMode");
          sessionStorage.setItem("kundliRequest", JSON.stringify(pending));
          sessionStorage.removeItem("authIntent");

          // Route: onboarded → kundali (Kundali is free)
          navigate("/kundali", { replace: true });
        } catch { /* ignore */ }
      }
      setChecking(false);
    });
  }, [user, authLoading, navigate, intent]);

  // ── Direct kundali generation (no auth required) ──
  const handleGenerateKundali = (req: ReportRequest) => {
    setKundliRequest(req);
    // Save to session storage for kundali page to pick up
    sessionStorage.setItem("kundliRequest", JSON.stringify(req));
    // Clear any stale report so the kundali page generates a fresh one
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    // Navigate directly to kundali — no auth needed
    navigate("/kundali");
  };

  // ── "Continue with Google" from birth form (Sign Up — for users who want to save) ──
  const handleGoogleSignIn = async (birthData: ReportRequest) => {
    setGoogleLoading(true);
    setAuthError(null);
    sessionStorage.setItem(PENDING_BIRTH_KEY, JSON.stringify(birthData));
    sessionStorage.setItem("authMode", "signup");
    // Persist intent so it survives the OAuth redirect
    if (intent) sessionStorage.setItem("authIntent", intent);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth${intent ? `?intent=${intent}` : ""}` },
    });
    if (error) {
      setAuthError(error.message);
      setGoogleLoading(false);
      sessionStorage.removeItem(PENDING_BIRTH_KEY);
      sessionStorage.removeItem("authMode");
    }
  };

  // ── Handle existing account dialog dismiss — proceed to correct route ──
  const handleExistingAccountContinue = async () => {
    setShowExistingAccountDialog(false);
    sessionStorage.removeItem("authIntent");

    // Kundali is free — go directly
    navigate("/kundali", { replace: true });
  };

  // ── Birth form submit (for already-authenticated users) ──
  const handleBirthSubmit = async (req: ReportRequest) => {
    setKundliRequest(req);
    if (user) {
      await saveBirthDetails(user.id, req);
    }
    sessionStorage.setItem("kundliRequest", JSON.stringify(req));
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    navigate("/kundali");
  };

  // ── Loading ──
  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f6f4f2' }}>
        <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: '#f6f4f2' }}>
      {/* Logo — in normal flow on mobile so it reserves space above the centred
          header (absolute, it painted over the "Financial Insights." headline);
          absolute from md up, where the taller viewport leaves it clear. */}
      <Link to="/home" className="relative self-start mt-6 ml-6 md:absolute md:top-6 md:left-6 md:mt-0 md:ml-0 z-20 flex items-center gap-2.5">
        <img src={vedicfinanceLogo} alt="VedicFinance" className="h-8 w-8" loading="lazy" decoding="async" />
        <span className="flex items-baseline select-none">
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "#1A0A2E", letterSpacing: "-0.5px" }}>Astro</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem", color: "#a22c1c" }}>Fin</span>
        </span>
      </Link>



      {/* ── Form centered in remaining space ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md flex flex-col items-center justify-center">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="text-sm md:text-base mb-3 tracking-wide" style={{ color: '#6B5C7A' }}>
              Welcome to <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: '#1A0A2E' }}>Astro</span><span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: '#a22c1c' }}>Fin</span>
            </p>
            <h1 className="text-4xl md:text-5xl xl:text-5xl font-bold mb-1 leading-tight" style={{ color: '#1A0A2E', fontFamily: "'Playfair Display', serif", letterSpacing: '-0.5px' }}>
              Financial Insights.
            </h1>
            <h2 className="text-2xl md:text-3xl xl:text-3xl font-bold italic mb-5" style={{ color: '#a22c1c', fontFamily: "'Playfair Display', serif", letterSpacing: '-0.5px' }}>
              Based on Vedic Astrology.
            </h2>
          </div>

          {/* Tabs — New Here? / Already a User? */}
          <div
            className="w-full flex rounded-t-2xl overflow-hidden"
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

          {/* ── Birth Details Form / Sign In ── */}
          <div 
            className="w-full rounded-b-2xl px-6 py-8 flex flex-col items-center gap-5"
            style={{
              background: "#fff",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            {/* New Users Tab - Birth Details Form */}
            {activeTab === "signup" && (
              <div className="w-full">
                <BirthDetailsForm
                  onSubmit={user ? handleBirthSubmit : handleGenerateKundali}
                  onGoogleSignIn={handleGoogleSignIn}
                  loading={false}
                  showAuth={!user}
                  googleLoading={googleLoading}
                  isSignedIn={!!user}
                  initialValues={kundliRequest}
                />
              </div>
            )}

            {/* Existing Users Tab - Sign In */}
            {activeTab === "signin" && (
              <div className="w-full flex flex-col items-center gap-5">
                <p className="text-sm leading-relaxed max-w-xs text-center" style={{ color: "#4A3F55" }}>
                  Welcome back! Sign in with your Google account to access your financial kundali.
                </p>

                {/* Continue with Google button */}
                <button
                  onClick={() => {
                    analytics({ 'gtm.text': 'Login_ContinuewithGoogle' });
                    setGoogleLoading(true);
                    setAuthError(null);
                    sessionStorage.setItem("authMode", "signin");
                    if (intent) sessionStorage.setItem("authIntent", intent);
                    supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: { redirectTo: `${window.location.origin}/auth${intent ? `?intent=${intent}` : ""}` },
                    }).then(({ error }) => {
                      if (error) {
                        setAuthError(error.message);
                        setGoogleLoading(false);
                        sessionStorage.removeItem("authMode");
                      }
                    });
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Existing Account Popup ── */}
      <AlertDialog open={showExistingAccountDialog} onOpenChange={setShowExistingAccountDialog}>
        <AlertDialogContent
          className="rounded-2xl border max-w-sm"
          style={{
            background: 'linear-gradient(135deg, #2A0E4A 0%, #4B1D73 100%)',
            borderColor: 'rgba(242, 197, 114, 0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(242,197,114,0.15)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-center text-xl"
              style={{ color: '#F2C572', fontFamily: "'Playfair Display', serif" }}
            >
              Account Already Exists
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-center text-sm leading-relaxed"
              style={{ color: '#D6C6F5' }}
            >
              An account already exists with{" "}
              {existingAccountEmail && (
                <span className="font-medium" style={{ color: '#C8A2FF' }}>
                  {existingAccountEmail}
                </span>
              )}
              . You can sign in directly from the <span style={{ color: '#F2C572' }}>"Already a User?"</span> tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleExistingAccountContinue}
              className="w-full h-11 rounded-xl text-sm font-semibold border-0"
              style={{
                backgroundImage: 'linear-gradient(135deg, #F2C572, #FFDFA3)',
                color: '#2A0E4A',
                boxShadow: '0 10px 30px rgba(242,197,114,0.4)',
              }}
            >
              Continue to My Account
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={async () => {
                setShowExistingAccountDialog(false);
                // Set flag so auth-context redirects to /auth instead of /home
                sessionStorage.setItem("signOutRedirect", "/auth");
                await supabase.auth.signOut();
              }}
              className="w-full h-11 rounded-xl text-sm font-medium border"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#D6C6F5',
              }}
            >
              Go back and sign in with another account
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuthPage;
