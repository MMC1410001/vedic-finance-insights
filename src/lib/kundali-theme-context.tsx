/**
 * KundaliThemeContext — Theme provider for the /kundali page.
 * Supports two themes:
 *   - "cosmic" (default dark purple/gold theme)
 *   - "vedic" (white/golden Vedic astrology theme)
 */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

export type KundaliTheme = "cosmic" | "vedic";

interface ThemeColors {
  /** Page background */
  pageBg: string;
  /** Sidebar background gradient */
  sidebarBg: string;
  /** Sidebar border */
  sidebarBorder: string;
  /** Primary text */
  textPrimary: string;
  /** Secondary/muted text */
  textSecondary: string;
  /** Accent color (gold) */
  accent: string;
  /** Accent gradient */
  accentGradient: string;
  /** Card background */
  cardBg: string;
  /** Card border */
  cardBorder: string;
  /** Section label color */
  sectionLabel: string;
  /** Nav item active bg */
  navActiveBg: string;
  /** Nav item hover bg */
  navHoverBg: string;
  /** Muted icon color */
  iconMuted: string;
  /** Particle color */
  particleColor: string;
  /** Divider color */
  divider: string;
  /** Badge/tag background */
  badgeBg: string;
  /** Badge text */
  badgeText: string;
  /** Logo text color */
  logoText: string;
  /** CTA button text */
  ctaText: string;
  /** Subtle glow shadow */
  glowShadow: string;
}

const cosmicColors: ThemeColors = {
  pageBg: "#080310",
  sidebarBg: "linear-gradient(180deg, #0D0618 0%, #0A0412 40%, #080310 100%)",
  sidebarBorder: "rgba(242,197,114,0.12)",
  textPrimary: "#F5E9FF",
  textSecondary: "rgba(200,185,230,0.82)",
  accent: "#F2C572",
  accentGradient: "linear-gradient(135deg, #F2C572, #FFDFA3)",
  cardBg: "rgba(255, 255, 255, 0.04)",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  sectionLabel: "#F2C572",
  navActiveBg: "rgba(242,197,114,0.10)",
  navHoverBg: "rgba(255,255,255,0.06)",
  iconMuted: "rgba(200,185,230,0.7)",
  particleColor: "#F2C572",
  divider: "rgba(255,255,255,0.08)",
  badgeBg: "rgba(47,191,159,0.1)",
  badgeText: "rgba(47,191,159,0.75)",
  logoText: "#F2C572",
  ctaText: "#2A0E4A",
  glowShadow: "0 4px 20px rgba(242,197,114,0.35)",
};

const vedicColors: ThemeColors = {
  pageBg: "#FFFCF5",
  sidebarBg: "linear-gradient(180deg, #FFFDF7 0%, #FFF9EC 40%, #FFF5E0 100%)",
  sidebarBorder: "rgba(184,134,11,0.18)",
  textPrimary: "#2C1810",
  textSecondary: "rgba(80,50,20,0.75)",
  accent: "#B8860B",
  accentGradient: "linear-gradient(135deg, #B8860B, #D4A012, #E8B828)",
  cardBg: "rgba(255, 253, 247, 0.97)",
  cardBorder: "rgba(184,134,11,0.2)",
  sectionLabel: "#8B6914",
  navActiveBg: "rgba(184,134,11,0.08)",
  navHoverBg: "rgba(184,134,11,0.04)",
  iconMuted: "rgba(139,105,20,0.55)",
  particleColor: "#D4A012",
  divider: "rgba(184,134,11,0.12)",
  badgeBg: "rgba(184,134,11,0.06)",
  badgeText: "rgba(139,105,20,0.85)",
  logoText: "#8B6914",
  ctaText: "#2C1810",
  glowShadow: "0 4px 24px rgba(184,134,11,0.2)",
};

interface KundaliThemeContextValue {
  theme: KundaliTheme;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (t: KundaliTheme) => void;
}

const KundaliThemeContext = createContext<KundaliThemeContextValue>({
  theme: "cosmic",
  colors: cosmicColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const KundaliThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<KundaliTheme>(() => {
    try {
      const saved = localStorage.getItem("kundali-theme");
      if (saved === "vedic" || saved === "cosmic") return saved;
    } catch {}
    // Vedic is the default for everyone; cosmic is opt-in via the toggle.
    return "vedic";
  });

  // Debounce guard: prevent rapid theme toggling from flooding re-renders
  const toggleCooldownRef = useRef(false);

  const setTheme = useCallback((t: KundaliTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem("kundali-theme", t);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    if (toggleCooldownRef.current) return;
    toggleCooldownRef.current = true;
    setTheme(theme === "cosmic" ? "vedic" : "cosmic");
    // Allow next toggle after 300ms — prevents rapid re-renders & duplicate requests
    setTimeout(() => { toggleCooldownRef.current = false; }, 300);
  }, [theme, setTheme]);

  const colors = theme === "cosmic" ? cosmicColors : vedicColors;

  return (
    <KundaliThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </KundaliThemeContext.Provider>
  );
};

export const useKundaliTheme = () => useContext(KundaliThemeContext);
