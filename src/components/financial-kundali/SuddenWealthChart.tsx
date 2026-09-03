/**
 * SuddenWealthChart — Sudden Wealth Probability chart for /kundali.
 *
 * Personalised from the user's ACTUAL chart (planets in 2nd/5th/8th/11th houses,
 * dignities, nakshatras) — not just the 7 scalar scores. Different placements
 * produce different trigger categories, timing, and peak windows, so two users
 * with similar scores but different charts see different outcomes.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import type {
  ChartData,
  DashaInfo,
  ReportScores,
  ReportTimeline,
  TransitPlanet,
} from "@/lib/vedicfinance-types";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import { buildPersonalWealthTriggers } from "@/lib/chart-personalization";
import { useKundaliTheme } from "@/lib/kundali-theme-context";

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  timeline: ReportTimeline | null;
  chart: ChartData | null;
  birthYear?: number;
}

/**
 * Build a strictly monotonic probability curve path across the age range.
 * We sample the x-axis at a fixed resolution and compute y as the max of:
 *  - a small ambient baseline (so the curve never sits at zero), and
 *  - Gaussian peaks centred on each event age.
 * The resulting path moves only forward in x and never self-crosses.
 */
function buildCurvePath(
  events: { age: number; probability: number }[],
  startAge: number,
  endAge: number,
  peakStartAge: number,
  peakEndAge: number,
  xScale: (a: number) => number,
  yScale: (p: number) => number,
): string {
  const SAMPLES = 160;
  const sigma = 0.55; // peak half-width in "years"
  const ageRange = endAge - startAge;
  const step = ageRange / SAMPLES;

  // Baseline ramps gently upward inside the peak window, low outside it
  const baselineAt = (a: number) => {
    if (a < peakStartAge - 0.5) return 3;
    if (a > peakEndAge + 0.5) return 6;
    // rises from 4 at window start to ~12 at window end
    const t = (a - peakStartAge) / Math.max(1, peakEndAge - peakStartAge);
    return 4 + t * 8;
  };

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const a = startAge + i * step;
    let prob = baselineAt(a);
    for (const evt of events) {
      const d = a - evt.age;
      const gaussian = Math.exp(-(d * d) / (2 * sigma * sigma));
      // amplitude: event peak minus baseline floor at that point
      const amp = Math.max(0, evt.probability - baselineAt(evt.age));
      const contribution = amp * gaussian;
      if (contribution > prob - baselineAt(a)) {
        prob = baselineAt(a) + contribution;
      }
    }
    // clamp
    prob = Math.max(0, Math.min(100, prob));
    pts.push({ x: xScale(a), y: yScale(prob) });
  }

  if (pts.length < 2) return "";
  // Smooth catmull-rom → cubic bezier (strictly forward in x by construction)
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function SuddenWealthChart({
  scores,
  dasha,
  transits,
  timeline,
  chart,
  birthYear,
}: Props) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";
  const effectiveBirthYear = birthYear ?? new Date().getFullYear() - 30;

  const data = useMemo(() => {
    if (!scores || !dasha || !transits || !chart) return null;

    const base = buildPersonalWealthTriggers(chart, dasha, transits, scores, effectiveBirthYear);

    // Prefer timeline.favorable_periods for the window when present; otherwise use chart-derived.
    let peakStartYear = base.peakStartYear;
    let peakEndYear = base.peakEndYear;
    if (timeline?.favorable_periods?.length) {
      let best = timeline.favorable_periods[0];
      let bestDur = 0;
      for (const p of timeline.favorable_periods) {
        const s = new Date(p.start).getFullYear();
        const e = new Date(p.end).getFullYear();
        if (e - s > bestDur) {
          bestDur = e - s;
          best = p;
        }
      }
      const s = new Date(best.start).getFullYear();
      const e = new Date(best.end).getFullYear();
      if (!isNaN(s) && !isNaN(e) && e > s) {
        peakStartYear = s;
        peakEndYear = e;
      }
    }

    const peakStartAge = peakStartYear - effectiveBirthYear;
    const peakEndAge = peakEndYear - effectiveBirthYear;

    // Event list from the chart-derived triggers. Cap at 2 — the chart reads
    // best with exactly 2 labelled peaks; more creates visual clutter and collisions.
    const events = base.triggers.slice(0, 2).map((t) => ({
      label: t.source,
      probability: t.probability,
      age: t.ageWhen ?? peakStartAge + 1,
      year: (t.ageWhen ?? peakStartAge + 1) + effectiveBirthYear,
    }));

    return {
      overallProb: base.overallProbability,
      riskLevel: base.riskLevel,
      peakStartAge,
      peakEndAge,
      peakStartYear,
      peakEndYear,
      events,
      startAge: peakStartAge - 3,
      endAge: peakEndAge + 3,
    };
  }, [chart, dasha, transits, scores, timeline, effectiveBirthYear]);

  if (!data) return null;

  const {
    riskLevel,
    peakStartAge,
    peakEndAge,
    peakStartYear,
    peakEndYear,
    events,
    startAge,
    endAge,
  } = data;

  const riskColor =
    riskLevel === "High" ? "#2FBF9F" : riskLevel === "Moderate" ? "#F2C572" : "#E06BAA";

  const W = 640;
  const H = 400;
  const padL = 72;
  const padR = 28;
  const padT = 28;
  const padB = 72;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const ageRange = Math.max(1, endAge - startAge);
  const xScale = (age: number) => padL + ((age - startAge) / ageRange) * plotW;
  const yScale = (prob: number) => padT + plotH - (prob / 100) * plotH;

  const ageTicks: number[] = [];
  for (let a = startAge; a <= endAge; a++) ageTicks.push(a);
  const probTicks = [0, 50, 100];

  const pwX1 = xScale(peakStartAge);
  const pwX2 = xScale(peakEndAge);
  const pwY1 = padT;
  const pwY2 = padT + plotH;

  const curvePath = buildCurvePath(
    events,
    startAge,
    endAge,
    peakStartAge,
    peakEndAge,
    xScale,
    yScale,
  );
  const areaPath = curvePath
    ? `${curvePath} L ${xScale(endAge)},${padT + plotH} L ${xScale(startAge)},${padT + plotH} Z`
    : "";

  return (
    <div
      className="sudden-wealth-card rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 md:px-10 pt-6 sm:pt-8 md:pt-8 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "clamp(14px, 2.2vw, 26px)",
                color: isVedic ? "#2C1810" : "#F5E9FF",
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.3px",
              }}
            >
              Surprise Wealth Gains
            </h3>
            <InsightInfoTooltip explanation="Every event on this chart is generated from a specific planet in your chart: e.g. Rahu in 5th → speculation/lottery, Jupiter in 8th → inheritance, Venus in 11th → network windfall, Mercury in 11th → client-referral boom. The peak window anchors to your current antardasha end date + your strongest wealth-yoga planet." />
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <motion.span
              className="text-xs sm:text-sm font-bold uppercase tracking-[0.08em] px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl"
              style={{
                color: riskColor,
                background: `${riskColor}10`,
                border: `1.5px solid ${riskColor}50`,
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              {riskLevel}
            </motion.span>
            <span
              className="text-[10px] sm:text-[11px] font-medium px-2 sm:px-2.5 py-1 rounded-lg"
              style={{
                color: "#4FD1C5",
                background: "rgba(79,209,197,0.08)",
                border: "1px solid rgba(79,209,197,0.2)",
              }}
            >
              Peak ( {peakStartYear} – {String(peakEndYear).slice(2)} )
            </span>
          </div>
        </div>
      </div>

      {/* Chart — `sw-chart-body` is a styling hook only (no Cosmic styles are
          attached to it); the Vedic override in index.css uses it to add
          bottom padding under the feedback buttons (AF-085). */}
      <div className="sw-chart-body px-4 md:px-6 pb-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="swAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="sw-grad-stop-1" stopColor={isVedic ? "#B8860B" : "#7B2D3E"} stopOpacity={isVedic ? 0.3 : 0.55} />
              <stop offset="60%" className="sw-grad-stop-2" stopColor={isVedic ? "#D4A843" : "#5A1E2A"} stopOpacity={isVedic ? 0.15 : 0.25} />
              <stop offset="100%" className="sw-grad-stop-3" stopColor={isVedic ? "#F2C572" : "#3A0F18"} stopOpacity={isVedic ? 0.04 : 0.05} />
            </linearGradient>
            <clipPath id="swPlotClip">
              <rect x={padL} y={padT} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          <motion.rect
            x={pwX1}
            y={pwY1}
            width={pwX2 - pwX1}
            height={pwY2 - pwY1}
            rx={8}
            fill={isVedic ? "rgba(184,134,11,0.04)" : "rgba(47,191,159,0.04)"}
            stroke={isVedic ? "#B8860B" : "#2FBF9F"}
            strokeWidth={1.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          />

          {areaPath && (
            <motion.path
              d={areaPath}
              fill="url(#swAreaGrad)"
              clipPath="url(#swPlotClip)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.6 }}
            />
          )}

          {curvePath && (
            <motion.path
              d={curvePath}
              fill="none"
              stroke={isVedic ? "#8B5A3C" : "#9B3A4A"}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath="url(#swPlotClip)"
              className="sw-curve-line"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, ease: "easeInOut", delay: 0.5 }}
              style={{ filter: `drop-shadow(0 0 4px ${isVedic ? "rgba(139,90,60,0.4)" : "rgba(155,58,74,0.5)"})` }}
            />
          )}

          <line x1={padL} y1={padT - 12} x2={padL} y2={padT + plotH} stroke={isVedic ? "#B8860B" : "#F2C572"} strokeWidth={2} />
          <polygon points={`${padL},${padT - 18} ${padL - 5},${padT - 8} ${padL + 5},${padT - 8}`} fill={isVedic ? "#B8860B" : "#F2C572"} />

          <line
            x1={padL}
            y1={padT + plotH}
            x2={padL + plotW + 18}
            y2={padT + plotH}
            stroke={isVedic ? "#B8860B" : "#F2C572"}
            strokeWidth={2}
          />
          <polygon
            points={`${padL + plotW + 24},${padT + plotH} ${padL + plotW + 14},${padT + plotH - 5} ${padL + plotW + 14},${padT + plotH + 5}`}
            fill={isVedic ? "#B8860B" : "#F2C572"}
          />

          <text
            x={16}
            y={padT + plotH / 2}
            textAnchor="middle"
            fill={isVedic ? "#8B6914" : "#F2C572"}
            fontSize={13}
            fontWeight="700"
            fontFamily="'Poppins', 'Inter', sans-serif"
            fontStyle="italic"
            transform={`rotate(-90, 16, ${padT + plotH / 2})`}
          >
            Probability
          </text>
          <text
            x={padL + plotW / 2}
            y={H - 10}
            textAnchor="middle"
            fill={isVedic ? "#8B6914" : "#F2C572"}
            fontSize={13}
            fontWeight="700"
            fontFamily="'Poppins', 'Inter', sans-serif"
            fontStyle="italic"
          >
            Age
          </text>

          {probTicks.map((p) => (
            <g key={p}>
              <text
                x={padL - 10}
                y={yScale(p) + 4}
                textAnchor="end"
                fill={isVedic ? "#8B6914" : "#4FD1C5"}
                fontSize={14}
                fontWeight="700"
                fontFamily="'Poppins', 'Inter', sans-serif"
              >
                {p}%
              </text>
              <line
                x1={padL + 2}
                y1={yScale(p)}
                x2={padL + plotW}
                y2={yScale(p)}
                stroke={isVedic ? "rgba(184,134,11,0.08)" : "rgba(255,255,255,0.04)"}
                strokeDasharray="3 6"
              />
            </g>
          ))}

          {ageTicks.map((age) => {
            const inWin = age >= peakStartAge && age <= peakEndAge;
            return (
              <text
                key={age}
                x={xScale(age)}
                y={padT + plotH + 22}
                textAnchor="middle"
                fill={inWin ? (isVedic ? "#8B6914" : "#F2C572") : (isVedic ? "#6B5A3D" : "rgba(214,198,245,0.75)")}
                fontSize={14}
                fontWeight={inWin ? "700" : "500"}
                fontFamily="'Poppins', 'Inter', sans-serif"
              >
                {age}
              </text>
            );
          })}

          {/* ── Event labels with proper collision-avoidance layout ── */}
          {(() => {
            // Sort events left-to-right so collision layout is deterministic
            const sortedEvents = [...events].sort((a, b) => a.age - b.age);
            const sortedWithIndex = sortedEvents.map((evt) => ({
              evt,
              origIndex: events.indexOf(evt),
            }));

            // Layout constants
            const LINE_H = 16;
            const FONT = 13;
            const CHIP_FONT = 11;
            const PAD_X = 9;
            const PAD_Y = 5;
            const GAP = 22; // vertical distance from dot to label box
            const CHIP_W = 0; // no probability chip
            const charApprox = 7;

            // Build the raw label boxes
            const boxes = sortedWithIndex.map(({ evt, origIndex }) => {
              const ex = xScale(evt.age);
              const ey = yScale(evt.probability);

              // Break label into up-to-2 balanced lines (~16 chars each)
              const words = evt.label.split(" ");
              const lines: string[] = [];
              let cur = "";
              for (const w of words) {
                if ((cur + " " + w).trim().length <= 16) {
                  cur = (cur + " " + w).trim();
                } else {
                  if (cur) lines.push(cur);
                  cur = w;
                }
              }
              if (cur) lines.push(cur);
              const labelLines = lines.slice(0, 2);
              if (lines.length > 2) labelLines[1] = labelLines[1] + "…";

              const textWidth = Math.max(...labelLines.map((l) => l.length)) * charApprox;
              const boxW = textWidth + CHIP_W + PAD_X * 2;
              const boxH = labelLines.length * LINE_H + PAD_Y * 2 - 2;

              // Alternate top/bottom: even origIndex → above the dot, odd → below
              const placeAbove = origIndex % 2 === 0;

              // Initial horizontal anchor: centre the box above/below the dot
              let boxX = ex - boxW / 2;
              // Clamp so the box doesn't exit the plot on the sides
              const minX = padL + 6;
              const maxX = padL + plotW - boxW - 6;
              if (boxX < minX) boxX = minX;
              if (boxX > maxX) boxX = maxX;

              const boxY = placeAbove ? ey - GAP - boxH : ey + GAP;

              return {
                evt,
                origIndex,
                ex,
                ey,
                boxX,
                boxY,
                boxW,
                boxH,
                labelLines,
                placeAbove,
              };
            });

            // Resolve horizontal collisions within same row (above / below).
            // Group by placement and shift overlapping boxes apart.
            for (const placement of [true, false]) {
              const row = boxes.filter((b) => b.placeAbove === placement);
              row.sort((a, b) => a.boxX - b.boxX);
              for (let i = 1; i < row.length; i++) {
                const prev = row[i - 1];
                const cur = row[i];
                const minX = prev.boxX + prev.boxW + 8;
                if (cur.boxX < minX) cur.boxX = minX;
              }
              // If the last box overflowed, pull it back and push its predecessors leftward
              const maxX = padL + plotW - 6;
              for (let i = row.length - 1; i >= 0; i--) {
                const cur = row[i];
                const limit = maxX - cur.boxW;
                if (cur.boxX > limit) cur.boxX = limit;
                if (i > 0) {
                  const prev = row[i - 1];
                  const prevLimit = cur.boxX - prev.boxW - 8;
                  if (prev.boxX > prevLimit) prev.boxX = prevLimit;
                }
              }
            }

            return boxes.map(({ evt, origIndex, ex, ey, boxX, boxY, boxW, boxH, labelLines, placeAbove }) => {
              // Leader-line endpoints: middle-top of box (if below) or middle-bottom (if above)
              const leaderX = Math.min(Math.max(ex, boxX + 12), boxX + boxW - 12);
              const leaderY = placeAbove ? boxY + boxH : boxY;
              const dotEdgeY = placeAbove ? ey - 9 : ey + 9;

              return (
                <motion.g
                  key={`evt-${origIndex}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.0 + origIndex * 0.16, type: "spring", stiffness: 180 }}
                >
                  {/* Vertical dashed crosshair to X-axis */}
                  <line
                    x1={ex}
                    y1={ey + 9}
                    x2={ex}
                    y2={padT + plotH}
                    stroke={isVedic ? "#D4A843" : "#2FBF9F"}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.45}
                  />
                  {/* Horizontal dashed crosshair to Y-axis */}
                  <line
                    x1={padL}
                    y1={ey}
                    x2={ex - 9}
                    y2={ey}
                    stroke={isVedic ? "#D4A843" : "#2FBF9F"}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.45}
                  />

                  {/* Dot */}
                  <circle cx={ex} cy={ey} r={14} fill={isVedic ? "rgba(184,134,11,0.12)" : "rgba(47,191,159,0.12)"} />
                  <circle
                    cx={ex}
                    cy={ey}
                    r={8}
                    fill={isVedic ? "#B8860B" : "#2FBF9F"}
                    style={{ filter: `drop-shadow(0 0 8px ${isVedic ? "rgba(184,134,11,0.5)" : "rgba(47,191,159,0.7)"})` }}
                  />
                  <circle cx={ex} cy={ey} r={3} fill="rgba(255,255,255,0.9)" />

                  {/* Leader line from dot edge to label text */}
                  <line
                    x1={ex}
                    y1={dotEdgeY}
                    x2={leaderX}
                    y2={leaderY}
                    stroke={isVedic ? "rgba(184,134,11,0.4)" : "rgba(242,197,114,0.4)"}
                    strokeWidth={1}
                  />

                  {/* Label text — left side of plate */}
                  <text
                    x={boxX + PAD_X}
                    y={boxY + PAD_Y + FONT}
                    fill={isVedic ? "#6B4E0A" : "#F2C572"}
                    fontSize={FONT}
                    fontWeight={600}
                    fontFamily="'Poppins', 'Inter', sans-serif"
                    style={{ letterSpacing: "0.01em" }}
                  >
                    {labelLines.map((line, li) => (
                      <tspan key={li} x={boxX + PAD_X} dy={li === 0 ? 0 : LINE_H}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </motion.g>
              );
            });
          })()}
        </svg>
      </div>
    </div>
  );
}
