import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LogoutDialog } from "@/components/LogoutDialog";
import {
  Rocket,
  Sparkles,
  LogOut,
  MapPin,
  Calendar,
  Clock,
  Flame,
  Globe,
  Wind,
  Droplets,
  TrendingUp,
  Shield,
} from "lucide-react";
import { legalColors } from "@/components/legal/legal-theme";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";

interface ProfileData {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  astroSign: string;
  signLabel: string;
  signDesc: string;
  riskTolerance: string;
  horizon: string;
}

const signMeta: Record<string, { icon: typeof Flame; color: string }> = {
  Fire: { icon: Flame, color: "#EF4444" },
  Earth: { icon: Globe, color: "#22C55E" },
  Air: { icon: Wind, color: "#6366F1" },
  Water: { icon: Droplets, color: "#3B82F6" },
};

const signLabels: Record<string, { label: string; desc: string }> = {
  Fire: { label: "Fire 🔥", desc: "Bold risk-taker with aggressive growth instincts" },
  Earth: { label: "Earth 🌍", desc: "Steady builder who values stability and compounding" },
  Air: { label: "Air 🌀", desc: "Analytical strategist driven by research and data" },
  Water: { label: "Water 💧", desc: "Cautious protector focused on capital preservation" },
};

const ComingSoon = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    // Try sessionStorage first (just completed onboarding)
    const cached = sessionStorage.getItem("kundliRequest");
    if (cached) {
      try {
        const d = JSON.parse(cached);
        const meta = signLabels[d.astroSign] ?? signLabels.Earth;
        setProfile({
          birthDate: d.birth_date,
          birthTime: d.birth_time,
          birthPlace: d.birth_place,
          astroSign: d.astroSign,
          signLabel: meta.label,
          signDesc: meta.desc,
          riskTolerance: d.riskTolerance,
          horizon: d.horizon,
        });
        return;
      } catch { /* fall through to DB */ }
    }

    // Fetch from Supabase for returning users
    if (!user) return;
    Promise.all([
      supabase.from("user_birth_details").select("*").eq("id", user.id).single(),
      supabase.from("user_astrosign").select("*").eq("id", user.id).single(),
      supabase.from("user_financial_profile").select("*").eq("id", user.id).single(),
    ]).then(([birth, astro, fin]) => {
      if (birth.data && astro.data && fin.data) {
        setProfile({
          birthDate: birth.data.birth_date,
          birthTime: birth.data.birth_time,
          birthPlace: birth.data.birth_place,
          astroSign: astro.data.element,
          signLabel: astro.data.sign_label,
          signDesc: astro.data.sign_desc,
          riskTolerance: fin.data.risk_tolerance,
          horizon: fin.data.horizon,
        });
      }
    });
  }, [user]);

  const handleSignOut = () => {
    setShowLogoutDialog(true);
  };

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const SignIcon = profile ? (signMeta[profile.astroSign]?.icon ?? Globe) : Globe;
  const signColor = profile ? (signMeta[profile.astroSign]?.color ?? "#22C55E") : "#22C55E";

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: legalColors.pageBg }}
    >
      {/* Soft wash — decorative only */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ backgroundImage: legalColors.wash }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl w-full">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-3 mb-8">
          <img src={vedicfinanceLogo} alt="VedicFinance" className="h-10 w-10" loading="lazy" decoding="async" />
          <span className="flex items-baseline select-none">
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "#2A0E4A", letterSpacing: "-0.5px" }}>Astro</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem", color: legalColors.accent }}>Fin</span>
          </span>
        </Link>

        {/* Profile card */}
        {profile && (
          <div
            className="w-full rounded-2xl p-6 mb-8 text-left space-y-5"
            style={{
              background: legalColors.cardBg,
              border: legalColors.cardBorder,
              boxShadow: legalColors.cardShadow,
            }}
          >
            {/* AstroSign header */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${signColor}15`, border: `1px solid ${signColor}30` }}
              >
                <SignIcon className="w-7 h-7" style={{ color: signColor }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-[#6B5C7A]">Your AstroSign</p>
                <p className="text-xl font-bold text-[#1A0A2E]">{profile.signLabel}</p>
                <p className="text-xs text-[#6B5C7A]">{profile.signDesc}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-black/[0.06]" />

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-[#6B5C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#6B5C7A]">Birth Date</p>
                  <p className="text-sm text-[#1A0A2E]">{profile.birthDate}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#6B5C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#6B5C7A]">Birth Time</p>
                  <p className="text-sm text-[#1A0A2E]">{profile.birthTime || "Not specified"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#6B5C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#6B5C7A]">Birth Place</p>
                  <p className="text-sm text-[#1A0A2E]">{profile.birthPlace}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#6B5C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#6B5C7A]">Risk Tolerance</p>
                  <p className="text-sm text-[#1A0A2E]">{profile.riskTolerance}</p>
                </div>
              </div>
              <div className="col-span-2 flex items-start gap-2.5">
                <TrendingUp className="w-4 h-4 text-[#6B5C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#6B5C7A]">Investment Horizon</p>
                  <p className="text-sm text-[#1A0A2E]">{profile.horizon}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coming soon section */}
        <div className="relative mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(162,44,28,0.08)",
              border: "1px solid rgba(162,44,28,0.18)",
            }}
          >
            <Rocket className="w-9 h-9" style={{ color: legalColors.accent }} />
          </div>
          <Sparkles className="absolute -top-1.5 -right-1.5 w-5 h-5 animate-pulse" style={{ color: "#B8860B" }} />
        </div>

        <h1
          className="text-3xl md:text-4xl font-bold mb-3 leading-tight"
          style={{ color: legalColors.ink, fontFamily: "'Playfair Display', serif" }}
        >
          Something{" "}
          <span style={{ color: legalColors.accent }}>Amazing</span>{" "}
          is Coming
        </h1>

        <p className="text-[#6B5C7A] text-sm md:text-base leading-relaxed mb-6 max-w-md">
          We're redesigning your VedicFinance experience from the ground up. Your
          personalized dashboard, Vedic trading insights, and more are on the way.
        </p>

        {/* Status pill */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{
            background: legalColors.cardBg,
            border: legalColors.cardBorder,
            boxShadow: legalColors.cardShadow,
          }}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0F9B8D] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0F9B8D]" />
          </span>
          <span className="text-sm text-[#6B5C7A]">Actively building: stay tuned</span>
        </div>

        {/* User info + sign out */}
        {user && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-[#6B5C7A]">
              Signed in as{" "}
              <span className="text-[#1A0A2E] font-medium">{user.email}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-[#6B5C7A] hover:text-[#a22c1c] hover:bg-black/[0.03] gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        )}

        {!user && (
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-black/[0.12] bg-white text-[#1A0A2E] hover:bg-black/[0.03] hover:text-[#a22c1c]"
          >
            Back to sign in
          </Button>
        )}
      </div>
      <LogoutDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} />
    </div>
  );
};

export default ComingSoon;
