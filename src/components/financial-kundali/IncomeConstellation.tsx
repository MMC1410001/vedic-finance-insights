/**
 * IncomeConstellation — solar-system viz of income streams for /kundali.
 *
 * Streams are now gated by specific conditions in the user's D1 chart:
 *   - Mercury in your 3rd/10th/11th → freelance / SaaS / trading options unlock
 *   - Jupiter in your 5th/9th/11th → advisory / courses / royalties unlock
 *   - Venus in your 2nd/7th/10th → design / luxury brand / coaching unlock
 *   - Mars in your 4th/11th → real estate / engineering
 *   - Rahu in your 3rd/9th/11th/12th → foreign remote / crypto / alt assets
 * etc.
 *
 * Activation times also shrink if the stream's ruling planet matches the
 * current Mahadasha or Antardasha lord, so different charts produce visibly
 * different stream mixes and timings.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ChartData, DashaInfo, ReportScores, TransitPlanet } from "@/lib/vedicfinance-types";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import { useKundaliTheme } from "@/lib/kundali-theme-context";
import {
  buildPersonalIncomeStreams,
  type IncomeEffort,
  type PersonalIncomeStream,
} from "@/lib/chart-personalization";

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  chart: ChartData | null;
  birthYear?: number;
}

const effortColors: Record<IncomeEffort, string> = {
  passive: "#4FD1C5",
  moderate: "#F2C572",
  intensive: "#E06BAA",
};

const effortGlow: Record<IncomeEffort, string> = {
  passive: "rgba(79,209,197,0.5)",
  moderate: "rgba(242,197,114,0.5)",
  intensive: "rgba(224,107,170,0.5)",
};

export default function IncomeConstellation({ scores, dasha, transits, chart }: Props) {
  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";

  const data = useMemo(() => {
    if (!scores || !dasha || !transits || !chart) return null;
    return buildPersonalIncomeStreams(chart, dasha, transits, scores);
  }, [scores, dasha, transits, chart]);

  if (!data) return null;
  const { streams, primaryIncome } = data;
  const streamCount = streams.length;

  // ViewBox — give planets room to breathe on the outer orbits
  const W = 680;
  const H = 680;
  const cx = W / 2;
  const cy = H / 2;
  const maxOrbitR = 270;
  // Remap raw orbit radius (0..1) into an outer band so no planet crowds the sun
  const ORBIT_MIN = 0.62;
  const ORBIT_MAX = 1.0;
  const mapOrbit = (r: number) =>
    (ORBIT_MIN + Math.max(0, Math.min(1, r)) * (ORBIT_MAX - ORBIT_MIN)) * maxOrbitR;

  const [hoveredStream, setHoveredStream] = useState<string | null>(null);

  return (
    <div
      // `side-incomes-card` is a styling hook only — no colours are attached to
      // it. index.css uses it to reserve space under the legend for the
      // feedback thumbs, in both themes (AF-085).
      className="side-incomes-card rounded-2xl overflow-hidden p-5 sm:p-6"
      style={{
        background: isVedic ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.04)",
        border: isVedic ? "1px solid rgba(197,155,55,0.15)" : "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: isVedic
          ? "0 10px 40px rgba(0,0,0,0.04), 0 2px 8px rgba(154,120,30,0.05), inset 0 1px 0 rgba(255,255,255,1)"
          : "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Header */}
      <div className="pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(14px, 2.2vw, 26px)",
              color: isVedic ? "#1A1A2E" : "#F5E9FF",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.4px",
            }}
          >
            {/* Your Top Ways to Make Money */}
            Suggested Side Incomes

          </h3>
          <InsightInfoTooltip explanation="Each stream is gated by specific conditions in your D1 chart: Mercury in your 3rd/10th unlocks freelance/consulting, Jupiter in 5th/9th unlocks teaching/advisory, Venus in 2nd/7th unlocks creative/partnership income, Rahu in 3rd/11th unlocks foreign/remote work, Mars in 4th/11th unlocks real-estate. Activation times shrink when the stream's ruling planet is your current Mahadasha or Antardasha lord." />
        </div>
      </div>

      {/* Constellation SVG */}
      <div className="relative flex items-center justify-center -mx-2 sm:-mx-3 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="tiSunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F2C572" stopOpacity={0.95} />
              <stop offset="55%" stopColor="#E06B3A" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#2A0E4A" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="tiSunCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFDFA3" stopOpacity={1} />
              <stop offset="65%" stopColor="#F2C572" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#E06B3A" stopOpacity={0.8} />
            </radialGradient>
          </defs>

          {[0.35, 0.5, 0.65, 0.8, 0.95].map((r, i) => (
            <circle
              key={`orbit-${i}`}
              cx={cx}
              cy={cy}
              r={r * maxOrbitR}
              fill="none"
              stroke={isVedic ? "rgba(198,147,10,0.12)" : "rgba(200,162,255,0.12)"}
              strokeWidth={1}
              strokeDasharray="3 8"
            />
          ))}

          {[0.35, 0.5, 0.65, 0.8, 0.95].flatMap((r, ri) =>
            [0, 72, 144, 216, 288].map((angleDeg, ai) => {
              const rad = ((angleDeg + ri * 15) * Math.PI) / 180;
              const dist = r * maxOrbitR;
              return (
                <circle
                  key={`dot-${ri}-${ai}`}
                  cx={cx + Math.cos(rad) * dist}
                  cy={cy + Math.sin(rad) * dist}
                  r={1.5}
                  fill={isVedic ? "rgba(198,147,10,0.12)" : "rgba(200,162,255,0.15)"}
                />
              );
            }),
          )}

          {streams.map((stream: PersonalIncomeStream, i: number) => {
            const rad = (stream.angle * Math.PI) / 180;
            const dist = mapOrbit(stream.orbitRadius);
            const px = cx + Math.cos(rad) * dist;
            const py = cy + Math.sin(rad) * dist;
            const color = effortColors[stream.effort];
            return (
              <motion.line
                key={`conn-${i}`}
                x1={cx}
                y1={cy}
                x2={px}
                y2={py}
                stroke={color}
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.2}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              />
            );
          })}

          <motion.circle
            cx={cx}
            cy={cy}
            r={58}
            fill="url(#tiSunGlow)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
          />
          <motion.circle
            cx={cx}
            cy={cy}
            r={42}
            fill="url(#tiSunCore)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
          />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill="#2A0E4A"
            fontSize={16}
            fontWeight="700"
            fontFamily="'Poppins', sans-serif"
          >
            Salary
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fill="rgba(42,14,74,0.7)"
            fontSize={12}
            fontWeight="600"
            fontFamily="'Poppins', sans-serif"
          >
            {primaryIncome}
          </text>

          {streams.map((stream: PersonalIncomeStream, i: number) => {
            const rad = (stream.angle * Math.PI) / 180;
            const dist = mapOrbit(stream.orbitRadius);
            const px = cx + Math.cos(rad) * dist;
            const py = cy + Math.sin(rad) * dist;
            const circleR = 28 + stream.size * 18;
            const color = effortColors[stream.effort];
            const glow = effortGlow[stream.effort];
            const isHovered = hoveredStream === stream.name;

            return (
              <motion.g
                key={stream.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.12, duration: 0.5, type: "spring" }}
                onMouseEnter={() => setHoveredStream(stream.name)}
                onMouseLeave={() => setHoveredStream(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={px}
                  cy={py}
                  r={circleR + 5}
                  fill={isVedic ? "rgba(255,255,255,0.9)" : "rgba(20,12,40,0.6)"}
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 2}
                  opacity={isHovered ? 1 : 0.7}
                />
                <circle
                  cx={px}
                  cy={py}
                  r={circleR}
                  fill={color}
                  style={{ filter: `drop-shadow(0 0 ${isHovered ? 18 : 12}px ${glow})` }}
                />
                <text
                  x={px}
                  y={py + 6}
                  textAnchor="middle"
                  fill="#2A0E4A"
                  fontSize={16}
                  fontWeight="800"
                  fontFamily="'Poppins', sans-serif"
                >
                  {stream.amount}
                </text>
                <text
                  x={px}
                  y={py - circleR - 16}
                  textAnchor="middle"
                  fill={isVedic ? "#1A1A2E" : "#F5E9FF"}
                  fontSize={20}
                  fontWeight="700"
                  fontFamily="'Poppins', sans-serif"
                  style={{ letterSpacing: "-0.2px" }}
                >
                  {stream.name}
                </text>
                <text
                  x={px}
                  y={py + circleR + 19}
                  textAnchor="middle"
                  fill={isVedic ? "rgba(61,53,82,0.7)" : "#FFFFFF"}
                  fontSize={12}
                  fontFamily="'Poppins', sans-serif"
                >
                  {stream.activationTime} · {stream.rulingPlanet}
                </text>

                {/* Tooltip on hover — rendered as HTML overlay below */}
              </motion.g>
            );
          })}
        </svg>

        {/* HTML tooltip — positioned over SVG, supports text wrapping */}
        {hoveredStream && (() => {
          const stream = streams.find((s: PersonalIncomeStream) => s.name === hoveredStream);
          if (!stream) return null;
          const color = effortColors[stream.effort];
          return (
            <div
              className="absolute left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl max-w-[280px] w-[90%] text-center pointer-events-none"
              style={{
                bottom: "12px",
                background: isVedic ? "#FFFDF5" : "#1A1030",
                backgroundColor: isVedic ? "#FFFDF5" : "#1A1030",
                border: isVedic ? "1.5px solid rgba(184,134,11,0.3)" : `1.5px solid ${color}55`,
                boxShadow: isVedic
                  ? "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(184,134,11,0.1)"
                  : "0 4px 20px rgba(0,0,0,0.6)",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
                opacity: 1,
              }}
            >
              <p
                className="text-[12px] font-semibold leading-snug mb-1"
                style={{ color: isVedic ? "#2C1810" : "#F5E9FF", fontFamily: "'Poppins', sans-serif" }}
              >
                {stream.reason}
              </p>
              <p
                className="text-[10px] capitalize"
                style={{ color: isVedic ? "rgba(80,50,20,0.6)" : "rgba(200,185,230,0.7)", fontFamily: "'Poppins', sans-serif" }}
              >
                {stream.effort} · {stream.activationTime} · {stream.rulingPlanet}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Bottom legend */}
      <div
        className="pt-4 pb-2"
        style={{ borderTop: isVedic ? "1px solid rgba(197,155,55,0.08)" : "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4 sm:gap-5 mb-2 mt-2">
              {(["passive", "moderate", "intensive"] as const).map((level) => (
                <div key={level} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full phase-dot"
                    style={{ background: effortColors[level], boxShadow: `0 0 6px ${effortGlow[level]}` }}
                  />
                  <span
                    className="text-[11px] capitalize font-medium"
                    style={{ color: isVedic ? "rgba(26,26,46,0.8)" : "rgba(214,198,245,0.85)" }}
                  >
                    {level}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: isVedic ? "rgba(61,53,82,0.5)" : "rgba(168,155,200,0.6)" }}>
                <span className="w-1 h-1 rounded-full bg-current" />
                Closer = Activates sooner
              </p>
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: isVedic ? "rgba(61,53,82,0.5)" : "rgba(168,155,200,0.6)" }}>
                <span className="w-1 h-1 rounded-full bg-current" />
                Larger = Pays more
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 self-end">
            <p
              className="text-2xl font-bold italic leading-none"
              style={{ color: isVedic ? "#9B7B2C" : "#F2C572", fontFamily: "'Poppins', sans-serif" }}
            >
              {streamCount}
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.12em] mt-1"
              style={{ color: isVedic ? "rgba(61,53,82,0.45)" : "rgba(168,155,200,0.55)" }}
            >
              Active for your chart
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
