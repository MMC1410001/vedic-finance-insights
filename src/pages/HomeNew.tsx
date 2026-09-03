/**
 * HomeNew — redesigned home screen (work in progress)
 * Standalone page — no sidebar, no nav.
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useChatAccess } from "@/hooks/useChatAccess";
import { LogOut, LogIn, RefreshCw, Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import planetBg from "@/assets/planet-bg.webp";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { StarButton } from "@/components/ui/star-button";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { LiquidMetalInput } from "@/components/ui/liquid-metal-input";
import horoscopeLottie from "@/assets/horoscope.lottie";
import shootingStarLottie from "@/assets/shooting-star.lottie";
import scrollDownLottie from "@/assets/scroll-down.lottie";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";
import traderCardImg from "@/assets/trader-card.webp";
import bizCardImg from "@/assets/biz-card.webp";
import runtimeFont from "@/assets/fonts/runtime-font/RuntimeRegular-m2Odx.otf?url";
import InsightRadar from "@/components/vedicfinance/InsightRadar";
import InsightConfidence from "@/components/vedicfinance/InsightConfidence";
import InsightFinancialPanel, { EarningPhasesCard, DashaRiskCard, AuspiciousTimingCard, PhaseCard } from "@/components/vedicfinance/InsightFinancialPanel";
import DailyTradingBriefing from "@/components/vedicfinance/DailyTradingBriefing";
import ReasoningAccordion from "@/components/vedicfinance/ReasoningAccordion";
import NatalChartVisual, { HousePlanetPanel, KundaliSVG, PLANET_COLORS, PLANET_ABBR, ZODIAC_SYMBOLS } from "@/components/vedicfinance/NatalChartVisual";
import { ZODIAC_IMAGES } from "@/lib/zodiac-images";
import { generateReport } from "@/lib/vedicfinance-api";
import { saveKundaliReport } from "@/lib/kundali-history";
import { supabase } from "@/lib/supabase";
import InvestmentBonds from "./InvestmentBonds";
import LuxuryAssets from "./LuxuryAssets";
// BusinessTiming moved to its own route: /business-timing
import GlobalAstroInsights from "@/components/vedicfinance/GlobalAstroInsights";
import FinancialKundaliDashboard from "@/components/vedicfinance/FinancialKundaliDashboard";
import SectionBackground from "@/components/SectionBackground";
import { NeuralNoise } from "@/components/ui/neural-noise";
import { StarsBackground } from "@/components/ui/stars";
import { Particles } from "@/components/ui/particles";
import type { ReportScores, ReportConfidence, DashaInfo, ChartData, ReportRequest, ReportReasoning, ReportTimeline, TransitPlanet } from "@/lib/vedicfinance-types";

const STARS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  top: `${[8, 18, 35, 52, 68, 82][i]}%`,
  left: `${[5, 25, 48, 15, 70, 38][i]}%`,
  size: [140, 120, 160, 130, 115, 150][i],
  delay: [0, 2.5, 5, 1.5, 7, 3.5][i],
}));

const ShootingStars = () => (
  <>
    {STARS.map(({ id, top, left, size, delay }) => (
      <div
        key={id}
        className="pointer-events-none absolute"
        style={{ top, left, width: size, height: size, opacity: 0.55, animationDelay: `${delay}s` }}
      >
        <DotLottieReact src={shootingStarLottie} loop autoplay style={{ width: "100%", height: "100%" }} />
      </div>
    ))}
  </>
);

const navItems = [
  { label: "Financial Kundali", id: "financial-kundali" },
  { label: "Vedic Trading Calculator", id: "vedic-trading", route: "/vedic-trading" },
  { label: "Auspicious Buy Timing", id: "luxury-assets" },
  { label: "Cosmic Investments", id: "bonds" },
  { label: "Business Decision Timing", id: "business-timing", route: "/business-timing" },
];


const HomeNew = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { openChat } = useChatAccess();
  const [active, setActive] = useState("kundali-wealth");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const [chart, setChart] = useState<ChartData | null>(null);
  const [chartLagna, setChartLagna] = useState<string>("");
  const [reasoning, setReasoning] = useState<ReportReasoning | null>(null);
  const [scores, setScores] = useState<ReportScores | null>(null);
  const [confidence, setConfidence] = useState<ReportConfidence | null>(null);
  const [dasha, setDasha] = useState<DashaInfo | null>(null);
  const [timeline, setTimeline] = useState<ReportTimeline | null>(null);
  const [transits, setTransits] = useState<TransitPlanet[] | null>(null);
  const [activeHouse, setActiveHouse] = useState<number | null>(1);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: 'Runtime'; src: url('${runtimeFont}') format('opentype'); }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  /* Track which section is in view and update active nav */
  useEffect(() => {
    const ids = navItems.map(n => n.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { threshold: 0.3 },
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return; // No birth data — show empty state
    let req: ReportRequest;
    try { req = JSON.parse(raw); } catch { return; }

    // Build a fingerprint from the current request to detect stale cache
    const reqKey = `${req.birth_date}|${req.birth_time}|${req.latitude}|${req.longitude}`;

    // Try cached report first — but only if it matches the current request
    const cachedRaw = sessionStorage.getItem("kundliReport");
    const cachedKey = sessionStorage.getItem("kundliReportKey");
    if (cachedRaw && cachedKey === reqKey) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.d1_chart?.planets?.length) {
          applyReport(cached);

          // Ensure it's persisted to DB (may not have been saved on first generation)
          if (!sessionStorage.getItem("lastKundaliId")) {
            supabase.auth.getSession().then(async ({ data: { session } }) => {
              let userId = session?.user?.id;
              // Auth may still be initializing. Wait once before falling back to guest.
              if (!userId) {
                await new Promise((r) => setTimeout(r, 1500));
                const { data: { session: retry } } = await supabase.auth.getSession();
                userId = retry?.user?.id;
              }
              // Save for both authenticated and guest users (guest: userId = undefined)
              const result = await saveKundaliReport(req, cached, userId);
              if (result) {
                sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
                sessionStorage.setItem("lastKundaliId", result.id);
              }
            }).catch(() => {});
          }
          return;
        }
      } catch { /* fall through to API */ }
    }

    generateReport(req)
      .then(async (report) => {
        sessionStorage.setItem("kundliReport", JSON.stringify(report));
        sessionStorage.setItem("kundliReportKey", reqKey);
        window.dispatchEvent(new Event("kundliReportReady"));
        applyReport(report);

        // Persist to database for history & sharing
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let userId = session?.user?.id;
          if (!userId) {
            await new Promise((r) => setTimeout(r, 1500));
            const { data: { session: retry } } = await supabase.auth.getSession();
            userId = retry?.user?.id;
          }
          const result = await saveKundaliReport(req, report, userId);
          if (result) {
            sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
            sessionStorage.setItem("lastKundaliId", result.id);
          }
        } catch (err) {
          // Non-critical for the UI, but must be visible — a silent failure here
          // is what hid three days of missing guest kundalis.
          console.error("Failed to persist kundali to history:", err);
        }
      })
      .catch(() => { /* no fallback — panels show empty state */ });
  }, []);

  function applyReport(report: any) {
    setChart(report.d1_chart);
    setChartLagna(report.d1_chart?.lagna_sign ?? "");
    if (report.reasoning) setReasoning(report.reasoning);
    if (report.scores) setScores(report.scores);
    if (report.confidence) setConfidence(report.confidence);
    if (report.dasha) setDasha(report.dasha);
    if (report.timeline) setTimeline(report.timeline);
    if (report.transits) setTransits(report.transits);
  }

  const handleSignOut = async () => {
    sessionStorage.removeItem("guestMode");
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    sessionStorage.removeItem("kundliRequest");
    sessionStorage.removeItem("sessionId");
    if (user) {
      await signOut();
    }
    navigate("/");
  };

  const handleTryAnother = () => {
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    sessionStorage.removeItem("kundliRequest");
    sessionStorage.removeItem("sessionId");
    navigate("/");
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #2A0E4A 0%, #4B1D73 50%, #A14EBF 100%)" }}>

      {/* ── Hero section — bg scoped here, scrolls with content ── */}
      <section id="kundali-wealth" className="relative overflow-hidden">

        {/* Background layers — clipped to this section */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <Particles
            className="absolute inset-0 h-full w-full"
            quantity={200}
            color="#C8A2FF"
            size={0.6}
            staticity={40}
            ease={60}
          />
          <ShootingStars />

          {/* Gold glow orb — matching landing hero */}
          <div
            className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-30 blur-3xl animate-float-slow"
            style={{ background: "radial-gradient(circle, rgba(242,197,114,0.45), rgba(75,29,115,0.3) 45%, transparent 70%)" }}
          />
          {/* Cosmic pink glow */}
          <div style={{ position: "absolute", width: "110vw", height: "110vw", bottom: "-45%", right: "-30%", background: "radial-gradient(circle, rgba(224,107,170,0.06) 0%, rgba(161,78,191,0.03) 35%, transparent 62%)", filter: "blur(80px)" }} />
          {/* Soft teal accent glow */}
          <div style={{ position: "absolute", width: "80vw", height: "80vw", bottom: "-25%", right: "-15%", background: "radial-gradient(circle, rgba(47,191,159,0.04) 0%, rgba(28,140,122,0.02) 40%, transparent 65%)", filter: "blur(40px)" }} />

          {/* Horoscope lottie — large wheel, top-left, partially cut off */}
          <div style={{ position: "absolute", top: "-25%", left: "-65%", width: "130vw", zIndex: 0 }}>
            <DotLottieReact src={horoscopeLottie} loop autoplay style={{ width: "100%", height: "100%", opacity: 0.18 }} />
          </div>

          {/* Subtle grid — matching landing hero */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(245,233,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,233,255,0.5) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />
        </div>

        {/* Sticky top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 pt-4 md:pt-5 pb-3 backdrop-blur-xl" style={{ background: "rgba(42,14,74,0.6)" }}>
          <Link to="/home" className="flex items-center gap-2 pl-0 md:pl-5" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src={vedicfinanceLogo} alt="VedicFinance" className="h-8 md:h-10 w-auto" style={{ filter: "drop-shadow(0 0 12px rgba(242,197,114,0.4))" }} loading="lazy" decoding="async" />
            <span className="flex items-baseline select-none">
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.125rem", color: "#F5E9FF", letterSpacing: "-0.5px" }}>Astro</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.125rem", color: "#F2C572" }}>Fin</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-10">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if ('route' in item && item.route) {
                    navigate(item.route);
                  } else {
                    setActive(item.id);
                    document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className={`text-sm tracking-wide transition-colors duration-200 ${
                  active === item.id ? "text-white" : "text-[#D6C6F5]/60 hover:text-[#F5E9FF]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Moon sign badge — visible when birth chart data exists */}
            {(() => {
              const moonPlanet = chart?.planets?.find((p: any) => p.planet === "Moon");
              if (!moonPlanet) return null;
              return (
                <div
                  className="relative z-30 hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl border cursor-default"
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
                  title={`Moon in ${moonPlanet.sign}`}
                >
                  <img
                    src={ZODIAC_IMAGES[moonPlanet.sign_num]}
                    alt={moonPlanet.sign}
                    className="w-4 h-4 object-contain"
                  loading="lazy" decoding="async" />
                  <span className="text-xs font-medium" style={{ color: "#C8A2FF" }}>
                    {moonPlanet.sign?.slice(0, 3)}
                  </span>
                </div>
              );
            })()}
            {!user && (
              <button
                onClick={handleTryAnother}
                className="relative z-30 hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#D6C6F5", backdropFilter: "blur(12px)" }}
              >
                <RefreshCw className="h-4 w-4" /> Try Another Birth Chart
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="relative z-30 hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm cursor-pointer"
              style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#D6C6F5", backdropFilter: "blur(12px)" }}
            >
              {user ? (
                <><LogOut className="h-4 w-4" /> Logout</>
              ) : (
                <><LogIn className="h-4 w-4" /> Sign In</>
              )}
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden sticky top-[52px] z-30 backdrop-blur-xl border-b px-4 py-3 flex flex-col gap-2 animate-fade-in" style={{ background: "rgba(42,14,74,0.95)", borderColor: "rgba(255,255,255,0.06)" }}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if ('route' in item && item.route) {
                    setMobileMenuOpen(false);
                    navigate(item.route);
                  } else {
                    setActive(item.id);
                    setMobileMenuOpen(false);
                    document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className={`text-sm tracking-wide transition-colors duration-200 text-left px-3 py-2 rounded-xl ${
                  active === item.id ? "text-white" : "text-[#D6C6F5]/60"
                }`}
                style={active === item.id ? { background: "rgba(242,197,114,0.08)" } : {}}
              >
                {item.label}
              </button>
            ))}
            <div className="flex gap-2 mt-2 pt-2 border-t border-white/[0.06]">
              {/* Moon sign badge — mobile */}
              {(() => {
                const moonPlanet = chart?.planets?.find((p: any) => p.planet === "Moon");
                if (!moonPlanet) return null;
                return (
                  <div
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl cursor-default"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    title={`Moon in ${moonPlanet.sign}`}
                  >
                    <img
                      src={ZODIAC_IMAGES[moonPlanet.sign_num]}
                      alt={moonPlanet.sign}
                      className="w-4 h-4 object-contain"
                    loading="lazy" decoding="async" />
                    <span className="text-[10px] font-medium" style={{ color: "#C8A2FF" }}>
                      {moonPlanet.sign?.slice(0, 3)}
                    </span>
                  </div>
                );
              })()}
              {!user && (
                <button onClick={handleTryAnother} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#D6C6F5" }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Try Another
                </button>
              )}
              <button onClick={handleSignOut} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#D6C6F5" }}>
                {user ? <><LogOut className="h-3.5 w-3.5" /> Logout</> : <><LogIn className="h-3.5 w-3.5" /> Sign In</>}
              </button>
            </div>
          </div>
        )}

        {/* Content — mobile: stacked (hero → fin metrics → kundali). Desktop: 2-column grid */}
        <div className="relative z-20 px-4 md:px-8 pb-12 md:pb-20 lg:pl-32 flex flex-col lg:grid lg:gap-0" style={{ gridTemplateColumns: 'minmax(0, 480px) 1fr', gridTemplateRows: 'auto auto' }}>

          {/* Hero text + CTAs — mobile order-1, desktop: top-left */}
          <div className="flex flex-col justify-start relative order-1 pt-12 pb-8 lg:pb-0 md:pt-[25vh]" style={{ gridColumn: '1', gridRow: '1' }}>

            {/* Mobile-only: planet + zodiac wheel as hero background */}
            <div className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
              {/* Zodiac wheel — top-left, cut off, more visible */}
              <div className="absolute" style={{ top: "-35%", left: "-45%", width: "130%", opacity: 0.2 }}>
                <DotLottieReact src={horoscopeLottie} loop autoplay style={{ width: "100%", height: "100%" }} />
              </div>

            </div>

            {/* Text content — sits above the bg layers */}
            <div className="relative z-10">
              <h1
                className="font-bold uppercase mb-4"
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.6rem)",
                  lineHeight: 1.15,
                  letterSpacing: "-0.5px",
                  fontFamily: "'Playfair Display', serif",
                  color: "#F5E9FF",
                }}
              >
                YOUR FINANCIAL ADVISORY BASED ON{" "}
                <span style={{ color: "#F2C572" }}>VEDIC ASTROLOGY</span>
              </h1>
              <p
                className="mb-7"
                style={{
                  fontSize: "0.8rem",
                  lineHeight: 1.65,
                  color: "#D6C6F5",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 400,
                }}
              >
                Get astrology-based insights for income, savings, investment timing, and major money decisions using your birth chart, dasha, and transits. 
              </p>
              <div className="flex flex-col items-start">
                <LiquidMetalInput
                  placeholder="Ask about fin-astrology..."
                  ctaLabel="Chat with AI Astrologer"
                  onSubmit={(text) => openChat(text)}
                  onCtaClick={() => openChat()}
                />
                <div className="mt-2 self-center" style={{ width: 36, height: 36, opacity: 0.4 }}>
                  <DotLottieReact src={scrollDownLottie} loop autoplay style={{ width: "100%", height: "100%" }} />
                </div>
              </div>

              {/* ── Glassmorphic feature cards — moved to bento grid ── */}
            </div>
          </div>

          {/* Fin metrics — mobile order-2, desktop: right column — bento grid matching reference image */}
          <div className="flex flex-col justify-start pt-6 lg:pt-[12vh] px-0 lg:pl-10 lg:pr-6 min-w-0 gap-4 order-2" style={{ gridColumn: '2', gridRow: '1 / 3' }}>

            {/* ── Mobile layout: all 5 cards stacked ── */}
            <div className="lg:hidden flex flex-col gap-3 w-full">
              {scores && <EarningPhasesCard scores={scores} dasha={dasha ?? undefined} timeline={timeline ?? undefined} />}
              {scores && <DashaRiskCard scores={scores} dasha={dasha ?? undefined} transits={transits ?? undefined} />}
              {scores && <AuspiciousTimingCard scores={scores} transits={transits ?? undefined} />}
              {/* Trader + Biz side by side on mobile */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/vedic-trading")}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(242,197,114,0.15)]"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
                >
                  <div className="relative h-24 overflow-hidden">
                    <img src={traderCardImg} alt="Vedic Trading" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" loading="lazy" decoding="async" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, rgba(42,14,74,0.8) 100%)" }} />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: "#F5E9FF" }}>Vedic Analysis for Traders</p>
                    <p className="text-[8px] mt-0.5 leading-relaxed" style={{ color: "#D6C6F5" }}>Daily trading insights powered by planetary transits</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/business-timing")}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(242,197,114,0.15)]"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
                >
                  <div className="relative h-24 overflow-hidden">
                    <img src={bizCardImg} alt="Business Advisory" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" loading="lazy" decoding="async" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, rgba(42,14,74,0.8) 100%)" }} />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: "#F5E9FF" }}>Vedic Advisory for Business Owners</p>
                    <p className="text-[8px] mt-0.5 leading-relaxed" style={{ color: "#D6C6F5" }}>Auspicious timing for launches, deals & expansion</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Desktop layout: 2-column bento grid ── */}
            <div className="hidden lg:grid gap-3 w-full" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto auto" }}>

              {/* Left col, row 1-2: Trader card (tall) */}
              <button
                onClick={() => navigate("/vedic-trading")}
                className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(242,197,114,0.15)]"
                style={{
                  gridColumn: "1", gridRow: "1 / 3",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div className="relative h-full min-h-[200px] overflow-hidden">
                  <img src={traderCardImg} alt="Vedic Trading" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500" loading="lazy" decoding="async" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 10%, rgba(42,14,74,0.85) 100%)" }} />
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                    <p className="text-xs font-semibold leading-tight" style={{ color: "#F5E9FF" }}>Vedic Analysis for Traders</p>
                    <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "#D6C6F5" }}>Daily trading insights powered by planetary transits</p>
                  </div>
                </div>
              </button>

              {/* Right col, row 1: Earnings */}
              <div style={{ gridColumn: "2", gridRow: "1" }}>
                {scores && <EarningPhasesCard scores={scores} dasha={dasha ?? undefined} timeline={timeline ?? undefined} />}
              </div>

              {/* Right col, row 2: Dasha Risk */}
              <div style={{ gridColumn: "2", gridRow: "2" }}>
                {scores && <DashaRiskCard scores={scores} dasha={dasha ?? undefined} transits={transits ?? undefined} />}
              </div>

              {/* Left col, row 3: Business card */}
              <button
                onClick={() => navigate("/business-timing")}
                className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(242,197,114,0.15)]"
                style={{
                  gridColumn: "1", gridRow: "3",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div className="relative h-full min-h-[120px] overflow-hidden">
                  <img src={bizCardImg} alt="Business Advisory" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500" loading="lazy" decoding="async" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 10%, rgba(42,14,74,0.85) 100%)" }} />
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <p className="text-xs font-semibold leading-tight" style={{ color: "#F5E9FF" }}>Vedic Advisory for Business Owners</p>
                    <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "#D6C6F5" }}>Auspicious timing for launches, deals & expansion</p>
                  </div>
                </div>
              </button>

              {/* Right col, row 3: Auspicious Timing */}
              <div style={{ gridColumn: "2", gridRow: "3" }}>
                {scores && <AuspiciousTimingCard scores={scores} transits={transits ?? undefined} />}
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── Kundali Chart section ── */}
      <section id="kundali-chart" className="border-t border-white/[0.04] relative overflow-hidden" style={{ background: "linear-gradient(180deg, #3A1560 0%, #2A0E4A 100%)" }}>
        <div className="absolute inset-0 pointer-events-none z-0">
          <div style={{ position: "absolute", width: "80vw", height: "80vw", top: "10%", left: "-20%", background: "radial-gradient(circle, rgba(242,197,114,0.06) 0%, transparent 65%)", filter: "blur(60px)" }} />
        </div>
        <div className="relative z-10 px-4 md:px-8 lg:px-16 xl:px-24 py-12 md:py-16">
          {/* Mobile: kundali + houses + reasoning stacked */}
          <div className="flex flex-col gap-6 lg:grid lg:gap-8" style={{ gridTemplateColumns: "minmax(0, 420px) 1fr" }}>

            {/* Kundali chart */}
            {chart && (
              <div className="w-full flex flex-col gap-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(242,197,114,0.12)", border: "1px solid rgba(242,197,114,0.25)" }}>
                    <span className="text-base">🪷</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight leading-tight" style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}>
                      Birth Chart <span style={{ color: "#F2C572" }}>(Kundali)</span> Analysis
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(242,197,114,0.5)" }}>
                      Vedic Natal Chart · D1 Rasi
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl p-3" style={{ background: "rgba(42,14,74,0.6)", border: "1px solid rgba(242,197,114,0.2)", backdropFilter: "blur(24px)", boxShadow: "0 0 40px rgba(242,197,114,0.08), inset 0 1px 0 rgba(242,197,114,0.1)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(242,197,114,0.5)" }}>North Indian</span>
                    <span className="text-[10px] font-semibold" style={{ color: "#F2C572" }}>
                      {chart.houses.find(h => h.house === 1)
                        ? `${chart.houses.find(h => h.house === 1)!.sign} Lagna`
                        : chartLagna ? `${chartLagna} Lagna` : ""}
                    </span>
                  </div>
                  <KundaliSVG chart={chart} activeHouse={activeHouse} onHouseClick={setActiveHouse} />
                  <div className="mt-2 flex flex-wrap justify-center gap-x-2.5 gap-y-1">
                    {Object.entries(PLANET_ABBR).map(([name, abbr]) => (
                      <span key={name} className="flex items-center gap-1 text-[8px] text-white/40">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLANET_COLORS[name] }} />
                        {abbr}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-4 grid grid-cols-3 text-center" style={{ background: "rgba(42,14,74,0.6)", border: "1px solid rgba(242,197,114,0.2)", backdropFilter: "blur(24px)" }}>
                  {[
                    { label: "Lagna", planet: null, house: 1 },
                    { label: "Moon",  planet: "Moon", house: null },
                    { label: "Sun",   planet: "Sun",  house: null },
                  ].map(({ label, planet, house }) => {
                    const sign = planet
                      ? chart.planets.find(p => p.planet === planet)?.sign
                      : chart.houses.find(h => h.house === house)?.sign;
                    const signNum = planet
                      ? chart.planets.find(p => p.planet === planet)?.sign_num
                      : chart.houses.find(h => h.house === house)?.sign_num;
                    return (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(242,197,114,0.5)" }}>{label}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <img
                            src={signNum !== undefined ? ZODIAC_IMAGES[signNum] : ""}
                            alt={sign ?? ""}
                            className="w-5 h-5 object-contain rounded-md"
                            style={{ background: "rgba(242,197,114,0.15)" }}
                          loading="lazy" decoding="async" />
                          <p className="text-base font-bold" style={{ color: "#F5E9FF" }}>{sign?.slice(0, 3) ?? "—"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Radar, Phase, Confidence, Houses + Reasoning */}
            <div className="flex flex-col gap-4">
              {scores && <PhaseCard scores={scores} dasha={dasha ?? undefined} />}
              {scores && <InsightRadar scores={scores} />}
              {confidence && dasha && <InsightConfidence confidence={confidence} dasha={dasha} />}
              {chart && <HousePlanetPanel chart={chart} activeHouse={activeHouse} onHouseChange={setActiveHouse} />}
              {reasoning && <ReasoningAccordion reasoning={reasoning} />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Financial Kundali Premium Insights ── */}
      {chart && scores && dasha && transits && (
        <section id="financial-kundali" className="border-t border-white/[0.04] relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(75,29,115,0.25) 0%, rgba(42,14,74,0.95) 60%, #2A0E4A 100%)" }}>
          <Particles
            className="absolute inset-0 h-full w-full z-0"
            quantity={60}
            color="#F2C572"
            size={0.3}
            staticity={60}
            ease={80}
          />
          <div className="relative z-10 py-10 px-4 md:py-16 md:px-8 lg:px-24">
            <FinancialKundaliDashboard
              chart={chart}
              scores={scores}
              dasha={dasha}
              transits={transits}
              timeline={timeline}
            />
          </div>
        </section>
      )}

      {/* ── Luxury Asset Purchase section ── */}
      <section id="luxury-assets" className="min-h-screen border-t border-white/[0.04] relative overflow-hidden" style={{ background: "linear-gradient(180deg, #2A0E4A 0%, #3A1560 50%, #4B1D73 100%)" }}>
        <StarsBackground
          className="absolute inset-0 z-0"
          speed={80}
          factor={0.03}
          starColor="rgba(242,197,114,0.5)"
        />
        <div className="relative z-10 py-8 px-4 md:py-16 md:px-12 lg:px-24 h-full">
          <LuxuryAssets />
        </div>
      </section>

      {/* ── Bonds section ── */}
      <section id="bonds" className="min-h-screen lg:h-screen border-t border-white/[0.04] relative overflow-hidden" style={{ background: "linear-gradient(180deg, #4B1D73 0%, #2A0E4A 100%)" }}>
        <NeuralNoise color={[0.55, 0.15, 0.75]} opacity={0.45} speed={0.0008} />
        <div className="relative z-10 px-4 py-6 md:px-14 md:py-10 lg:px-24 lg:py-12 h-full">
          <InvestmentBonds />
        </div>
      </section>

      {/* ── Cosmic Market Pulse — Global Astro Insights (no birth data needed) ── */}
      <section id="cosmic-pulse" className="min-h-screen border-t border-white/[0.04] relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 40% 30%, rgba(161,78,191,0.15) 0%, rgba(75,29,115,0.12) 40%, #2A0E4A 75%)" }}>
        <Particles
          className="absolute inset-0 h-full w-full z-0"
          quantity={100}
          color="#C8A2FF"
          size={0.4}
          staticity={50}
          ease={70}
        />
        <div className="relative z-10 py-10 px-4 md:py-16 md:px-12 lg:px-24">
          <GlobalAstroInsights />
        </div>
      </section>

    </div>
  );
};

export default HomeNew;
