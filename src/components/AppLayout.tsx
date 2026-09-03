import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  PiggyBank,
  Shield,
  Briefcase,
  Globe,
  FileText,
  Settings,
  Search,
  Bell,
  User,
  Sparkles,
  Link2,
  MessageSquare,
  BarChart2,
  BookOpen,
  LogOut,
  Clock,
} from "lucide-react";
import StarField from "@/components/StarField";
import AllSections from "@/pages/AllSections";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ZODIAC_IMAGES } from "@/lib/zodiac-images";
import { LogoutDialog } from "@/components/LogoutDialog";

/**
 * Read moon sign — tries sessionStorage first (warm), then falls back to
 * localStorage (persists across page refreshes and new tabs).
 * Also writes through to localStorage whenever sessionStorage has fresh data,
 * so all future cold-starts resolve instantly.
 */
function getMoonSign(): { sign: string; signNum: number } | null {
  try {
    const raw = sessionStorage.getItem("kundliReport");
    if (raw) {
      const report = JSON.parse(raw);
      const moon = report?.d1_chart?.planets?.find(
        (p: any) => p.planet === "Moon"
      );
      if (moon?.sign && moon?.sign_num !== undefined) {
        const result = { sign: moon.sign as string, signNum: moon.sign_num as number };
        // Write-through so localStorage stays in sync for future refreshes
        try { localStorage.setItem("moonSign", JSON.stringify(result)); } catch { /* ignore */ }
        return result;
      }
    }
  } catch { /* ignore */ }

  // Fallback: localStorage survives page refreshes and new tabs
  try {
    const stored = localStorage.getItem("moonSign");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.sign && parsed?.signNum !== undefined) return parsed;
    }
  } catch { /* ignore */ }

  return null;
}

const navItems = [
  // ── New Home ──────────────────────────────────────────
  { icon: LayoutDashboard, label: "Home", sectionId: "home" },
  // ── MVP Core ──────────────────────────────────────────
  { icon: BookOpen, label: "Kundli", sectionId: "vedicfinance" },
  { icon: TrendingUp, label: "Luxury Assets", sectionId: "luxury-assets" },
  { icon: Link2, label: "Bonds", sectionId: "bonds" },
  { icon: MessageSquare, label: "AI Astrologer Chat", sectionId: "ai-chat" },
  // ── Secondary ─────────────────────────────────────────
  { icon: LayoutDashboard, label: "Dashboard", sectionId: "dashboard" },
  { icon: PiggyBank, label: "Investments", sectionId: "investment-timing" },
  { icon: Shield, label: "Risk Shield", sectionId: "risk-shield" },
  { icon: Sparkles, label: "Birth Chart", sectionId: "birth-chart" },
  { icon: BarChart2, label: "Sectors", sectionId: "sector-favorability" },
  { icon: Clock, label: "Biz Timing", sectionId: "business-timing", route: "/business-timing" },
  { icon: Briefcase, label: "Career", sectionId: "" },
  { icon: Globe, label: "Hub", sectionId: "" },
  { icon: FileText, label: "Summary", sectionId: "" },
  { icon: Settings, label: "Settings", sectionId: "" },
];

const AppLayout = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const [moonSign, setMoonSign] = useState<{ sign: string; signNum: number } | null>(null);

  // Read moon sign on mount and when user changes; also listen for updates
  useEffect(() => {
    setMoonSign(getMoonSign());

    const refresh = () => setMoonSign(getMoonSign());

    // Listen for same-tab kundali ready event and cross-tab localStorage changes
    window.addEventListener("kundliReportReady", refresh);
    window.addEventListener("storage", refresh);

    // Poll briefly as a safety net (covers race conditions on first load)
    const interval = setInterval(() => {
      const ms = getMoonSign();
      if (ms) {
        setMoonSign(ms);
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("kundliReportReady", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [user]);

  const handleSignOut = async () => {
    setShowLogoutDialog(true);
  };

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const scrollTo = useCallback((sectionId: string, route?: string) => {
    if (route) {
      setMobileMenuOpen(false);
      navigate(route);
      return;
    }
    if (!sectionId) return;
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el && mainRef.current) {
      mainRef.current.scrollTo({ top: el.offsetTop - mainRef.current.offsetTop, behavior: "smooth" });
    }
  }, [navigate]);

  /* Track which section is in view */
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const handleScroll = () => {
      const sections = navItems.filter(n => n.sectionId).map(n => n.sectionId);
      let current = sections[0];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top;
          if (top <= 120) current = id;
        }
      }
      setActiveSection(current);
    };

    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <StarField />

      {/* Sidebar — hidden on mobile */}
      <aside className="relative z-20 hidden md:flex w-[60px] flex-col items-center border-r border-white/[0.06] bg-[hsl(220,20%,5%)]/95 backdrop-blur-xl py-5 gap-0.5">
        {/* Logo */}
        <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>

        {navItems.map((item) => {
          const isActive = activeSection === item.sectionId;
          return (
            <button
              key={item.label}
              onClick={() => scrollTo(item.sectionId, 'route' in item ? (item as any).route : undefined)}
              className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 mb-0.5 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-primary/70 hover:bg-white/[0.03]"
              }`}
              title={item.label}
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-primary" />
              )}
            </button>
          );
        })}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[hsl(220,20%,5%)]/98 backdrop-blur-xl border-r border-white/[0.06] py-5 px-4 flex flex-col gap-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="flex items-baseline select-none">
                  <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.875rem", color: "#2A0E4A", letterSpacing: "-0.5px" }}>Astro</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "#a22c1c" }}>Fin</span>
                </span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navItems.map((item) => {
              const isActive = activeSection === item.sectionId;
              return (
                <button
                  key={item.label}
                  onClick={() => scrollTo(item.sectionId, 'route' in item ? (item as any).route : undefined)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-primary/70 hover:bg-white/[0.03]"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-[hsl(220,20%,5%)]/60 backdrop-blur-xl px-3 md:px-5 h-12">
          <div className="flex items-center gap-3 md:gap-5">
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              VedicFinance
            </h2>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-secondary/10 border border-secondary/20 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[11px] font-medium text-secondary">Mercury Direct</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-2.5">
            <button className="hidden sm:flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 hover:bg-white/[0.06] transition-colors">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Search...</span>
            </button>
            <button className="relative rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            {user ? (
              <div className="flex items-center gap-1.5">
                {/* Moon sign badge — visible when birth chart data exists */}
                {moonSign && (
                  <button
                    onClick={() => navigate("/kundali")}
                    className="flex items-center gap-1 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1 cursor-pointer transition-all hover:scale-105 hover:border-white/[0.15]"
                    title={`Moon in ${moonSign.sign}: View Kundali`}
                  >
                    <img
                      src={ZODIAC_IMAGES[moonSign.signNum]}
                      alt={moonSign.sign}
                      className="w-4 h-4 object-contain"
                      decoding="async"
                    />
                    <span className="text-[10px] font-medium text-[#C8A2FF]">
                      {moonSign.sign.slice(0, 3)}
                    </span>
                  </button>
                )}
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.full_name ?? "User"}
                    className="h-7 w-7 rounded-full object-cover border border-white/10"
                    decoding="async"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
        </header>

        {/* Page content - scrollable */}
        <main ref={mainRef} className="flex-1 overflow-y-auto scroll-smooth">
          <AllSections />
        </main>
      </div>
      <LogoutDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} />
    </div>
  );
};

export default AppLayout;
