/**
 * InheritanceWeaknessSection — Two premium cards at the bottom of /kundali.
 * 1. Inheritance & Legacy Wealth — 8th house analysis for inherited wealth
 * 2. Money Weakness — spending leaks, blind spots, greed/fear profile
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Crown, AlertTriangle, Eye, Flame, Shield,
  TrendingDown, Sparkles, Heart,
} from "lucide-react";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import type { ReportScores, ChartData, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";
import type { ExpenseInsight, InvestmentPersonality, WealthTimeline } from "@/lib/financial-kundali-engine";

interface Props {
  scores: ReportScores | null;
  chart: ChartData | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  expense: ExpenseInsight | null;
  investmentPersonality: InvestmentPersonality | null;
  wealthTimeline: WealthTimeline | null;
}

/* ── Vedic constants ── */
const BENEFICS = ["Jupiter", "Venus", "Mercury", "Moon"];
const WEALTH_HOUSES = [2, 11];

const HOUSE_MEANINGS: Record<number, string> = {
  1: "Self", 2: "Wealth", 3: "Courage", 4: "Property",
  5: "Speculation", 6: "Debts", 7: "Partnerships", 8: "Inheritance",
  9: "Fortune", 10: "Career", 11: "Gains", 12: "Expenses",
};

/* ── Inheritance data derivation ── */
interface InheritanceData {
  likelihood: "High" | "Moderate" | "Low";
  score: number;
  eighthLord: string;
  eighthLordHouse: number;
  reason: string;
  sources: { label: string; strength: number; planet: string; detail: string }[];
  activationPeriod: string;
  partnerWealthScore: number;
}

function deriveInheritance(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
): InheritanceData {
  const eighthHouse = chart.houses.find(h => h.house === 8);
  const eighthLordName = eighthHouse?.lord ?? "Saturn";
  const eighthLordPlanet = chart.planets.find(p => p.planet === eighthLordName);
  const eighthLordHouse = eighthLordPlanet?.house ?? 8;

  const jupiter = chart.planets.find(p => p.planet === "Jupiter");
  const venus = chart.planets.find(p => p.planet === "Venus");
  const planetsIn8th = chart.planets.filter(p => p.house === 8);

  let score = 25;
  const sources: InheritanceData["sources"] = [];

  // 8th lord in wealth houses = strong inheritance
  if (eighthLordPlanet && WEALTH_HOUSES.includes(eighthLordPlanet.house)) {
    score += 25;
    sources.push({
      label: "Family Legacy",
      strength: 85,
      planet: eighthLordName,
      detail: `8th lord ${eighthLordName} in ${HOUSE_MEANINGS[eighthLordPlanet.house]} house: direct wealth transfer likely`,
    });
  } else if (eighthLordPlanet && [1, 4, 9, 10].includes(eighthLordPlanet.house)) {
    score += 15;
    sources.push({
      label: "Family Legacy",
      strength: 60,
      planet: eighthLordName,
      detail: `8th lord in ${HOUSE_MEANINGS[eighthLordPlanet.house]} house, moderate inheritance potential`,
    });
  } else {
    sources.push({
      label: "Family Legacy",
      strength: 30,
      planet: eighthLordName,
      detail: `8th lord placement doesn't strongly indicate inheritance`,
    });
  }

  // Jupiter in 8th or aspecting 8th
  if (jupiter && jupiter.house === 8) {
    score += 20;
    sources.push({
      label: "Insurance & Windfalls",
      strength: 80,
      planet: "Jupiter",
      detail: "Jupiter in 8th house: strong gains through insurance, settlements, or unexpected sources",
    });
  } else if (jupiter && [2, 4].includes(jupiter.house)) {
    score += 10;
    sources.push({
      label: "Insurance & Windfalls",
      strength: 55,
      planet: "Jupiter",
      detail: "Jupiter supports wealth accumulation, moderate windfall potential",
    });
  } else {
    sources.push({
      label: "Insurance & Windfalls",
      strength: 25,
      planet: "Jupiter",
      detail: "No strong windfall indicators from Jupiter's placement",
    });
  }

  // 7th house lord strength = partner's wealth
  const seventhHouse = chart.houses.find(h => h.house === 7);
  const seventhLord = seventhHouse ? chart.planets.find(p => p.planet === seventhHouse.lord) : null;
  let partnerWealth = 35;
  if (seventhLord && WEALTH_HOUSES.includes(seventhLord.house)) {
    partnerWealth = 80;
    score += 15;
    sources.push({
      label: "Partner's Wealth",
      strength: 80,
      planet: seventhHouse?.lord ?? "Venus",
      detail: `7th lord in ${HOUSE_MEANINGS[seventhLord.house]} house: partner brings significant financial value`,
    });
  } else if (venus && [7, 2, 11].includes(venus.house)) {
    partnerWealth = 60;
    score += 8;
    sources.push({
      label: "Partner's Wealth",
      strength: 60,
      planet: "Venus",
      detail: "Venus placement supports financial gains through partnerships",
    });
  } else {
    sources.push({
      label: "Partner's Wealth",
      strength: 30,
      planet: "Venus",
      detail: "Partnership wealth indicators are modest",
    });
  }

  // Benefics in 8th house boost
  const beneficsIn8th = planetsIn8th.filter(p => BENEFICS.includes(p.planet));
  if (beneficsIn8th.length > 0) {
    score += beneficsIn8th.length * 8;
  }

  score = Math.max(10, Math.min(90, score));
  const likelihood: InheritanceData["likelihood"] = score >= 65 ? "High" : score >= 40 ? "Moderate" : "Low";

  // Activation period
  const dashaLord = dasha.mahadasha_lord;
  const nextDasha = dasha.next_mahadasha ?? "Saturn";
  const activationPeriod = eighthLordName === dashaLord
    ? "Currently active: inheritance window is open now"
    : BENEFICS.includes(dashaLord)
      ? `During ${eighthLordName} dasha/antardasha activation`
      : `Best during ${eighthLordName} or Jupiter period`;

  const reason = likelihood === "High"
    ? `Your 8th lord ${eighthLordName} in the ${HOUSE_MEANINGS[eighthLordHouse]} house creates a strong Dhana Yoga for inherited wealth.`
    : likelihood === "Moderate"
      ? `Some inheritance indicators exist through ${eighthLordName}'s placement, but they need dasha activation to manifest.`
      : `Your chart suggests wealth through personal effort rather than inheritance. Focus on building your own legacy.`;

  return {
    likelihood, score, eighthLord: eighthLordName, eighthLordHouse,
    reason, sources, activationPeriod, partnerWealthScore: partnerWealth,
  };
}

/* ── Money Weakness data derivation ── */
interface WeaknessData {
  overallScore: number; // higher = more vulnerable
  leakCategory: string;
  leakPattern: string;
  blindSpots: { label: string; severity: "high" | "medium" | "low"; icon: string; detail: string }[];
  greedScore: number;
  fearScore: number;
  greedFearInsight: string;
  savingsGap: number; // income vs savings gap
  topWeakness: string;
  remedyHint: string;
}

function deriveWeakness(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  expense: ExpenseInsight | null,
  investmentPersonality: InvestmentPersonality | null,
): WeaknessData {
  const planetsIn12th = chart.planets.filter(p => p.house === 12);
  const planetsIn6th = chart.planets.filter(p => p.house === 6);
  const twelfthHouse = chart.houses.find(h => h.house === 12);
  const twelfthLord = twelfthHouse ? chart.planets.find(p => p.planet === twelfthHouse.lord) : null;
  const rahu = chart.planets.find(p => p.planet === "Rahu");
  const mars = chart.planets.find(p => p.planet === "Mars");
  const venus = chart.planets.find(p => p.planet === "Venus");
  const moon = chart.planets.find(p => p.planet === "Moon");

  // Overall vulnerability score
  let vulnScore = 20;
  vulnScore += (scores.expense_score / 100) * 25;
  vulnScore += ((100 - scores.savings_score) / 100) * 20;
  vulnScore += (scores.risk_score / 100) * 15;
  vulnScore += planetsIn12th.length * 5;
  vulnScore += planetsIn6th.length * 3;
  if (twelfthLord && [1, 2].includes(twelfthLord.house)) vulnScore += 10;
  vulnScore = Math.max(15, Math.min(85, Math.round(vulnScore)));

  // Blind spots from planetary placements
  const blindSpots: WeaknessData["blindSpots"] = [];

  if (venus && [12, 6, 8].includes(venus.house)) {
    blindSpots.push({
      label: "Luxury Trap",
      severity: "high",
      icon: "💎",
      detail: `Venus in ${HOUSE_MEANINGS[venus.house]} house: you overspend on comfort, aesthetics, and lifestyle upgrades without realizing the cumulative cost.`,
    });
  }

  if (rahu && [2, 11, 5].includes(rahu.house)) {
    blindSpots.push({
      label: "Get-Rich-Quick Temptation",
      severity: rahu.house === 5 ? "high" : "medium",
      icon: "🎰",
      detail: `Rahu in ${HOUSE_MEANINGS[rahu.house]} house: you're drawn to shortcuts, speculative schemes, and "too good to be true" opportunities.`,
    });
  }

  if (mars && [2, 12].includes(mars.house)) {
    blindSpots.push({
      label: "Impulse Spending",
      severity: "medium",
      icon: "⚡",
      detail: `Mars in ${HOUSE_MEANINGS[mars.house]} house: anger, competition, or excitement triggers unplanned purchases.`,
    });
  }

  if (moon && [6, 8, 12].includes(moon.house)) {
    blindSpots.push({
      label: "Emotional Money Decisions",
      severity: "medium",
      icon: "🌙",
      detail: `Moon in ${HOUSE_MEANINGS[moon.house]} house: your financial decisions are heavily influenced by mood. You spend to cope with stress.`,
    });
  }

  if (scores.income_score >= 60 && scores.savings_score < 45) {
    blindSpots.push({
      label: "Earn Well, Save Poorly",
      severity: "high",
      icon: "🕳️",
      detail: "Your income is strong but savings are weak: money flows out as fast as it comes in. The gap is your biggest vulnerability.",
    });
  }

  if (scores.risk_score >= 65) {
    blindSpots.push({
      label: "Over-Leveraging Risk",
      severity: "medium",
      icon: "📉",
      detail: "High risk appetite without matching discipline. During Rahu or Mars periods, you may take on more risk than your portfolio can handle.",
    });
  }

  // Ensure at least 2 blind spots
  if (blindSpots.length < 2) {
    if (!blindSpots.some(b => b.label.includes("Lifestyle"))) {
      blindSpots.push({
        label: "Gradual Lifestyle Inflation",
        severity: "low",
        icon: "📊",
        detail: "No dramatic weakness, but small lifestyle upgrades compound over time. Review subscriptions and recurring expenses quarterly.",
      });
    }
    if (blindSpots.length < 2) {
      blindSpots.push({
        label: "Complacency During Good Times",
        severity: "low",
        icon: "😌",
        detail: "During favorable dasha periods, you may relax financial discipline. The best time to save aggressively is when things are going well.",
      });
    }
  }

  const greedScore = investmentPersonality?.greedFearProfile.greedScore ?? Math.min(80, Math.round(scores.risk_score * 0.5 + scores.investment_score * 0.3));
  const fearScore = investmentPersonality?.greedFearProfile.fearScore ?? Math.min(80, Math.round(scores.expense_score * 0.4 + (100 - scores.timing_score) * 0.3));
  const greedFearInsight = investmentPersonality?.greedFearProfile.insight
    ?? (greedScore > fearScore
      ? "Greed dominates your financial psychology: you chase gains more than you protect capital."
      : "Fear drives your money decisions: you may exit winning positions too early or avoid necessary risks.");

  const savingsGap = Math.max(0, scores.income_score - scores.savings_score);
  const leakCategory = expense?.leakCategory ?? "General";
  const leakPattern = expense?.spendingLeakPattern ?? "Monitor spending patterns during Venus and Moon sub-periods.";

  const topWeakness = blindSpots.length > 0 ? blindSpots[0].label : "No critical weakness detected";
  const remedyHint = vulnScore >= 60
    ? "Automate savings before spending. Set up a separate account that you don't touch: your chart shows money leaves fast if accessible."
    : vulnScore >= 40
      ? "Your weaknesses are manageable. Focus on awareness during challenging dasha periods and avoid financial decisions when emotionally charged."
      : "Your financial discipline is naturally strong. Just watch for complacency during prosperous periods.";

  return {
    overallScore: vulnScore, leakCategory, leakPattern,
    blindSpots: blindSpots.slice(0, 4), greedScore, fearScore,
    greedFearInsight, savingsGap, topWeakness, remedyHint,
  };
}

/* ── Shared mini-components ── */

function LikelihoodBadge({ level }: { level: "High" | "Moderate" | "Low" }) {
  const colors = {
    High: { bg: "rgba(47,191,159,0.10)", text: "#4FD1C5", border: "rgba(47,191,159,0.22)" },
    Moderate: { bg: "rgba(242,197,114,0.10)", text: "#F2C572", border: "rgba(242,197,114,0.22)" },
    Low: { bg: "rgba(168,155,200,0.10)", text: "#A89BC8", border: "rgba(168,155,200,0.22)" },
  };
  const c = colors[level];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full"
      style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {level}
    </span>
  );
}

function MiniGauge({ value, color, size = 44 }: { value: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (value / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center", filter: `drop-shadow(0 0 4px ${color}50)` }}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${filled} ${circ}` }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill="#F5E9FF" fontSize={size * 0.28} fontWeight={700}>
        {value}
      </text>
    </svg>
  );
}

function StrengthBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] w-[90px] shrink-0 truncate" style={{ color: "rgba(168,155,200,0.6)" }}>{label}</span>
      <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-semibold w-6 text-right" style={{ color: "rgba(214,198,245,0.6)" }}>{value}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── Inheritance Card ──
   ════════════════════════════════════════════════════════ */

function InheritanceCard({ chart, scores, dasha }: {
  chart: ChartData; scores: ReportScores; dasha: DashaInfo;
}) {
  const data = useMemo(() => deriveInheritance(chart, scores, dasha), [chart, scores, dasha]);

  const likelihoodColor = data.likelihood === "High" ? "#4FD1C5"
    : data.likelihood === "Moderate" ? "#F2C572" : "#A89BC8";

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(242,197,114,0.12), rgba(255,223,163,0.08))",
                border: "1px solid rgba(242,197,114,0.20)",
              }}
            >
              <Crown className="h-4 w-4" style={{ color: "#F2C572" }} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "clamp(16px, 2vw, 22px)",
                  color: "#F5E9FF",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.3px",
                }}
              >
                Inheritance & Legacy
              </h3>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(168,155,200,0.5)" }}>
                8th house wealth · Partner's assets · Windfalls
              </p>
            </div>
          </div>
          <InsightInfoTooltip explanation="Inheritance potential is derived from your 8th house lord's placement (house of other people's money), Jupiter's connection to wealth houses, and 7th lord strength for partner's wealth. Activation depends on when these lords' dasha periods run." />
        </div>
      </div>

      {/* Score + Likelihood */}
      <div className="px-5 sm:px-6 pb-4 flex items-center gap-5">
        <MiniGauge value={data.score} color={likelihoodColor} size={56} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <LikelihoodBadge level={data.likelihood} />
            <span className="text-[10px]" style={{ color: "rgba(168,155,200,0.45)" }}>likelihood</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(214,198,245,0.55)" }}>
            {data.reason}
          </p>
        </div>
      </div>

      {/* Sources breakdown */}
      <div className="px-5 sm:px-6 pb-4 flex flex-col gap-2.5">
        {data.sources.map((src) => (
          <div key={src.label} className="flex flex-col gap-1">
            <StrengthBar value={src.strength} color={likelihoodColor} label={src.label} />
            <p className="text-[9px] pl-[102px] leading-relaxed" style={{ color: "rgba(168,155,200,0.4)" }}>
              {src.detail}
            </p>
          </div>
        ))}
      </div>

      {/* Activation period + Partner wealth */}
      <div
        className="mt-auto px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3"
        style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3 w-3 shrink-0" style={{ color: "#F2C572" }} />
          <span className="text-[10px] truncate" style={{ color: "rgba(214,198,245,0.55)" }}>
            {data.activationPeriod}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Heart className="h-3 w-3" style={{ color: "#E06BAA" }} />
          <span className="text-[10px] font-medium" style={{ color: "rgba(214,198,245,0.55)" }}>
            Partner: <span style={{ color: data.partnerWealthScore >= 60 ? "#4FD1C5" : "#A89BC8" }}>
              {data.partnerWealthScore}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── Money Weakness Card ──
   ════════════════════════════════════════════════════════ */

function MoneyWeaknessCard({ chart, scores, dasha, expense, investmentPersonality }: {
  chart: ChartData; scores: ReportScores; dasha: DashaInfo;
  expense: ExpenseInsight | null; investmentPersonality: InvestmentPersonality | null;
}) {
  const data = useMemo(
    () => deriveWeakness(chart, scores, dasha, expense, investmentPersonality),
    [chart, scores, dasha, expense, investmentPersonality],
  );

  const severityColors = {
    high: { bg: "rgba(224,107,170,0.10)", text: "#E06BAA", border: "rgba(224,107,170,0.20)" },
    medium: { bg: "rgba(242,197,114,0.10)", text: "#F2C572", border: "rgba(242,197,114,0.20)" },
    low: { bg: "rgba(168,155,200,0.08)", text: "#A89BC8", border: "rgba(168,155,200,0.15)" },
  };

  const vulnColor = data.overallScore >= 60 ? "#E06BAA" : data.overallScore >= 40 ? "#F2C572" : "#4FD1C5";
  const vulnLabel = data.overallScore >= 60 ? "Vulnerable" : data.overallScore >= 40 ? "Moderate" : "Resilient";

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(224,107,170,0.15)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(224,107,170,0.06), inset 0 0 0 1px rgba(224,107,170,0.04)",
      }}
    >
      {/* Header */}
      <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(224,107,170,0.12), rgba(200,162,255,0.08))",
                border: "1px solid rgba(224,107,170,0.20)",
              }}
            >
              <Eye className="h-4 w-4" style={{ color: "#E06BAA" }} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "clamp(16px, 2vw, 22px)",
                  color: "#F5E9FF",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.3px",
                }}
              >
                Money Weakness
              </h3>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(168,155,200,0.5)" }}>
                Blind spots · Spending leaks · Greed vs Fear
              </p>
            </div>
          </div>
          <InsightInfoTooltip explanation="Money weakness is analyzed from your 12th house (expenses/losses), 6th house (debts), Venus placement (luxury spending), Rahu (speculation traps), and the gap between your income and savings scores. The greed/fear profile comes from Mars, Rahu, and Saturn placements." />
        </div>
      </div>

      {/* Vulnerability score + label */}
      <div className="px-5 sm:px-6 pb-4 flex items-center gap-5">
        <MiniGauge value={data.overallScore} color={vulnColor} size={56} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full"
              style={{
                color: vulnColor,
                background: `${vulnColor}15`,
                border: `1px solid ${vulnColor}30`,
              }}
            >
              {vulnLabel}
            </span>
            <span className="text-[10px]" style={{ color: "rgba(168,155,200,0.45)" }}>
              {data.leakCategory} leak
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(214,198,245,0.55)" }}>
            {data.leakPattern.length > 120 ? data.leakPattern.slice(0, 120) + "…" : data.leakPattern}
          </p>
        </div>
      </div>

      {/* Blind spots */}
      <div className="px-5 sm:px-6 pb-4 flex flex-col gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(168,155,200,0.4)" }}>
          Your Blind Spots
        </span>
        {data.blindSpots.map((spot) => {
          const sc = severityColors[spot.severity];
          return (
            <motion.div
              key={spot.label}
              className="rounded-lg px-3 py-2.5 flex items-start gap-2.5"
              style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-sm shrink-0 mt-0.5">{spot.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold" style={{ color: sc.text }}>{spot.label}</span>
                  <span className="text-[8px] uppercase tracking-wider" style={{ color: `${sc.text}80` }}>
                    {spot.severity}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(214,198,245,0.45)" }}>
                  {spot.detail}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Greed vs Fear bar */}
      <div className="px-5 sm:px-6 pb-4">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] block mb-2" style={{ color: "rgba(168,155,200,0.4)" }}>
          Greed vs Fear Profile
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <Flame className="h-3 w-3" style={{ color: "#E06BAA" }} />
            <span className="text-[10px] font-medium" style={{ color: "#E06BAA" }}>{data.greedScore}</span>
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #E06BAA, #C8A2FF)" }}
              initial={{ width: 0 }}
              animate={{ width: `${data.greedScore}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <motion.div
              className="absolute right-0 top-0 h-full rounded-full"
              style={{ background: "linear-gradient(270deg, #2FBF9F, #4FD1C5)" }}
              initial={{ width: 0 }}
              animate={{ width: `${data.fearScore}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-medium" style={{ color: "#4FD1C5" }}>{data.fearScore}</span>
            <Shield className="h-3 w-3" style={{ color: "#4FD1C5" }} />
          </div>
        </div>
        <p className="text-[9px] mt-1.5 leading-relaxed" style={{ color: "rgba(168,155,200,0.4)" }}>
          {data.greedFearInsight}
        </p>
      </div>

      {/* Remedy hint footer */}
      <div
        className="mt-auto px-5 sm:px-6 py-3.5"
        style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-start gap-2">
          <TrendingDown className="h-3 w-3 shrink-0 mt-0.5" style={{ color: "#F2C572" }} />
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(214,198,245,0.5)" }}>
            {data.remedyHint}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── Main Export ──
   ════════════════════════════════════════════════════════ */

export default function InheritanceWeaknessSection({
  scores, chart, dasha, transits, expense, investmentPersonality, wealthTimeline,
}: Props) {
  if (!scores || !chart || !dasha) return null;

  return (
    <div className="mt-0">
      {/* Section header */}
      <div className="mb-6 sm:mb-8 md:mb-10">
        {/* Animated divider with centered label */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full">
            {/* Left shiny line */}
            <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.25) 40%, rgba(255,223,163,0.6) 100%)",
                }}
              />
              <div
                className="absolute inset-y-0 w-full"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dividerShimmer 4s ease-in-out infinite",
                }}
              />
              <div
                className="absolute -inset-y-[2px] w-full pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.15) 40%, rgba(255,223,163,0.4) 100%)",
                  filter: "blur(4px)",
                }}
              />
            </div>

            {/* Center label */}
            <span
              className="shrink-0 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-[0.06em]"
              style={{
                color: "#D6C6F5",
                fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                fontStyle: "italic",
                textShadow: "0 0 12px rgba(200,162,255,0.3)",
                paddingBottom: "0.15em",
                paddingTop: "0.05em",
                display: "inline-block",
              }}
            >
              Legacy & Awareness
            </span>

            {/* Right shiny line */}
            <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, rgba(255,223,163,0.6) 0%, rgba(242,197,114,0.25) 60%, transparent 100%)",
                }}
              />
              <div
                className="absolute inset-y-0 w-full"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dividerShimmerReverse 7s ease-in-out infinite",
                }}
              />
              <div
                className="absolute -inset-y-[2px] w-full pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, rgba(255,223,163,0.4) 0%, rgba(242,197,114,0.15) 60%, transparent 100%)",
                  filter: "blur(4px)",
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm" style={{ color: "rgba(168,155,200,0.55)" }}>
          Inheritance potential and your financial blind spots
        </p>
      </div>

      {/* Two-column card grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <InheritanceCard chart={chart} scores={scores} dasha={dasha} />
        <MoneyWeaknessCard
          chart={chart} scores={scores} dasha={dasha}
          expense={expense} investmentPersonality={investmentPersonality}
        />
      </div>
    </div>
  );
}
