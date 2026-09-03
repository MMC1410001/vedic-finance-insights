/**
 * PeakEarningYears — vertical stepper showing the user's strongest earning windows.
 *
 * The years come from `buildPeakEarningYears` in chart-personalization.ts, which
 * walks the user's real Vimshottari dasha ladder and scores each sub-period
 * against their natal chart. They are NOT offsets from the current year — two
 * different birth charts must produce different years here.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { ReportScores, DashaInfo, TransitPlanet, ChartData } from "@/lib/vedicfinance-types";
import { buildPeakEarningYears, type PeakYear } from "@/lib/chart-personalization";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
  birthYear?: number;
}

const FAVORABLE_LORDS = ["Jupiter", "Venus", "Mercury", "Moon"];

/**
 * No-chart path only. Without the natal chart there is nothing chart-specific
 * to derive from, so this is generic by construction — every user hitting it
 * sees the same years. Both `chart` and `dasha` arrive in the same report
 * payload, so in practice this fires only when the report failed to load.
 */
function fallbackPeakYears(dasha: DashaInfo | null, birthYear: number): PeakYear[] {
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const dashaLord = dasha?.mahadasha_lord ?? "Jupiter";
  const antarLord = dasha?.antardasha_lord ?? "Venus";
  const nextDasha = dasha?.next_mahadasha ?? "Saturn";

  const peaks: PeakYear[] = [];

  if (FAVORABLE_LORDS.includes(antarLord)) {
    peaks.push({
      year: currentYear + 2,
      age: currentAge + 2,
      planet: antarLord,
      reason: `${antarLord} antardasha brings strong earning momentum`,
      intensity: "high",
    });
  }

  if (FAVORABLE_LORDS.includes(dashaLord)) {
    peaks.push({
      year: currentYear + 5,
      age: currentAge + 5,
      planet: dashaLord,
      reason: `${dashaLord} mahadasha reaches full maturity`,
      intensity: "very-high",
    });
  }

  const peakLord = FAVORABLE_LORDS.includes(nextDasha) ? nextDasha : "Jupiter";
  peaks.push({
    year: currentYear + 9,
    age: currentAge + 9,
    planet: peakLord,
    reason: `${peakLord} period opens a major wealth window`,
    intensity: "peak",
  });

  peaks.push({
    year: currentYear + 14,
    age: currentAge + 14,
    planet: "Venus",
    reason: "Venus alignment signals highest earning potential",
    intensity: "very-high",
  });

  return peaks.slice(0, 4);
}

const intensityColor: Record<PeakYear["intensity"], string> = {
  high: "#2FBF9F",
  "very-high": "#F2C572",
  peak: "#FFDFA3",
};

const intensityLabel: Record<PeakYear["intensity"], string> = {
  high: "Strong",
  "very-high": "Very Strong",
  peak: "Peak",
};

export default function PeakEarningYears({ scores, dasha, chart, birthYear }: Props) {
  const effectiveBirthYear = birthYear ?? new Date().getFullYear() - 30;

  const peaks = useMemo(() => {
    if (!scores) return [];
    if (chart && dasha) {
      const derived = buildPeakEarningYears(chart, scores, dasha, effectiveBirthYear);
      if (derived.length > 0) return derived;
    }
    return fallbackPeakYears(dasha, effectiveBirthYear);
  }, [scores, dasha, chart, effectiveBirthYear]);

  if (!scores || peaks.length === 0) return null;

  return (
    <div
      className="peak-earning-card rounded-2xl flex flex-col h-full"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-2">
        <div className="flex items-center gap-1.5">
          <h3
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(14px, 2.2vw, 26px)",
              color: "#F5E9FF",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.3px",
            }}
          >
            Peak Earning Years
          </h3>
          <InsightInfoTooltip explanation="Your peak earning years are identified by looking at which Mahadasha and Antardasha periods activate your income houses (10th and 11th). When benefic planets like Jupiter, Venus, or Mercury rule these periods, your earning potential peaks. The years shown are when these planetary energies are strongest in your chart." />
        </div>
      </div>

      {/* Vertical stepper */}
      <div className="px-4 sm:px-6 pb-8 sm:pb-10 flex-1">
        <div className="relative flex flex-col">
          {/* Continuous vertical line running through all nodes */}
          <motion.div
            className="absolute left-[19px] top-[20px] w-[2px]"
            style={{
              bottom: "20px",
              background: "linear-gradient(to bottom, rgba(47,191,159,0.5), rgba(242,197,114,0.5), rgba(255,223,163,0.5), rgba(242,197,114,0.3))",
            }}
            initial={{ scaleY: 0, transformOrigin: "top" }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          />

          {peaks.map((peak, i) => {
            const color = intensityColor[peak.intensity];
            const isLast = i === peaks.length - 1;

            return (
              <div key={i} className={`flex items-start gap-5 ${!isLast ? "pb-12 sm:pb-14" : ""}`}>
                {/* Left column: node on the continuous line */}
                <div className="flex flex-col items-center shrink-0 relative z-10">
                  {/* Node circle */}
                  <motion.div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    data-intensity={peak.intensity}
                    style={{
                      background: `${color}18`,
                      border: `2.5px solid ${color}70`,
                      boxShadow: `0 0 16px ${color}35, 0 0 4px ${color}20`,
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.18, type: "spring", stiffness: 200 }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      data-intensity={peak.intensity}
                      style={{ background: color, boxShadow: `0 0 10px ${color}` }}
                    />
                  </motion.div>
                </div>

                {/* Right column: year + badge + description + additional detail */}
                <div className="flex flex-col justify-center pt-1">
                  <div className="flex items-center gap-3">
                    <motion.p
                      className="font-bold"
                      style={{
                        color,
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: "clamp(22px, 2.8vw, 30px)",
                      }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.18 }}
                    >
                      {peak.year}
                    </motion.p>

                    <motion.span
                      className="text-[9px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                      style={{
                        color,
                        background: `${color}12`,
                        border: `1px solid ${color}30`,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + i * 0.18 }}
                    >
                      {intensityLabel[peak.intensity]}
                    </motion.span>
                  </div>

                  <motion.p
                    className="mt-2 text-[12px] sm:text-[13px] leading-relaxed max-w-[260px]"
                    style={{ color: "rgba(214,198,245,0.75)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.18 }}
                  >
                    {peak.reason}
                  </motion.p>

                  <motion.p
                    className="mt-1.5 text-[10px] font-medium"
                    style={{ color: `${color}90` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 + i * 0.18 }}
                  >
                    Age {peak.age} · {peak.planet} period
                  </motion.p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
