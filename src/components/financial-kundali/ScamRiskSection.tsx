/**
 * ScamRiskSection — "Is Your Money At Risk?" 3-panel card.
 * Panel 1: Scam Warning (left)
 * Panel 2: Dasha Risk Meter gauge (center)
 * Panel 3: Loan, EMI & Debt Trap Risk (right)
 *
 * Redesigned with premium visual treatment matching the design system.
 */

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import { useKundaliTheme } from "@/lib/kundali-theme-context";
import type { ReportScores, ChartData, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";
import type { LoanInsight } from "@/lib/financial-kundali-engine";

interface Props {
  scores: ReportScores | null;
  chart: ChartData | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  loan: LoanInsight | null;
}

const BENEFICS = ["Jupiter", "Venus", "Mercury", "Moon"];

function deriveRiskScore(scores: ReportScores): number {
  return Math.round(
    scores.risk_score * 0.35 +
    scores.expense_score * 0.2 +
    (100 - scores.savings_score) * 0.2 +
    (100 - scores.timing_score) * 0.15 +
    (100 - scores.natal_wealth_score) * 0.1
  );
}

export default function ScamRiskSection({ scores, chart, dasha, transits, loan }: Props) {
  if (!scores) return null;

  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";

  /* ── Scam Warning ── */
  let scamLevel: "Low" | "Moderate" | "High" = "Low";
  let scamContext = "No major risk indicators";
  let scamDetail = "Your chart shows no significant vulnerability to financial deception at this time.";

  if (chart && dasha) {
    const rahu = chart.planets.find(p => p.planet === "Rahu");
    const isRahuDasha = dasha.mahadasha_lord === "Rahu" || dasha.antardasha_lord === "Rahu";
    if (isRahuDasha) {
      scamLevel = "High";
      scamContext = `Active ${dasha.antardasha_lord === "Rahu" ? "Rahu Antardasha" : "Rahu Mahadasha"}`;
      scamDetail = "Rahu's influence is strong right now: exercise extra caution with unfamiliar financial offers and verify all investment opportunities thoroughly.";
    } else if (rahu && [2, 7, 8, 11].includes(rahu.house)) {
      scamLevel = "Moderate";
      scamContext = `Rahu in ${rahu.house}th House`;
      scamDetail = "Rahu's placement in a financial house creates some vulnerability to deceptive schemes. Stay vigilant with partnerships and joint ventures.";
    } else {
      scamLevel = "Low";
      scamContext = "Rahu well-placed";
      scamDetail = "Minimal fraud exposure: Rahu's position doesn't amplify financial deception risk in your chart.";
    }
  }

  const scamColorMap = {
    Low: { bg: "rgba(47,191,159,0.10)", text: "#4FD1C5", border: "rgba(47,191,159,0.22)", glow: "rgba(47,191,159,0.15)", icon: ShieldCheck },
    Moderate: { bg: "rgba(242,197,114,0.10)", text: "#F2C572", border: "rgba(242,197,114,0.22)", glow: "rgba(242,197,114,0.15)", icon: Shield },
    High: { bg: "rgba(224,107,170,0.10)", text: "#E06BAA", border: "rgba(224,107,170,0.22)", glow: "rgba(224,107,170,0.15)", icon: ShieldAlert },
  };
  const sc = scamColorMap[scamLevel];
  const ScamIcon = sc.icon;

  /* ── Debt Trap ── */
  const debtLevel = loan?.debtTrapRisk.level ?? "low";
  const debtReason = loan?.debtTrapRisk.reason ?? "Current planetary alignment suggests manageable debt exposure.";
  const debtDisplay = debtLevel.charAt(0).toUpperCase() + debtLevel.slice(1);
  const debtColorMap: Record<string, { text: string; icon: string; bg: string; border: string }> = {
    low: { text: "#4FD1C5", icon: "#2FBF9F", bg: "rgba(47,191,159,0.10)", border: "rgba(47,191,159,0.22)" },
    moderate: { text: "#F2C572", icon: "#F2C572", bg: "rgba(242,197,114,0.10)", border: "rgba(242,197,114,0.22)" },
    high: { text: "#E06BAA", icon: "#E06BAA", bg: "rgba(224,107,170,0.10)", border: "rgba(224,107,170,0.22)" },
  };
  const dc = debtColorMap[debtLevel] ?? debtColorMap.low;

  /* ── Dasha Risk Meter ── */
  const riskScore = deriveRiskScore(scores);
  const radius = 48;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const filledLength = arcLength * (riskScore / 100);
  const gaugeColor = riskScore > 65 ? "#E06BAA" : riskScore > 40 ? "#F2C572" : "#2FBF9F";
  const riskLabel = riskScore >= 65 ? "High Risk" : riskScore >= 45 ? "Careful about Finance" : "Low Risk";

  const isFavorableDasha = dasha && BENEFICS.includes(dasha.mahadasha_lord);
  const dashaLabel = isFavorableDasha ? "Favorable Dasha" : "Challenging Dasha";
  const dashaColor = isFavorableDasha ? "#4FD1C5" : "#f87171";
  const hasRetro = transits?.some(t => t.retrograde && ["Saturn", "Jupiter", "Mars"].includes(t.planet));
  const retroLabel = hasRetro ? "Retrograde Active" : "No Retrograde";
  const retroColor = hasRetro ? "#fbbf24" : "rgba(214,198,245,0.5)";

  /* ── Safe EMI sub-card ── */
  const emiPercent = Math.round(10 + (riskScore / 100) * 22);

  return (
    <div
      // `scam-risk-card` is a styling hook only — no colours are attached to
      // it. index.css uses it to reserve space under the 3-panel grid for the
      // feedback thumbs, in both themes (AF-085).
      className="scam-risk-card rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* 3-panel grid */}
      <div className={`grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${isVedic ? "divide-[rgba(154,120,30,0.35)]" : "divide-white/[0.06]"}`}>

        {/* ── Panel 1: Scam Warning ── */}
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="flex items-center gap-1.5">
              <h4
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "clamp(14px, 2.2vw, 26px)",
                  color: "#F5E9FF",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.4px",
                }}
              >
                Scam Warning
              </h4>
              <InsightInfoTooltip explanation="Scam vulnerability is assessed from Rahu's house placement. Rahu in money houses (2nd, 7th, 11th) or active Rahu Dasha increases deception risk." />
            </div>
          </div>

          {/* Shield icon + level badge — visual centerpiece */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <motion.div
              className="relative h-14 w-14 rounded-xl flex items-center justify-center shrink-0 scam-status-icon"
              style={{
                background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                border: "1px solid rgba(242,197,114,0.4)",
                boxShadow: "0 0 20px rgba(242,197,114,0.3)",
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <ScamIcon className="h-6 w-6" strokeWidth={1.8} style={{ color: "#2A0E4A" }} />
              {/* Subtle pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{ border: `1px solid ${sc.border}` }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            <div className="flex flex-col items-center gap-0.5">
              <motion.span
                className="text-xl font-bold uppercase tracking-wide vedic-dark-island"
                style={{ color: sc.text }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {scamLevel}
              </motion.span>
              <span
                className="text-[10px] uppercase tracking-[0.1em] font-medium"
                style={{ color: "rgba(168,155,200,0.55)" }}
              >
                {scamContext}
              </span>
            </div>
          </div>

          {/* Description */}
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "rgba(214,198,245,0.5)" }}
          >
            {scamDetail}
          </p>
        </div>

        {/* ── Panel 2: Dasha Risk Meter ── */}
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 mb-4">
            <h4
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "clamp(14px, 2.2vw, 26px)",
                color: "#F5E9FF",
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.4px",
              }}
            >
              Dasha Risk Meter
            </h4>
            <InsightInfoTooltip explanation="The Dasha Risk Meter scores your current Mahadasha and Antardasha lords for financial risk. Malefic lords raise the score; benefic lords lower it." />
          </div>

          {/* Gauge */}
          <div className="relative w-[130px] h-[130px] mb-3">
            <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(135deg)" }}>
              {/* Track */}
              <circle cx="60" cy="60" r={radius} fill="none"
                stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeLinecap="round" />
              {/* Progress */}
              <motion.circle cx="60" cy="60" r={radius} fill="none"
                stroke={gaugeColor} strokeWidth={stroke}
                strokeDasharray={`${filledLength} ${circumference}`}
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${filledLength} ${circumference}` }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                style={{ filter: `drop-shadow(0 0 8px ${gaugeColor}60)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span className="text-3xl font-bold" style={{ color: "#F5E9FF" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                {riskScore}
              </motion.span>
              <span className="text-[10px]" style={{ color: "rgba(168,155,200,0.45)" }}>/ 100</span>
            </div>
          </div>

          <p className="text-sm font-semibold mb-3" style={{ color: "rgba(214,198,245,0.85)" }}>
            {riskLabel}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-medium"
              style={{ background: `${dashaColor}15`, border: `1px solid ${dashaColor}30`, color: dashaColor }}>
              {dashaLabel}
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-medium"
              style={{ background: `${retroColor}10`, border: `1px solid ${retroColor}25`, color: retroColor }}>
              {retroLabel}
            </span>
          </div>
        </div>

        {/* ── Panel 3: Loan, EMI & Debt Trap Risk ── */}
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <h4
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "clamp(14px, 2.2vw, 26px)",
                color: "#F5E9FF",
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.4px",
              }}
            >
              Loan, EMI, Debt Trap
            </h4>
            <InsightInfoTooltip explanation="Debt trap risk is calculated from your 6th house (debts), Saturn's transit position, and the ratio of your expense score to savings score." />
          </div>

          {/* Level badge + icon */}
          <div className="flex items-center gap-3">
            <motion.div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 scam-status-icon"
              style={{
                background: dc.bg,
                border: `1px solid ${dc.border}`,
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {debtLevel === "low"
                ? <CheckCircle className="h-4.5 w-4.5" strokeWidth={1.8} style={{ color: dc.icon }} />
                : <AlertTriangle className="h-4.5 w-4.5" strokeWidth={1.8} style={{ color: dc.icon }} />
              }
            </motion.div>
            <div className="flex flex-col">
              <motion.span
                className="text-sm font-bold uppercase tracking-[0.06em] vedic-dark-island"
                style={{ color: dc.text }}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                {debtDisplay} Risk
              </motion.span>
              <span className="text-[10px]" style={{ color: "rgba(168,155,200,0.45)" }}>
                Debt trap exposure
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(214,198,245,0.5)" }}>
            {debtReason}
          </p>

          {/* Safe EMI sub-card */}
          <div
            className="rounded-xl p-3 mt-1"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "rgba(168,155,200,0.5)" }}>
                Safe EMI Limit
              </span>
              <span className="text-sm font-bold" style={{ color: "#F2C572" }}>{emiPercent}%</span>
            </div>
            {/* Mini progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full emi-bar-fill"
                style={{
                  background: "linear-gradient(90deg, #F2C572, #FFDFA3)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (emiPercent / 35) * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
              />
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(168,155,200,0.45)" }}>
              {debtLevel === "low"
                ? "Keep EMI commitments within this range for financial safety during the current planetary period."
                : "Consider delaying major debt commitments until a more favorable planetary period."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
