import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";

import SplashScreen from "./SplashScreen";
import BirthDetailsForm from "@/components/vedicfinance/BirthDetailsForm";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { stampFirstTouchOnce } from "@/lib/utm";
import type { ReportRequest } from "@/lib/vedicfinance-types";

const PENDING_BIRTH_KEY = "pendingBirthData";

/* ── Component ────────────────────────────────────────── */
const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Skip splash if returning from Google OAuth redirect
  const isOAuthReturn = window.location.hash.includes("access_token") || window.location.search.includes("code=");
  const [showSplash, setShowSplash] = useState(!isOAuthReturn);

  const [kundliRequest, setKundliRequest] = useState<ReportRequest | null>(null);
  const [checking, setChecking] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Handle returning user (Google redirect back or existing session) ──
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    setChecking(true);

    const pendingRaw = sessionStorage.getItem(PENDING_BIRTH_KEY);

    // Check if user already completed onboarding
    Promise.all([
      supabase.from("user_profiles").select("onboarding_done").eq("id", user.id).single(),
      supabase.from("user_birth_details").select("*").eq("id", user.id).single(),
    ]).then(async ([profile, birth]) => {
      if (profile.data?.onboarding_done && birth.data) {
        // Already completed — go to home
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
        navigate("/home", { replace: true });
      } else if (pendingRaw) {
        // Returning from Google with pending birth data — save and finish
        try {
          const pending: ReportRequest = JSON.parse(pendingRaw);
          setKundliRequest(pending);
          await supabase.from("user_birth_details").upsert({
            id: user.id,
            full_name: pending.full_name || "",
            birth_date: pending.birth_date,
            birth_time: pending.birth_time,
            birth_time_accuracy: pending.birth_time_accuracy,
            birth_place: pending.birth_place,
            latitude: pending.latitude,
            longitude: pending.longitude,
            timezone: pending.timezone,
            updated_at: new Date().toISOString(),
          });
          await supabase.from("user_profiles").upsert({
            id: user.id,
            onboarding_done: true,
            updated_at: new Date().toISOString(),
          });
          // The row now exists — record the acquiring campaign. See utm.ts.
          void stampFirstTouchOnce();
          sessionStorage.removeItem(PENDING_BIRTH_KEY);
          sessionStorage.setItem("kundliRequest", JSON.stringify(pending));
          navigate("/home", { replace: true });
        } catch {
          // If parsing fails, show birth form again
          setChecking(false);
        }
      } else {
        // Authenticated but no onboarding data — show birth form
        setChecking(false);
      }
    }).catch(() => {
      // DB error — try pending data or show form
      if (pendingRaw) {
        try {
          const pending: ReportRequest = JSON.parse(pendingRaw);
          sessionStorage.removeItem(PENDING_BIRTH_KEY);
          sessionStorage.setItem("kundliRequest", JSON.stringify(pending));
          navigate("/home", { replace: true });
        } catch { /* ignore */ }
      }
      setChecking(false);
    });
  }, [user, authLoading, navigate]);

  // ── "Continue with Google" from birth form ──
  const handleGoogleSignIn = async (birthData: ReportRequest) => {
    setGoogleLoading(true);
    setAuthError(null);
    sessionStorage.setItem(PENDING_BIRTH_KEY, JSON.stringify(birthData));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
      setGoogleLoading(false);
      sessionStorage.removeItem(PENDING_BIRTH_KEY);
    }
  };

  // ── "Continue as guest" from birth form ──
  const handleSkip = (birthData: ReportRequest) => {
    sessionStorage.setItem("guestMode", "true");
    sessionStorage.setItem("kundliRequest", JSON.stringify(birthData));
    navigate("/home");
  };

  // ── Birth form submit (for already-authenticated users) ──
  const handleBirthSubmit = async (req: ReportRequest) => {
    setKundliRequest(req);
    if (user) {
      await supabase.from("user_birth_details").upsert({
        id: user.id,
        full_name: req.full_name || "",
        birth_date: req.birth_date,
        birth_time: req.birth_time,
        birth_time_accuracy: req.birth_time_accuracy,
        birth_place: req.birth_place,
        latitude: req.latitude,
        longitude: req.longitude,
        timezone: req.timezone,
        updated_at: new Date().toISOString(),
      });
      await supabase.from("user_profiles").upsert({
        id: user.id,
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      });
      // The row now exists — record the acquiring campaign. See utm.ts.
      void stampFirstTouchOnce();
    }
    sessionStorage.setItem("kundliRequest", JSON.stringify(req));
    navigate("/home");
  };

  // ── Splash ──
  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;

  // ── Loading ──
  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: '#f6f4f2' }}>
      {/* Logo */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2.5">
        <img src={vedicfinanceLogo} alt="VedicFinance" className="h-8 w-8" loading="lazy" decoding="async" />
        <span className="flex items-baseline select-none">
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "#2A0E4A", letterSpacing: "-0.5px" }}>Astro</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem", color: "#a22c1c" }}>Fin</span>
        </span>
      </div>

      {/* ── Form centered in remaining space ── */}
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center justify-center">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="text-sm md:text-base mb-3 tracking-wide" style={{ color: '#4B1D73' }}>
              Welcome to <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: '#2A0E4A' }}>Astro</span><span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: '#a22c1c' }}>Fin</span>
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-1 leading-tight" style={{ color: '#2A0E4A', fontFamily: "'Playfair Display', serif", letterSpacing: '-0.5px' }}>
              Financial Insights.
            </h1>
            <h2 className="text-2xl md:text-3xl font-bold italic mb-5" style={{ color: '#4B1D73', fontFamily: "'Playfair Display', serif", letterSpacing: '-0.5px' }}>
              Based on Vedic Astrology.
            </h2>
          </div>

          {/* Birth details form */}
          <div className="animate-scale-in w-full">
            <BirthDetailsForm
              onSubmit={handleBirthSubmit}
              loading={false}
              showAuth
              isSignedIn={!!user}
              onGoogleSignIn={user ? handleBirthSubmit : handleGoogleSignIn}
              onSkip={handleSkip}
              googleLoading={googleLoading}
              authError={authError}
              initialValues={kundliRequest}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
