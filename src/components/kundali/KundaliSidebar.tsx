/**
 * KundaliSidebar — shared sidebar for /kundali and /upcoming-features pages.
 * Single source of truth for the Financial Kundali navigation.
 */
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Home,
  ChevronsLeft,
  ChevronsRight,
  Download,
  MessageSquare,
  Rocket,
  Sparkles,
  BadgeDollarSign,
  AlertOctagon,
  PieChart,

  Compass,
  Clock,
  BookOpen,
  LogOut,
  User,
  TrendingUp,
  CalendarClock,
  ShieldAlert,
  Landmark,
  Share2,
  Lock,
} from "lucide-react";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";
import { useAuth } from "@/lib/auth-context";
import { useKundaliTheme } from "@/lib/kundali-theme-context";
import KundaliThemeSwitcher from "./KundaliThemeSwitcher";
import analytics from "@/lib/analytics";
import { LogoutDialog } from "@/components/LogoutDialog";

/* ── Kundali section subitems — sections on /kundali page ── */
export const kundaliSections = [
  { id: "kundali-earnings",     label: "About your Income",         icon: TrendingUp },
  { id: "kundali-timings",      label: "Best Financial Timings",    icon: CalendarClock },
  { id: "kundali-investments",  label: "Investments & Assets",      icon: Landmark },
  { id: "kundali-risks",        label: "Money at Risk",             icon: ShieldAlert },
];

/* ── Upcoming insights — visible but navigates to /upcoming-features ── */
export const upcomingInsights = [
  { id: "upcoming-lifepath", label: "Life Path & Destiny", icon: Compass },
  { id: "upcoming-legacy",   label: "Legacy & Awareness",  icon: BookOpen },
];

/* ── Sidebar nav items (legacy — kept for reference) ── */
export const sidebarItems = [
  { id: "kundali-overview", label: "Kundali Overview",   icon: Sparkles,        route: "/kundali" },
];

export interface KundaliSidebarProps {
  active: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onGoHome?: () => void;
  onAiChat?: () => void;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  userName?: string;
  className?: string;
  /** Explicitly mark this sidebar as a shared/public view, hiding user-specific items.
   *  When omitted, detection falls back to checking if the current path starts with /shared/. */
  isSharedView?: boolean;
}

/* ── Sidebar component ── */
const KundaliSidebar = ({
  active,
  onSelect,
  collapsed = false,
  onToggleCollapse,
  onGoHome,
  onAiChat,
  onDownloadPdf,
  isDownloadingPdf = false,
  userName,
  className = "",
  isSharedView: isSharedViewProp,
}: KundaliSidebarProps) => {
  const [shareCopied, setShareCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, colors } = useKundaliTheme();

  // Detect if we're on a shared kundali page — hide user-specific items.
  // An explicit prop takes precedence over the path-based heuristic so that
  // pages like /upcoming-features can still be in "shared view" mode when
  // reached by following a shared kundali link.
  const isSharedView = isSharedViewProp ?? location.pathname.startsWith("/shared/");

  const handleAuthSignIn = () => {
    navigate("/kundali-auth");
  };

  const handleShareKundali = async () => {
    // Before the auth gate, so the tag counts the click itself. Covers both the
    // expanded and collapsed share buttons.
    analytics({ 'gtm.text': 'Kundali_ShareKundali' });
    if (!user) {
      handleAuthSignIn();
      return;
    }
    const slug = sessionStorage.getItem("lastKundaliSlug");

    // Reports are private until shared (migration 012). Flip the flag before
    // handing out the link, or the recipient gets a "not found" page.
    const id = sessionStorage.getItem("lastKundaliId");
    if (id) {
      const { markKundaliShared } = await import("@/lib/kundali-history");
      await markKundaliShared(id);
    }

    const shareUrl = slug
      ? `${window.location.origin}/shared/${slug}`
      : window.location.href;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };
  const isVedic = theme === "vedic";

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  return (
  <>
  <aside
    className={`flex flex-col h-screen max-h-screen overflow-hidden transition-all duration-300 ease-in-out ${className}`}
    style={{
      background: colors.sidebarBg,
      borderRight: `1px solid ${colors.sidebarBorder}`,
    }}
  >
    {/* Logo area */}
    <div className="flex items-center justify-between px-4 py-3 shrink-0">
      <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
        <img
          src={vedicfinanceLogo}
          alt="VedicFinance"
          className={`${collapsed ? "h-7 w-7 mx-auto" : "h-8 w-8"} object-contain`}
          style={{ filter: isVedic ? "none" : "drop-shadow(0 0 8px rgba(242,197,114,0.5))" }}
        loading="lazy" decoding="async" />
        {!collapsed && (
          <span
            className="text-base font-bold tracking-tight"
            style={{ color: colors.logoText, fontFamily: "'Playfair Display', serif" }}
          >
            VedicFinance
          </span>
        )}
      </Link>
      {onToggleCollapse && (
        <button onClick={onToggleCollapse} className="p-1 rounded hover:bg-white/5">
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" style={{ color: colors.textSecondary }} />
          ) : (
            <ChevronsLeft className="h-4 w-4" style={{ color: colors.textSecondary }} />
          )}
        </button>
      )}
    </div>

    {/* Scrollable content area */}
    <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 flex flex-col">


      {/* Main nav items */}
      {kundaliSections.map((sub) => (
        <button
          key={sub.id}
          onClick={() => onSelect(sub.id)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group shrink-0"
          style={{
            background: active === sub.id ? colors.navActiveBg : "transparent",
            borderLeft: active === sub.id ? `2px solid ${colors.accent}` : "2px solid transparent",
          }}
          onMouseEnter={(e) => { if (active !== sub.id) e.currentTarget.style.background = colors.navHoverBg; }}
          onMouseLeave={(e) => { if (active !== sub.id) e.currentTarget.style.background = "transparent"; }}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-all duration-200"
            style={{
              background: active === sub.id ? `${colors.accent}15` : "transparent",
            }}
          >
            <sub.icon
              className="h-[15px] w-[15px]"
              style={{ color: active === sub.id ? colors.accent : colors.iconMuted }}
            />
          </div>
          {!collapsed && (
            <span
              className="text-[13px] font-medium truncate transition-colors duration-200"
              style={{ color: active === sub.id ? colors.textPrimary : colors.textSecondary }}
            >
              {sub.label}
            </span>
          )}
        </button>
      ))}

      {/* Divider between main sections and secondary nav */}
      <div className="shrink-0 mt-2 mb-1">
        <div className="mx-1 h-px" style={{ background: colors.divider }} />
      </div>

      {/* Secondary nav items */}
      <div className="shrink-0 mt-1 flex flex-col gap-0.5">
        {/* 1. Go to Home */}
        {!isSharedView && onGoHome && (
          <button
            onClick={onGoHome}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
            style={{ borderLeft: "2px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.navHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0">
              <Home className="h-[15px] w-[15px]" style={{ color: colors.iconMuted }} />
            </div>
            {!collapsed && (
              <span className="text-[13px] font-medium truncate" style={{ color: colors.textSecondary }}>
                Go to Home
              </span>
            )}
          </button>
        )}
        {/* 2. Profile & History */}
        {!isSharedView && user && (
          <button
            onClick={() => navigate("/profile")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
            style={{
              background: active === "profile" ? colors.navActiveBg : "transparent",
              borderLeft: active === "profile" ? `2px solid ${colors.accent}` : "2px solid transparent",
            }}
            onMouseEnter={(e) => { if (active !== "profile") e.currentTarget.style.background = colors.navHoverBg; }}
            onMouseLeave={(e) => { if (active !== "profile") e.currentTarget.style.background = "transparent"; }}
          >
            <div
              className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-all duration-200"
              style={{ background: active === "profile" ? `${colors.accent}15` : "transparent" }}
            >
              <User
                className="h-[15px] w-[15px]"
                style={{ color: active === "profile" ? colors.accent : colors.iconMuted }}
              />
            </div>
            {!collapsed && (
              <span
                className="text-[13px] font-medium truncate transition-colors duration-200"
                style={{ color: active === "profile" ? colors.textPrimary : colors.textSecondary }}
              >
                Profile & History
              </span>
            )}
          </button>
        )}
        {/* 3. Chat with AI Astrologer */}
        {onAiChat && (
          <button
            onClick={onAiChat}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
            style={{ borderLeft: "2px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.navHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0">
              <MessageSquare className="h-[15px] w-[15px]" style={{ color: colors.iconMuted }} />
            </div>
            {!collapsed && (
              <span className="text-[13px] font-medium truncate" style={{ color: colors.textSecondary }}>
                Chat with AI Astrologer
              </span>
            )}
          </button>
        )}
        {/* 4. Boost Your Wealth */}
        {onDownloadPdf && (
          <Link
            to="/boost-wealth"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
            style={{ borderLeft: "2px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.navHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0">
              <Rocket className="h-[15px] w-[15px]" style={{ color: colors.iconMuted }} />
            </div>
            {!collapsed && (
              <span className="text-[13px] font-medium truncate" style={{ color: colors.textSecondary }}>
                Boost Your Wealth
              </span>
            )}
          </Link>
        )}
        {/* 5. Upcoming Insights — requires auth */}
        <button
          onClick={() => {
            if (!user) { handleAuthSignIn(); return; }
            onSelect("upcoming-lifepath");
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group shrink-0"
          style={{
            background: active === "upcoming-lifepath" ? colors.navActiveBg : "transparent",
            borderLeft: active === "upcoming-lifepath" ? `2px solid ${colors.accent}` : "2px solid transparent",
          }}
          onMouseEnter={(e) => { if (active !== "upcoming-lifepath") e.currentTarget.style.background = colors.navHoverBg; }}
          onMouseLeave={(e) => { if (active !== "upcoming-lifepath") e.currentTarget.style.background = "transparent"; }}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-all duration-200"
            style={{
              background: active === "upcoming-lifepath" ? `${colors.accent}15` : "transparent",
            }}
          >
            <Clock
              className="h-[15px] w-[15px]"
              style={{ color: active === "upcoming-lifepath" ? colors.accent : colors.iconMuted }}
            />
          </div>
          {!collapsed && (
            <span
              className="text-[13px] font-medium truncate transition-colors duration-200 flex items-center gap-1.5"
              style={{ color: active === "upcoming-lifepath" ? colors.textPrimary : colors.textSecondary }}
            >
              Upcoming Insights
              {!user && <Lock className="h-3 w-3 inline-block opacity-60" />}
            </span>
          )}
        </button>
        {/* 6. Logout */}
        {!isSharedView && user && (
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
          style={{ borderLeft: "2px solid transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.navHoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0">
            <LogOut className="h-[15px] w-[15px]" style={{ color: colors.iconMuted }} />
          </div>
          {!collapsed && (
            <span className="text-[13px] font-medium truncate" style={{ color: colors.textSecondary }}>
              Logout
            </span>
          )}
        </button>
        )}
      </div>
    </div>

    {/* Pinned bottom — Theme + Download */}
    <div
      className="shrink-0 px-2 pt-2 flex flex-col gap-1.5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 8px, 24px)" }}
    >
      <KundaliThemeSwitcher collapsed={collapsed} />

      {/* Download PDF CTA */}
      {!collapsed && (
        <button
          onClick={() => {
            if (!user) { handleAuthSignIn(); return; }
            onDownloadPdf?.();
          }}
          disabled={isDownloadingPdf}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-300 hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100"
          style={{
            background: colors.accentGradient,
            color: colors.ctaText,
            boxShadow: isDownloadingPdf ? "none" : colors.glowShadow,
          }}
        >
          {isDownloadingPdf ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating PDF…
            </>
          ) : !user ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Sign in to Download
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </>
          )}
        </button>
      )}
      {/* Share Kundali CTA */}
      {!collapsed && (
        <button
          onClick={handleShareKundali}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-300 hover:brightness-110"
          style={{
            background: colors.accentGradient,
            color: colors.ctaText,
            boxShadow: shareCopied ? "none" : colors.glowShadow,
          }}
        >
          {shareCopied ? (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Link Copied!
            </>
          ) : !user ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Sign in to Share
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              Share Kundali
            </>
          )}
        </button>
      )}
      {collapsed && (
        <button
          onClick={() => {
            if (!user) { handleAuthSignIn(); return; }
            onDownloadPdf?.();
          }}
          disabled={isDownloadingPdf}
          className="w-full flex items-center justify-center px-3 py-2 rounded-xl transition-all duration-300 hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100"
          style={{
            background: colors.accentGradient,
            boxShadow: isDownloadingPdf ? "none" : colors.glowShadow,
          }}
          title={!user ? "Sign in to Download" : isDownloadingPdf ? "Generating PDF…" : "Download PDF"}
        >
          {isDownloadingPdf ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke={colors.ctaText} strokeWidth="3" />
              <path className="opacity-75" fill={colors.ctaText} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : !user ? (
            <Lock className="h-4 w-4" style={{ color: colors.ctaText }} />
          ) : (
            <Download className="h-4 w-4" style={{ color: colors.ctaText }} />
          )}
        </button>
      )}
      {collapsed && (
        <button
          onClick={handleShareKundali}
          className="w-full flex items-center justify-center px-3 py-2 rounded-xl transition-all duration-300 hover:brightness-110"
          style={{
            background: colors.accentGradient,
            boxShadow: shareCopied ? "none" : colors.glowShadow,
          }}
          title={!user ? "Sign in to Share" : shareCopied ? "Link Copied!" : "Share Kundali"}
        >
          {shareCopied ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={colors.ctaText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : !user ? (
            <Lock className="h-4 w-4" style={{ color: colors.ctaText }} />
          ) : (
            <Share2 className="h-4 w-4" style={{ color: colors.ctaText }} />
          )}
        </button>
      )}
    </div>
  </aside>
  <LogoutDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} />
  </>
  );
};

export default KundaliSidebar;
