/**
 * ForeignSettlementSection — "Foreign Settlement" analysis card.
 *
 * Analyzes foreign travel & settlement potential from Vedic chart:
 * - Settlement score gauge with verdict
 * - Travel vs Settlement dual meters
 * - Best directions with country hints
 * - Key Vedic indicators (checklist style)
 * - Favorable periods timeline
 * - Income abroad potential
 * - Challenges
 */

import { motion } from "framer-motion";
import {
  Globe,
  Plane,
  MapPin,
  Compass,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import type { ForeignSettlementInsight } from "@/lib/financial-kundali-engine";

interface Props {
  data: ForeignSettlementInsight | null;
}

/* ── Verdict config ── */
const VERDICT_CONFIG = {
  Strong: {
    label: "Strong Potential",
    color: "#4FD1C5",
    bg: "rgba(47,191,159,0.10)",
    border: "rgba(47,191,159,0.22)",
    glow: "rgba(47,191,159,0.25)",
    gradient: "linear-gradient(135deg, #2FBF9F, #4FD1C5)",
  },
  Moderate: {
    label: "Moderate Potential",
    color: "#F2C572",
    bg: "rgba(242,197,114,0.10)",
    border: "rgba(242,197,114,0.22)",
    glow: "rgba(242,197,114,0.25)",
    gradient: "linear-gradient(135deg, #F2C572, #FFDFA3)",
  },
  Unlikely: {
    label: "Homeland Favored",
    color: "#C8A2FF",
    bg: "rgba(200,162,255,0.10)",
    border: "rgba(200,162,255,0.22)",
    glow: "rgba(200,162,255,0.25)",
    gradient: "linear-gradient(135deg, #C8A2FF, #E06BAA)",
  },
};

/* ── Circular gauge ── */
function ScoreGauge({ score, label, color, size = 100 }: { score: number; label: string; color: string; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (score / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={6}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference - filled }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "#A89BC8" }}>/100</span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#A89BC8" }}>
        {label}
      </span>
    </div>
  );
}

export default function ForeignSettlementSection({ data }: Props) {
  if (!data) return null;

  const vc = VERDICT_CONFIG[data.verdict];
  const presentCount = data.keyIndicators.filter(k => k.present).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(200,162,255,0.12)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* ── Header ── */}
      <div className="px-5 sm:px-7 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(200,162,255,0.12)", border: "1px solid rgba(200,162,255,0.18)" }}
          >
            <Globe className="h-4.5 w-4.5" style={{ color: "#C8A2FF" }} />
          </div>
          <h3
            className="font-bold"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(17px, 2.5vw, 22px)",
              color: "#F5E9FF",
            }}
          >
            Foreign Settlement
          </h3>
          <InsightInfoTooltip explanation="Analysis based on your 9th house (long-distance travel), 12th house (foreign lands), 4th house (homeland), Rahu/Ketu axis, and current dasha-transit influences." />
        </div>
        <p className="text-xs sm:text-sm mt-1" style={{ color: "#A89BC8" }}>
          Will your stars take you across borders?
        </p>
      </div>

      <div className="px-5 sm:px-7 pb-6 sm:pb-8 space-y-5">
        {/* ── Top Row: Gauges + Verdict ── */}
        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
          {/* Dual Gauges */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <ScoreGauge score={data.settlementScore} label="Settlement" color={vc.color} size={96} />
            </div>
            <div className="relative">
              <ScoreGauge score={data.travelScore} label="Travel" color="#E06BAA" size={96} />
            </div>
          </div>

          {/* Verdict + Summary */}
          <div className="flex-1 space-y-2.5">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                background: vc.gradient,
                boxShadow: `0 6px 24px ${vc.glow}`,
              }}
            >
              <Globe className="h-3.5 w-3.5" style={{ color: "#2A0E4A" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#2A0E4A" }}>
                {vc.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "#D6C6F5" }}>
              {data.summary}
            </p>
          </div>
        </div>

        {/* ── Key Indicators Checklist ── */}
        <div
          className="rounded-xl p-4 space-y-2.5"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
              Vedic Indicators ({presentCount}/{data.keyIndicators.length} active)
            </span>
            <Sparkles className="h-3.5 w-3.5" style={{ color: "rgba(242,197,114,0.4)" }} />
          </div>
          {data.keyIndicators.map((ki, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.3 }}
              className="flex items-start gap-2.5"
            >
              {ki.present ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#2FBF9F" }} />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "rgba(168,155,200,0.35)" }} />
              )}
              <div className="flex-1 min-w-0">
                <span
                  className="text-xs font-medium"
                  style={{ color: ki.present ? "#F5E9FF" : "#A89BC8" }}
                >
                  {ki.indicator}
                </span>
                <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: ki.present ? "#D6C6F5" : "rgba(168,155,200,0.5)" }}>
                  {ki.explanation}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Two-Column: Directions + Favorable Periods ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Best Directions */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "rgba(200,162,255,0.04)",
              border: "1px solid rgba(200,162,255,0.10)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" style={{ color: "#C8A2FF" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Best Directions
              </span>
            </div>
            {data.bestDirections.map((d, i) => (
              <div key={i} className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#C8A2FF" }} />
                <div>
                  <span className="text-xs font-medium" style={{ color: "#F5E9FF" }}>{d.direction}</span>
                  <p className="text-[11px] mt-0.5" style={{ color: "#A89BC8" }}>{d.reason}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Favorable Periods */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "rgba(47,191,159,0.04)",
              border: "1px solid rgba(47,191,159,0.10)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" style={{ color: "#2FBF9F" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Favorable Periods
              </span>
            </div>
            {data.favorablePeriods.map((fp, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                  style={{
                    background: fp.strength === "strong" ? "#2FBF9F" : "#F2C572",
                    boxShadow: `0 0 6px ${fp.strength === "strong" ? "rgba(47,191,159,0.5)" : "rgba(242,197,114,0.5)"}`,
                  }}
                />
                <div>
                  <span className="text-xs font-medium" style={{ color: "#F5E9FF" }}>{fp.period}</span>
                  <p className="text-[11px] mt-0.5" style={{ color: "#A89BC8" }}>{fp.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Row: Income Abroad + Challenges ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Income Abroad */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{
              background: "rgba(242,197,114,0.04)",
              border: "1px solid rgba(242,197,114,0.10)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" style={{ color: "#F2C572" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Income Abroad Potential
              </span>
            </div>
            {/* Mini bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${data.incomeAbroadPotential.score}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #F2C572, #FFDFA3)",
                    boxShadow: "0 0 8px rgba(242,197,114,0.4)",
                  }}
                />
              </div>
              <span className="text-xs font-bold" style={{ color: "#F2C572" }}>
                {data.incomeAbroadPotential.score}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "#D6C6F5" }}>
              <span className="font-medium" style={{ color: "#F2C572" }}>{data.incomeAbroadPotential.type}</span>
              {" — "}{data.incomeAbroadPotential.reason}
            </p>
          </div>

          {/* Challenges */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{
              background: "rgba(224,107,170,0.04)",
              border: "1px solid rgba(224,107,170,0.10)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#E06BAA" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Challenges
              </span>
            </div>
            <div className="space-y-1.5">
              {data.challenges.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div
                    className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: "rgba(224,107,170,0.5)" }}
                  />
                  <span className="text-[11px] leading-relaxed" style={{ color: "#A89BC8" }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
