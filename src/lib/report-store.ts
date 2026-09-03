/**
 * Zustand store for the Financial Kundali report data.
 *
 * Hydrates synchronously from sessionStorage on creation so there's
 * no flash of skeleton/loading state when navigating between pages.
 *
 * Components subscribe to individual slices:
 *   const scores = useReportStore(s => s.scores);
 * This means a component only re-renders when its specific slice changes.
 */

import { create } from "zustand";
import { computeAllInsights, type FinancialKundaliInsights } from "./financial-kundali-engine";
import { generateReport, generateFinancialSummary } from "./vedicfinance-api";
import { saveKundaliReport } from "./kundali-history";
import { ensureSessionId } from "./visitor-tracking";
import { supabase } from "./supabase";
import type {
  ReportRequest,
  ReportScores,
  DashaInfo,
  TransitPlanet,
  ChartData,
  ReportTimeline,
  ReportResponse,
} from "./vedicfinance-types";

// ── Synchronous hydration from sessionStorage ───────────────────────────────

function hydrateFromSession(): {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
  timeline: ReportTimeline | null;
  birthYear: number | undefined;
  userName: string;
  hasRealData: boolean;
} {
  try {
    const reqRaw = sessionStorage.getItem("kundliRequest");
    const reportRaw = sessionStorage.getItem("kundliReport");

    if (reportRaw) {
      const report = JSON.parse(reportRaw);
      let userName = "";
      let birthYear: number | undefined;

      if (reqRaw) {
        const req = JSON.parse(reqRaw);
        if (req.full_name) userName = req.full_name;
        if (req.birth_date) {
          const y = new Date(req.birth_date).getFullYear();
          if (!isNaN(y)) birthYear = y;
        }
      }

      return {
        scores: report.scores ?? null,
        dasha: report.dasha ?? null,
        transits: report.transits ?? null,
        chart: report.d1_chart ?? null,
        timeline: report.timeline ?? null,
        birthYear,
        userName,
        hasRealData: true,
      };
    }
  } catch {
    // Malformed JSON — fall through to empty state
  }

  // No cached data — return empty state (no demo/dummy data)
  return {
    scores: null,
    dasha: null,
    transits: null,
    chart: null,
    timeline: null,
    birthYear: undefined,
    userName: "",
    hasRealData: false,
  };
}

// ── Store shape ─────────────────────────────────────────────────────────────

interface ReportState {
  // Core report data
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
  timeline: ReportTimeline | null;

  // Derived
  insights: FinancialKundaliInsights | null;

  // User info
  birthYear: number | undefined;
  userName: string;
  personalSummary: string;

  // Status
  hasRealData: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  setReport: (report: ReportResponse, userName?: string, birthYear?: number) => void;
  setUserName: (name: string) => void;
  fetchReport: (req: ReportRequest) => Promise<void>;
  fetchSummary: () => Promise<void>;
  clear: () => void;
}

// ── Create store with synchronous hydration ─────────────────────────────────

const initial = hydrateFromSession();

// Pre-compute insights if we have data
function computeInsights(
  chart: ChartData | null,
  scores: ReportScores | null,
  dasha: DashaInfo | null,
  transits: TransitPlanet[] | null,
  timeline: ReportTimeline | null,
): FinancialKundaliInsights | null {
  if (!chart || !scores || !dasha || !transits) return null;
  return computeAllInsights(chart, scores, dasha, transits, timeline);
}

const initialInsights = computeInsights(
  initial.chart,
  initial.scores,
  initial.dasha,
  initial.transits,
  initial.timeline,
);

export const useReportStore = create<ReportState>((set, get) => ({
  // Hydrated state — available on first render, no flash
  scores: initial.scores,
  dasha: initial.dasha,
  transits: initial.transits,
  chart: initial.chart,
  timeline: initial.timeline,
  insights: initialInsights,
  birthYear: initial.birthYear,
  userName: initial.userName,
  personalSummary: "",
  hasRealData: initial.hasRealData,
  loading: false,
  error: null,

  setReport: (report, userName, birthYear) => {
    const scores = report.scores ?? null;
    const dasha = report.dasha ?? null;
    const transits = report.transits ?? null;
    const chart = report.d1_chart ?? null;
    const timeline = report.timeline ?? null;
    const insights = computeInsights(chart, scores, dasha, transits, timeline);

    set({
      scores,
      dasha,
      transits,
      chart,
      timeline,
      insights,
      birthYear: birthYear ?? get().birthYear,
      userName: userName ?? get().userName,
      hasRealData: true,
      loading: false,
      error: null,
      personalSummary: "", // Reset so AI summary re-generates
    });
  },

  // Lightweight update — only changes the displayed name without touching report data.
  // Used by FloatingAstrologerChat (and any other component that fetches birth data
  // independently) to keep the hero title in sync when the store userName is still empty.
  setUserName: (name) => {
    if (!name || get().userName === name) return;
    set({ userName: name });
  },

  fetchReport: async (req) => {
    const state = get();
    if (state.loading) return;

    // Check if we already have data for this request
    const reqKey = `${req.birth_date}|${req.birth_time}|${req.latitude}|${req.longitude}`;
    const cachedKey = sessionStorage.getItem("kundliReportKey");
    if (state.hasRealData && cachedKey === reqKey) {
      // Data already loaded from cache — but ensure it's saved to DB with user_id
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (userId) {
          const lastId = sessionStorage.getItem("lastKundaliId");
          if (lastId) {
            // Update the existing record to claim it for this user
            await supabase
              .from("kundli_reports")
              .update({ user_id: userId })
              .eq("id", lastId)
              .is("user_id", null);
          } else {
            // No record saved yet for this session — save now
            const reportRaw = sessionStorage.getItem("kundliReport");
            if (reportRaw) {
              const report = JSON.parse(reportRaw) as ReportResponse;
              const result = await saveKundaliReport(req, report, userId);
              if (result) {
                sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
                sessionStorage.setItem("lastKundaliId", result.id);
              }
            }
          }
        }
      } catch {
        // Non-critical
      }
      return;
    }

    set({ loading: true, error: null });

    // Ensure a consistent sessionId exists
    ensureSessionId();

    try {
      const report = await generateReport(req);

      // Cache in sessionStorage
      sessionStorage.setItem("kundliReport", JSON.stringify(report));
      sessionStorage.setItem("kundliReportKey", reqKey);

      // Persist moon sign to localStorage so the navbar badge survives page refreshes
      try {
        const moon = report.d1_chart?.planets?.find((p: any) => p.planet === "Moon");
        if (moon?.sign && moon?.sign_num !== undefined) {
          localStorage.setItem("moonSign", JSON.stringify({ sign: moon.sign, signNum: moon.sign_num }));
        }
      } catch { /* non-critical */ }

      window.dispatchEvent(new Event("kundliReportReady"));

      const userName = req.full_name ?? get().userName;
      const birthYear = req.birth_date
        ? new Date(req.birth_date).getFullYear()
        : get().birthYear;

      get().setReport(report, userName, birthYear);

      // Persist to database for history & sharing (fire-and-forget)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let userId = session?.user?.id;

        // If no session yet, wait briefly and retry (auth may still be initializing)
        if (!userId) {
          await new Promise((r) => setTimeout(r, 1500));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          userId = retrySession?.user?.id;
        }

        const result = await saveKundaliReport(req, report, userId);
        if (result) {
          // Store the share slug in session for quick access
          sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
          sessionStorage.setItem("lastKundaliId", result.id);
        }
      } catch (err) {
        // Non-critical — don't block the UI if DB save fails, but do surface it.
        console.error("Failed to persist kundali to history:", err);
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to generate report",
      });
    }
  },

  fetchSummary: async () => {
    const { scores, dasha, insights, chart, userName, personalSummary } = get();
    if (!scores || !dasha || !insights || !chart) return;
    if (personalSummary) return; // Already have one

    // Cache key includes userName so a summary generated without a name (or for a
    // different user) is never reused in a new tab/window where the name loaded later.
    const userSlug = userName ? `_${userName.replace(/\s+/g, "").toLowerCase()}` : "";
    const cacheKey = `financialSummary_${scores.income_score}_${scores.natal_wealth_score}_${dasha.mahadasha_lord}${userSlug}`;
    const cached = sessionStorage.getItem(cacheKey);
    // Validate cached value: must be a real sentence (>40 chars) and contain
    // at least one letter — guards against corrupted/partial cache entries.
    if (cached && cached.trim().length > 40 && /[a-zA-Z]{3,}/.test(cached)) {
      set({ personalSummary: cached });
      return;
    }
    // Discard any corrupt cached entry so it gets regenerated
    if (cached) sessionStorage.removeItem(cacheKey);

    try {
      const res = await generateFinancialSummary({
        scores,
        dasha_lord: dasha.mahadasha_lord,
        antardasha_lord: dasha.antardasha_lord,
        archetype_name: insights.archetype.name,
        lagna_sign: chart.lagna_sign,
        user_name: userName || undefined,
      });
      sessionStorage.setItem(cacheKey, res.summary);
      set({ personalSummary: res.summary });
    } catch {
      // Fallback: build locally
      const archetype = insights.archetype.name;
      const dashaLord = dasha.mahadasha_lord;
      const wealthScore = scores.natal_wealth_score;
      const phase = wealthScore >= 60
        ? "a strong wealth-building phase"
        : wealthScore >= 40
          ? "a consolidation phase with steady potential"
          : "a period requiring financial discipline";
      const dashaInsight = ["Jupiter", "Venus", "Mercury"].includes(dashaLord)
        ? `Your ${dashaLord} Mahadasha amplifies earning capacity and opens doors for growth.`
        : dashaLord === "Saturn"
          ? `Your Saturn Mahadasha rewards patience: structured savings and long-term investments will compound significantly.`
          : `Your ${dashaLord} Mahadasha brings unique financial energy: channel it through calculated moves rather than impulse.`;
      const opener = userName
        ? `${userName}, your chart reveals ${phase} with a "${archetype}" money personality.`
        : `Your chart reveals ${phase} with a "${archetype}" money personality.`;
      const fallback = `${opener} ${dashaInsight}`;
      sessionStorage.setItem(cacheKey, fallback);
      set({ personalSummary: fallback });
    }
  },

  clear: () => {
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    sessionStorage.removeItem("kundliRequest");
    set({
      scores: null,
      dasha: null,
      transits: null,
      chart: null,
      timeline: null,
      insights: null,
      birthYear: undefined,
      userName: "",
      personalSummary: "",
      hasRealData: false,
      loading: false,
      error: null,
    });
  },
}));
