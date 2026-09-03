/**
 * BusinessTimingPage — standalone page with sidebar navigation (design-2 style).
 * Fixed sidebar on desktop, bottom nav on mobile.
 */
import { useNavigate, Link } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft, BarChart3, Sparkles, MessageSquare, Calendar,
  Layers, Target, Menu, X,
} from "lucide-react";
import BusinessTiming from "./BusinessTiming";
import { StarsBackground } from "@/components/ui/stars";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";
import runtimeFont from "@/assets/fonts/runtime-font/RuntimeRegular-m2Odx.otf?url";
import { useAuth } from "@/lib/auth-context";

const SIDEBAR_NAV = [
  { icon: BarChart3,      label: "Dashboard",     sectionId: "biz-hero" },
  { icon: Sparkles,       label: "Dasha Layer",   sectionId: "biz-dasha" },
  { icon: Layers,         label: "Transits",      sectionId: "biz-transits" },
  { icon: Target,         label: "Decisions",     sectionId: "biz-decisions" },
  { icon: Calendar,       label: "Muhurta",       sectionId: "biz-muhurta" },
  { icon: MessageSquare,  label: "Consultation",  sectionId: "biz-consultation" },
];

const BusinessTimingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState("biz-hero");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: 'Runtime'; src: url('${runtimeFont}') format('opentype'); }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Track which section is in view
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const handleScroll = () => {
      const ids = SIDEBAR_NAV.map(n => n.sectionId);
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top;
          if (top <= 140) current = id;
        }
      }
      setActiveSection(current);
    };
    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = useCallback((sectionId: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el && mainRef.current) {
      mainRef.current.scrollTo({ top: el.offsetTop - mainRef.current.offsetTop, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#131313" }}>

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col z-40"
        style={{ background: "#0a0a0a", borderRight: "1px solid rgba(255,255,255,0.04)" }}>

        {/* Logo + back */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <button
            onClick={() => navigate("/home")}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/[0.06]"
            title="Back to Home"
          >
            <ArrowLeft className="h-4 w-4" style={{ color: "rgba(186,195,255,0.7)" }} />
          </button>
          <Link to="/home" className="flex items-center gap-2">
            <img src={vedicfinanceLogo} alt="VedicFinance" className="h-7 w-auto" loading="lazy" decoding="async" />
            <span className="flex items-baseline select-none">
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.875rem", color: "#F5E9FF", letterSpacing: "-0.5px" }}>Astro</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "#F2C572" }}>Fin</span>
            </span>
          </Link>
        </div>

        {/* User profile */}
        <div className="flex items-center gap-3 px-5 py-4 mb-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(42,42,42,1)" }}>
            <span className="text-sm font-bold" style={{ color: "#bac3ff" }}>
              {user?.user_metadata?.full_name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "rgba(186,195,255,0.85)" }}>
              {user?.user_metadata?.full_name ?? "Observer"}
            </p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
              Business Timing
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-3 flex-1">
          {SIDEBAR_NAV.map((item) => {
            const isActive = activeSection === item.sectionId;
            return (
              <button
                key={item.sectionId}
                onClick={() => scrollTo(item.sectionId)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  background: isActive ? "rgba(28,27,27,1)" : "transparent",
                  color: isActive ? "#bac3ff" : "rgba(255,255,255,0.3)",
                }}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5">
            {mobileMenuOpen ? <X className="h-5 w-5" style={{ color: "rgba(255,255,255,0.6)" }} /> : <Menu className="h-5 w-5" style={{ color: "rgba(255,255,255,0.6)" }} />}
          </button>
          <Link to="/home"><img src={vedicfinanceLogo} alt="VedicFinance" className="h-6 w-auto" loading="lazy" decoding="async" /></Link>
        </div>
        <button onClick={() => navigate("/home")} className="text-xs" style={{ color: "rgba(186,195,255,0.6)" }}>
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col py-5 px-4 gap-1 overflow-y-auto animate-fade-in"
            style={{ background: "#0a0a0a" }}>
            <div className="flex items-center justify-between mb-6 px-2">
              <Link to="/home" className="flex items-center gap-2">
                <img src={vedicfinanceLogo} alt="VedicFinance" className="h-7 w-auto" loading="lazy" decoding="async" />
                <span className="flex items-baseline select-none">
                  <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.875rem", color: "#F5E9FF", letterSpacing: "-0.5px" }}>Astro</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "#F2C572" }}>Fin</span>
                </span>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5">
                <X className="h-5 w-5" style={{ color: "rgba(255,255,255,0.4)" }} />
              </button>
            </div>
            {SIDEBAR_NAV.map((item) => {
              const isActive = activeSection === item.sectionId;
              return (
                <button
                  key={item.sectionId}
                  onClick={() => scrollTo(item.sectionId)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: isActive ? "rgba(28,27,27,1)" : "transparent",
                    color: isActive ? "#bac3ff" : "rgba(255,255,255,0.3)",
                  }}
                >
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </aside>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 md:pl-60 flex flex-col overflow-hidden">
        <main ref={mainRef} className="flex-1 overflow-y-auto scroll-smooth relative">
          {/* Stars background */}
          <StarsBackground
            className="fixed inset-0 z-0 pointer-events-none"
            speed={60}
            factor={0.04}
            starColor="rgba(52,211,153,0.4)"
          />
          <div className="relative z-10 pt-16 md:pt-8 pb-24 md:pb-12 px-5 md:px-10">
            <BusinessTiming />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-16"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {SIDEBAR_NAV.slice(0, 4).map((item) => {
          const isActive = activeSection === item.sectionId;
          return (
            <button
              key={item.sectionId}
              onClick={() => scrollTo(item.sectionId)}
              className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all"
              style={{
                background: isActive ? "rgba(186,195,255,0.08)" : "transparent",
                color: isActive ? "#bac3ff" : "rgba(255,255,255,0.3)",
              }}
            >
              <item.icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[9px] uppercase font-bold tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BusinessTimingPage;
