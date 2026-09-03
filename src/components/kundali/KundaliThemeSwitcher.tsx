/**
 * KundaliThemeSwitcher — Beautiful Vedic astrology theme toggle for the sidebar.
 * Switches between "cosmic" (dark) and "vedic" (white/golden) themes.
 */
import { useKundaliTheme } from "@/lib/kundali-theme-context";
import { Moon, Sun } from "lucide-react";

interface KundaliThemeSwitcherProps {
  collapsed?: boolean;
}

const KundaliThemeSwitcher = ({ collapsed = false }: KundaliThemeSwitcherProps) => {
  const { theme, toggleTheme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";

  if (collapsed) {
    return (
      <button
        onClick={toggleTheme}
        className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-500 group"
        title={isVedic ? "Switch to Cosmic theme" : "Switch to Vedic theme"}
        style={{
          background: isVedic
            ? "linear-gradient(135deg, rgba(198,147,10,0.08), rgba(232,184,40,0.05))"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${isVedic ? "rgba(198,147,10,0.15)" : "rgba(242,197,114,0.1)"}`,
        }}
      >
        <div className="relative w-5 h-5">
          <Sun
            className="absolute inset-0 h-5 w-5 transition-all duration-500"
            style={{
              color: isVedic ? "#C6930A" : "rgba(242,197,114,0.3)",
              opacity: isVedic ? 1 : 0,
              transform: isVedic ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.5)",
            }}
          />
          <Moon
            className="absolute inset-0 h-5 w-5 transition-all duration-500"
            style={{
              color: isVedic ? "rgba(198,147,10,0.3)" : "#F2C572",
              opacity: isVedic ? 0 : 1,
              transform: isVedic ? "rotate(90deg) scale(0.5)" : "rotate(0deg) scale(1)",
            }}
          />
        </div>
      </button>
    );
  }

  return (
    <div className="px-2">
      <div
        className="relative rounded-xl p-[1px] transition-all duration-500"
        style={{
          background: isVedic
            ? "linear-gradient(135deg, rgba(198,147,10,0.25), rgba(232,184,40,0.1), rgba(198,147,10,0.25))"
            : "linear-gradient(135deg, rgba(242,197,114,0.15), rgba(200,162,255,0.1), rgba(242,197,114,0.15))",
        }}
      >
        <div
          className="rounded-[11px] p-2.5 transition-all duration-500"
          style={{
            background: isVedic
              ? "linear-gradient(165deg, rgba(255,255,255,0.98), rgba(254,252,248,0.95))"
              : "rgba(13,6,24,0.8)",
          }}
        >
          {/* Label */}
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.14em] transition-colors duration-500"
              style={{ color: isVedic ? "rgba(155,123,44,0.5)" : "rgba(168,155,200,0.4)" }}
            >
              Theme
            </span>
            <div
              className="flex-1 h-px transition-colors duration-500"
              style={{ background: isVedic ? "rgba(197,155,55,0.08)" : "rgba(255,255,255,0.06)" }}
            />
          </div>

          {/* Toggle track */}
          <button
            onClick={toggleTheme}
            className="relative w-full h-9 rounded-lg overflow-hidden transition-all duration-500 group"
            style={{
              background: isVedic
                ? "linear-gradient(135deg, rgba(198,147,10,0.04), rgba(232,184,40,0.03))"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${isVedic ? "rgba(197,155,55,0.1)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {/* Sliding indicator */}
            <div
              className="absolute top-[3px] bottom-[3px] w-[calc(50%-4px)] rounded-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                left: isVedic ? "calc(50% + 1px)" : "3px",
                background: isVedic
                  ? "linear-gradient(135deg, #C6930A, #E8B828)"
                  : "linear-gradient(135deg, #4B1D73, #6B21A8)",
                boxShadow: isVedic
                  ? "0 2px 10px rgba(198,147,10,0.4), inset 0 1px 0 rgba(255,255,255,0.25)"
                  : "0 2px 8px rgba(107,33,168,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            />

            {/* Options */}
            <div className="relative flex items-center h-full">
              {/* Cosmic option */}
              <div className="flex-1 flex items-center justify-center gap-1.5 z-10">
                <Moon
                  className="h-3 w-3 transition-all duration-500"
                  style={{
                    color: !isVedic ? "#F5E9FF" : isVedic ? "rgba(155,123,44,0.4)" : "rgba(168,155,200,0.4)",
                  }}
                />
                <span
                  className="text-[10px] font-semibold transition-all duration-500"
                  style={{
                    color: !isVedic ? "#F5E9FF" : isVedic ? "rgba(155,123,44,0.4)" : "rgba(168,155,200,0.4)",
                  }}
                >
                  Cosmic
                </span>
              </div>

              {/* Vedic option */}
              <div className="flex-1 flex items-center justify-center gap-1.5 z-10">
                <Sun
                  className="h-3 w-3 transition-all duration-500"
                  style={{
                    color: isVedic ? "#FFFDF7" : "rgba(168,155,200,0.4)",
                  }}
                />
                <span
                  className="text-[10px] font-semibold transition-all duration-500"
                  style={{
                    color: isVedic ? "#FFFDF7" : "rgba(168,155,200,0.4)",
                  }}
                >
                  Vedic
                </span>
              </div>
            </div>
          </button>

          {/* Decorative Om / Star symbol */}
          <div className="flex items-center justify-center mt-2">
            <span
              className="text-[10px] transition-all duration-700"
              style={{
                color: isVedic ? "rgba(198,147,10,0.3)" : "rgba(242,197,114,0.2)",
                letterSpacing: "0.3em",
              }}
            >
              {isVedic ? "☸ वैदिक ☸" : "✦ ⋆ ✦"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KundaliThemeSwitcher;
