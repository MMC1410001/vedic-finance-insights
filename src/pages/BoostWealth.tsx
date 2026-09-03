import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Rocket, Sparkles, Bell, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { legalColors } from "@/components/legal/legal-theme";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";

const BoostWealth = () => {
  const navigate = useNavigate();
  const [notified, setNotified] = useState(false);

  const handleNotify = () => {
    setNotified(true);
    // Could integrate with an email list / Supabase in the future
  };

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
        <Link to="/home" className="flex items-center gap-3 mb-10">
          <img src={vedicfinanceLogo} alt="VedicFinance" className="h-10 w-10" loading="lazy" decoding="async" />
          <span className="flex items-baseline select-none">
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "#2A0E4A", letterSpacing: "-0.5px" }}>Astro</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem", color: legalColors.accent }}>Fin</span>
          </span>
        </Link>

        {/* Icon */}
        <div className="relative mb-8">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(162,44,28,0.08)",
              border: "1px solid rgba(162,44,28,0.18)",
            }}
          >
            <Rocket className="w-11 h-11" style={{ color: legalColors.accent }} />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 animate-pulse" style={{ color: "#B8860B" }} />
        </div>

        {/* Heading */}
        <h1
          className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
          style={{ color: legalColors.ink, fontFamily: "'Playfair Display', serif" }}
        >
          Boost Your{" "}
          <span style={{ color: legalColors.accent }}>Wealth</span>
        </h1>

        {/* Coming soon paragraph */}
        <p
          className="text-base md:text-lg leading-relaxed mb-8 max-w-md"
          style={{ color: legalColors.body }}
        >
          Personalized remedies and actionable steps to boost your wealth based on
          your Vedic financial kundali are coming soon. Stay tuned for cosmic
          insights tailored to your unique planetary alignments.
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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a22c1c] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#a22c1c]" />
          </span>
          <span className="text-sm text-[#6B5C7A]">Coming Soon</span>
        </div>

        {/* Notify button */}
        {!notified ? (
          <Button
            onClick={handleNotify}
            className="gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:brightness-110 border-0"
            style={{
              background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
              color: "#2A0E4A",
              boxShadow: "0 10px 30px rgba(242,197,114,0.4)",
            }}
          >
            <Bell className="h-4 w-4" />
            Get Notified
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#0F9B8D]/30 bg-[#0F9B8D]/10">
            <CheckCircle className="h-4 w-4 text-[#0F9B8D]" />
            <span className="text-sm text-[#0F9B8D] font-medium">
              You'll be notified when it's ready!
            </span>
          </div>
        )}

        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mt-6 text-[#6B5C7A] hover:text-[#a22c1c] hover:bg-black/[0.03] gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Go Back
        </Button>
      </div>
    </div>
  );
};

export default BoostWealth;
