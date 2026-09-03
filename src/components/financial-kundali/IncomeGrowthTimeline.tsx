/**
 * IncomeGrowthTimeline — income growth chart for /kundali.
 * Mirrors the /kundali version: 9 nodes, horizontally scrollable past 2040,
 * solid curve up to 2040 then dashed projection beyond.
 */

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReportScores, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";
import { sampleDashaLadder } from "@/lib/chart-personalization";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import { useKundaliTheme } from "@/lib/kundali-theme-context";

/* ─── Types ─── */

interface PhaseNode {
  age: number;
  year: number;
  income: number;
  growthIndex: number;
  label: string;
  planet: string;
  phase: "growth" | "stable" | "slow";
  insight: string;
}

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  birthYear?: number;
}

/* ─── Helpers ─── */

const FAVORABLE_LORDS = ["Jupiter", "Venus", "Mercury", "Moon"];
const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃",
  Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};

const Y_TICKS = [
  { value: 0,   label: "1.5x" },
  { value: 33,  label: "2x"   },
  { value: 66,  label: "2.5x" },
  { value: 100, label: "3x+"  },
];

function scoreToGrowthIndex(score: number): number {
  return 1.5 + (score / 100) * 1.7;
}

function formatGrowthIndex(index: number): string {
  return `${index.toFixed(1)}x`;
}

const NODE_COUNT = 9;
const SPAN_YEARS = 24;

/** Fixed-offset sequence used only when the dasha dates are unusable. Generic by
 *  construction — every user hitting this path sees the same years. */
function fallbackSequence(dasha: DashaInfo | null, currentYear: number) {
  const dashaLord = dasha?.mahadasha_lord ?? "Jupiter";
  const antarLord = dasha?.antardasha_lord ?? "Venus";
  const nextDasha = dasha?.next_mahadasha ?? "Saturn";

  return [
    { lord: dashaLord,  offset: 0,  sub: "current mahadasha"  },
    { lord: antarLord,  offset: 3,  sub: "antardasha peak"     },
    { lord: dashaLord,  offset: 6,  sub: "mahadasha maturity"  },
    { lord: nextDasha,  offset: 9,  sub: "transition phase"    },
    { lord: nextDasha,  offset: 12, sub: "new dasha settling"  },
    { lord: FAVORABLE_LORDS.includes(nextDasha) ? "Jupiter" : "Venus", offset: 15, sub: "growth window" },
    { lord: "Saturn",   offset: 18, sub: "consolidation"       },
    { lord: "Jupiter",  offset: 21, sub: "expansion cycle"     },
    { lord: "Venus",    offset: 24, sub: "luxury phase"        },
  ].map((e) => ({ lord: e.lord, sub: e.sub, year: currentYear + e.offset, offset: e.offset }));
}

function buildPhases(
  scores: ReportScores,
  dasha: DashaInfo | null,
  transits: TransitPlanet[] | null,
  birthYear: number,
): PhaseNode[] {
  const currentYear = new Date().getFullYear();
  const baseIncome = scores.income_score * 0.5 + scores.natal_wealth_score * 0.3 + scores.timing_score * 0.2;

  // Real ladder first: each node is whichever antardasha is actually running at
  // that point in the user's own dasha timeline, so the years move with the
  // birth chart instead of being fixed offsets from today.
  const samples = dasha ? sampleDashaLadder(dasha, NODE_COUNT, SPAN_YEARS) : [];
  const sequence =
    samples.length === NODE_COUNT
      ? samples.map((s) => ({
          lord: s.subLord,
          sub:
            s.subLord === s.lord
              ? `${s.lord} mahadasha`
              : `${s.subLord} antardasha in ${s.lord}'s mahadasha`,
          year: s.year,
          offset: s.year - currentYear,
        }))
      : fallbackSequence(dasha, currentYear);

  let prevIncome = Math.max(15, baseIncome - 15);
  const phases: PhaseNode[] = [];

  sequence.forEach(({ lord, offset, sub, year }) => {
    const age  = year - birthYear;
    const isFavorable = FAVORABLE_LORDS.includes(lord);
    const hasRetro = transits?.some((t) => t.planet === lord && t.retrograde) ?? false;

    const lordWeight =
      lord === "Jupiter" ? 0.8 : lord === "Venus"   ? 0.7
      : lord === "Mercury" ? 0.65 : lord === "Moon"  ? 0.5
      : lord === "Sun"     ? 0.45 : lord === "Saturn" ? 0.3
      : lord === "Mars"    ? 0.35 : lord === "Rahu"   ? 0.4 : 0.25;

    const scoreFactor    = (scores.income_score * 0.4 + scores.timing_score * 0.3 + scores.investment_score * 0.3) / 100;
    const positionFactor = Math.sin((offset + 1) * 0.7) * 0.3 + 0.7;

    let growth: number;
    if (isFavorable && !hasRetro)       growth = 8 + lordWeight * 12 * scoreFactor * positionFactor;
    else if (isFavorable && hasRetro)   growth = 2 + lordWeight * 5  * scoreFactor;
    else if (hasRetro)                  growth = -3 + lordWeight * 4 * scoreFactor;
    else                                growth = 1 + lordWeight * 6  * scoreFactor * positionFactor;

    const income     = Math.min(98, Math.max(10, prevIncome + growth));
    prevIncome       = income;

    const phase: PhaseNode["phase"] = isFavorable && !hasRetro ? "growth" : hasRetro || !isFavorable ? "slow" : "stable";
    const growthIndex = scoreToGrowthIndex(income);
    const insight = isFavorable
      ? `${lord} brings expansion and financial momentum during this ${sub}.`
      : `${lord} period calls for disciplined saving and cautious decisions.`;

    phases.push({ age, year, income, growthIndex, label: `${lord} ${sub}`, planet: lord, phase, insight });
  });

  return phases;
}

/* ─── Colours ─── */

const phaseColor: Record<PhaseNode["phase"], string> = {
  growth: "#F2C572",
  stable: "#2FBF9F",
  slow:   "#E06BAA",
};
const phaseGlow: Record<PhaseNode["phase"], string> = {
  growth: "rgba(242,197,114,0.6)",
  stable: "rgba(47,191,159,0.5)",
  slow:   "rgba(224,107,170,0.4)",
};
const phaseLabel: Record<PhaseNode["phase"], string> = {
  growth: "Growth",
  stable: "Stable",
  slow:   "Slow",
};

/* ─── Component ─── */

export default function IncomeGrowthTimeline({ scores, dasha, transits, birthYear }: Props) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";
  /* One index drives hover, tap and keyboard alike. */
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  /* Viewport coords of the active node — the tooltip is portalled to <body>,
     so it needs fixed-position coordinates, not SVG-space ones. */
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /* A tap-opened tooltip stays put until an outside tap; a hover-opened one
     follows the pointer. */
  const stickyRef = useRef(false);
  const lastPointerTypeRef = useRef("mouse");
  const effectiveBirthYear = birthYear ?? 2002;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const clearActive = useCallback(() => {
    stickyRef.current = false;
    setActiveIdx(null);
    setAnchor(null);
  }, []);

  /* The anchor is a viewport coordinate, so any scroll — the page or the
     chart's own horizontal overflow — detaches it from its dot. Close instead
     of chasing it. Resize does the same because the SVG geometry changes. */
  useEffect(() => {
    if (activeIdx === null) return;

    const onScroll = () => clearActive();
    const onResize = () => clearActive();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearActive();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!stickyRef.current) return;
      if (cardRef.current?.contains(e.target as Node)) return;
      clearActive();
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [activeIdx, clearActive]);

  const phases = useMemo(() => {
    if (!scores) return [];
    return buildPhases(scores, dasha, transits, effectiveBirthYear);
  }, [scores, dasha, transits, effectiveBirthYear]);

  if (!scores || phases.length === 0) return null;

  /* ── SVG dimensions ── */
  const H = 280;
  const padL = isMobile ? 42 : 70;
  const padR = isMobile ? 16 : 30;
  const padT = 40;
  const padB = 48;
  const plotH = H - padT - padB;

  const startYear        = 2025;
  const projectionEndYear = 2040;
  const lastPhaseYear    = phases[phases.length - 1]?.year ?? 2052;
  const endYear          = lastPhaseYear + 2;

  // On mobile, use a tighter pxPerYear so at least 5 nodes (15 years) fit in viewport
  // On desktop, the chart sits in a ~600-700px container so keep it compact too
  const visibleYears = projectionEndYear - startYear;
  const visibleW     = isMobile ? 480 : 680;
  const pxPerYear    = (visibleW - padL - padR) / visibleYears;
  const totalYears   = endYear - startYear;
  const W            = padL + totalYears * pxPerYear + padR;
  const plotW        = W - padL - padR;

  const xScaleYear = (year: number) => padL + (year - startYear) * pxPerYear;
  const yScale     = (v: number)    => padT + plotH - (v / 100) * plotH;

  const points = phases.map((p) => ({ x: xScaleYear(p.year), y: yScale(p.income) }));

  const solidPhaseIdx = phases.findIndex((p) => p.year > projectionEndYear);
  const solidEndIdx   = solidPhaseIdx === -1 ? phases.length - 1 : solidPhaseIdx - 1;
  const solidPoints   = points.slice(0, solidEndIdx + 1);
  const projectedPoints = solidEndIdx < points.length - 1 ? points.slice(solidEndIdx) : [];

  function catmullRomPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const solidCurvePath     = catmullRomPath(solidPoints);
  const projectedCurvePath = projectedPoints.length >= 2 ? catmullRomPath(projectedPoints) : "";
  const allPoints = points; // full set for area fill
  const fullCurvePath = catmullRomPath(allPoints);
  const areaPath = allPoints.length >= 2
    ? `${fullCurvePath} L ${allPoints[allPoints.length - 1].x},${padT + plotH} L ${allPoints[0].x},${padT + plotH} Z`
    : "";

  /* ── Interaction ──────────────────────────────────────────────────────
     Hit targets are full-height columns, one per node, rather than the drawn
     glyph pixels. The visual node group is pointer-transparent so it can never
     steal an event, and a single pointerleave on the band layer means moving
     between adjacent columns swaps the index without a "nothing hovered"
     frame in between — that gap is what made the old hover flicker. */

  /* Bands split the plot at the midpoint between neighbouring nodes. */
  const bands = points.map((pt, i) => {
    const left  = i === 0 ? padL : (points[i - 1].x + pt.x) / 2;
    const right = i === points.length - 1 ? W - padR : (pt.x + points[i + 1].x) / 2;
    return { x: left, width: Math.max(0, right - left) };
  });
  const bandY = padT - 12;
  const bandH = plotH + 56; // reaches past the year/age labels below the axis

  /* Map an SVG-space point to viewport coordinates. The SVG is laid out at its
     intrinsic size inside a horizontally scrollable box, so read the live rect
     and scale rather than assuming 1:1. */
  function anchorFor(i: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + points[i].x * (rect.width / W),
      y: rect.top + points[i].y * (rect.height / H),
    };
  }

  function activate(i: number, sticky = false) {
    stickyRef.current = sticky;
    setActiveIdx(i);
    setAnchor(anchorFor(i));
  }

  function handleBandEnter(i: number, e: React.PointerEvent) {
    lastPointerTypeRef.current = e.pointerType;
    if (e.pointerType !== "mouse") return; // touch is handled by click
    activate(i); // a real mouse always takes over a tap- or keyboard-pinned tooltip
  }

  function handleLayerLeave(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    if (stickyRef.current) return;
    clearActive();
  }

  /* Touch/pen: a swipe that scrolls the chart never fires click, so tap-toggle
     coexists with horizontal scrolling. A mouse click leaves hover in charge. */
  function handleBandClick(i: number) {
    const byTouch = lastPointerTypeRef.current !== "mouse";
    if (!byTouch) {
      activate(i);
      return;
    }
    if (stickyRef.current && activeIdx === i) clearActive();
    else activate(i, true);
  }

  /* One tab stop for the whole chart, arrow keys walk the nodes. */
  function handleChartKeyDown(e: React.KeyboardEvent) {
    const last = points.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight")      next = activeIdx === null ? 0 : Math.min(last, activeIdx + 1);
    else if (e.key === "ArrowLeft")  next = activeIdx === null ? last : Math.max(0, activeIdx - 1);
    else if (e.key === "Home")       next = 0;
    else if (e.key === "End")        next = last;
    else if (e.key === "Escape")     { clearActive(); return; }
    else return;

    e.preventDefault();
    activate(next, true); // survives until blur/Escape, like a tap
  }

  /* ── Tooltip geometry ── */
  const TIP_W  = Math.min(280, (typeof window !== "undefined" ? window.innerWidth : 360) - 24);
  const TIP_GAP = 20;
  const activePhase = activeIdx !== null ? phases[activeIdx] : null;
  const activeColor = activePhase ? phaseColor[activePhase.phase] : "";

  let tipLeft = 0;
  let tipBelow = false;
  let caretLeft = TIP_W / 2;
  if (anchor) {
    /* Above the point by default — that's where the eye already is. Flip below
       only when the point sits too close to the top of the viewport. */
    tipBelow = anchor.y < 170;
    tipLeft = Math.max(12, Math.min(window.innerWidth - TIP_W - 12, anchor.x - TIP_W / 2));
    caretLeft = Math.max(16, Math.min(TIP_W - 16, anchor.x - tipLeft));
  }

  return (
    <div
      ref={cardRef}
      className="income-growth-card rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3
              className="truncate"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "clamp(14px, 2.2vw, 26px)",
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.3px",
                ...(isVedic
                  ? {
                      background: "linear-gradient(135deg, #9B7B2C 0%, #C6930A 40%, #F5D060 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }
                  : { color: "#F5E9FF" }),
              }}
            >
              Your Income Growth
            </h3>
            <InsightInfoTooltip explanation="This chart maps your income trajectory across Mahadasha and Antardasha periods. Each node represents a planetary period: benefic planets like Jupiter and Venus create steeper growth, while Saturn or Rahu periods may slow momentum." />
          </div>
          <Link
            to="/boost-wealth"
            className="boost-wealth-btn flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] hover:brightness-110 transition-all shrink-0"
            style={{
              background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
              color: "#2A0E4A",
              boxShadow: "0 4px 16px rgba(242,197,114,0.35)",
            }}
          >
            <Rocket className="h-3 w-3" />
            <span className="hidden sm:inline">Boost Your Wealth</span>
            <span className="sm:hidden">Boost</span>
          </Link>
        </div>

        {/* Legend */}
        <div className="flex gap-3 sm:gap-5 mt-1">
          {(["growth", "stable", "slow"] as const).map((p) => (
            <span key={p} className="flex items-center gap-1.5 text-[10px] sm:text-[11px]" style={{ color: isVedic ? "#503214" : "rgba(214,198,245,0.7)" }}>
              <span className="legend-dot w-2 h-2 rounded-full" style={{ background: phaseColor[p], boxShadow: `0 0 5px ${phaseGlow[p]}`, '--dot-bg': phaseColor[p] } as React.CSSProperties} />
              {phaseLabel[p]}
            </span>
          ))}
        </div>
      </div>

      {/* Chart — horizontally scrollable past 2040 */}
      {/* `ig-chart-body` is a styling hook only — no Cosmic styles are attached
          to it. The Vedic override in index.css uses it to keep the feedback
          thumbs off the last x-axis label (AF-085). */}
      <div className="ig-chart-body px-1 sm:px-4 lg:px-6 pb-6 sm:pb-8 overflow-x-auto -mx-0">
        <svg
          ref={svgRef}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: Math.min(W, isMobile ? 420 : 500), outline: "none" }}
          tabIndex={0}
          role="group"
          aria-label="Income growth by planetary period. Use the left and right arrow keys to step through each period."
          onKeyDown={handleChartKeyDown}
          onBlur={clearActive}
        >
          <defs>
            <linearGradient id="tiAreaGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={isVedic ? "#D4920A" : "#F2C572"} stopOpacity={isVedic ? 0.12 : 0.15} />
              <stop offset="60%"  stopColor={isVedic ? "#F2C572" : "#2FBF9F"} stopOpacity={isVedic ? 0.04 : 0.05} />
              <stop offset="100%" stopColor={isVedic ? "#FFFEF9" : "#2A0E4A"} stopOpacity={0}    />
            </linearGradient>
            <filter id="tiNodeGlow2">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="tiLineGrad2" x1="0" y1="0" x2="1" y2="0">
              {phases.slice(0, solidEndIdx + 1).map((p, i) => (
                <stop
                  key={i}
                  offset={`${(i / Math.max(solidEndIdx, 1)) * 100}%`}
                  stopColor={phaseColor[p.phase]}
                />
              ))}
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {Y_TICKS.map(({ value }) => (
            <line
              key={value}
              x1={padL} y1={yScale(value)}
              x2={padL + plotW} y2={yScale(value)}
              stroke={isVedic ? "rgba(184,134,11,0.08)" : "rgba(255,255,255,0.04)"}
              strokeDasharray="4 6"
            />
          ))}

          {/* Y-axis labels */}
          {Y_TICKS.map(({ value, label }) => (
            <text
              key={value}
              x={padL - 8} y={yScale(value) + 5}
              textAnchor="end"
              fill={isVedic ? "#7A5A30" : "rgba(168,155,200,0.6)"}
              fontSize={isMobile ? 11 : 14} fontWeight="600" fontFamily="'Poppins', sans-serif"
            >
              {label}
            </text>
          ))}

          {/* Area fill */}
          {areaPath && (
            <motion.path
              d={areaPath}
              fill="url(#tiAreaGrad2)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          )}

          {/* Solid curve */}
          {solidCurvePath && (
            <motion.path
              d={solidCurvePath}
              fill="none"
              stroke="url(#tiLineGrad2)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="8 5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          )}

          {/* Projected curve (after 2040) */}
          {projectedCurvePath && (
            <motion.path
              d={projectedCurvePath}
              fill="none"
              stroke="rgba(224,107,170,0.6)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="6 6"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: 1.8, ease: "easeInOut" }}
            />
          )}

          {/* Guide line for the active node. A <rect>, not a <line> — the Vedic
              override forces a flat gold stroke on every line in this card. */}
          {activeIdx !== null && (
            <rect
              x={points[activeIdx].x - 0.5}
              y={padT}
              width={1}
              height={plotH}
              fill={phaseColor[phases[activeIdx].phase]}
              opacity={0.35}
              pointerEvents="none"
            />
          )}

          {/* Nodes — purely visual; the hit layer below owns all pointer events */}
          {points.map((pt, i) => {
            const phase       = phases[i];
            const color       = phaseColor[phase.phase];
            const glow        = phaseGlow[phase.phase];
            const isHov       = activeIdx === i;
            const isProjected = phase.year > projectionEndYear;

            return (
              <g key={i} pointerEvents="none">
                {/* Outer ring — the strokeWidth bump carries the hover state in
                    Vedic, where circle opacity is pinned by a theme override. */}
                <motion.circle
                  className="ig-ring"
                  cx={pt.x} cy={pt.y} r={isHov ? 17 : 12}
                  fill="none" stroke={color} strokeWidth={isHov ? 2.5 : 1.5}
                  opacity={isHov ? 0.6 : 0.2}
                  strokeDasharray={isProjected ? "3 3" : undefined}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                />
                {/* Filled dot */}
                <motion.circle
                  className="ig-dot"
                  cx={pt.x} cy={pt.y} r={isHov ? 7.5 : 6}
                  fill={color}
                  opacity={isProjected ? 0.7 : 1}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 200 }}
                  style={{ filter: `drop-shadow(0 0 ${isHov ? 14 : 8}px ${glow})` }}
                />

                {/* Growth index above */}
                <motion.text
                  x={pt.x} y={pt.y - 24}
                  textAnchor="middle"
                  className="phase-colored-text"
                  fill={isVedic ? "#503214" : "#F5E9FF"} fontSize={isMobile ? 12 : 15} fontWeight="700" fontFamily="'Poppins', sans-serif"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.15 }}
                >
                  {formatGrowthIndex(phase.growthIndex)}
                </motion.text>

                {/* Planet glyph below dot */}
                <motion.text
                  x={pt.x} y={pt.y + 26}
                  textAnchor="middle"
                  className="phase-colored-text"
                  fill={color} fontSize={isMobile ? 11 : 14} fontFamily="'Poppins', sans-serif"
                  initial={{ opacity: 0 }} animate={{ opacity: 0.8 }}
                  transition={{ delay: 0.6 + i * 0.15 }}
                >
                  {PLANET_GLYPHS[phase.planet] ?? "⭐"}
                </motion.text>

                {/* Year */}
                <text
                  x={pt.x} y={padT + plotH + 22}
                  textAnchor="middle"
                  fill={isVedic ? "#503214" : "rgba(214,198,245,0.85)"}
                  fontSize={isMobile ? 11 : 14} fontWeight="700" fontFamily="'Poppins', sans-serif"
                >
                  {phase.year}
                </text>
                {/* Age */}
                <text
                  x={pt.x} y={padT + plotH + 38}
                  textAnchor="middle"
                  fill={isVedic ? "#7A5A30" : "rgba(168,155,200,0.55)"}
                  fontSize={isMobile ? 10 : 12} fontFamily="'Poppins', sans-serif"
                >
                  Age {phase.age}
                </text>
              </g>
            );
          })}

          {/* Hit layer — full-height columns, drawn last so nothing overlaps it.
              `fill="transparent"` is deliberate: `fill="none"` is not hoverable. */}
          <g className="ig-hit-layer" onPointerLeave={handleLayerLeave}>
            {bands.map((band, i) => (
              <rect
                key={i}
                x={band.x} y={bandY}
                width={band.width} height={bandH}
                fill="transparent"
                pointerEvents="all"
                style={{ cursor: "pointer" }}
                onPointerDown={(e) => { lastPointerTypeRef.current = e.pointerType; }}
                onPointerEnter={(e) => handleBandEnter(i, e)}
                onClick={() => handleBandClick(i)}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Screen-reader announcement of the active node */}
      <div className="sr-only" aria-live="polite">
        {activePhase
          ? `${activePhase.year}, age ${activePhase.age}, ${activePhase.label}, ${phaseLabel[activePhase.phase]}, ${formatGrowthIndex(activePhase.growthIndex)}. ${activePhase.insight}`
          : ""}
      </div>

      {/* Floating tooltip — portalled to <body> because this card is
          overflow-hidden with a backdrop-filter, and the chart body scrolls
          horizontally; either would clip an in-card absolute overlay.
          Note the portal renders outside <main>, so the `.vedic-theme main …`
          overrides never reach it — every colour is set explicitly here. */}
      {activePhase && anchor && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            top: anchor.y,
            left: tipLeft,
            width: TIP_W,
            transform: tipBelow
              ? `translateY(${TIP_GAP}px)`
              : `translateY(calc(-100% - ${TIP_GAP}px))`,
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          <div
            className="relative rounded-xl px-4 py-3"
            style={{
              background: isVedic ? "#FFFDF5" : "#1A1030",
              border: `1px solid ${isVedic ? "rgba(184,134,11,0.22)" : `${activeColor}33`}`,
              boxShadow: isVedic
                ? "0 10px 30px rgba(139,105,20,0.16)"
                : "0 10px 30px rgba(0,0,0,0.45)",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              animation: "tooltipFadeIn 0.14s ease-out",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: activeColor, fontSize: 15 }}>
                {PLANET_GLYPHS[activePhase.planet] ?? "⭐"}
              </span>
              <span className="text-xs font-semibold capitalize" style={{ color: activeColor }}>
                {activePhase.label}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: `${activeColor}1F`,
                  color: activeColor,
                  border: `1px solid ${activeColor}3D`,
                }}
              >
                {phaseLabel[activePhase.phase]}
              </span>
              <span
                className="ml-auto text-xs font-semibold shrink-0"
                style={{ color: isVedic ? "#2C1810" : "#F5E9FF" }}
              >
                {formatGrowthIndex(activePhase.growthIndex)}
              </span>
            </div>
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: isVedic ? "#503214" : "rgba(214,198,245,0.65)" }}
            >
              {activePhase.insight}
            </p>

            {/* Caret — clamped independently of the card so it keeps pointing
                at the dot when the card is pushed off a viewport edge. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: caretLeft - 5,
                [tipBelow ? "top" : "bottom"]: -5,
                width: 10,
                height: 10,
                transform: "rotate(45deg)",
                background: isVedic ? "#FFFDF5" : "#1A1030",
                borderRight: tipBelow ? "none" : `1px solid ${isVedic ? "rgba(184,134,11,0.22)" : `${activeColor}33`}`,
                borderBottom: tipBelow ? "none" : `1px solid ${isVedic ? "rgba(184,134,11,0.22)" : `${activeColor}33`}`,
                borderLeft: tipBelow ? `1px solid ${isVedic ? "rgba(184,134,11,0.22)" : `${activeColor}33`}` : "none",
                borderTop: tipBelow ? `1px solid ${isVedic ? "rgba(184,134,11,0.22)" : `${activeColor}33`}` : "none",
              }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
