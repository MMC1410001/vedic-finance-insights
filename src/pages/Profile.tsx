/**
 * Profile Page — shows user info (name, birth details, location)
 * and a history of all generated kundalis with share links.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Calendar,
  Clock,
  MapPin,
  Share2,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { getUserKundalis, type KundaliRecord } from "@/lib/kundali-history";
import { useReportStore } from "@/lib/report-store";
import { Particles } from "@/components/ui/particles";
import { format } from "date-fns";
import KundaliSidebar from "@/components/kundali/KundaliSidebar";
import { KundaliThemeProvider, useKundaliTheme } from "@/lib/kundali-theme-context";

interface UserBirthDetails {
  birth_date: string;
  birth_time: string;
  birth_place: string;
  birth_time_accuracy: string;
}

const ProfileInner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";
  const [birthDetails, setBirthDetails] = useState<UserBirthDetails | null>(null);
  const [kundalis, setKundalis] = useState<KundaliRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  const userName = profileName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch birth details
      const { data: birth } = await supabase
        .from("user_birth_details")
        .select("full_name, birth_date, birth_time, birth_place, birth_time_accuracy")
        .eq("id", user.id)
        .single();

      if (birth) {
        setBirthDetails(birth);
        if (birth.full_name) setProfileName(birth.full_name);
      }

      // Fetch kundali history
      let history = await getUserKundalis(user.id);

      // Recovery strategy 1: If we have a lastKundaliId in session, try fetching it directly
      // (it may have been saved with user_id but the query above missed it due to timing)
      if (history.length === 0) {
        const lastId = sessionStorage.getItem("lastKundaliId");
        if (lastId) {
          const { getKundaliById } = await import("@/lib/kundali-history");
          const record = await getKundaliById(lastId);
          if (record) {
            // Ensure it's linked to this user
            if (!record.user_id || record.user_id !== user.id) {
              await supabase
                .from("kundli_reports")
                .update({ user_id: user.id })
                .eq("id", lastId);
            }
            history = await getUserKundalis(user.id);
          }
        }
      }

      // Recovery strategy 2: If still empty but we have a report in session, persist it now
      if (history.length === 0) {
        const reportRaw = sessionStorage.getItem("kundliReport");
        const reqRaw = sessionStorage.getItem("kundliRequest");
        if (reportRaw && reqRaw) {
          try {
            const report = JSON.parse(reportRaw);
            const req = JSON.parse(reqRaw);
            const { saveKundaliReport } = await import("@/lib/kundali-history");
            const result = await saveKundaliReport(req, report, user.id);
            if (result) {
              sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
              sessionStorage.setItem("lastKundaliId", result.id);
              // Re-fetch to show the newly saved record
              history = await getUserKundalis(user.id);
            } else {
              console.warn("[Profile] saveKundaliReport returned null: insert may have failed");
            }
          } catch (e) {
            console.error("[Profile] Failed to save kundali from session:", e);
          }
        }
      }

      // Recovery strategy 3: If still empty and user has birth details, the report might
      // still be generating on the Landing page. Wait briefly and retry once.
      if (history.length === 0 && birth) {
        const reqRaw = sessionStorage.getItem("kundliRequest");
        if (reqRaw) {
          // Wait for background generation to complete (Landing page generates async)
          await new Promise((r) => setTimeout(r, 3000));
          
          // Check if report appeared in sessionStorage during the wait
          const reportRaw = sessionStorage.getItem("kundliReport");
          if (reportRaw) {
            try {
              const report = JSON.parse(reportRaw);
              const req = JSON.parse(reqRaw);
              // Check if it was already saved (lastKundaliId might have been set)
              const lastId = sessionStorage.getItem("lastKundaliId");
              if (lastId) {
                // Ensure it's linked to this user
                await supabase
                  .from("kundli_reports")
                  .update({ user_id: user.id })
                  .eq("id", lastId);
              } else {
                // Save it now
                const { saveKundaliReport } = await import("@/lib/kundali-history");
                const result = await saveKundaliReport(req, report, user.id);
                if (result) {
                  sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
                  sessionStorage.setItem("lastKundaliId", result.id);
                }
              }
              history = await getUserKundalis(user.id);
            } catch { /* ignore */ }
          } else {
            // Report still not ready — just retry the DB fetch in case Landing saved it
            history = await getUserKundalis(user.id);
          }
        }
      }

      setKundalis(history);
      setLoading(false);
    }

    loadProfile();
  }, [user]);

  // Listen for storage events — Landing page dispatches one after saving the report
  useEffect(() => {
    if (!user) return;

    const handleStorageChange = async () => {
      // If we currently show 0 kundalis and a report just appeared, try to refresh
      const lastId = sessionStorage.getItem("lastKundaliId");
      if (lastId && kundalis.length === 0) {
        const history = await getUserKundalis(user.id);
        if (history.length > 0) {
          setKundalis(history);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [user, kundalis.length]);

  const handleCopyLink = async (slug: string) => {
    const url = `${window.location.origin}/shared/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleViewKundali = (kundali: KundaliRecord) => {
    // Hydrate sessionStorage with this kundali's data so /kundali page renders it
    const reportData = {
      summary: {
        financial_phase: kundali.financial_phase,
        confidence_level: kundali.confidence_lvl,
        primary_insight: kundali.primary_insight,
      },
      scores: kundali.scores,
      d1_chart: kundali.d1_chart,
      d9_chart: kundali.d9_chart,
      dasha: kundali.dasha,
      timeline: kundali.timeline,
      transits: kundali.transits,
    };
    const requestData = {
      full_name: kundali.full_name || "",
      birth_date: kundali.birth_date,
      birth_time: kundali.birth_time,
      birth_place: kundali.birth_place,
      latitude: 0,
      longitude: 0,
      timezone: 0,
      birth_time_accuracy: "exact" as const,
    };

    sessionStorage.setItem("kundliReport", JSON.stringify(reportData));
    sessionStorage.setItem("kundliRequest", JSON.stringify(requestData));
    sessionStorage.setItem("lastKundaliSlug", kundali.share_slug);
    sessionStorage.setItem("lastKundaliId", kundali.id);
    window.dispatchEvent(new Event("kundliReportReady"));

    // Build a cache key matching what fetchReport computes: birth_date|birth_time|lat|lng
    const reqKey = `${kundali.birth_date}|${kundali.birth_time}|0|0`;
    sessionStorage.setItem("kundliReportKey", reqKey);

    // Update the Zustand store directly so /kundali renders immediately without re-fetching
    const { setReport } = useReportStore.getState();
    const birthYear = kundali.birth_date ? new Date(kundali.birth_date).getFullYear() : undefined;
    setReport(reportData as any, kundali.full_name || "", birthYear);

    // Navigate to the full kundali page
    navigate("/kundali");
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy, hh:mm a");
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: isVedic
          ? "linear-gradient(135deg, #FFFDF7 0%, #FFF9EC 50%, #FFFDF7 100%)"
          : "linear-gradient(135deg, #0D0618 0%, #1A0B2E 50%, #0D0618 100%)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.accent }} />
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isVedic ? "vedic-theme" : ""}`} style={{ background: colors.pageBg }}>
      {/* Sidebar — desktop */}
      <div
        className={`hidden lg:flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <KundaliSidebar
          active="profile"
          onSelect={(id) => {
            if (id === "kundali-overview" || id.startsWith("kundali-")) {
              navigate("/kundali");
            }
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onGoHome={() => navigate("/home")}
          userName={userName}
        />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            >
              <KundaliSidebar
                active="profile"
                onSelect={(id) => {
                  setMobileMenuOpen(false);
                  if (id === "kundali-overview" || id.startsWith("kundali-")) {
                    navigate("/kundali");
                  }
                }}
                onGoHome={() => navigate("/home")}
                userName={userName}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative">
        <Particles
          className="absolute inset-0 pointer-events-none z-0"
          quantity={30}
          color={colors.particleColor}
          size={0.4}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Mobile header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: colors.accent }} />
            </button>
            <h1
              className="text-lg font-bold"
              style={{ color: colors.textPrimary, fontFamily: "'Playfair Display', serif" }}
            >
              Profile
            </h1>
          </div>

          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div
              className="rounded-2xl p-6 sm:p-8"
              style={{
                background: isVedic
                  ? "linear-gradient(165deg, #FFFDF7 0%, #FFF9EC 50%, #FFFBF2 100%)"
                  : "rgba(255, 255, 255, 0.03)",
                border: isVedic
                  ? "1px solid rgba(184, 134, 11, 0.25)"
                  : "1px solid rgba(242, 197, 114, 0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Avatar + Name */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="h-16 w-16 shrink-0 rounded-full flex items-center justify-center"
                  style={{
                    background: isVedic
                      ? "linear-gradient(135deg, rgba(184,134,11,0.12), rgba(212,160,18,0.12))"
                      : "linear-gradient(135deg, rgba(242,197,114,0.2), rgba(161,78,191,0.2))",
                    border: isVedic
                      ? "2px solid rgba(184,134,11,0.3)"
                      : "2px solid rgba(242,197,114,0.3)",
                  }}
                >
                  <User className="h-7 w-7" style={{ color: colors.accent }} />
                </div>
                <div className="min-w-0">
                  <h2
                    className="text-2xl font-bold break-words"
                    title={userName}
                    style={{ color: colors.textPrimary, fontFamily: "'Playfair Display', serif" }}
                  >
                    {userName}
                  </h2>
                  <p className="text-sm break-all" style={{ color: colors.textSecondary }}>
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Birth Details Grid */}
              {birthDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoCard
                    icon={Calendar}
                    label="Birth Date"
                    value={formatDate(birthDetails.birth_date)}
                  />
                  <InfoCard
                    icon={Clock}
                    label="Birth Time"
                    value={birthDetails.birth_time}
                    sublabel={birthDetails.birth_time_accuracy === "exact" ? "Exact" : "Approximate"}
                  />
                  <InfoCard
                    icon={MapPin}
                    label="Birth Place"
                    value={birthDetails.birth_place}
                    className="sm:col-span-2"
                  />
                </div>
              ) : (
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  No birth details found. Generate a kundali to see your details here.
                </p>
              )}
            </div>
          </motion.div>

          {/* Kundali History — Hidden from users per requirement */}
          {/* History is still tracked in the database and visible to admins on the admin dashboard */}
          {false && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5" style={{ color: colors.accent }} />
                <h3
                  className="text-lg font-bold"
                  style={{ color: colors.textPrimary, fontFamily: "'Playfair Display', serif" }}
                >
                  Your Kundali History
                </h3>
                <span
                  className="ml-2 text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: isVedic ? "rgba(184,134,11,0.08)" : "rgba(242,197,114,0.1)",
                    color: colors.accent,
                    border: isVedic
                      ? "1px solid rgba(184,134,11,0.2)"
                      : "1px solid rgba(242,197,114,0.2)",
                  }}
                >
                  {kundalis.length}
                </span>
              </div>

              {kundalis.length === 0 ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    background: isVedic
                      ? "linear-gradient(165deg, #FFFDF7 0%, #FFF9EC 50%, #FFFBF2 100%)"
                      : "rgba(255, 255, 255, 0.02)",
                    border: isVedic
                      ? "1px solid rgba(184, 134, 11, 0.2)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Sparkles className="h-10 w-10 mx-auto mb-3" style={{ color: isVedic ? "rgba(184,134,11,0.4)" : "rgba(242,197,114,0.3)" }} />
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    No kundalis generated yet. Go to your Financial Kundali to generate one.
                  </p>
                  <button
                    onClick={() => navigate("/kundali")}
                    className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                    style={{
                      background: colors.accentGradient,
                      color: colors.ctaText,
                    }}
                  >
                    Generate Kundali
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {kundalis.map((k, idx) => (
                    <motion.div
                      key={k.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <KundaliHistoryCard
                        kundali={k}
                        onCopyLink={() => handleCopyLink(k.share_slug)}
                        onView={() => handleViewKundali(k)}
                        isCopied={copiedSlug === k.share_slug}
                        formatDateTime={formatDateTime}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

/* ── Info Card ── */
function InfoCard({
  icon: Icon,
  label,
  value,
  sublabel,
  className = "",
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  sublabel?: string;
  className?: string;
}) {
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl ${className}`}
      style={{
        background: isVedic ? "rgba(255,252,245,0.7)" : "rgba(255,255,255,0.03)",
        border: isVedic ? "1px solid rgba(184,134,11,0.12)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: isVedic ? "rgba(184,134,11,0.08)" : "rgba(242,197,114,0.08)" }}
      >
        <Icon className="h-4 w-4" style={{ color: colors.accent }} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider" style={{ color: colors.textSecondary }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          {value}
        </p>
        {sublabel && (
          <p className="text-[10px]" style={{ color: isVedic ? "#6B8E23" : "rgba(47,191,159,0.7)" }}>
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Kundali History Card ── */
function KundaliHistoryCard({
  kundali,
  onCopyLink,
  onView,
  isCopied,
  formatDateTime,
}: {
  kundali: KundaliRecord;
  onCopyLink: () => void;
  onView: () => void;
  isCopied: boolean;
  formatDateTime: (d: string) => string;
}) {
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";
  const wealthScore = kundali.scores?.natal_wealth_score ?? 0;
  const phase = kundali.financial_phase || "Unknown Phase";

  return (
    <div
      className="rounded-xl p-4 transition-all duration-200 hover:translate-y-[-2px] group"
      style={{
        background: isVedic
          ? "linear-gradient(165deg, rgba(255,253,247,0.95) 0%, rgba(255,249,236,0.9) 100%)"
          : "rgba(255, 255, 255, 0.03)",
        border: isVedic
          ? "1px solid rgba(184,134,11,0.18)"
          : "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name + Phase */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>
              {kundali.full_name || "Unnamed"}
            </h4>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: isVedic ? "rgba(107,142,35,0.08)" : "rgba(47,191,159,0.1)",
                color: isVedic ? "#4A7C10" : "#2FBF9F",
                border: isVedic ? "1px solid rgba(107,142,35,0.2)" : "1px solid rgba(47,191,159,0.2)",
              }}
            >
              {phase}
            </span>
          </div>

          {/* Birth info */}
          <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>
            {kundali.birth_place} • {kundali.birth_date} • {kundali.birth_time}
          </p>

          {/* Scores preview */}
          <div className="flex items-center gap-3 mt-2">
            <ScorePill label="Wealth" value={wealthScore} />
            <ScorePill label="Income" value={kundali.scores?.income_score ?? 0} />
            <ScorePill label="Timing" value={kundali.scores?.timing_score ?? 0} />
          </div>

          {/* Generated at */}
          <p className="text-[10px] mt-2" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>
            Generated: {formatDateTime(kundali.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={onView}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            title="View Kundali"
          >
            <ExternalLink className="h-4 w-4" style={{ color: colors.textSecondary }} />
          </button>
          <button
            onClick={onCopyLink}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            title="Copy Share Link"
          >
            {isCopied ? (
              <Check className="h-4 w-4" style={{ color: isVedic ? "#6B8E23" : "#2FBF9F" }} />
            ) : (
              <Share2 className="h-4 w-4" style={{ color: colors.textSecondary }} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Score Pill ── */
function ScorePill({ label, value }: { label: string; value: number }) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";
  const color = value >= 65
    ? (isVedic ? "#4A7C10" : "#2FBF9F")
    : value >= 45
      ? (isVedic ? "#8B6914" : "#F2C572")
      : (isVedic ? "#9F1239" : "#E06BAA");
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px]" style={{ color: isVedic ? "rgba(80,50,20,0.6)" : "rgba(168,155,200,0.5)" }}>
        {label}
      </span>
      <span className="text-xs font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

const Profile = () => (
  <KundaliThemeProvider>
    <ProfileInner />
  </KundaliThemeProvider>
);

export default Profile;
