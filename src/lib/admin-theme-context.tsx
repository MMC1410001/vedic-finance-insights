/**
 * Admin panel theme — Cosmic (dark) / Vedic (cream + antique gold).
 *
 * Deliberately a SEPARATE preference from the kundali theme, under its own
 * localStorage key and defaulting to dark. Sharing kundali-theme would have
 * flipped every existing admin's ops dashboard to cream the moment this shipped,
 * because that provider defaults to Vedic. Someone reading their chart in Vedic
 * has expressed no opinion about what their admin panel should look like.
 *
 * The colour values themselves live in index.css under `.admin-theme` /
 * `.admin-theme[data-admin-theme="vedic"]`; this context only carries the
 * switch, plus the chart palette that Recharts needs as JS (it cannot consume
 * Tailwind classes).
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type AdminTheme = "cosmic" | "vedic";

const STORAGE_KEY = "admin-theme";

export interface AdminChartColors {
  grid: string;
  tick: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  legend: string;
  /** Bar colours, keyed to the pipeline streams. */
  guest: string;
  signed_in: string;
  admin: string;
  /**
   * Categorical slots for share-of-whole charts, in fixed order — never cycled.
   *
   * Exactly three, and that is a hard cap rather than a starting point. These
   * were run through the dataviz palette validator against each theme's own
   * chart surface with `--pairs all` (which is what a pie needs, since any slice
   * can sit beside any other). Three slots pass every check in both themes; a
   * fourth fails the colour-blind separation and the normal-vision floor no
   * matter which hue is added. So a pie here shows the top two categories plus
   * "Other", and the full breakdown lives in the bar list beneath it.
   *
   * The dark column is the same three hues re-stepped for the dark surface, not
   * a separate palette or an automatic flip.
   */
  series: [string, string, string];
  /** "Other" — deliberately neutral, so it never reads as a fourth category. */
  seriesOther: string;
}

const cosmicChart: AdminChartColors = {
  grid: "#1f2937",
  tick: "#6b7280",
  axis: "#374151",
  tooltipBg: "#111827",
  tooltipBorder: "#374151",
  legend: "#9ca3af",
  guest: "#10b981",
  signed_in: "#3b82f6",
  admin: "#a855f7",
  // Validated on surface #13161B (--admin-surface, 220 18% 9%): all checks pass.
  series: ["#3987e5", "#d95926", "#199e70"],
  seriesOther: "#4b5563",
};

const vedicChart: AdminChartColors = {
  grid: "#EADFC2",
  tick: "#7A5A30",
  axis: "#D6C08A",
  tooltipBg: "#FFFDF7",
  tooltipBorder: "#D6C08A",
  legend: "#503214",
  // Darkened from the cosmic series: the -500 family washes out on cream.
  guest: "#15803D",
  signed_in: "#1D4ED8",
  admin: "#7E22CE",
  // Validated on surface #FEFDFB (--admin-surface, 44 60% 99%). All checks pass,
  // with one WARN: #1baf7a sits at 2.77:1 against cream, just under the 3:1 bar.
  // That warning is not dismissable — it obliges visible labels — so every pie
  // using these carries a percentage on each slice AND a legend AND the bar
  // list below it. Do not drop those and keep this colour.
  series: ["#2a78d6", "#eb6834", "#1baf7a"],
  seriesOther: "#8A7250",
};

interface AdminThemeContextValue {
  theme: AdminTheme;
  isVedic: boolean;
  chartColors: AdminChartColors;
  toggleTheme: () => void;
  setTheme: (t: AdminTheme) => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue>({
  theme: "cosmic",
  isVedic: false,
  chartColors: cosmicChart,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const AdminThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<AdminTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "vedic" || saved === "cosmic") return saved;
    } catch { /* private mode / disabled storage */ }
    // Dark is the default: it is what the panel has always looked like.
    return "cosmic";
  });

  // Same debounce guard as the kundali provider — a held-down toggle otherwise
  // floods re-renders through a page with three tables and a chart.
  const toggleCooldownRef = useRef(false);

  const setTheme = useCallback((t: AdminTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch { /* non-critical: the theme just won't persist */ }
  }, []);

  const toggleTheme = useCallback(() => {
    if (toggleCooldownRef.current) return;
    toggleCooldownRef.current = true;
    setTheme(theme === "cosmic" ? "vedic" : "cosmic");
    setTimeout(() => { toggleCooldownRef.current = false; }, 300);
  }, [theme, setTheme]);

  return (
    <AdminThemeContext.Provider
      value={{
        theme,
        isVedic: theme === "vedic",
        chartColors: theme === "vedic" ? vedicChart : cosmicChart,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </AdminThemeContext.Provider>
  );
};

export const useAdminTheme = () => useContext(AdminThemeContext);
