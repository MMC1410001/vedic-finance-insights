/**
 * ArchetypeHeroSection — top hero section for /kundali page.
 *
 * Left:  Money Personality Archetype card (matching reference design)
 * Right: Mini Kundali chart + Sun sign badge
 *
 * Data comes from the same report used by /dashboard (d1_chart + scores).
 */

import { useMemo, useState } from "react";
import { computeMoneyArchetype } from "@/lib/financial-kundali-engine";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import {
  KundaliSVG,
  ZODIAC_SYMBOLS,
  PLANET_COLORS,
  PLANET_ABBR,
} from "@/components/vedicfinance/NatalChartVisual";
import type { ChartData, ReportScores } from "@/lib/vedicfinance-types";

interface Props {
  chart: ChartData;
  scores: ReportScores;
}

export default function ArchetypeHeroSection({ chart, scores }: Props) {
  const archetype = useMemo(
    () => computeMoneyArchetype(chart, scores),
    [chart, scores],
  );

  const [activeHouse, setActiveHouse] = useState<number | null>(null);

  /* Derive sun sign from chart planets */
  const sunPlanet = chart.planets.find((p) => p.planet === "Sun");
  const sunSign = sunPlanet?.sign ?? "—";
  const sunSignNum = sunPlanet?.sign_num;
  const lagnaHouse = chart.houses.find((h) => h.house === 1);
  const lagnaSign = lagnaHouse?.sign ?? chart.lagna_sign ?? "—";
  const lagnaSignNum = lagnaHouse?.sign_num;
  const moonPlanet = chart.planets.find((p) => p.planet === "Moon");
  const moonSign = moonPlanet?.sign ?? "—";
  const moonSignNum = moonPlanet?.sign_num;

  return (
    <div className="mb-6 md:mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* ── Left: Archetype Card ── */}
        <div
          className="relative rounded-2xl overflow-hidden p-5 md:p-7 flex flex-col justify-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Geometric constellation background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg
              viewBox="0 0 400 400"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] opacity-[0.08]"
              fill="none"
            >
              {/* Constellation-like geometric lines */}
              <g stroke="rgba(242,197,114,0.6)" strokeWidth="0.5">
                <line x1="50" y1="80" x2="200" y2="40" />
                <line x1="200" y1="40" x2="350" y2="100" />
                <line x1="350" y1="100" x2="300" y2="250" />
                <line x1="300" y1="250" x2="150" y2="300" />
                <line x1="150" y1="300" x2="50" y2="200" />
                <line x1="50" y1="200" x2="50" y2="80" />
                <line x1="200" y1="40" x2="150" y2="300" />
                <line x1="50" y1="80" x2="300" y2="250" />
                <line x1="350" y1="100" x2="50" y2="200" />
                <line x1="200" y1="40" x2="200" y2="350" />
                <line x1="100" y1="140" x2="300" y2="140" />
                <line x1="100" y1="140" x2="200" y2="250" />
                <line x1="300" y1="140" x2="200" y2="250" />
                <line x1="150" y1="100" x2="250" y2="200" />
                <line x1="250" y1="100" x2="150" y2="200" />
              </g>
              {/* Constellation dots */}
              <g fill="rgba(242,197,114,0.5)">
                <circle cx="50" cy="80" r="2.5" />
                <circle cx="200" cy="40" r="3" />
                <circle cx="350" cy="100" r="2.5" />
                <circle cx="300" cy="250" r="2" />
                <circle cx="150" cy="300" r="2.5" />
                <circle cx="50" cy="200" r="2" />
                <circle cx="100" cy="140" r="2" />
                <circle cx="300" cy="140" r="2" />
                <circle cx="200" cy="250" r="2.5" />
                <circle cx="200" cy="350" r="2" />
              </g>
            </svg>
            {/* Soft radial glow behind constellation */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(242,197,114,0.06) 0%, transparent 70%)",
              }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* ARCHETYPE label */}
            <div className="flex items-center gap-1 mb-2">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "#F2C572" }}
              >
                Archetype
              </p>
              <InsightInfoTooltip explanation="Your money personality archetype is determined by analysing which planets dominate your wealth houses (2nd, 5th, 9th, 11th), your Lagna lord's nature, and the balance between benefic and malefic influences on your financial houses. Each archetype reflects a distinct relationship with money rooted in your birth chart." />
            </div>

            {/* Archetype name */}
            <h2
              className="text-2xl md:text-3xl font-bold mb-6 leading-tight"
              style={{
                color: "#F2C572",
                fontFamily: "'Playfair Display', serif",
                letterSpacing: "-0.5px",
              }}
            >
              {archetype.name}
            </h2>

            {/* Key Strengths */}
            <div className="mb-5">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: "rgba(168,155,200,0.6)" }}
              >
                Key Strengths
              </p>
              <p
                className="text-base md:text-lg font-medium leading-relaxed"
                style={{ color: "#F5E9FF" }}
              >
                {archetype.strengths.slice(0, 2).join(", ")}
              </p>
            </div>

            {/* Blind Spots */}
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: "rgba(168,155,200,0.6)" }}
              >
                Blind Spots
              </p>
              <p
                className="text-sm md:text-base leading-relaxed"
                style={{ color: "#E06BAA" }}
              >
                {archetype.blindSpots[0]}
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Kundali Chart + Sun Sign ── */}
        <div className="flex flex-col gap-4">
          {/* Kundali Chart */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🪷</span>
                <span
                  className="text-xs font-bold uppercase tracking-[0.1em]"
                  style={{ color: "#F2C572" }}
                >
                  Birth Chart
                </span>
              </div>
              <span
                className="text-[9px] uppercase tracking-widest"
                style={{ color: "rgba(242,197,114,0.5)" }}
              >
                D1 Rasi · North Indian
              </span>
            </div>

            <div className="max-w-[280px] mx-auto">
              <KundaliSVG
                chart={chart}
                activeHouse={activeHouse}
                onHouseClick={setActiveHouse}
              />
            </div>

            {/* Planet legend */}
            <div className="mt-3 flex flex-wrap justify-center gap-x-2.5 gap-y-1">
              {Object.entries(PLANET_ABBR).map(([name, abbr]) => (
                <span
                  key={name}
                  className="flex items-center gap-1 text-[8px] text-white/40"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: PLANET_COLORS[name] }}
                  />
                  {abbr}
                </span>
              ))}
            </div>
          </div>

          {/* Sun / Moon / Lagna badges */}
          <div
            className="rounded-2xl p-4 grid grid-cols-3 text-center gap-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(16px)",
            }}
          >
            {[
              { label: "Lagna", sign: lagnaSign, signNum: lagnaSignNum },
              { label: "Moon", sign: moonSign, signNum: moonSignNum },
              { label: "Sun", sign: sunSign, signNum: sunSignNum },
            ].map(({ label, sign, signNum }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <p
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: "rgba(242,197,114,0.5)" }}
                >
                  {label}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[11px]"
                    style={{
                      background: "rgba(242,197,114,0.15)",
                      color: "#F2C572",
                    }}
                  >
                    {signNum !== undefined ? ZODIAC_SYMBOLS[signNum] : ""}
                  </span>
                  <p
                    className="text-base font-bold"
                    style={{ color: "#F5E9FF" }}
                  >
                    {sign?.slice(0, 3) ?? "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
