/**
 * LuxuryAssets — Vedic astrology luxury asset purchase timing.
 * Redesigned: slim pillars, bar-chart scores, spacious layout.
 */
import { useState, useEffect } from "react";
import { Sparkles, Home, Car, Gem, CreditCard, TrendingUp, Calendar, Star } from "lucide-react";
import propertyImg from "@/assets/luxury-property.webp";
import carImg from "@/assets/luxury-car.webp";
import goldImg from "@/assets/gold-jewelry.webp";
import necklaceImg from "@/assets/gold-necklace.webp";
import { generateLuxuryAnalysis } from "@/lib/vedicfinance-api";
import type {
  LuxuryAnalysisResponse,
  AssetAnalysis,
  AssetType,
  ReportRequest,
} from "@/lib/vedicfinance-types";

const ASSET_IMAGES: Record<AssetType, string> = {
  property: propertyImg,
  vehicle: carImg,
  gold: goldImg,
  loan: necklaceImg,
};

const ASSET_LABELS: Record<AssetType, string> = {
  property: "Property",
  vehicle: "Vehicle",
  gold: "Gold",
  loan: "Loan",
};

const ASSET_ICONS: Record<AssetType, typeof Home> = {
  property: Home,
  vehicle: Car,
  gold: Gem,
  loan: CreditCard,
};

const VERDICT_COLORS: Record<string, string> = {
  yes: "hsl(170 70% 50%)",
  delay: "hsl(43 80% 55%)",
  avoid: "hsl(0 70% 55%)",
};

const VERDICT_LABELS: Record<string, string> = {
  yes: "Favorable",
  delay: "Delay",
  avoid: "Avoid",
};

const SCORE_KEYS = ["dasha", "transit", "natal", "muhurta"] as const;
const SCORE_COLORS: Record<string, string> = {
  dasha: "#f59e0b",
  transit: "#3b82f6",
  natal: "#10b981",
  muhurta: "#a78bfa",
};
const SCORE_LABELS: Record<string, string> = {
  dasha: "Dasha",
  transit: "Transit",
  natal: "Natal",
  muhurta: "Muhurta",
};

/* ── Horizontal score bar ── */
const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex items-center gap-3">
    <span className="text-[10px] text-white/40 w-14 shrink-0">{label}</span>
    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}90, ${color})` }}
      />
    </div>
    <span className="text-[11px] font-semibold text-white/60 w-7 text-right">{value}</span>
  </div>
);

/* ── Slim pillar card ── */
interface PillarProps {
  analysis: AssetAnalysis;
  isSelected: boolean;
  onClick: () => void;
}

const PillarCard = ({ analysis, isSelected, onClick }: PillarProps) => {
  const { asset_type, verdict, overall_score } = analysis;
  const image = ASSET_IMAGES[asset_type];
  const label = ASSET_LABELS[asset_type];
  const Icon = ASSET_ICONS[asset_type];
  const verdictColor = VERDICT_COLORS[verdict];

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center py-5 px-3 transition-all duration-300 cursor-pointer shrink-0"
      style={{
        background: isSelected
          ? "linear-gradient(180deg, rgba(139,92,246,0.10) 0%, rgba(15,10,30,0.95) 50%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(10,8,20,0.95) 50%)",
        border: isSelected ? "1px solid rgba(139,92,246,0.30)" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "60px 60px 16px 16px",
        width: "100px",
        minHeight: "200px",
        boxShadow: isSelected ? "0 0 30px -8px rgba(139,92,246,0.15)" : "none",
      }}
    >
      {/* Image arch */}
      <div
        className="w-16 h-12 overflow-hidden flex items-end justify-center mb-3"
        style={{
          borderRadius: "32px 32px 6px 6px",
          background: "linear-gradient(180deg, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0.2) 100%)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <img src={image} alt={label} className="h-10 w-auto object-contain" loading="lazy" decoding="async" />
      </div>

      {/* Icon + label */}
      <Icon className="h-3 w-3 text-violet-400/50 mb-1" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-300/70">{label}</span>

      {/* Score */}
      <span className="text-xl font-bold text-white mt-2">{overall_score}</span>

      {/* Verdict */}
      <span
        className="mt-1.5 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
        style={{ color: verdictColor, border: `1px solid ${verdictColor}30`, background: `${verdictColor}08` }}
      >
        {VERDICT_LABELS[verdict]}
      </span>
    </button>
  );
};

/* ── Main component ── */
const LuxuryAssets = () => {
  const [data, setData] = useState<LuxuryAnalysisResponse | null>(null);
  const [selected, setSelected] = useState<AssetType>("property");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;

    let req: ReportRequest;
    try { req = JSON.parse(raw); } catch { return; }

    const cached = sessionStorage.getItem("luxuryAnalysis");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setSelected(parsed.best_asset);
        return;
      } catch { /* fall through */ }
    }

    setLoading(true);
    generateLuxuryAnalysis(req)
      .then((result) => {
        sessionStorage.setItem("luxuryAnalysis", JSON.stringify(result));
        setData(result);
        setSelected(result.best_asset);
      })
      .catch(() => { /* no fallback */ })
      .finally(() => setLoading(false));
  }, []);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 text-sm">
        {loading ? "Analyzing your chart…" : "Complete onboarding to see luxury asset timing"}
      </div>
    );
  }

  const a = data.assets[selected];
  const verdictColor = VERDICT_COLORS[a.verdict];

  return (
    <div className="h-full flex flex-col lg:flex-row items-start lg:items-center gap-8 lg:gap-16 overflow-y-auto lg:overflow-hidden px-2 md:px-8">

      {/* ── LEFT — heading + pillar cards ── */}
      <div className="flex flex-col gap-6 lg:gap-10 shrink-0 w-full lg:w-[42%]">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 self-start">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[11px] font-medium text-violet-300 tracking-widest uppercase">Luxury Asset Timing</span>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight tracking-tight">
            Check the Right Time to<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300">
              Purchase Luxury Items
            </span>
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-md">
            Find your ideal cosmic window for big purchases using Dasha, Transit & Muhurta.
          </p>
        </div>

        {loading && (
          <p className="text-[10px] text-violet-300/50 animate-pulse">Calculating Vedic analysis...</p>
        )}

        {/* Pillar cards row — horizontal scroll on mobile */}
        <div className="flex gap-3 items-end overflow-x-auto pb-2 -mx-2 px-2 lg:mx-0 lg:px-0 lg:overflow-visible">
          {data.ranked.map((assetType) => (
            <PillarCard
              key={assetType}
              analysis={data.assets[assetType]}
              isSelected={selected === assetType}
              onClick={() => setSelected(assetType)}
            />
          ))}
        </div>

        <p className="text-[10px] text-white/20 mt-2">{data.current_dasha} • Strict Vedic • No Western Cycles</p>
      </div>

      {/* ── RIGHT — analysis panel ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-5 lg:gap-7 w-full">

        {/* ─── TOP: The big insight — score, verdict, when to buy ─── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.20)" }}
            >
              {(() => { const Icon = ASSET_ICONS[a.asset_type]; return <Icon className="h-5 w-5 text-violet-400" />; })()}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{ASSET_LABELS[a.asset_type]} Analysis</h3>
              <p className="text-[11px] text-white/30 mt-0.5">Is it the right time to buy?</p>
            </div>
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mt-1"
            style={{ color: verdictColor, border: `1px solid ${verdictColor}40`, background: `${verdictColor}10` }}
          >
            {VERDICT_LABELS[a.verdict]}
          </span>
        </div>

        {/* Big score + purchase window — the hero insight */}
        <div className="flex flex-wrap items-center gap-4 md:gap-10">
          {/* Score */}
          <div className="flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-bold text-white">{a.overall_score}</span>
            <span className="text-sm text-white/25">/ 100</span>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-14 bg-white/[0.08]" />

          {/* Purchase window */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-violet-400/40 mt-1 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Best Window to Buy</p>
              <p className="text-base md:text-lg font-semibold text-white/80">
                {new Date(a.time_window.start).toLocaleDateString("en", { month: "short", year: "numeric" })}
                {" → "}
                {new Date(a.time_window.end).toLocaleDateString("en", { month: "short", year: "numeric" })}
              </p>
              <p className="text-[10px] text-white/25 mt-0.5">{a.time_window.months} month window</p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-14 bg-white/[0.08]" />

          {/* Dasha */}
          <div className="flex items-start gap-3">
            <Star className="h-4 w-4 text-violet-400/40 mt-1 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Current Dasha</p>
              <p className="text-base md:text-lg font-medium text-violet-300">{a.dasha_period}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* ─── MIDDLE: Score bars with inline reasoning ─── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-violet-400/50" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Score Breakdown</span>
          </div>

          {SCORE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1.5">
              <ScoreBar label={SCORE_LABELS[key]} value={a.scores[key]} color={SCORE_COLORS[key]} />
              {/* Reason for this score */}
              {a.reasoning[key]?.slice(0, 1).map((r, i) => (
                <div key={i} className="flex items-start gap-2 pl-[4.5rem]">
                  <span className="h-1 w-1 rounded-full shrink-0 mt-1.5" style={{ background: SCORE_COLORS[key] }} />
                  <p className="text-[10px] text-white/35 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* ─── BOTTOM: Nakshatras ─── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-white/25 mr-1">Nakshatras</span>
          {a.suggested_nakshatras.slice(0, 5).map((n) => (
            <span key={n} className="text-[9px] px-2.5 py-1 rounded-full text-violet-300/60 border border-violet-500/15 bg-violet-500/[0.06]">
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LuxuryAssets;
