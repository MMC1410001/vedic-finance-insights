import { useState } from "react";
import type { ChartData, PlanetData, ReportReasoning } from "@/lib/vedicfinance-types";
import { ZODIAC_IMAGES } from "@/lib/zodiac-images";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLANET_COLORS: Record<string, string> = {
  Sun: "#f59e0b", Moon: "#a78bfa", Mars: "#ef4444", Mercury: "#10b981",
  Jupiter: "#f97316", Venus: "#ec4899", Saturn: "#6366f1", Rahu: "#64748b", Ketu: "#78716c",
};

const PLANET_ABBR: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

const ZODIAC_SYMBOLS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
export { ZODIAC_SYMBOLS };
const ZODIAC_NAMES = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];

// North Indian chart cell geometry (400×400 viewBox)
const CHART_CELLS: Record<number, { points: string; cx: number; cy: number }> = {
  1:  { points: "200,0 400,0 300,100",                cx: 300, cy: 50  },
  2:  { points: "400,0 400,200 300,100",              cx: 375, cy: 100 },
  3:  { points: "400,200 400,400 300,300",            cx: 375, cy: 300 },
  4:  { points: "200,400 400,400 300,300",            cx: 300, cy: 375 },
  5:  { points: "0,400 200,400 100,300",              cx: 100, cy: 375 },
  6:  { points: "0,200 0,400 100,300",                cx: 25,  cy: 300 },
  7:  { points: "0,0 0,200 100,100",                  cx: 25,  cy: 100 },
  8:  { points: "0,0 200,0 100,100",                  cx: 100, cy: 50  },
  9:  { points: "100,100 200,0 200,200",              cx: 165, cy: 110 },
  10: { points: "100,100 0,200 100,300 200,200",      cx: 90,  cy: 200 },
  11: { points: "200,200 100,300 200,400 300,300",    cx: 200, cy: 310 },
  12: { points: "200,0 300,100 200,200 100,100",      cx: 200, cy: 100 },
};

// ─── SVG Chart ────────────────────────────────────────────────────────────────
export { PLANET_COLORS, PLANET_ABBR };
export function KundaliSVG({
  chart, activeHouse, onHouseClick,
}: {
  chart: ChartData;
  activeHouse: number | null;
  onHouseClick: (h: number) => void;
}) {
  const planetsByHouse = (h: number) => chart.planets.filter(p => p.house === h);
  const houseSign = (h: number) => {
    const hd = chart.houses.find(x => x.house === h);
    return hd ? ZODIAC_SYMBOLS[hd.sign_num] + " " + hd.sign.slice(0, 3) : "";
  };

  return (
    <svg viewBox="-2 -2 404 404" className="w-full max-w-[340px] mx-auto select-none">
      {/* Outer border */}
      <rect x="0" y="0" width="400" height="400" fill="none"
        stroke="hsl(var(--primary)/0.3)" strokeWidth="1.5" rx="2" />
      {/* Inner diamond */}
      <polygon points="200,0 400,200 200,400 0,200"
        fill="none" stroke="hsl(var(--primary)/0.15)" strokeWidth="1" />
      {/* Diagonals */}
      {[["0,0","200,200"],["400,0","200,200"],["0,400","200,200"],["400,400","200,200"]].map(([a,b],i) => (
        <line key={i} x1={a.split(",")[0]} y1={a.split(",")[1]}
          x2={b.split(",")[0]} y2={b.split(",")[1]}
          stroke="hsl(var(--primary)/0.08)" strokeWidth="1" />
      ))}

      {Object.entries(CHART_CELLS).map(([hStr, cell]) => {
        const h = parseInt(hStr);
        const isActive = activeHouse === h;
        const isLagna = h === 1;
        const planets = planetsByHouse(h);

        return (
          <g key={h} onClick={() => onHouseClick(h)} className="cursor-pointer group">
            <polygon
              points={cell.points}
              fill={isActive
                ? "hsl(var(--primary)/0.2)"
                : isLagna
                  ? "hsl(var(--primary)/0.08)"
                  : "transparent"}
              stroke={isActive ? "hsl(var(--primary)/0.6)" : "transparent"}
              strokeWidth={isActive ? 1.5 : 0}
              className="transition-all duration-200 group-hover:fill-white/[0.04]"
            />

            {/* House number */}
            <text x={cell.cx} y={cell.cy - 14} textAnchor="middle"
              fontSize="7.5" fill="hsl(220,10%,38%)" fontWeight="500">
              {h}
            </text>

            {/* Zodiac symbol + sign abbr */}
            <text x={cell.cx} y={cell.cy - 2} textAnchor="middle"
              fontSize="11"
              fill={isActive ? "hsl(var(--primary))" : "hsl(220,10%,60%)"}>
              {houseSign(h)}
            </text>

            {/* Lagna marker */}
            {isLagna && (
              <text x={cell.cx} y={cell.cy - 26} textAnchor="middle"
                fontSize="6.5" fill="hsl(var(--primary))" fontWeight="700" letterSpacing="0.5">
                ASC
              </text>
            )}

            {/* Planets */}
            {planets.map((p, pi) => {
              const total = planets.length;
              const cols = total <= 2 ? total : Math.ceil(total / 2);
              const col = pi % cols;
              const row = Math.floor(pi / cols);
              const startX = cell.cx - ((cols - 1) * 13) / 2;
              const px = startX + col * 13;
              const py = cell.cy + 13 + row * 12;
              const color = PLANET_COLORS[p.planet] ?? "#a78bfa";
              return (
                <text key={p.planet} x={px} y={py}
                  textAnchor="middle" fontSize="9.5" fontWeight="700"
                  fill={p.retrograde ? "#f59e0b" : color}>
                  {PLANET_ABBR[p.planet] ?? p.planet.slice(0, 2)}
                  {p.retrograde ? "ᴿ" : ""}
                </text>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Planet legend row ────────────────────────────────────────────────────────
function PlanetRow({ p }: { p: PlanetData }) {
  const color = PLANET_COLORS[p.planet] ?? "#a78bfa";
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <span className="w-6 text-center text-xs font-bold shrink-0" style={{ color }}>
        {PLANET_ABBR[p.planet] ?? p.planet.slice(0, 2)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{p.planet}</p>
        <p className="text-[10px] text-muted-foreground">{p.nakshatra} · {p.nakshatra_lord}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-foreground">{p.sign} {p.degree.toFixed(1)}°</p>
        <p className="text-[10px] text-muted-foreground">H{p.house}{p.retrograde ? " · ᴿ" : ""}</p>
      </div>
    </div>
  );
}

// ─── House detail ─────────────────────────────────────────────────────────────
const HOUSE_MEANINGS: Record<number, string> = {
  1: "Self, body, personality, overall life direction",
  2: "Wealth, speech, family, accumulated assets",
  3: "Courage, siblings, communication, short journeys",
  4: "Home, mother, property, vehicles, inner peace",
  5: "Children, creativity, intelligence, speculation",
  6: "Enemies, debts, health, service, litigation",
  7: "Spouse, partnerships, business, foreign travel",
  8: "Longevity, inheritance, occult, sudden events",
  9: "Luck, father, religion, higher learning",
  10: "Career, reputation, authority, public life",
  11: "Income, gains, social networks, aspirations",
  12: "Expenses, foreign lands, spirituality, liberation",
};

function HouseDetail({ house, chart }: { house: number; chart: ChartData }) {
  const hd = chart.houses.find(x => x.house === house);
  const planets = chart.planets.filter(p => p.house === house);
  if (!hd) return null;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">House {house}</p>
        <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1.5">
          <img src={ZODIAC_IMAGES[hd.sign_num]} alt={hd.sign} className="w-4 h-4 object-contain inline-block" loading="lazy" decoding="async" />
          {hd.sign}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">{HOUSE_MEANINGS[house]}</p>
      </div>
      <div className="flex gap-2 text-[10px]">
        <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-muted-foreground">
          Lord: <span className="text-foreground font-semibold">{hd.lord}</span>
        </span>
        <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-muted-foreground">
          {planets.length === 0 ? "Empty" : `${planets.length} planet${planets.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {planets.length > 0 && (
        <div className="space-y-1.5">
          {planets.map(p => <PlanetRow key={p.planet} p={p} />)}
        </div>
      )}
    </div>
  );
}

// ─── Action point derivation ──────────────────────────────────────────────────
function deriveActionPoints(type: "natal" | "dasha" | "transit", bullets: string[]): string[] {
  const text = bullets.join(" ").toLowerCase();
  const actions: string[] = [];

  if (type === "natal") {
    if (/jupiter|dhana yoga|wealth|11th|2nd lord/.test(text))
      actions.push("Prioritise long-term wealth building: your chart supports compounding assets like equity mutual funds or index funds.");
    if (/venus|taurus|libra|luxury/.test(text))
      actions.push("Luxury or real-estate purchases are karmically supported: plan major acquisitions during Venus-strong transits.");
    if (/saturn|capricorn|aquarius|discipline/.test(text))
      actions.push("Adopt a disciplined SIP or recurring investment habit: Saturn rewards consistent, structured effort.");
    if (/mars|aries|scorpio|risk|aggressive/.test(text))
      actions.push("Keep speculative exposure below 15% of portfolio: Mars energy can amplify both gains and losses.");
    if (/rahu|ketu|shadow|karmic/.test(text))
      actions.push("Avoid impulsive financial decisions during eclipses or Rahu/Ketu transits over your natal positions.");
    if (/moon|cancer|emotional/.test(text))
      actions.push("Avoid making investment decisions based on market sentiment or fear: your Moon placement makes you susceptible to emotional trading.");
    if (actions.length === 0)
      actions.push("Review your natal wealth houses (2nd, 11th) with a financial advisor to align investments with your chart strengths.");
  }

  if (type === "dasha") {
    if (/jupiter mahadasha|jupiter dasha/.test(text))
      actions.push("You are in a Jupiter Mahadasha: an ideal window to expand investments, start a business, or pursue higher education.");
    if (/venus mahadasha|venus dasha|venus antardasha/.test(text))
      actions.push("Venus period favours luxury assets, real estate, and creative ventures: act on property or gold purchases now.");
    if (/saturn mahadasha|saturn dasha/.test(text))
      actions.push("Saturn Mahadasha demands patience: focus on debt reduction, building emergency funds, and avoiding high-risk speculation.");
    if (/rahu mahadasha|rahu dasha/.test(text))
      actions.push("Rahu periods bring unconventional opportunities: consider tech, foreign markets, or emerging sectors, but hedge carefully.");
    if (/ketu mahadasha|ketu dasha/.test(text))
      actions.push("Ketu Mahadasha is better for spiritual growth than financial expansion: preserve capital and avoid new ventures.");
    if (/mars mahadasha|mars dasha/.test(text))
      actions.push("Mars Dasha supports bold moves: good for starting a business or making a calculated high-risk investment.");
    if (/antardasha|sub-period/.test(text))
      actions.push("The current sub-period (Antardasha) fine-tunes timing: align major financial moves to the start of a favourable Antardasha.");
    if (actions.length === 0)
      actions.push("Track your Dasha transitions: major financial decisions are best timed to the start of a new favourable Mahadasha.");
  }

  if (type === "transit") {
    if (/jupiter transit|jupiter in/.test(text))
      actions.push("Jupiter's current transit is activating income or wealth houses: this is a good window to increase SIP amounts or open new investment positions.");
    if (/saturn transit|saturn in/.test(text))
      actions.push("Saturn's transit may slow returns: stay patient, avoid panic-selling, and use this period to rebalance your portfolio.");
    if (/retrograde/.test(text))
      actions.push("Retrograde planets in transit signal a review phase: audit existing investments rather than initiating new ones.");
    if (/house 8|8th house/.test(text))
      actions.push("8th house transits indicate sudden changes: keep 3–6 months of expenses as liquid reserves.");
    if (/house 11|11th house|income/.test(text))
      actions.push("11th house activation supports income growth: negotiate a raise, launch a side income stream, or increase equity exposure.");
    if (/house 12|12th house|expense/.test(text))
      actions.push("12th house transits increase hidden expenses: review subscriptions, insurance, and recurring costs now.");
    if (actions.length === 0)
      actions.push("Monitor current planetary transits over your 2nd, 11th, and 10th houses for the best timing on financial moves.");
  }

  return actions;
}

// ─── Reasoning section with action points ────────────────────────────────────
function ReasoningSection({ title, content, type }: { title: string; content: string; type: "natal" | "dasha" | "transit" }) {
  const bullets = content.split(/[;.]/).map(s => s.trim()).filter(s => s.length > 10);
  const actions = deriveActionPoints(type, bullets);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground/90">{title}</p>
      {/* Astrological observations */}
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-[11px] text-foreground/70 leading-relaxed">
            <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
            {b}
          </li>
        ))}
      </ul>
      {/* Action points */}
      {actions.length > 0 && (
        <div
          className="mt-2 rounded-xl p-3 space-y-2"
          style={{
            background: "rgba(16, 185, 129, 0.06)",
            border: "1px solid rgba(16, 185, 129, 0.18)",
          }}
        >
          <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "#6ee7b7" }}>
            ✦ What this means for you
          </p>
          <ul className="space-y-1.5">
            {actions.map((a, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-relaxed" style={{ color: "rgba(167,243,208,0.85)" }}>
                <span className="shrink-0 mt-[3px]" style={{ color: "#34d399" }}>→</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Standalone Houses/Planets panel (exported for use elsewhere) ─────────────
export function HousePlanetPanel({
  chart,
  activeHouse: activeHouseProp,
  onHouseChange,
}: {
  chart: ChartData;
  activeHouse?: number | null;
  onHouseChange?: (h: number) => void;
}) {
  const [internalHouse, setInternalHouse] = useState<number | null>(1);
  const [tab, setTab] = useState<"houses" | "planets">("houses");

  const activeHouse = activeHouseProp !== undefined ? activeHouseProp : internalHouse;
  const setActiveHouse = (h: number) => {
    setInternalHouse(h);
    onHouseChange?.(h);
  };

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: "rgba(15, 8, 30, 0.82)",
        border: "1px solid rgba(167, 139, 250, 0.2)",
        backdropFilter: "blur(24px)",
        boxShadow: "0 0 40px rgba(139, 92, 246, 0.08), inset 0 1px 0 rgba(167,139,250,0.1)",
      }}
    >
      {/* Tabs */}
      <div className="flex gap-2">
        {(["houses", "planets"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize ${
              tab === t
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-white/[0.04] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.06]"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Detail card */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 min-h-[160px]">
        {tab === "houses" && activeHouse && (
          <HouseDetail house={activeHouse} chart={chart} />
        )}
        {tab === "planets" && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">All Planets</p>
            {chart.planets.map(p => <PlanetRow key={p.planet} p={p} />)}
          </div>
        )}
      </div>

      {/* House quick-nav */}
      {tab === "houses" && (
        <div className="grid grid-cols-6 gap-1">
          {chart.houses.map(h => (
            <button key={h.house} onClick={() => setActiveHouse(h.house)}
              className={`p-1.5 rounded-lg text-center transition-all ${
                activeHouse === h.house
                  ? "bg-primary/15 border border-primary/30"
                  : "bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05]"
              }`}>
              <p className="text-[8px] text-muted-foreground">H{h.house}</p>
              <p className="text-[9px] font-semibold text-foreground">{ZODIAC_SYMBOLS[h.sign_num]}</p>
              <p className="text-[8px] text-primary leading-tight">
                {chart.planets.filter(p => p.house === h.house).map(p => PLANET_ABBR[p.planet] ?? "?").join(" ") || "·"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface Props {
  chart: ChartData;
  reasoning?: ReportReasoning;
  hideReasoning?: boolean;
}

export default function NatalChartVisual({ chart, reasoning, hideReasoning }: Props) {
  const [activeHouse, setActiveHouse] = useState<number | null>(1);
  const [tab, setTab] = useState<"houses" | "planets">("houses");

  const lagna = chart.houses.find(h => h.house === 1);

  return (
    <div className="space-y-5">
      {/* Section title */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-lg">🪷</span>
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Birth Chart <span className="text-primary">(Kundali)</span> Analysis
          </h2>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Vedic Natal Chart · D1 Rasi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start xl:items-end">
        {/* Left: Chart SVG + key signs */}
        <div className="flex flex-col gap-3">
          <div className="glass-card p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">North Indian</span>
              {lagna && (
                <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
                  <img src={ZODIAC_IMAGES[lagna.sign_num]} alt={lagna.sign} className="w-3.5 h-3.5 object-contain inline-block" loading="lazy" decoding="async" />
                  {lagna.sign} Lagna
                </span>
              )}
            </div>
            <div className="flex-1 flex items-center justify-center">
              <KundaliSVG chart={chart} activeHouse={activeHouse} onHouseClick={h => {
                setActiveHouse(h);
                setTab("houses");
              }} />
            </div>
            {/* Planet color legend */}
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {Object.entries(PLANET_ABBR).map(([name, abbr]) => (
                <span key={name} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLANET_COLORS[name] }} />
                  {abbr}
                </span>
              ))}
            </div>
          </div>

          {/* Key signs */}
          <div className="glass-card p-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Lagna", planet: null, house: 1 },
              { label: "Moon", planet: "Moon", house: null },
              { label: "Sun", planet: "Sun", house: null },
            ].map(({ label, planet, house }) => {
              const sign = planet
                ? chart.planets.find(p => p.planet === planet)?.sign
                : chart.houses.find(h => h.house === house)?.sign;
              const signNum = planet
                ? chart.planets.find(p => p.planet === planet)?.sign_num
                : chart.houses.find(h => h.house === house)?.sign_num;
              return (
                <div key={label}>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                    {signNum !== undefined ? <img src={ZODIAC_IMAGES[signNum]} alt={sign ?? ""} className="w-3.5 h-3.5 object-contain inline-block" loading="lazy" decoding="async" /> : null} {sign?.slice(0, 3) ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Houses / Planets detail panel */}
        <div className="flex flex-col gap-3">
          {/* Tabs */}
          <div className="flex gap-2">
            {(["houses", "planets"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize ${
                  tab === t
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-white/[0.04] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.06]"
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="glass-card p-4 flex-1">
            {tab === "houses" && activeHouse && (
              <HouseDetail house={activeHouse} chart={chart} />
            )}
            {tab === "planets" && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">All Planets</p>
                {chart.planets.map(p => <PlanetRow key={p.planet} p={p} />)}
              </div>
            )}
          </div>

          {/* House quick-nav */}
          {tab === "houses" && (
            <div className="grid grid-cols-6 gap-1">
              {chart.houses.map(h => (
                <button key={h.house} onClick={() => setActiveHouse(h.house)}
                  className={`p-1.5 rounded-lg text-center transition-all ${
                    activeHouse === h.house
                      ? "bg-primary/15 border border-primary/30"
                      : "bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05]"
                  }`}>
                  <p className="text-[8px] text-muted-foreground">H{h.house}</p>
                  <p className="text-[9px] font-semibold text-foreground">{ZODIAC_SYMBOLS[h.sign_num]}</p>
                  <p className="text-[8px] text-primary leading-tight">
                    {chart.planets.filter(p => p.house === h.house).map(p => PLANET_ABBR[p.planet] ?? "?").join(" ") || "·"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detailed Reasoning (side by side) */}
        {!hideReasoning && reasoning && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Detailed Reasoning</p>
            <ReasoningSection title="🪐 Natal Chart Analysis" content={reasoning.natal_analysis} type="natal" />
            <ReasoningSection title="🔄 Dasha Analysis" content={reasoning.dasha_analysis} type="dasha" />
            <ReasoningSection title="✨ Transit Analysis" content={reasoning.transit_analysis} type="transit" />
          </div>
        )}
      </div>
    </div>
  );
}
