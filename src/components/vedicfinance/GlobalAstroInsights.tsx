import { useState, useMemo } from "react";
import { Moon, Sun, TrendingUp, TrendingDown, AlertTriangle, Activity, Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Area, AreaChart, CartesianGrid, ReferenceLine, Dot } from "recharts";
import { ZODIAC_IMAGES } from "@/lib/zodiac-images";

/* ─────────────────────────────────────────────────────────
   Astronomical calculations — client-side, no API needed
   Based on simplified astronomical algorithms (Meeus)
   ───────────────────────────────────────────────────────── */

const ZODIAC_SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const ZODIAC_SYMBOLS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const PLANETS = [
  { name: "Sun", symbol: "☉", color: "#FFD700" },
  { name: "Moon", symbol: "☽", color: "#C0C0C0" },
  { name: "Mercury", symbol: "☿", color: "#7986CB" },
  { name: "Venus", symbol: "♀", color: "#F48FB1" },
  { name: "Mars", symbol: "♂", color: "#EF5350" },
  { name: "Jupiter", symbol: "♃", color: "#FFB74D" },
  { name: "Saturn", symbol: "♄", color: "#90A4AE" },
];

function julianDay(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24 + date.getUTCMinutes() / 1440;
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}

function sunLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360;
  const Mr = M * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mr) + 0.019993 * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
  return ((L0 + C) % 360 + 360) % 360;
}

function moonLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const Lp = (218.3165 + 481267.8813 * T) % 360;
  const D = (297.8502 + 445267.1115 * T) % 360;
  const M = (357.5291 + 35999.0503 * T) % 360;
  const Mp = (134.9634 + 477198.8676 * T) % 360;
  const F = (93.2720 + 483202.0175 * T) % 360;
  const toRad = (d: number) => d * Math.PI / 180;
  let lon = Lp
    + 6.289 * Math.sin(toRad(Mp))
    - 1.274 * Math.sin(toRad(2 * D - Mp))
    + 0.658 * Math.sin(toRad(2 * D))
    + 0.214 * Math.sin(toRad(2 * Mp))
    - 0.186 * Math.sin(toRad(M))
    - 0.114 * Math.sin(toRad(2 * F));
  return ((lon % 360) + 360) % 360;
}

function moonPhase(jd: number): { phase: string; illumination: number; emoji: string } {
  const sunLon = sunLongitude(jd);
  const moonLon = moonLongitude(jd);
  let elongation = ((moonLon - sunLon) % 360 + 360) % 360;
  const illum = (1 - Math.cos(elongation * Math.PI / 180)) / 2;
  let phase: string, emoji: string;
  if (elongation < 22.5) { phase = "New Moon"; emoji = "🌑"; }
  else if (elongation < 67.5) { phase = "Waxing Crescent"; emoji = "🌒"; }
  else if (elongation < 112.5) { phase = "First Quarter"; emoji = "🌓"; }
  else if (elongation < 157.5) { phase = "Waxing Gibbous"; emoji = "🌔"; }
  else if (elongation < 202.5) { phase = "Full Moon"; emoji = "🌕"; }
  else if (elongation < 247.5) { phase = "Waning Gibbous"; emoji = "🌖"; }
  else if (elongation < 292.5) { phase = "Last Quarter"; emoji = "🌗"; }
  else if (elongation < 337.5) { phase = "Waning Crescent"; emoji = "🌘"; }
  else { phase = "New Moon"; emoji = "🌑"; }
  return { phase, illumination: Math.round(illum * 100), emoji };
}

// Simplified planetary longitudes (mean elements — good enough for sign placement)
function planetLongitude(planet: string, jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  switch (planet) {
    case "Sun": return sunLongitude(jd);
    case "Moon": return moonLongitude(jd);
    case "Mercury": return ((252.2509 + 149472.6747 * T) % 360 + 360) % 360;
    case "Venus": return ((181.9798 + 58517.8157 * T) % 360 + 360) % 360;
    case "Mars": return ((355.4330 + 19140.2993 * T) % 360 + 360) % 360;
    case "Jupiter": return ((34.3515 + 3034.9057 * T) % 360 + 360) % 360;
    case "Saturn": return ((50.0774 + 1222.1138 * T) % 360 + 360) % 360;
    default: return 0;
  }
}

function getSign(longitude: number): { sign: string; symbol: string; degree: number; index: number } {
  const idx = Math.floor(longitude / 30) % 12;
  return { sign: ZODIAC_SIGNS[idx], symbol: ZODIAC_SYMBOLS[idx], degree: Math.floor(longitude % 30), index: idx };
}

// Retrograde approximation for outer planets
function isRetrograde(planet: string, jd: number): boolean {
  if (planet === "Sun" || planet === "Moon") return false;
  const lon1 = planetLongitude(planet, jd - 1);
  const lon2 = planetLongitude(planet, jd + 1);
  let diff = lon2 - lon1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

/* ─────────────────────────────────────────────────────────
   Financial astrology interpretations
   ───────────────────────────────────────────────────────── */

interface PlanetPosition {
  name: string;
  symbol: string;
  color: string;
  sign: string;
  signSymbol: string;
  degree: number;
  retrograde: boolean;
}

interface FinancialInsight {
  title: string;
  description: string;
  impact: "bullish" | "bearish" | "neutral" | "caution";
  relevance: string;
}

function getFinancialInsights(positions: PlanetPosition[], moonData: { phase: string; illumination: number }): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const jupiter = positions.find(p => p.name === "Jupiter");
  const saturn = positions.find(p => p.name === "Saturn");
  const mercury = positions.find(p => p.name === "Mercury");
  const venus = positions.find(p => p.name === "Venus");
  const mars = positions.find(p => p.name === "Mars");

  // Mercury retrograde — most impactful for finance
  if (mercury?.retrograde) {
    insights.push({
      title: "Mercury Retrograde Active",
      description: "Communication breakdowns and contract errors are more likely. Avoid signing major financial agreements or launching new ventures.",
      impact: "caution",
      relevance: "Contracts, Trading, Communication",
    });
  }

  // Jupiter sign-based insight
  if (jupiter) {
    const jupiterInsights: Record<string, { desc: string; impact: "bullish" | "bearish" | "neutral" }> = {
      Aries: { desc: "Jupiter in Aries favors bold entrepreneurial ventures and startup investments. Risk appetite is elevated across markets.", impact: "bullish" },
      Taurus: { desc: "Jupiter in Taurus supports steady wealth accumulation, real estate, and banking sector growth. Conservative investments thrive.", impact: "bullish" },
      Gemini: { desc: "Jupiter in Gemini boosts tech, media, and communication sectors. Information-driven investments gain momentum.", impact: "bullish" },
      Cancer: { desc: "Jupiter in Cancer strengthens real estate, food, and domestic markets. Emotional spending patterns increase.", impact: "bullish" },
      Leo: { desc: "Jupiter in Leo energizes entertainment, luxury goods, and speculative markets. Gold and precious metals may see interest.", impact: "bullish" },
      Virgo: { desc: "Jupiter in Virgo favors healthcare, analytics, and service industries. Detailed due diligence pays off.", impact: "neutral" },
      Libra: { desc: "Jupiter in Libra supports partnerships, luxury brands, and diplomatic trade agreements. Balance in portfolios is key.", impact: "neutral" },
      Scorpio: { desc: "Jupiter in Scorpio intensifies activity in insurance, debt instruments, and transformative investments.", impact: "neutral" },
      Sagittarius: { desc: "Jupiter in its own sign amplifies international trade, education sector, and philosophical ventures. Expansion energy is strong.", impact: "bullish" },
      Capricorn: { desc: "Jupiter in Capricorn is debilitated: growth is slow but structured. Infrastructure and government bonds are favored.", impact: "bearish" },
      Aquarius: { desc: "Jupiter in Aquarius drives innovation, crypto, and technology disruption. Unconventional investments gain traction.", impact: "bullish" },
      Pisces: { desc: "Jupiter in Pisces supports spiritual businesses, pharma, and oil. Intuitive investment decisions may outperform analysis.", impact: "neutral" },
    };
    const ji = jupiterInsights[jupiter.sign];
    if (ji) {
      insights.push({
        title: `Jupiter in ${jupiter.sign} ${jupiter.signSymbol}`,
        description: ji.desc,
        impact: ji.impact,
        relevance: "Long-term Growth, Sector Trends",
      });
    }
  }

  // Saturn — discipline and restriction
  if (saturn) {
    insights.push({
      title: `Saturn in ${saturn.sign} ${saturn.signSymbol}${saturn.retrograde ? " ℞" : ""}`,
      description: saturn.retrograde
        ? `Saturn retrograde in ${saturn.sign}: revisiting past financial commitments. Restructuring debts and long-term plans is favored.`
        : `Saturn in ${saturn.sign} demands discipline in financial planning. Sectors ruled by ${saturn.sign} face regulatory pressure but reward patience.`,
      impact: saturn.retrograde ? "caution" : "neutral",
      relevance: "Regulation, Long-term Planning, Debt",
    });
  }

  // Venus — luxury and value
  if (venus) {
    insights.push({
      title: `Venus in ${venus.sign} ${venus.signSymbol}`,
      description: venus.retrograde
        ? `Venus retrograde: reassess valuations and luxury purchases. Markets may see corrections in overvalued assets.`
        : `Venus in ${venus.sign} influences spending patterns and asset valuations. Luxury, beauty, and lifestyle sectors respond to this transit.`,
      impact: venus.retrograde ? "bearish" : "bullish",
      relevance: "Luxury, Valuations, Consumer Spending",
    });
  }

  // Mars — energy and volatility
  if (mars) {
    insights.push({
      title: `Mars in ${mars.sign} ${mars.signSymbol}`,
      description: mars.retrograde
        ? `Mars retrograde: market volatility increases. Avoid impulsive trades and aggressive positions.`
        : `Mars in ${mars.sign} drives energy in related sectors. Competition and market momentum are elevated.`,
      impact: mars.retrograde ? "caution" : "neutral",
      relevance: "Volatility, Energy, Competition",
    });
  }

  // Moon phase financial insight
  if (moonData.illumination > 90) {
    insights.push({
      title: "Full Moon Period",
      description: "Markets historically show increased volatility around full moons. Emotional trading peaks: stick to your strategy.",
      impact: "caution",
      relevance: "Market Sentiment, Volatility",
    });
  } else if (moonData.illumination < 10) {
    insights.push({
      title: "New Moon Period",
      description: "New moons mark fresh cycles: favorable for initiating new investments and financial plans. Set intentions for the month ahead.",
      impact: "bullish",
      relevance: "New Ventures, Planning",
    });
  }

  return insights;
}

/* ─────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────── */

export default function GlobalAstroInsights() {
  const [selectedSign, setSelectedSign] = useState(0);

  const now = new Date();
  const jd = julianDay(now);

  const positions: PlanetPosition[] = useMemo(() => {
    return PLANETS.map(p => {
      const lon = planetLongitude(p.name, jd);
      const s = getSign(lon);
      return {
        ...p,
        sign: s.sign,
        signSymbol: s.symbol,
        degree: s.degree,
        retrograde: isRetrograde(p.name, jd),
      };
    });
  }, [jd]);

  const moonData = useMemo(() => moonPhase(jd), [jd]);
  const insights = useMemo(() => getFinancialInsights(positions, moonData), [positions, moonData]);

  // Client-side financial zodiac outlook based on current transits
  const zodiacOutlook = useMemo(() => {
    const sun = positions.find(p => p.name === "Sun");
    const jupiter = positions.find(p => p.name === "Jupiter");
    const saturn = positions.find(p => p.name === "Saturn");
    const mars = positions.find(p => p.name === "Mars");
    const venus = positions.find(p => p.name === "Venus");

    return ZODIAC_SIGNS.map((sign, idx) => {
      const sunInSign = sun?.sign === sign;
      const jupiterInSign = jupiter?.sign === sign;
      const saturnInSign = saturn?.sign === sign;
      const marsInSign = mars?.sign === sign;
      const venusInSign = venus?.sign === sign;

      // Compute a simple financial score
      let score = 50;
      const factors: string[] = [];

      if (sunInSign) { score += 10; factors.push("Sun illuminates your financial sector: visibility and confidence are high"); }
      if (jupiterInSign) { score += 20; factors.push("Jupiter blesses your sign with expansion: excellent for growth investments and new ventures"); }
      if (saturnInSign) { score -= 10; factors.push("Saturn demands discipline: restructure finances and avoid shortcuts"); }
      if (marsInSign) { score += 5; factors.push("Mars energizes your sign: take decisive action on pending financial decisions"); }
      if (venusInSign) { score += 15; factors.push("Venus brings prosperity: luxury purchases and valuations are favored"); }

      // Aspect-based insights (simplified: planets in trine signs = +120°)
      const trineIdxs = [(idx + 4) % 12, (idx + 8) % 12];
      const squareIdxs = [(idx + 3) % 12, (idx + 9) % 12];

      if (jupiter && trineIdxs.includes(ZODIAC_SIGNS.indexOf(jupiter.sign))) {
        score += 12; factors.push("Jupiter trines your sign: financial luck flows naturally");
      }
      if (saturn && squareIdxs.includes(ZODIAC_SIGNS.indexOf(saturn.sign))) {
        score -= 8; factors.push("Saturn squares your sign: expect delays in financial approvals");
      }
      if (venus && trineIdxs.includes(ZODIAC_SIGNS.indexOf(venus.sign))) {
        score += 8; factors.push("Venus harmonizes with your sign: good for negotiations and deals");
      }

      // Default factor if none triggered
      if (factors.length === 0) {
        factors.push("A steady period for financial planning. Focus on long-term goals and avoid impulsive decisions.");
      }

      const clampedScore = Math.max(20, Math.min(95, score));
      const outlook = clampedScore >= 70 ? "Favorable" : clampedScore >= 50 ? "Moderate" : "Challenging";
      const outlookColor = clampedScore >= 70 ? "#50C878" : clampedScore >= 50 ? "#FFD700" : "#EF5350";

      return { sign, symbol: ZODIAC_SYMBOLS[idx], image: ZODIAC_IMAGES[idx], score: clampedScore, outlook, outlookColor, factors };
    });
  }, [positions]);

  const impactIcon = (impact: string) => {
    switch (impact) {
      case "bullish": return <TrendingUp className="w-4 h-4" style={{ color: "#50C878" }} />;
      case "bearish": return <TrendingDown className="w-4 h-4" style={{ color: "#EF5350" }} />;
      case "caution": return <AlertTriangle className="w-4 h-4" style={{ color: "#FFD700" }} />;
      default: return <Activity className="w-4 h-4" style={{ color: "#5C6BC0" }} />;
    }
  };

  const impactLabel = (impact: string) => {
    switch (impact) {
      case "bullish": return { text: "Bullish", color: "#50C878", bg: "rgba(80,200,120,0.1)" };
      case "bearish": return { text: "Bearish", color: "#EF5350", bg: "rgba(239,83,80,0.1)" };
      case "caution": return { text: "Caution", color: "#FFD700", bg: "rgba(255,215,0,0.1)" };
      default: return { text: "Neutral", color: "#5C6BC0", bg: "rgba(92,107,192,0.1)" };
    }
  };

  return (
    <div className="space-y-8">

      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(57,73,171,0.12)", border: "1px solid rgba(57,73,171,0.25)" }}>
          <Sparkles className="w-4 h-4" style={{ color: "#5C6BC0" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
            Cosmic Market <span style={{ color: "#5C6BC0" }}>Pulse</span>
          </h2>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(92,107,192,0.5)" }}>
            Global Planetary Transits · No Birth Data Required
          </p>
        </div>
      </div>

      {/* Top row: Moon Phase + Planetary Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Moon Phase Card */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Moon className="w-4 h-4" style={{ color: "#C0C0C0" }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Moon Phase</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{moonData.emoji}</span>
            <div>
              <p className="text-white font-bold text-lg">{moonData.phase}</p>
              <p className="text-sm" style={{ color: "#64748B" }}>{moonData.illumination}% illuminated</p>
              <p className="text-[11px] mt-1" style={{ color: "#94A3B8" }}>
                {moonData.illumination > 80 ? "High emotional energy: markets may be volatile" :
                 moonData.illumination < 20 ? "Low energy phase: good for planning, not action" :
                 "Balanced lunar energy: steady market conditions expected"}
              </p>
            </div>
          </div>
        </div>

        {/* Planetary Positions */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-4 h-4" style={{ color: "#FFD700" }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Current Planetary Positions</span>
            <span className="text-[9px] ml-auto" style={{ color: "#475569" }}>
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {positions.map(p => (
              <div key={p.name} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-lg" style={{ color: p.color }}>{p.symbol}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-white">{p.name}</span>
                    {p.retrograde && <span className="text-[9px] font-bold" style={{ color: "#EF5350" }}>℞</span>}
                  </div>
                  <span className="text-[11px]" style={{ color: "#64748B" }}>
                    {p.signSymbol} {p.sign} {p.degree}°
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Insights */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" style={{ color: "#50C878" }} />
          <span className="text-sm font-semibold text-white">Astro-Financial Insights</span>
          <span className="text-[9px] uppercase tracking-widest ml-2" style={{ color: "#475569" }}>Based on current transits</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight, i) => {
            const label = impactLabel(insight.impact);
            return (
              <div key={i} className="rounded-xl p-4 flex gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="shrink-0 mt-0.5">{impactIcon(insight.impact)}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-white">{insight.title}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: label.color, backgroundColor: label.bg }}>
                      {label.text}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed mb-1.5" style={{ color: "#94A3B8" }}>{insight.description}</p>
                  <p className="text-[10px]" style={{ color: "#475569" }}>{insight.relevance}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Zodiac Outlook — Line Chart + Insights */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 mb-5">
          <span className="text-base">🔮</span>
          <span className="text-sm font-semibold text-white">Financial Zodiac Outlook</span>
          <span className="text-[9px] uppercase tracking-widest ml-2" style={{ color: "#475569" }}>Click a point for details</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Line Chart */}
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={zodiacOutlook.map((z, i) => ({ name: z.symbol, fullName: z.sign, score: z.score, color: z.outlookColor, idx: i }))}
                margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
                onClick={(data) => {
                  if (data?.activeTooltipIndex !== undefined) setSelectedSign(data.activeTooltipIndex);
                }}
              >
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5C6BC0" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#5C6BC0" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3949AB" />
                    <stop offset="50%" stopColor="#5C6BC0" />
                    <stop offset="100%" stopColor="#50C878" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748B", fontSize: 14 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#475569", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(92,107,192,0.3)", strokeDasharray: "4 4" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "#0F172A", border: "1px solid rgba(92,107,192,0.3)" }}>
                        <span className="font-semibold text-white">{d.fullName}</span>
                        <span className="ml-2 font-bold" style={{ color: d.color }}>{d.score}</span>
                        <span style={{ color: "#64748B" }}>/100</span>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" strokeDasharray="6 4" />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="url(#lineGradient)"
                  strokeWidth={2.5}
                  fill="url(#scoreGradient)"
                  dot={(props: any) => {
                    const { cx, cy, index } = props;
                    const isSelected = index === selectedSign;
                    const z = zodiacOutlook[index];
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 7 : 4}
                        fill={isSelected ? z.outlookColor : "#1E293B"}
                        stroke={z.outlookColor}
                        strokeWidth={isSelected ? 3 : 2}
                        style={{ cursor: "pointer", filter: isSelected ? `drop-shadow(0 0 6px ${z.outlookColor})` : "none" }}
                      />
                    );
                  }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Right: Selected sign insights */}
          {(() => {
            const data = zodiacOutlook[selectedSign];
            return (
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <img src={data.image} alt={data.sign} className="w-10 h-10 object-contain" loading="lazy" decoding="async" />
                  <div>
                    <p className="text-white font-bold text-xl">{data.sign}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: data.outlookColor, backgroundColor: `${data.outlookColor}15` }}>
                        {data.outlook}
                      </span>
                      <span className="text-sm font-bold" style={{ color: data.outlookColor }}>{data.score}/100</span>
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${data.score}%`, backgroundImage: `linear-gradient(to right, #3949AB, ${data.outlookColor})` }} />
                </div>

                <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "#475569" }}>Transit Factors</p>
                <div className="space-y-3">
                  {data.factors.map((f, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: data.outlookColor }} />
                      <p className="text-[13px] leading-relaxed" style={{ color: "#CBD5E1" }}>{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

    </div>
  );
}
