/**
 * UpcomingFeatures — /upcoming-features page.
 * Shows features that are coming soon: Life Path & Destiny + Legacy & Awareness.
 * Reuses the same sidebar and layout as the main Kundali page.
 */

import { useState, useEffect, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Particles } from "@/components/ui/particles";
import { Home, Menu, Clock, Compass, BookOpen } from "lucide-react";
import KundaliSidebar from "@/components/kundali/KundaliSidebar";
import { useReportStore } from "@/lib/report-store";
import { KundaliThemeProvider, useKundaliTheme } from "@/lib/kundali-theme-context";
import { useChatAccess } from "@/hooks/useChatAccess";
import type { ReportRequest } from "@/lib/vedicfinance-types";

import JobVsBusinessSection from "@/components/financial-kundali/JobVsBusinessSection";
import ForeignSettlementSection from "@/components/financial-kundali/ForeignSettlementSection";
import InheritanceWeaknessSection from "@/components/financial-kundali/InheritanceWeaknessSection";
import ArchetypeHeroSection from "@/components/legacy-kundali/LegacyArchetypeHeroSection";
import { WealthMilestonesCard } from "@/components/legacy-kundali/LegacyInsightCards";

const MemoParticles = memo(Particles);

const UpcomingFeaturesInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Carry the shared-view flag forwarded by FinancialKundali when the user
  // navigates here from a /shared/:slug link so the sidebar stays limited.
  const isSharedView = !!(location.state as { isSharedView?: boolean } | null)?.isSharedView;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024 && window.innerWidth < 1280;
    }
    return false;
  });
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";

  // Pre-warm payment status cache so navigating back to /kundali (PaidRoute)
  // doesn't flash a redirect while the payment query re-resolves
  const { openChat } = useChatAccess();

  const scores = useReportStore((s) => s.scores);
  const dasha = useReportStore((s) => s.dasha);
  const transits = useReportStore((s) => s.transits);
  const chart = useReportStore((s) => s.chart);
  const insights = useReportStore((s) => s.insights);
  const userName = useReportStore((s) => s.userName);
  const fetchReport = useReportStore((s) => s.fetchReport);

  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;
    try {
      const req: ReportRequest = JSON.parse(raw);
      fetchReport(req);
    } catch {
      // ignore
    }
  }, [fetchReport]);

  // Scroll to hash section on mount or when hash changes
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash) {
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  const handleSidebarSelect = (id: string) => {
    if (id === "kundali-overview") {
      navigate("/kundali");
      return;
    }
    // Kundali page sections — navigate to /kundali with hash
    if (id.startsWith("kundali-")) {
      navigate(`/kundali#${id}`);
      return;
    }
    // Upcoming section items — scroll to top of the page
    if (id.startsWith("upcoming-")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Also scroll the main content container if it exists
      const main = document.querySelector("main");
      if (main) main.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Fallback — navigate to kundali
    navigate("/kundali");
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isVedic ? "vedic-theme" : ""}`} style={{ background: colors.pageBg }}>
      {/* Sidebar — desktop */}
      <div
        className="hidden lg:block shrink-0 h-full transition-all duration-300"
        style={{ width: sidebarCollapsed ? "60px" : "240px" }}
      >
        <KundaliSidebar
          active="upcoming-features"
          onSelect={handleSidebarSelect}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onGoHome={() => navigate("/kundali")}
          onAiChat={openChat}
          userName={userName}
          isSharedView={isSharedView || undefined}
        />
      </div>

      {/* Mobile header */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          background: isVedic ? "rgba(255,253,247,0.95)" : "rgba(8,3,16,0.95)",
          borderBottom: isVedic ? "1px solid rgba(184,134,11,0.12)" : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button onClick={() => setMobileMenuOpen(true)} className="p-1">
          <Menu className="h-5 w-5" style={{ color: isVedic ? "rgba(80,50,20,0.6)" : "rgba(255,255,255,0.5)" }} />
        </button>
        <span
          className="text-sm font-bold"
          style={{ color: colors.accent, fontFamily: "'Poppins', sans-serif" }}
        >
          Upcoming Features
        </span>
        <button onClick={() => navigate("/kundali")} className="p-1">
          <Home className="h-5 w-5" style={{ color: isVedic ? "rgba(80,50,20,0.6)" : "rgba(255,255,255,0.5)" }} />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[260px]">
            <KundaliSidebar
              active="upcoming-features"
              onSelect={(id) => {
                setMobileMenuOpen(false);
                handleSidebarSelect(id);
              }}
              onGoHome={() => navigate("/kundali")}
              onAiChat={openChat}
              userName={userName}
              isSharedView={isSharedView || undefined}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative">
        <MemoParticles
          className="absolute inset-0 z-0 pointer-events-none"
          quantity={30}
          color={colors.particleColor}
        />

        <div className="relative z-10 px-4 sm:px-6 md:px-10 lg:px-14 pt-16 pb-12 lg:pt-16 lg:pb-16 max-w-7xl mx-auto">
          {/* Page heading */}
          <div className="mb-10 sm:mb-14">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{
                  background: isVedic ? "rgba(107,142,35,0.1)" : "rgba(47,191,159,0.12)",
                  border: isVedic ? "1px solid rgba(107,142,35,0.2)" : "1px solid rgba(47,191,159,0.2)",
                }}
              >
                <Clock className="h-5 w-5" style={{ color: isVedic ? "#6B8E23" : "#2FBF9F" }} />
              </div>
              <h1
                className="font-bold tracking-tight"
                style={{
                  color: colors.textPrimary,
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(22px, 4vw, 42px)",
                  lineHeight: 1.15,
                }}
              >
                Upcoming Features
              </h1>
            </div>
            <p
              className="text-xs sm:text-sm leading-relaxed max-w-2xl"
              style={{ color: colors.textSecondary }}
            >
              These insights are being refined and will be fully integrated into your Financial Kundali soon.
              Preview them below.
            </p>

            {/* Status pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mt-4"
              style={{
                background: isVedic ? "rgba(107,142,35,0.06)" : "rgba(47,191,159,0.06)",
                border: isVedic ? "1px solid rgba(107,142,35,0.15)" : "1px solid rgba(47,191,159,0.15)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: isVedic ? "#6B8E23" : "#2FBF9F" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: isVedic ? "#6B8E23" : "#2FBF9F" }} />
              </span>
              <span className="text-xs font-medium" style={{ color: isVedic ? "rgba(107,142,35,0.8)" : "rgba(47,191,159,0.8)" }}>
                Actively building: stay tuned
              </span>
            </div>
          </div>

          {/* Section 0: Identity & Chart Foundation (moved from legacy kundali) */}
          {chart && scores && (
            <div id="upcoming-identity" className="mb-10 sm:mb-14">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: isVedic ? "rgba(184,134,11,0.08)" : "rgba(242,197,114,0.1)",
                    border: isVedic ? "1px solid rgba(184,134,11,0.18)" : "1px solid rgba(242,197,114,0.18)",
                  }}
                >
                  <Compass className="h-4.5 w-4.5" style={{ color: colors.accent }} />
                </div>
                <div>
                  <h2
                    className="text-xl md:text-2xl lg:text-[1.75rem] font-extrabold uppercase tracking-[0.04em]"
                    style={{
                      color: colors.sectionLabel,
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: "italic",
                      textShadow: isVedic ? "none" : "0 0 24px rgba(242,197,114,0.35), 0 0 6px rgba(242,197,114,0.2)",
                    }}
                  >
                    Identity & Chart
                  </h2>
                  <p className="text-xs sm:text-sm mt-0.5" style={{ color: colors.textSecondary }}>
                    Your money archetype, birth chart, and wealth milestones
                  </p>
                </div>
              </div>

              <ArchetypeHeroSection chart={chart} scores={scores} />

              <div className="mt-4">
                <WealthMilestonesCard wealthTimeline={insights?.wealthTimeline ?? null} dasha={dasha} />
              </div>
            </div>
          )}

          {/* Section 1: Life Path & Destiny */}
          <div id="upcoming-lifepath" className="mb-6 sm:mb-10">
            {/* Animated section divider */}
            <div className="relative h-px w-full overflow-hidden mb-8 sm:mb-12">
              <div
                className="absolute inset-0"
                style={{
                  background: isVedic
                    ? "linear-gradient(90deg, transparent, rgba(184,134,11,0.18) 15%, rgba(184,134,11,0.18) 85%, transparent)"
                    : "linear-gradient(90deg, transparent, rgba(200,162,255,0.18) 15%, rgba(200,162,255,0.18) 85%, transparent)",
                }}
              />
              <div
                className="absolute inset-y-0 w-full"
                style={{
                  background: isVedic
                    ? "linear-gradient(90deg, transparent 0%, transparent 30%, rgba(184,134,11,0.65) 48%, rgba(212,160,18,0.8) 50%, rgba(184,134,11,0.65) 52%, transparent 70%, transparent 100%)"
                    : "linear-gradient(90deg, transparent 0%, transparent 30%, rgba(200,162,255,0.65) 48%, rgba(242,197,114,0.8) 50%, rgba(200,162,255,0.65) 52%, transparent 70%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dividerShimmer 4s ease-in-out infinite",
                }}
              />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background: isVedic ? "rgba(139,105,20,0.08)" : "rgba(200,162,255,0.1)",
                  border: isVedic ? "1px solid rgba(139,105,20,0.18)" : "1px solid rgba(200,162,255,0.18)",
                }}
              >
                <Compass className="h-4.5 w-4.5" style={{ color: isVedic ? "#8B6914" : "#C8A2FF" }} />
              </div>
              <div>
                <h2
                  className="text-xl md:text-2xl lg:text-[1.75rem] font-extrabold uppercase tracking-[0.04em]"
                  style={{
                    color: colors.sectionLabel,
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: "italic",
                    textShadow: isVedic ? "none" : "0 0 24px rgba(242,197,114,0.35), 0 0 6px rgba(242,197,114,0.2)",
                  }}
                >
                  Life Path & Destiny
                </h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: colors.textSecondary }}>
                  Career direction, entrepreneurship potential, and foreign settlement analysis
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <JobVsBusinessSection data={insights?.jobVsBusiness ?? null} />
              <ForeignSettlementSection data={insights?.foreignSettlement ?? null} />
            </div>
          </div>

          {/* Section 2: Legacy & Awareness */}
          <div id="upcoming-legacy" className="mt-14 sm:mt-24 mb-6 sm:mb-10">
            <InheritanceWeaknessSection
              scores={scores}
              chart={chart}
              dasha={dasha}
              transits={transits}
              expense={insights?.expense ?? null}
              investmentPersonality={insights?.investmentPersonality ?? null}
              wealthTimeline={insights?.wealthTimeline ?? null}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

const UpcomingFeatures = () => (
  <KundaliThemeProvider>
    <UpcomingFeaturesInner />
  </KundaliThemeProvider>
);

export default UpcomingFeatures;
