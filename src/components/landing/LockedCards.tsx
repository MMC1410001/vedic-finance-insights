/**
 * LockedCards — Blurred preview cards for the Glimpse of Kundali section.
 * Two cards: Surprise Wealth Gain + Best Investment for You.
 * Adapted to the cosmic purple/gold dark theme.
 */

import { Lock, Sparkles, TrendingUp, BarChart3, Star } from "lucide-react";

/* ─── Shared Lock Overlay ─── */
function LockOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(242,197,114,0.1)",
            border: "1px solid rgba(242,197,114,0.25)",
            boxShadow: "0 0 20px rgba(242,197,114,0.12)",
          }}
        >
          <Lock className="w-4 h-4" style={{ color: "#F2C572" }} />
        </div>
        <span
          className="text-[9px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#996B1F" }}
        >
          Locked
        </span>
      </div>
    </div>
  );
}

/* ─── Card A: Surprise Wealth Gain (locked) ─── */
export function SurpriseWealthLockedCard() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(242,197,114,0.3)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header — always visible */}
      <div className="px-4 pt-3 pb-1.5 relative z-20">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#F2C572" }} />
          <h3
            className="text-sm font-bold leading-tight"
            style={{
              color: "#a22c1c",
              fontFamily: "'Playfair Display', serif",
            }}
          >
            Surprise Wealth Gain
          </h3>
        </div>
      </div>

      {/* Body — blurred */}
      <div className="relative flex-1 min-h-0">
        <div
          className="px-4 pb-4 select-none"
          style={{ filter: "blur(3px)", pointerEvents: "none" }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">🏛️</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "#F2C572" }}>
                  Family Inheritance
                </p>
                <p className="text-[11px]" style={{ color: "#6B5A8A" }}>
                  Around age 28–32
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">✈️</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "#F2C572" }}>
                  Overseas Income Surge
                </p>
                <p className="text-[11px]" style={{ color: "#6B5A8A" }}>
                  Around age 30–34
                </p>
              </div>
            </div>
          </div>
        </div>

        <LockOverlay />
      </div>
    </div>
  );
}

/* ─── Card B: Best Investment for You (locked) ─── */
export function BestInvestmentLockedCard() {
  const investments = [
    { icon: BarChart3, label: "Mutual Funds", status: "Suitable", statusColor: "#4FD1C5" },
    { icon: Star, label: "Gold", status: "Moderate", statusColor: "#F2C572" },
    { icon: TrendingUp, label: "Real Estate", status: "Suitable", statusColor: "#4FD1C5" },
  ];

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(242,197,114,0.3)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header — always visible */}
      <div className="px-4 pt-3 pb-1.5 relative z-20">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "#F2C572" }} />
          <h3
            className="text-sm font-bold leading-tight"
            style={{
              color: "#a22c1c",
              fontFamily: "'Playfair Display', serif",
            }}
          >
            Best Investment for You
          </h3>
        </div>
      </div>

      {/* Body — blurred */}
      <div className="relative flex-1 min-h-0">
        <div
          className="px-4 pb-4 select-none"
          style={{ filter: "blur(3px)", pointerEvents: "none" }}
        >
          <div className="flex flex-col gap-2.5">
            {investments.map((a) => (
              <div key={a.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${a.statusColor}08`,
                      border: `1px solid ${a.statusColor}20`,
                    }}
                  >
                    <a.icon className="w-3.5 h-3.5" style={{ color: a.statusColor }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "#4A3A6A" }}>
                    {a.label}
                  </span>
                </div>
                <span className="text-xs font-bold" style={{ color: a.statusColor }}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <LockOverlay />
      </div>
    </div>
  );
}
