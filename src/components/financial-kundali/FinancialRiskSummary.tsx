/**
 * FinancialRiskSummary — "Financial Risk & Stability Outlook" multi-line chart.
 * Shows Loss Risk (pink) and Stability (teal) curves over 12 months.
 * Gold diamond markers for external disruption events.
 * Matches reference image exactly.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ReportScores, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
}

interface MonthData {
  month: string;
  lossRisk: number;
  stability: number;
  externalFactor: { label: string; severity: number } | null;
}

const RISK_LORDS = ["Rahu", "Mars", "Saturn", "Ketu"];
const STABILITY_LORDS = ["Jupiter", "Venus", "Mercury", "Moon"];

function buildMonthlyData(scores: ReportScores, dasha: DashaInfo | null, transits: TransitPlanet[] | null): MonthData[] {
  const now = new Date();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dashaLord = dasha?.mahadasha_lord ?? "Jupiter";
  const antarLord = dasha?.antardasha_lord ?? "Saturn";

  const dashaRiskMod = RISK_LORDS.includes(dashaLord) ? 10 : 0;
  const antarRiskMod = RISK_LORDS.includes(antarLord) ? 6 : 0;
  const dashaStabilityMod = STABILITY_LORDS.includes(dashaLord) ? 8 : 0;

  const baseRisk = scores.risk_score * 0.35 + (100 - scores.natal_wealth_score) * 0.3 +
    scores.expense_score * 0.2 + (100 - scores.timing_score) * 0.15;
  const baseStability = scores.natal_wealth_score * 0.35 + scores.savings_score * 0.25 +
    scores.income_score * 0.25 + scores.timing_score * 0.15;

  // Find external factors from transits
  const extFactors = new Map<number, { label: string; severity: number }>();
  transits?.forEach(t => {
    if (t.impact === "challenging") {
      const monthIdx = t.natal_house % 12;
      if (!extFactors.has(monthIdx)) {
        extFactors.set(monthIdx, {
          label: `${t.planet} in ${t.sign}, ${t.retrograde ? "retrograde disruption" : "challenging transit"}`,
          severity: Math.min(75, 40 + (t.retrograde ? 20 : 0)),
        });
      }
    }
  });

  return MONTHS.map((month, i) => {
    const monthPlanets = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
    const ruler = monthPlanets[i % 7];
    const rulerRiskMod = RISK_LORDS.includes(ruler) ? 5 : -3;
    const rulerStabilityMod = STABILITY_LORDS.includes(ruler) ? 4 : -2;
    const ext = extFactors.get(i) ?? null;
    const extSpike = ext ? ext.severity * 0.18 : 0;

    const lossRisk = Math.min(88, Math.max(10, baseRisk * 0.55 + dashaRiskMod + antarRiskMod + rulerRiskMod + extSpike));
    const stability = Math.min(90, Math.max(12, baseStability * 0.55 + dashaStabilityMod + rulerStabilityMod - extSpike * 0.5));

    return { month, lossRisk: Math.round(lossRisk), stability: Math.round(stability), externalFactor: ext };
  });
}

export default function FinancialRiskSummary({ scores, dasha, transits }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const months = useMemo(() => {
    if (!scores) return [];
    return buildMonthlyData(scores, dasha, transits);
  }, [scores, dasha, transits]);

  if (!scores || months.length === 0) return null;

  // Find the maximum loss risk value, then collect all months that share it
  const maxRisk = months.reduce((max, m) => Math.max(max, m.lossRisk), 0);
  const peakRiskMonths = months.filter((m) => m.lossRisk === maxRisk);
  const peakRiskLabel = peakRiskMonths.map((m) => m.month).join(", ");

  /* ── SVG ── */
  const W = 900;
  const H = 200;
  const padL = 38;
  const padR = 40;
  const padT = 10;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xScale = (i: number) => padL + (i / 11) * plotW;
  const yScale = (v: number) => padT + plotH - (v / 100) * plotH;

  function catmullRom(pts: { x: number; y: number }[]): string {
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

  const riskPts = months.map((m, i) => ({ x: xScale(i), y: yScale(m.lossRisk) }));
  const stabilityPts = months.map((m, i) => ({ x: xScale(i), y: yScale(m.stability) }));
  const riskPath = catmullRom(riskPts);
  const stabilityPath = catmullRom(stabilityPts);
  const riskAreaPath = riskPts.length >= 2
    ? `${riskPath} L ${riskPts[riskPts.length - 1].x},${padT + plotH} L ${riskPts[0].x},${padT + plotH} Z`
    : "";

  const externalEvents = months.filter(m => m.externalFactor);

  return (
    <div
      className="financial-risk-card rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-1">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
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
                Financial Risk &amp; Stability Outlook
              </h3>
              <InsightInfoTooltip explanation="This chart analyses your current Mahadasha and Antardasha lords, checks which planets are transiting challenging houses in your birth chart, and identifies retrograde periods that may cause financial stress." />
            </div>
            <p className="text-[10px] sm:text-[11px]" style={{ color: "rgba(168,155,200,0.5)" }}>
              Based on {dasha?.mahadasha_lord}/{dasha?.antardasha_lord} dasha &amp; current transits
            </p>
          </div>
          {/* Peak risk badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 w-fit"
            style={{ background: "rgba(224,107,170,0.1)", border: "1px solid rgba(224,107,170,0.25)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#E06BAA" }}>
              Peak Risk: {peakRiskLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 sm:gap-5 mt-1.5">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(214,198,245,0.7)" }}>
            <span className="w-2.5 h-2.5 rounded-full phase-dot" style={{ background: "#E06BAA", boxShadow: "0 0 5px rgba(224,107,170,0.5)" }} />
            Loss Risk
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(214,198,245,0.7)" }}>
            <span className="w-2.5 h-2.5 rounded-full phase-dot" style={{ background: "#2FBF9F", boxShadow: "0 0 5px rgba(47,191,159,0.5)" }} />
            Stability
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(214,198,245,0.7)" }}>
            <span className="text-[#F2C572] text-xs">◆</span>
            <span style={{ color: "#F2C572" }}>External Factor</span>
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 sm:px-4 lg:px-6 pb-4">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="riskAreaGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E06BAA" stopOpacity={0.14} />
              <stop offset="70%" stopColor="#E06BAA" stopOpacity={0.03} />
              <stop offset="100%" stopColor="#080310" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[25, 50, 75].map(v => (
            <g key={v}>
              <line x1={padL} y1={yScale(v)} x2={padL + plotW} y2={yScale(v)}
                stroke="rgba(255,255,255,0.04)" strokeDasharray="4 6" />
              <text x={padL - 8} y={yScale(v) + 4} textAnchor="end"
                fill="rgba(168,155,200,0.4)" fontSize={10} fontFamily="'Poppins', sans-serif">
                {v}
              </text>
            </g>
          ))}

          {/* Hover column */}
          {hoveredIdx !== null && (
            <rect x={xScale(hoveredIdx) - plotW / 24} y={padT}
              width={plotW / 12} height={plotH}
              fill="rgba(255,255,255,0.025)" rx={3} />
          )}

          {/* Risk area */}
          {riskAreaPath && (
            <motion.path d={riskAreaPath} fill="url(#riskAreaGrad2)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 1 }} />
          )}

          {/* Risk line */}
          <motion.path d={riskPath} fill="none" stroke="#E06BAA" strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
            style={{ filter: "drop-shadow(0 0 4px rgba(224,107,170,0.5))" }} />

          {/* Stability line */}
          <motion.path d={stabilityPath} fill="none" stroke="#2FBF9F" strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.8, ease: "easeInOut", delay: 0.2 }}
            style={{ filter: "drop-shadow(0 0 4px rgba(47,191,159,0.4))" }} />

          {/* External factor diamonds */}
          {months.map((m, i) => {
            if (!m.externalFactor) return null;
            const markerY = (riskPts[i].y + stabilityPts[i].y) / 2 - 14;
            return (
              <motion.g key={`ext-${i}`}
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.05 }}>
                <line x1={xScale(i)} y1={markerY + 6} x2={xScale(i)} y2={padT + plotH}
                  stroke="rgba(242,197,114,0.15)" strokeDasharray="3 4" />
                <polygon
                  points={`${xScale(i)},${markerY - 6} ${xScale(i) + 6},${markerY} ${xScale(i)},${markerY + 6} ${xScale(i) - 6},${markerY}`}
                  fill="#F2C572" opacity={0.85}
                  style={{ filter: "drop-shadow(0 0 5px rgba(242,197,114,0.5))" }} />
              </motion.g>
            );
          })}

          {/* Hover dots */}
          {hoveredIdx !== null && (
            <>
              <circle cx={riskPts[hoveredIdx].x} cy={riskPts[hoveredIdx].y} r={4}
                fill="#E06BAA" style={{ filter: "drop-shadow(0 0 5px rgba(224,107,170,0.6))" }} />
              <circle cx={stabilityPts[hoveredIdx].x} cy={stabilityPts[hoveredIdx].y} r={4}
                fill="#2FBF9F" style={{ filter: "drop-shadow(0 0 5px rgba(47,191,159,0.6))" }} />
            </>
          )}

          {/* X-axis month labels + single hover zone to prevent jitter */}
          <rect
            x={padL} y={padT}
            width={plotW} height={plotH + padB}
            fill="transparent"
            onMouseMove={(e) => {
              const svg = e.currentTarget.closest("svg");
              if (!svg) return;
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
              const relX = svgPt.x - padL;
              const idx = Math.round((relX / plotW) * 11);
              const clamped = Math.max(0, Math.min(11, idx));
              setHoveredIdx(clamped);
            }}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ cursor: "pointer" }}
          />
          {months.map((m, i) => (
            <text key={i} x={xScale(i)} y={H - 8} textAnchor="middle"
              fill={hoveredIdx === i ? "#F5E9FF" : "rgba(168,155,200,0.55)"}
              fontSize={10} fontWeight={hoveredIdx === i ? "700" : "500"}
              fontFamily="'Poppins', sans-serif"
              style={{ pointerEvents: "none" }}>
              {m.month}
            </text>
          ))}
        </svg>
      </div>

      {/* Hover tooltip — fixed height container prevents layout shift */}
      <div className="px-4 sm:px-6 pb-3" style={{ minHeight: "52px" }}>
        {hoveredIdx !== null ? (
          <motion.div key={hoveredIdx}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="rounded-xl px-4 py-2.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-bold" style={{ color: "#F5E9FF" }}>{months[hoveredIdx].month}</span>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#E06BAA" }}>
                <span className="w-1.5 h-1.5 rounded-full phase-dot bg-current" />
                Loss Risk: {months[hoveredIdx].lossRisk}%
              </span>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#2FBF9F" }}>
                <span className="w-1.5 h-1.5 rounded-full phase-dot bg-current" />
                Stability: {months[hoveredIdx].stability}%
              </span>
            </div>
            {months[hoveredIdx].externalFactor && (
              <p className="text-[10px] mt-1 flex items-center gap-1.5" style={{ color: "#F2C572" }}>
                <span>◆</span> {months[hoveredIdx].externalFactor!.label}
              </p>
            )}
          </motion.div>
        ) : (
          <div className="h-[40px]" />
        )}
      </div>

      {/* External disruption events */}
      {externalEvents.length > 0 && (
        <div className="px-4 sm:px-6 pb-5">
          <p className="text-[9px] uppercase tracking-[0.12em] mb-2.5" style={{ color: "rgba(168,155,200,0.4)" }}>
            External Disruption Events
          </p>
          <div className="flex flex-wrap gap-2">
            {externalEvents.map((m, i) => (
              <motion.div key={i}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: "rgba(242,197,114,0.04)", border: "1px solid rgba(242,197,114,0.12)" }}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}>
                <span className="text-[#F2C572] text-xs">◆</span>
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "rgba(214,198,245,0.75)" }}>
                    {m.externalFactor!.label}
                  </p>
                  <p className="text-[9px]" style={{ color: "rgba(168,155,200,0.4)" }}>
                    {m.month} • Severity {m.externalFactor!.severity}%
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
