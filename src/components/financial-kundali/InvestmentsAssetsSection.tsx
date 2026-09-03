/**
 * InvestmentsAssetsSection — "Investments & Assets" section for /kundali.
 *
 * Every sub-card here is now personalised from the user's D1 chart
 * (house lords, planet placements, dignities, nakshatras) + live dasha
 * + transits. Backend calls are optional enrichment — the chart-driven
 * compute is always the source of truth so two different charts always
 * produce visibly different outputs.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, Calendar, Rocket, Home, Car, Gem,
  CreditCard, Star,
} from "lucide-react";

// Investment option images
import propertyImg from "@/assets/investement-options/property.webp";
import carImg from "@/assets/investement-options/car.webp";
import goldImg from "@/assets/investement-options/gold.webp";
import loanImg from "@/assets/investement-options/loan.webp";
import type { ChartData, ReportScores, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";
import type { InvestmentPersonality } from "@/lib/financial-kundali-engine";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import { CardFeedbackWrapper } from "@/components/financial-kundali/CardFeedback";
import { generateLuxuryAnalysis, generateInvestmentBaskets } from "@/lib/vedicfinance-api";
import { useKundaliTheme } from "@/lib/kundali-theme-context";
import type {
  LuxuryAnalysisResponse, AssetAnalysis, AssetType,
  InvestmentBasketResponse, BasketType, ReportRequest,
} from "@/lib/vedicfinance-types";
import {
  buildMonthlyPurposeScores,
  chartSeed,
  makeRng,
  computeLuxuryFromChart,
  computeBasketsFromChart,
} from "@/lib/chart-personalization";


interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
  investment: InvestmentPersonality | null;
}

/* ════════════════════════════════════════════════════════
   ── BestBusinessStartCard ──
   Personalised from 10th/7th/3rd/11th house lord strengths
   + transit drift + Mahadasha/Antardasha.
   ════════════════════════════════════════════════════════ */

function BestBusinessStartCard({
  scores,
  dasha,
  transits,
  chart,
}: {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
}) {
  const data = useMemo(() => {
    if (!scores || !dasha || !transits || !chart) return null;

    const months = buildMonthlyPurposeScores(chart, dasha, transits, scores, "business");
    const best = [...months].sort((a, b) => b.score - a.score)[0];

    // Pick a day-of-month deterministically from the chart fingerprint — different charts → different dates
    const rng = makeRng(chartSeed(chart) + 11);
    const day = 3 + Math.floor(rng() * 25);
    const launchDate = new Date(best.year, best.monthIdx, day);

    return { best, launchDate, reason: best.driver };
  }, [scores, dasha, transits, chart]);

  if (!data) return null;

  const dateLabel = data.launchDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="business-start-card rounded-2xl p-5 sm:p-6 h-full flex flex-col justify-center"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(242,197,114,0.10)", border: "1px solid rgba(242,197,114,0.20)" }}
        >
          <Rocket className="h-4 w-4" style={{ color: "#F2C572" }} />
        </div>
        <h4
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "clamp(14px, 2.2vw, 26px)",
            color: "#F5E9FF",
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.3px",
          }}
        >
          Best Time to Start / Grow Business
        </h4>
        <InsightInfoTooltip explanation="Computed from your 10th (career), 7th (partnerships), 3rd (initiative) and 11th (gains) house lord strengths, with monthly modulation from which transit planets drift through those houses. The day-of-month is seeded from your chart fingerprint, so different users see different dates." />
      </div>

      <p
        className="text-2xl md:text-3xl font-bold best-business-date"
        style={{ color: "#F2C572", fontFamily: "'Poppins', sans-serif" }}
      >
        {dateLabel}
      </p>

      <span
        className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full w-fit"
        style={{
          color: "#2FBF9F",
          background: "rgba(47,191,159,0.08)",
          border: "1px solid rgba(47,191,159,0.20)",
        }}
      >
        {data.best.score}% favorable
      </span>

      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "rgba(168,155,200,0.6)" }}>
        {data.reason}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── InvestmentTimingCard ──
   Now renders 12 personalised monthly bars (not a static 5-bar ramp).
   ════════════════════════════════════════════════════════ */

function InvestmentTimingCard({
  investment,
  scores,
  dasha,
  transits,
  chart,
}: {
  investment: InvestmentPersonality | null;
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
}) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";

  // Active bar index for tap/hover tooltip (null = none)
  const [activeBarIdx, setActiveBarIdx] = useState<number | null>(null);
  const lastPointerTypeRef = useRef<string>("mouse");

  const monthly = useMemo(() => {
    if (!scores || !dasha || !transits || !chart) return null;
    return buildMonthlyPurposeScores(chart, dasha, transits, scores, "invest");
  }, [scores, dasha, transits, chart]);

  const topMonths = useMemo(() => {
    if (!monthly) return [];
    return [...monthly].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [monthly]);

  const sentiment = investment
    ? investment.type === "Aggressive"
      ? "Bullish"
      : investment.type === "Balanced"
      ? "Moderate"
      : "Conservative"
    : "—";
  const sipVerdict = investment?.sipVsLumpSum.verdict ?? "SIP";
  const sipReason = investment?.sipVsLumpSum.reason ?? "";

  const bestMonthLabels = topMonths.length
    ? topMonths.map((m) => `${m.short} '${String(m.year).slice(2)}`)
    : investment?.bestEntryMonths ?? [];
  const topDriver = topMonths[0]?.driver ?? "";

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Card title */}
      <div className="flex items-center gap-1">
        <span
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "clamp(14px, 2.2vw, 26px)",
            color: "#F5E9FF",
            fontWeight: 700,
            letterSpacing: "-0.3px",
          }}
        >
          Best Months To Invest
        </span>
        <InsightInfoTooltip explanation="The 12 monthly bars are computed from your chart: the strength of your 5th (speculation), 9th (fortune), 2nd (wealth) and 11th (gains) house lords, plus where Jupiter/Saturn/Mercury will actually transit each month relative to those houses. Different charts, different month ranking." />
      </div>

      <div className="flex flex-col md:flex-row gap-5 md:gap-0">
        {/* Left: 12 monthly bars + Sentiment */}
        <div className="flex-1 flex flex-col pl-1 sm:pl-2">
          <div className="flex items-end gap-[3px] h-[120px] mt-2 mb-1 overflow-x-auto overflow-y-visible"
            onClick={(e) => {
              // Dismiss tooltip when tapping on the container background (not a bar)
              if ((e.target as HTMLElement).closest("[data-bar]") === null) {
                setActiveBarIdx(null);
              }
            }}
          >
            {(monthly ?? []).map((m, idx) => {
              const isTop = topMonths.some(
                (t) => t.monthIdx === m.monthIdx && t.year === m.year,
              );
              const h = Math.max(8, m.score);
              const isActive = activeBarIdx === idx;
              return (
                <div
                  key={`${m.year}-${m.monthIdx}`}
                  data-bar
                  className="rounded-t-sm relative shrink-0"
                  onPointerDown={(e) => { lastPointerTypeRef.current = e.pointerType; }}
                  onMouseEnter={() => {
                    if (lastPointerTypeRef.current === "mouse") setActiveBarIdx(idx);
                  }}
                  onMouseLeave={() => {
                    if (lastPointerTypeRef.current === "mouse") setActiveBarIdx(null);
                  }}
                  onClick={() => {
                    // Touch tap: toggle; mouse click: ignore (hover handles it)
                    if (lastPointerTypeRef.current !== "mouse") {
                      setActiveBarIdx(isActive ? null : idx);
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    width: "14px",
                    height: `${h}%`,
                    background: isTop
                      ? isVedic
                        ? "linear-gradient(180deg, #D4A012 0%, #8B6914 100%)"
                        : "linear-gradient(180deg, #F2C572 0%, #A14EBF 100%)"
                      : isVedic
                        ? "linear-gradient(180deg, #A14EBF 0%, #7B2FA0 50%, #5C2080 100%)"
                        : "linear-gradient(180deg, #A14EBF 0%, #7B2FA0 50%, #4B1D73 100%)",
                    boxShadow: isTop
                      ? isVedic
                        ? "0 0 8px rgba(184,134,11,0.5), 0 -2px 6px rgba(212,160,18,0.4)"
                        : "0 0 10px rgba(242,197,114,0.4)"
                      : "none",
                    border: isTop && isVedic ? "1px solid rgba(184,134,11,0.6)" : "none",
                  }}
                >
                  {isTop && (
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full phase-dot"
                      style={{
                        background: isVedic ? "#D4A012" : "#fff",
                        boxShadow: isVedic
                          ? "0 0 6px 2px rgba(212,160,18,0.7)"
                          : "0 0 6px 2px rgba(255,255,255,0.6)",
                        border: isVedic ? "1px solid rgba(139,105,20,0.6)" : "none",
                      }}
                    />
                  )}
                  {/* Tap / hover tooltip */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 8px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                        background: isVedic ? "#FFFDF7" : "#1A0E30",
                        border: isVedic
                          ? "1.5px solid rgba(184,134,11,0.3)"
                          : "1.5px solid rgba(200,162,255,0.2)",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: isVedic ? "rgba(44,24,16,0.85)" : "rgba(245,233,255,0.95)",
                        boxShadow: isVedic
                          ? "0 4px 16px rgba(0,0,0,0.12)"
                          : "0 4px 20px rgba(0,0,0,0.6)",
                        zIndex: 50,
                        pointerEvents: "none",
                      }}
                    >
                      {m.label}: {m.score}%
                    </div>
                  )}
                </div>
              );
            })}
            <TrendingUp className="h-5 w-5 ml-1 mb-1" strokeWidth={2.5} style={{ color: "rgba(255,255,255,0.5)" }} />
          </div>
          {/* Month initials */}
          {monthly && (
            <div className="flex items-start gap-[3px] mb-3">
              {monthly.map((m) => (
                <span
                  key={`lbl-${m.year}-${m.monthIdx}`}
                  className="w-[14px] text-center text-[6px] leading-[1.3] flex flex-col items-center font-medium"
                  style={{ color: "rgba(168,155,200,0.55)", letterSpacing: "0.02em" }}
                >
                  {m.short.toUpperCase().split("").map((ch, ci) => (
                    <span key={ci} style={{ lineHeight: "1.2" }}>{ch}</span>
                  ))}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 mt-1">
            <span className="text-2xl font-bold leading-none" style={{ color: "#F5E9FF" }}>
              {sentiment}
            </span>
            <span className="text-xs" style={{ color: "rgba(168,155,200,0.55)" }}>
              Sentiment for {sipVerdict}s
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px mx-5 self-stretch" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="md:hidden h-px w-full" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Right: Best Months + Reason */}
        <div className="md:w-[38%] md:min-w-[260px] flex flex-col">
          <div className="flex items-start gap-2.5 mb-3">
            <Calendar className="h-4 w-4 shrink-0 mt-1" strokeWidth={1.5} style={{ color: "rgba(168,155,200,0.5)" }} />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-1">
                {(bestMonthLabels.length > 0 ? bestMonthLabels.slice(0, 3) : ["—"]).map((label, i) => (
                  <span
                    key={i}
                    className="best-month-chip inline-block px-2.5 py-1 rounded-lg text-xs font-bold"
                    style={{
                      color: "#5C3D0A",
                      background: "linear-gradient(135deg, #F2C572 0%, #FFDFA3 100%)",
                      border: "2px solid #D4A84B",
                      boxShadow: "0 3px 12px rgba(212,168,75,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              {topMonths[0] && (
                <span className="text-[10px]" style={{ color: "rgba(242,197,114,0.85)" }}>
                  Peak month is {topMonths[0].short} '{String(topMonths[0].year).slice(2)}, {topMonths[0].score}% favourable
                </span>
              )}
            </div>
          </div>

          {topDriver && (
            <div
              className="rounded-lg px-3 py-2 mb-2"
              style={{ background: "rgba(242,197,114,0.06)", border: "1px solid rgba(242,197,114,0.15)" }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#F2C572" }}>
                Why {topMonths[0]?.short}
              </span>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "rgba(214,198,245,0.7)" }}>
                {topDriver}
              </p>
            </div>
          )}

          {sipReason && (
            <div
              className="rounded-lg px-3 py-2.5"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-xs leading-relaxed" style={{ color: "rgba(168,155,200,0.55)" }}>
                {sipReason}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── LuxuryPurchaseTimingCard ──
   Primary source is client-side compute from the chart; API is
   optional enrichment.
   ════════════════════════════════════════════════════════ */


const ASSET_LABELS: Record<AssetType, string> = {
  property: "Property",
  vehicle: "Vehicle",
  gold: "Gold",
  loan: "Loan",
};
const ASSET_ICONS: Record<AssetType, (props: { className?: string }) => JSX.Element> = {
  property: (props) => <Home {...props} />,
  vehicle: (props) => <Car {...props} />,
  gold: (props) => <Gem {...props} />,
  loan: (props) => <CreditCard {...props} />,
};
const ASSET_IMAGES: Record<AssetType, string> = {
  property: propertyImg,
  vehicle: carImg,
  gold: goldImg,
  loan: loanImg,
};
const VERDICT_COLORS: Record<string, string> = {
  yes: "#2FBF9F",
  delay: "#F2C572",
  avoid: "#E06BAA",
};
const VERDICT_LABELS: Record<string, string> = {
  yes: "Favorable",
  delay: "Delay",
  avoid: "Avoid",
};
const SCORE_KEYS = ["dasha", "transit", "natal", "muhurta"] as const;
const SCORE_COLORS: Record<string, string> = {
  dasha: "#F2C572",
  transit: "#3b82f6",
  natal: "#2FBF9F",
  muhurta: "#a78bfa",
};
const SCORE_LABELS: Record<string, string> = {
  dasha: "Dasha",
  transit: "Transit",
  natal: "Natal",
  muhurta: "Muhurta",
};

function ScoreBar({ label, value, color, isVedic }: { label: string; value: number; color: string; isVedic?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] w-14 shrink-0" style={{ color: isVedic ? "rgba(80,50,20,0.6)" : "rgba(168,155,200,0.6)" }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isVedic ? "rgba(184,134,11,0.08)" : "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}90, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] font-semibold w-7 text-right" style={{ color: isVedic ? "rgba(44,24,16,0.7)" : "rgba(214,198,245,0.7)" }}>{value}</span>
    </div>
  );
}

interface PillarProps {
  analysis: AssetAnalysis;
  isSelected: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  isVedic?: boolean;
}

function PillarCard({ analysis, isSelected, onHover, onLeave, onClick, isVedic }: PillarProps) {
  const { asset_type, verdict, overall_score, time_window } = analysis;
  const label = ASSET_LABELS[asset_type];
  const assetImage = ASSET_IMAGES[asset_type];
  const verdictColor = VERDICT_COLORS[verdict];

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="group relative flex flex-col items-center cursor-pointer overflow-hidden pillar-card-hover"
      style={{
        background: isVedic
          ? isSelected
            ? "linear-gradient(180deg, rgba(198,147,10,0.06) 0%, rgba(255,255,255,0.98) 50%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(254,252,248,0.98) 50%)"
          : isSelected
            ? "linear-gradient(180deg, rgba(139,92,246,0.10) 0%, rgba(15,10,30,0.95) 50%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(10,8,20,0.95) 50%)",
        border: isVedic
          ? isSelected ? "1px solid rgba(198,147,10,0.3)" : "1px solid rgba(197,155,55,0.12)"
          : isSelected ? "1px solid rgba(139,92,246,0.30)" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "24px 24px 16px 16px",
        width: "100%",
        minHeight: "220px",
        boxShadow: isVedic
          ? isSelected ? "0 4px 24px rgba(198,147,10,0.1), 0 1px 3px rgba(0,0,0,0.03)" : "0 2px 12px rgba(0,0,0,0.03)"
          : isSelected ? "0 0 30px -8px rgba(139,92,246,0.15)" : "none",
        // Use CSS transition instead of framer whileHover to avoid jitter when
        // parent re-renders due to selected state change
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        willChange: "transform",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Image covering top half */}
      <div className="relative w-full h-[110px] overflow-hidden">
        <img
          src={assetImage}
          alt={label}
          className="w-full h-full object-cover"
        loading="lazy" decoding="async" />
        <div
          className="absolute inset-0"
          style={{
            background: isVedic
              ? "linear-gradient(180deg, transparent 50%, rgba(255,255,255,0.98) 100%)"
              : "linear-gradient(180deg, transparent 50%, rgba(10,8,20,0.98) 100%)",
          }}
        />
      </div>

      {/* Text content below image */}
      <div className="flex flex-col items-center px-2 pb-3 pt-1 gap-1">
        <span className={`text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] ${isVedic ? "text-amber-800/70" : "text-violet-300/70"}`}>{label}</span>
        <span className={`text-[11px] sm:text-sm font-bold mt-1 text-center leading-tight whitespace-nowrap ${isVedic ? "text-stone-800" : "text-white"}`}>
          {new Date(time_window.start).toLocaleDateString("en", { month: "short", year: "2-digit" })}
          {" – "}
          {new Date(time_window.end).toLocaleDateString("en", { month: "short", year: "2-digit" })}
        </span>
        <span
          className="mt-1 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ color: verdictColor, border: `1px solid ${verdictColor}30`, background: `${verdictColor}08` }}
        >
          {VERDICT_LABELS[verdict]}
        </span>
        <span className="mt-1 text-[9px]" style={{ color: isVedic ? "rgba(61,53,82,0.5)" : "rgba(168,155,200,0.5)" }}>
          Score: {overall_score}
        </span>
      </div>
    </motion.button>
  );
}

function LuxuryPurchaseTimingCard({
  scores,
  dasha,
  transits,
  chart,
}: {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
}) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";
  const gridRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  // Chart-driven compute is the source of truth
  const chartData = useMemo(() => {
    if (!chart || !dasha || !transits || !scores) return null;
    return computeLuxuryFromChart(chart, dasha, transits, scores);
  }, [chart, dasha, transits, scores]);

  const [data, setData] = useState<LuxuryAnalysisResponse | null>(chartData);
  const [selected, setSelected] = useState<AssetType | null>(null);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Cleanup leave timer on unmount
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);

  useEffect(() => {
    if (chartData) setData(chartData);
  }, [chartData]);

  // Optional API enrichment — adopted only if chart compute is unavailable
  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;
    let req: ReportRequest;
    try {
      req = JSON.parse(raw);
    } catch {
      return;
    }
    setLoading(true);
    generateLuxuryAnalysis(req)
      .then((apiResult) => {
        sessionStorage.setItem("luxuryAnalysis", JSON.stringify(apiResult));
        if (!chartData) setData(apiResult);
      })
      .catch(() => {
        /* silent — chart compute already in place */
      })
      .finally(() => setLoading(false));
  }, [chartData]);

  if (!data && !loading) return null;
  const activeAsset = selected ? data?.assets[selected] : null;

  return (
    <div
      ref={cardRef}
      className="rounded-2xl p-5 sm:p-6 h-full luxury-card-outer"
      style={{
        background: isVedic ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.03)",
        border: isVedic ? "1px solid rgba(197,155,55,0.15)" : "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: isVedic
          ? "0 10px 40px rgba(0,0,0,0.04), 0 2px 8px rgba(154,120,30,0.05), inset 0 1px 0 rgba(255,255,255,1)"
          : "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
        overflow: "visible",
      }}
    >
      <div className="pb-4">

        <div className="flex items-center gap-1.5">
          <h3
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(14px, 2.2vw, 26px)",
              color: isVedic ? "#1A1A2E" : "#F5E9FF",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.3px",
            }}
          >
            Right Time to{" "}
            <span className={isVedic ? "text-amber-800" : "text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300"}>
              Buy Luxury Items
            </span>
          </h3>
          <InsightInfoTooltip explanation="Each asset's four sub-scores are computed from YOUR chart: natal (4th/2nd/6th house lord dignities + karaka planet strength), dasha (is the current Mahadasha/Antardasha lord the asset's karaka?), transit (how favourable planets drift through target houses over the next 12 months), and muhurta (Moon's nakshatra match). Different charts. Different best windows AND different verdicts." />
        </div>
      </div>

      {loading && !data && (
        <div className="px-7 pb-6">
          <p className={`text-[10px] animate-pulse ${isVedic ? "text-amber-700/50" : "text-violet-300/50"}`}>Calculating Vedic analysis...</p>
        </div>
      )}

      {data && (
        <div ref={gridRef} className="relative" style={{ overflow: "visible" }}>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 pb-2">
            {data.ranked.map((assetType) => (
              <PillarCard
                key={assetType}
                analysis={data.assets[assetType]}
                isSelected={selected === assetType}
                onHover={() => {
                  // Skip hover on mobile/tablet — only tap (onClick) opens the sheet
                  if (window.innerWidth < 1024) return;
                  if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
                  if (cardRef.current) {
                    const rect = cardRef.current.getBoundingClientRect();
                    const popupWidth = 380;
                    const gap = 12;
                    const spaceRight = window.innerWidth - rect.right - gap;
                    const left = spaceRight >= popupWidth
                      ? rect.right + gap
                      : Math.max(8, rect.left - popupWidth - gap);
                    const top = Math.max(16, Math.min(rect.top, window.innerHeight - 500));
                    setPopupPos({ top, left });
                  }
                  setSelected(assetType);
                }}
                onLeave={() => {
                  // Skip hover-leave on mobile/tablet
                  if (window.innerWidth < 1024) return;
                  leaveTimer.current = setTimeout(() => setSelected(null), 200);
                }}
                onClick={() => {
                  if (selected === assetType) {
                    setSelected(null);
                  } else {
                    // Only compute popup position on desktop
                    if (window.innerWidth >= 1024 && cardRef.current) {
                      const rect = cardRef.current.getBoundingClientRect();
                      const popupWidth = 380;
                      const gap = 12;
                      const spaceRight = window.innerWidth - rect.right - gap;
                      const left = spaceRight >= popupWidth
                        ? rect.right + gap
                        : Math.max(8, rect.left - popupWidth - gap);
                      const top = Math.max(16, Math.min(rect.top, window.innerHeight - 500));
                      setPopupPos({ top, left });
                    }
                    setSelected(assetType);
                  }
                }}
                isVedic={isVedic}
              />
            ))}
          </div>
          <p className="text-[9px] mt-3" style={{ color: isVedic ? "rgba(61,53,82,0.35)" : "rgba(168,155,200,0.3)" }}>
            {data.current_dasha} • Hover or tap a card for detailed breakdown
          </p>

          {/* Desktop: positioned popup */}
          {activeAsset && popupPos && createPortal(
            <div
              onMouseEnter={() => { if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; } }}
              onMouseLeave={() => { leaveTimer.current = setTimeout(() => setSelected(null), 200); }}
              className="hidden lg:block fixed z-[99999] rounded-xl px-5 py-5 shadow-2xl w-[380px] max-w-[90vw] max-h-[85vh] overflow-y-auto luxury-popup-detail"
              style={{
                top: `${popupPos.top}px`,
                left: `${popupPos.left}px`,
                background: isVedic ? "#FFFDF7" : "#0F0A1E",
                border: isVedic ? "1.5px solid rgba(184,134,11,0.25)" : "1.5px solid rgba(139,92,246,0.3)",
                boxShadow: isVedic
                  ? "0 20px 60px rgba(0,0,0,0.2), 0 8px 24px rgba(139,105,20,0.15)"
                  : "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(139,92,246,0.12)",
                animation: "luxury-popup-enter 0.2s ease-out",
              }}
            >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden"
                      style={{
                        background: isVedic ? "rgba(184,134,11,0.08)" : "rgba(139,92,246,0.12)",
                        border: isVedic ? "1px solid rgba(184,134,11,0.2)" : "1px solid rgba(139,92,246,0.20)",
                      }}
                    >
                      <img
                        src={ASSET_IMAGES[activeAsset.asset_type]}
                        alt={ASSET_LABELS[activeAsset.asset_type]}
                        className="h-7 w-7 object-contain"
                      loading="lazy" decoding="async" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold" style={{ color: isVedic ? "#2C1810" : "#F5E9FF" }}>
                        {ASSET_LABELS[activeAsset.asset_type]} Analysis
                      </h4>
                      <p className="text-[10px]" style={{ color: isVedic ? "rgba(80,50,20,0.55)" : "rgba(168,155,200,0.5)" }}>Is it the right time to buy?</p>
                    </div>
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{
                      color: VERDICT_COLORS[activeAsset.verdict],
                      border: `1px solid ${VERDICT_COLORS[activeAsset.verdict]}40`,
                      background: `${VERDICT_COLORS[activeAsset.verdict]}10`,
                    }}
                  >
                    {VERDICT_LABELS[activeAsset.verdict]}
                  </span>
                </div>

                <p className="text-[11px] mb-4 leading-relaxed" style={{ color: isVedic ? "rgba(44,24,16,0.75)" : "rgba(214,198,245,0.75)" }}>
                  {activeAsset.summary}
                </p>

                <div className="flex flex-wrap items-center gap-5 md:gap-8 mb-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold" style={{ color: isVedic ? "#2C1810" : "#F5E9FF" }}>{activeAsset.overall_score}</span>
                    <span className="text-xs" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(168,155,200,0.4)" }}>/ 100</span>
                  </div>
                  <div className="hidden md:block w-px h-10" style={{ background: isVedic ? "rgba(184,134,11,0.12)" : "rgba(255,255,255,0.06)" }} />
                  <div className="flex items-start gap-2">
                    <Calendar className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isVedic ? "text-amber-700/50" : "text-violet-400/40"}`} />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>Best Window to Buy</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: isVedic ? "#503214" : "rgba(214,198,245,0.85)" }}>
                        {new Date(activeAsset.time_window.start).toLocaleDateString("en", { month: "short", year: "numeric" })}
                        {" → "}
                        {new Date(activeAsset.time_window.end).toLocaleDateString("en", { month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(168,155,200,0.3)" }}>{activeAsset.time_window.months} month window</p>
                    </div>
                  </div>
                  <div className="hidden md:block w-px h-10" style={{ background: isVedic ? "rgba(184,134,11,0.12)" : "rgba(255,255,255,0.06)" }} />
                  <div className="flex items-start gap-2">
                    <Star className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isVedic ? "text-amber-700/50" : "text-violet-400/40"}`} />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>Current Dasha</p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: isVedic ? "#8B6914" : "#C8A2FF" }}>{activeAsset.dasha_period}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className={`h-3 w-3 ${isVedic ? "text-amber-700/50" : "text-violet-400/50"}`} />
                  <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>Score Breakdown</span>
                </div>
                <div className="flex flex-col gap-3">
                  {[...SCORE_KEYS]
                    .sort((a, b) => activeAsset.scores[b] - activeAsset.scores[a])
                    .map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <ScoreBar label={SCORE_LABELS[key]} value={activeAsset.scores[key]} color={SCORE_COLORS[key]} isVedic={isVedic} />
                      {activeAsset.reasoning[key]?.slice(0, 1).map((r, i) => (
                        <div key={i} className="flex items-start gap-2 pl-[4.5rem]">
                          <span className="h-1 w-1 rounded-full shrink-0 mt-1.5" style={{ background: SCORE_COLORS[key] }} />
                          <p className="text-[10px] leading-relaxed" style={{ color: isVedic ? "rgba(44,24,16,0.55)" : "rgba(168,155,200,0.45)" }}>{r}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {activeAsset.suggested_nakshatras.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: isVedic ? "1px solid rgba(184,134,11,0.1)" : "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[9px] uppercase tracking-widest mr-1" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(168,155,200,0.3)" }}>Nakshatras</span>
                    {activeAsset.suggested_nakshatras.slice(0, 5).map((n) => (
                      <span
                        key={n}
                        className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{
                          color: isVedic ? "rgba(139,105,20,0.7)" : "rgba(200,162,255,0.6)",
                          border: isVedic ? "1px solid rgba(184,134,11,0.2)" : "1px solid rgba(139,92,246,0.15)",
                          background: isVedic ? "rgba(184,134,11,0.06)" : "rgba(139,92,246,0.06)",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          , document.body)}

          {/* Mobile: bottom sheet modal (50% screen height) */}
          {activeAsset && createPortal(
            <div className="lg:hidden fixed inset-0 z-[99999]" onClick={() => setSelected(null)}>
              {/* Backdrop */}
              <div
                className="absolute inset-0"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  animation: "luxury-sheet-backdrop 0.2s ease-out",
                }}
              />
              {/* Bottom Sheet */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 rounded-t-2xl px-5 pt-3 pb-5 overflow-y-auto luxury-bottom-sheet"
                style={{
                  height: "50vh",
                  background: isVedic ? "#FFFDF7" : "#0F0A1E",
                  borderTop: isVedic ? "1.5px solid rgba(184,134,11,0.25)" : "1.5px solid rgba(139,92,246,0.3)",
                  boxShadow: isVedic
                    ? "0 -10px 40px rgba(0,0,0,0.2)"
                    : "0 -10px 40px rgba(0,0,0,0.7), 0 0 40px rgba(139,92,246,0.12)",
                  animation: "luxury-sheet-slide-up 0.3s ease-out",
                }}
              >
                {/* Drag handle */}
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 rounded-full" style={{ background: isVedic ? "rgba(80,50,20,0.2)" : "rgba(255,255,255,0.15)" }} />
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden"
                      style={{
                        background: isVedic ? "rgba(184,134,11,0.08)" : "rgba(139,92,246,0.12)",
                        border: isVedic ? "1px solid rgba(184,134,11,0.2)" : "1px solid rgba(139,92,246,0.20)",
                      }}
                    >
                      <img
                        src={ASSET_IMAGES[activeAsset.asset_type]}
                        alt={ASSET_LABELS[activeAsset.asset_type]}
                        className="h-7 w-7 object-contain"
                      loading="lazy" decoding="async" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold" style={{ color: isVedic ? "#2C1810" : "#F5E9FF" }}>
                        {ASSET_LABELS[activeAsset.asset_type]} Analysis
                      </h4>
                      <p className="text-[10px]" style={{ color: isVedic ? "rgba(80,50,20,0.55)" : "rgba(168,155,200,0.5)" }}>Is it the right time to buy?</p>
                    </div>
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{
                      color: VERDICT_COLORS[activeAsset.verdict],
                      border: `1px solid ${VERDICT_COLORS[activeAsset.verdict]}40`,
                      background: `${VERDICT_COLORS[activeAsset.verdict]}10`,
                    }}
                  >
                    {VERDICT_LABELS[activeAsset.verdict]}
                  </span>
                </div>

                <p className="text-[11px] mb-4 leading-relaxed" style={{ color: isVedic ? "rgba(44,24,16,0.75)" : "rgba(214,198,245,0.75)" }}>
                  {activeAsset.summary}
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold" style={{ color: isVedic ? "#2C1810" : "#F5E9FF" }}>{activeAsset.overall_score}</span>
                    <span className="text-xs" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(168,155,200,0.4)" }}>/ 100</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isVedic ? "text-amber-700/50" : "text-violet-400/40"}`} />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>Best Window to Buy</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: isVedic ? "#503214" : "rgba(214,198,245,0.85)" }}>
                        {new Date(activeAsset.time_window.start).toLocaleDateString("en", { month: "short", year: "numeric" })}
                        {" → "}
                        {new Date(activeAsset.time_window.end).toLocaleDateString("en", { month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(168,155,200,0.3)" }}>{activeAsset.time_window.months} month window</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isVedic ? "text-amber-700/50" : "text-violet-400/40"}`} />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>Current Dasha</p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: isVedic ? "#8B6914" : "#C8A2FF" }}>{activeAsset.dasha_period}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className={`h-3 w-3 ${isVedic ? "text-amber-700/50" : "text-violet-400/50"}`} />
                  <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: isVedic ? "rgba(80,50,20,0.5)" : "rgba(168,155,200,0.4)" }}>Score Breakdown</span>
                </div>
                <div className="flex flex-col gap-3">
                  {[...SCORE_KEYS]
                    .sort((a, b) => activeAsset.scores[b] - activeAsset.scores[a])
                    .map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <ScoreBar label={SCORE_LABELS[key]} value={activeAsset.scores[key]} color={SCORE_COLORS[key]} isVedic={isVedic} />
                      {activeAsset.reasoning[key]?.slice(0, 1).map((r, i) => (
                        <div key={i} className="flex items-start gap-2 pl-[4.5rem]">
                          <span className="h-1 w-1 rounded-full shrink-0 mt-1.5" style={{ background: SCORE_COLORS[key] }} />
                          <p className="text-[10px] leading-relaxed" style={{ color: isVedic ? "rgba(44,24,16,0.55)" : "rgba(168,155,200,0.45)" }}>{r}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {activeAsset.suggested_nakshatras.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: isVedic ? "1px solid rgba(184,134,11,0.1)" : "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[9px] uppercase tracking-widest mr-1" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(168,155,200,0.3)" }}>Nakshatras</span>
                    {activeAsset.suggested_nakshatras.slice(0, 5).map((n) => (
                      <span
                        key={n}
                        className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{
                          color: isVedic ? "rgba(139,105,20,0.7)" : "rgba(200,162,255,0.6)",
                          border: isVedic ? "1px solid rgba(184,134,11,0.2)" : "1px solid rgba(139,92,246,0.15)",
                          background: isVedic ? "rgba(184,134,11,0.06)" : "rgba(139,92,246,0.06)",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          , document.body)}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── CosmicInvestmentChart ──
   Primary source is chart-driven compute; API is enrichment only.
   ════════════════════════════════════════════════════════ */

const BASKET_SHORT_LABELS: Record<BasketType, string> = {
  stocks: "Stocks / Equity",
  mutual_funds: "Mutual Funds",
  real_estate: "Real Estate",
  gold: "Gold / Savings",
  fixed_income: "Fixed Income",
  high_risk: "High Risk",
};

function CosmicInvestmentChart({
  scores,
  dasha,
  transits,
  chart,
}: {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
}) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";

  const chartData = useMemo(() => {
    if (!chart || !dasha || !transits || !scores) return null;
    return computeBasketsFromChart(chart, dasha, transits, scores);
  }, [chart, dasha, transits, scores]);

  const [data, setData] = useState<InvestmentBasketResponse | null>(chartData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (chartData) setData(chartData);
  }, [chartData]);

  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;
    let req: ReportRequest;
    try {
      req = JSON.parse(raw);
    } catch {
      return;
    }
    setLoading(true);
    generateInvestmentBaskets(req)
      .then((apiResult) => {
        sessionStorage.setItem("investmentBaskets", JSON.stringify(apiResult));
        if (!chartData) setData(apiResult);
      })
      .catch(() => {
        /* silent — chart compute already in place */
      })
      .finally(() => setLoading(false));
  }, [chartData]);

  const barData = useMemo(() => {
    if (!data) return [];
    return [...data.ranked, ...data.avoided]
      .map((b) => ({
        key: b,
        name: BASKET_SHORT_LABELS[b] || data.baskets[b].label,
        score: data.baskets[b].overall_score,
      }))
      .sort((a, b) => b.score - a.score);
  }, [data]);

  const topBasket = barData.length > 0 ? barData[0].key : null;
  const topReason = data && topBasket
    ? data.baskets[topBasket].reasoning.natal[0] ?? data.baskets[topBasket].summary
    : null;

  if (!data && !loading) return null;

  return (
    <div
      className="rounded-2xl h-full flex flex-col overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 md:pt-7 pb-2">
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
            Which Investment Option Is Best for You
          </h3>
          <InsightInfoTooltip explanation="Each basket's score is computed from your chart: the target houses' lord strengths (5th/11th for stocks, 9th/11th for mutual funds, 4th for real estate, 2nd/11th for gold, 2nd/4th for fixed income, 5th/8th for high risk), the karaka planet's dignity, plus whether your current Mahadasha/Antardasha lord activates that basket. Allocation percentages are proportional to the scores." />
        </div>
        {data && (
          <p className="text-[10px] mt-1" style={{ color: "rgba(168,155,200,0.55)" }}>
            <span style={{ color: "#F2C572" }}>{data.investor_type}</span> investor · {data.current_dasha}
          </p>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "rgba(200,162,255,0.4)", borderTopColor: "transparent" }}
            />
          </div>
        ) : (
          data && (
            <div className="rounded-xl p-4 md:p-5" style={{ background: "transparent", border: "none" }}>
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.12em] mb-4 text-center"
                style={{ color: "rgba(168,155,200,0.5)" }}
              >
                Comparison
              </p>
              <div className="flex flex-col gap-3 max-w-md mx-auto">
                {barData.map((item, i) => {
                  const isTop = item.key === topBasket;
                  const alloc = data.allocation[item.key] ?? 0;
                  return (
                    <div key={item.key} className="flex items-center gap-3">
                      <span
                        className="text-[10px] sm:text-[11px] md:text-xs w-[70px] sm:w-[80px] md:w-[100px] shrink-0 text-right leading-tight"
                        style={{ color: "rgba(214,198,245,0.7)" }}
                      >
                        {item.name}
                      </span>
                      <div
                        className="flex-1 h-[10px] md:h-[12px] rounded-full overflow-hidden investment-bar-track"
                        style={{ background: isVedic ? "rgba(198,147,10,0.07)" : "rgba(255,255,255,0.04)" }}
                      >
                        <motion.div
                          className="h-full rounded-full investment-bar-fill"
                          style={{
                            background: isVedic
                              ? isTop
                                ? "linear-gradient(90deg, #C6930A, #E8B828, #F5D060)"
                                : "linear-gradient(90deg, #D4A012, #F5D060)"
                              : isTop
                                ? "linear-gradient(90deg, #A14EBF, #C8A2FF)"
                                : "rgba(255,255,255,0.12)",
                            boxShadow: isVedic
                              ? isTop ? "0 0 14px rgba(198,147,10,0.35)" : "0 0 8px rgba(232,184,40,0.15)"
                              : isTop ? "0 0 12px rgba(161,78,191,0.4)" : "none",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.score}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                        />
                      </div>
                      <span
                        className="text-[10px] w-9 shrink-0 text-right tabular-nums"
                        style={{ color: isVedic ? (isTop ? "#C6930A" : "#9B7B2C") : (isTop ? "#C8A2FF" : "rgba(168,155,200,0.5)") }}
                      >
                        {alloc > 0 ? `${alloc}%` : "–"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 pl-[82px] sm:pl-[92px] md:pl-[112px] pr-10 max-w-md mx-auto">
                {[0, 25, 50, 75, 100].map((tick) => (
                  <span key={tick} className="text-[9px]" style={{ color: "rgba(168,155,200,0.35)" }}>
                    {tick}
                  </span>
                ))}
              </div>

              {topReason && topBasket && (
                <div
                  className="rounded-lg px-3.5 py-2.5 mt-4 max-w-md mx-auto"
                  style={{ background: "rgba(161,78,191,0.06)", border: "1px solid rgba(161,78,191,0.18)" }}
                >
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: "#C8A2FF" }}
                  >
                    Why {BASKET_SHORT_LABELS[topBasket]}
                  </span>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "rgba(214,198,245,0.72)" }}>
                    {topReason}
                  </p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ── Section Header ──
   ════════════════════════════════════════════════════════ */
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 sm:mb-8 md:mb-10">
      {/* Animated divider with centered label */}
      <div className="mb-6 sm:mb-8 md:mb-10">
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
            }}
          >
            {title}
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

      {subtitle && (
        <p className="text-xs sm:text-sm md:text-base mt-3 max-w-xl" style={{ color: "#A89BC8", lineHeight: 1.65 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Main export ── */
export { BestBusinessStartCard };

export default function InvestmentsAssetsSection({
  scores,
  dasha,
  transits,
  chart,
  investment,
}: Props) {
  return (
    <div className="mt-0">
      <SectionHeader title="Investments" subtitle="" />

      {/* Row 1: Luxury Purchase Timing (left) + Cosmic Investment Chart (right).
          items-start — both cards are h-full, so a default stretch row makes
          the shorter one pad itself out with blank space. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        <CardFeedbackWrapper cardId="luxury-purchase-timing">
          <LuxuryPurchaseTimingCard scores={scores} dasha={dasha} transits={transits} chart={chart} />
        </CardFeedbackWrapper>
        <CardFeedbackWrapper cardId="cosmic-investment-chart">
          <CosmicInvestmentChart scores={scores} dasha={dasha} transits={transits} chart={chart} />
        </CardFeedbackWrapper>
      </div>

      {/* Row 2: Best Months to Invest */}
      <div className="mt-4 sm:mt-6">
        <InvestmentTimingCard
          investment={investment}
          scores={scores}
          dasha={dasha}
          transits={transits}
          chart={chart}
        />
      </div>
    </div>
  );
}
