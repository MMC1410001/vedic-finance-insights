/**
 * UnlockedCards — Real insight cards shown to logged-in users
 * who have their kundali report data available.
 *
 * Replaces the blurred/locked placeholders with actual computed data:
 *   - Surprise Wealth Gain: shows windfall triggers and peak window
 *   - Best Investment Option: shows top-ranked investment basket
 *
 * Reuses the visual style from /kundali dashboard cards.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, BarChart3, Star } from "lucide-react";
import { useReportStore } from "@/lib/report-store";
import { buildPersonalWealthTriggers, computeBasketsFromChart } from "@/lib/chart-personalization";
import type { BasketType } from "@/lib/vedicfinance-types";

/* ─── Shared Card Wrapper ─── */
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "#FFFCF5",
        border: "1.5px solid rgba(184,134,11,0.22)",
        boxShadow: "0 2px 12px rgba(139,105,20,0.06), 0 0 0 1px rgba(184,134,11,0.08)",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Card A: Surprise Wealth Gain ─── */
export function UnlockedSurpriseWealthCard() {
  const scores = useReportStore((s) => s.scores);
  const dasha = useReportStore((s) => s.dasha);
  const transits = useReportStore((s) => s.transits);
  const chart = useReportStore((s) => s.chart);
  const birthYear = useReportStore((s) => s.birthYear);

  const data = useMemo(() => {
    if (!chart || !dasha || !transits || !scores) return null;
    const effectiveBirthYear = birthYear ?? new Date().getFullYear() - 30;
    const result = buildPersonalWealthTriggers(chart, dasha, transits, scores, effectiveBirthYear);
    // Get top 2 triggers
    const triggers = result.triggers.slice(0, 2);
    return { triggers, peakStartYear: result.peakStartYear, peakEndYear: result.peakEndYear };
  }, [chart, dasha, transits, scores, birthYear]);

  if (!data || data.triggers.length === 0) return null;

  return (
    <CardShell>
      {/* Header */}
      <div className="px-4 pt-3 pb-1.5 relative z-20">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#B8860B" }} />
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

      {/* Events — just the event name + year */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        {data.triggers.map((trigger, idx) => (
          <motion.div
            key={idx}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.15 }}
          >
            <span className="text-lg shrink-0">{trigger.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: "#a22c1c" }}>
                {trigger.source}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(80,50,20,0.6)" }}>
                {trigger.timing}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </CardShell>
  );
}

/* ─── Card B: Best Investment Option for You ─── */

const BASKET_LABELS: Record<BasketType, string> = {
  stocks: "Stocks",
  mutual_funds: "Mutual Funds",
  real_estate: "Real Estate",
  gold: "Gold",
  fixed_income: "Fixed Income",
  high_risk: "High Risk",
};

const BASKET_ICONS: Record<BasketType, typeof TrendingUp> = {
  stocks: TrendingUp,
  mutual_funds: BarChart3,
  real_estate: Star,
  gold: Sparkles,
  fixed_income: BarChart3,
  high_risk: TrendingUp,
};

const SUITABILITY_COLORS: Record<string, string> = {
  highly_suitable: "#1C8C7A",
  suitable: "#2A9D8F",
  moderate: "#B8860B",
  low: "#C0392B",
  avoid: "#C0392B",
};

const SUITABILITY_LABELS: Record<string, string> = {
  highly_suitable: "Highly Suitable",
  suitable: "Suitable",
  moderate: "Moderate",
  low: "Low",
  avoid: "Avoid",
};

export function UnlockedBestInvestmentCard() {
  const scores = useReportStore((s) => s.scores);
  const dasha = useReportStore((s) => s.dasha);
  const transits = useReportStore((s) => s.transits);
  const chart = useReportStore((s) => s.chart);

  const data = useMemo(() => {
    if (!chart || !dasha || !transits || !scores) return null;
    const baskets = computeBasketsFromChart(chart, dasha, transits, scores);
    // Get top 3 ranked baskets
    const top3 = baskets.ranked.slice(0, 3);
    return {
      investorType: baskets.investor_type,
      top3: top3.map((key) => ({
        key,
        ...baskets.baskets[key],
      })),
    };
  }, [chart, dasha, transits, scores]);

  if (!data) return null;

  return (
    <CardShell>
      {/* Header */}
      <div className="px-4 pt-3 pb-1.5 relative z-20">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "#B8860B" }} />
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

      {/* Investment list */}
      <div className="px-4 pb-4">
        <div className="flex flex-col gap-2.5">
          {data.top3.map((basket, idx) => {
            const Icon = BASKET_ICONS[basket.key] ?? TrendingUp;
            const suitColor = SUITABILITY_COLORS[basket.suitability] ?? "#F2C572";

            return (
              <motion.div
                key={basket.key}
                className="flex items-center justify-between"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${suitColor}08`,
                      border: `1px solid ${suitColor}20`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: suitColor }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "#2C1810" }}>
                    {BASKET_LABELS[basket.key]}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold" style={{ color: suitColor }}>
                    {SUITABILITY_LABELS[basket.suitability]}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}
