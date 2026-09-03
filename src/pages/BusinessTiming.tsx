import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Minus, Clock, Calendar, Zap,
  ChevronRight, Info, Star, AlertTriangle, CheckCircle2,
  BarChart3, Layers, Target, Activity, Shield, Sparkles, Briefcase,
} from "lucide-react";
import type { BirthInput } from "@/lib/vedic-calc";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import {
  computeBusinessTiming,
  type BusinessTimingResult,
  type BusinessPhase,
  type ActionVerdict,
  type DecisionSignal,
  type TransitLayer,
} from "@/lib/business-timing-engine";
import BusinessDecisionQuery from "@/components/vedicfinance/BusinessDecisionQuery";

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseBirthInput(req: ReportRequest): BirthInput {
  const [year, month, day] = req.birth_date.split("-").map(Number);
  const [hour, minute] = req.birth_time.split(":").map(Number);
  return { year, month, day, hour, minute, tzOffset: req.timezone, lat: req.latitude, lon: req.longitude };
}

function getStoredRequest(): ReportRequest | null {
  try {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.birth_date || !data.birth_time) return null;
    return data as ReportRequest;
  } catch {
    return null;
  }
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<BusinessPhase, {
  color: string; bg: string; border: string; icon: typeof TrendingUp; label: string; accent: string;
}> = {
  Expansion: { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", icon: TrendingUp, label: "Expansion Phase", accent: "#34d399" },
  Stable:    { color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   icon: Minus,      label: "Stable Phase",    accent: "#fbbf24" },
  Risk:      { color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/20",     icon: AlertTriangle, label: "Risk Phase",   accent: "#f87171" },
  Hold:      { color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",    icon: Shield,     label: "Hold Phase",      accent: "#60a5fa" },
};

const ACTION_CONFIG: Record<ActionVerdict, { color: string; bg: string }> = {
  "Expand":            { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "Invest Cautiously": { color: "text-amber-400",   bg: "bg-amber-400/10"   },
  "Hold":              { color: "text-blue-400",     bg: "bg-blue-400/10"    },
  "Cut Costs":         { color: "text-red-400",      bg: "bg-red-400/10"     },
};

const SIGNAL_CONFIG: Record<DecisionSignal["signal"], { color: string; bg: string; border: string; dot: string; label: string }> = {
  Go:      { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", dot: "bg-emerald-400", label: "Go" },
  Caution: { color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   dot: "bg-amber-400",   label: "Caution" },
  Hold:    { color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",    dot: "bg-blue-400",    label: "Hold" },
};

const TRANSIT_VERDICT_CONFIG: Record<TransitLayer["verdict"], { color: string; bg: string; accent: string; label: string }> = {
  Expansion:     { color: "text-emerald-400", bg: "bg-emerald-400/10", accent: "#34d399", label: "Auspicious" },
  Consolidation: { color: "text-amber-400",   bg: "bg-amber-400/10",   accent: "#fbbf24", label: "Delaying" },
  Caution:       { color: "text-red-400",      bg: "bg-red-400/10",     accent: "#f87171", label: "Volatile" },
  Neutral:       { color: "text-slate-400",    bg: "bg-slate-400/10",   accent: "#94a3b8", label: "Uncertain" },
};

const PLANET_GLYPHS: Record<string, string> = {
  Jupiter: "♃", Saturn: "♄", Mars: "♂", Rahu: "☊",
};

const DECISION_ICONS: Record<string, typeof Target> = {
  "Business Expansion":    TrendingUp,
  "Large Investment":      BarChart3,
  "Transaction (Buy/Sell)": Zap,
  "Cash Flow":             Activity,
  "Scaling vs Holding":    Layers,
};

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 65 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 8px ${color}44)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{score}</span>
        <span className="text-[8px] uppercase tracking-[0.15em] text-white/30 mt-0.5">Score</span>
      </div>
    </div>
  );
}

// ─── Tonal Card — no borders, background-shift based depth ────────────────────

const TONAL = {
  base: "rgba(28,27,27,1)",       // surface-container-low
  raised: "rgba(32,31,31,1)",     // surface-container
  high: "rgba(42,42,42,1)",       // surface-container-high
  highest: "rgba(53,53,52,1)",    // surface-container-highest
} as const;

function TonalCard({ level = "base", className = "", style, children, ...rest }: {
  level?: keyof typeof TONAL;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: TONAL[level], ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const BusinessTiming = () => {
  const navigate = useNavigate();
  const [req, setReq] = useState<ReportRequest | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredRequest();
    setReq(stored);
  }, []);

  const result: BusinessTimingResult | null = useMemo(() => {
    if (!req) return null;
    const input = parseBirthInput(req);
    return computeBusinessTiming(input);
  }, [req]);

  // ── No birth data → empty state ──
  if (!result) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-8 text-center px-6">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(186,195,255,0.08)" }}>
          <Briefcase className="w-9 h-9" style={{ color: "#bac3ff" }} />
        </div>
        <div className="space-y-3 max-w-md">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#e5e2e1" }}>
            Business Decision <span className="text-gradient-gold">&amp; Timing</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(229,226,225,0.5)" }}>
            Complete your birth details to unlock Vedic Muhurta-based business timing: Dasha permission, transit environment, and precise execution windows.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
          style={{ background: "linear-gradient(135deg, #bac3ff, #3f51b5)", color: "#08218a" }}
        >
          <Sparkles className="w-4 h-4" /> Start Onboarding
        </button>
      </div>
    );
  }

  const phaseCfg = PHASE_CONFIG[result.phase];
  const PhaseIcon = phaseCfg.icon;
  const actionCfg = ACTION_CONFIG[result.action];

  return (
    <div className="max-w-6xl mx-auto space-y-10 md:space-y-16">

      {/* ════════════════════════════════════════════════════════════════════════
          HERO HEADER — asymmetric layout: title left, score right
          ════════════════════════════════════════════════════════════════════ */}
      <header id="biz-hero" className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4 max-w-xl">
          {/* Brow badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full"
              style={{ color: "#bac3ff", background: "rgba(186,195,255,0.08)" }}>
              Decision Matrix
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full"
              style={{ color: phaseCfg.accent, background: `${phaseCfg.accent}14` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: phaseCfg.accent }} />
              {phaseCfg.label}
            </span>
          </div>
          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight" style={{ color: "#e5e2e1" }}>
            Business Decision &amp;<br />Expansion Timing
          </h1>
        </div>

        {/* Score indicator */}
        <TonalCard level="base" className="flex items-center gap-6 p-6 shrink-0">
          <ScoreRing score={result.overallScore} size={96} />
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(197,197,212,0.6)" }}>Cosmic Score</p>
            <p className="text-lg font-bold" style={{ color: phaseCfg.accent }}>{
              result.overallScore >= 65 ? "Strong Alignment" :
              result.overallScore >= 40 ? "Moderate Alignment" : "Weak Alignment"
            }</p>
            <p className="text-xs" style={{ color: "rgba(229,226,225,0.45)" }}>
              {result.dashaLayer.mahadasha}–{result.dashaLayer.antardasha} Dasha Active
            </p>
          </div>
        </TonalCard>
      </header>

      {/* ════════════════════════════════════════════════════════════════════════
          BENTO GRID — 4 metric cards (left) + Astrologer's Reading (right)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* Metric cards — 2×2 grid */}
        <div className="md:col-span-5 grid grid-cols-2 gap-4">
          {[
            { label: "Current Phase", value: result.phase, color: phaseCfg.accent },
            { label: "Recommended Action", value: result.action, color: actionCfg.color === "text-emerald-400" ? "#34d399" : actionCfg.color === "text-amber-400" ? "#fbbf24" : actionCfg.color === "text-blue-400" ? "#60a5fa" : "#f87171" },
            { label: "Intensity", value: result.intensity, color: "#bac3ff" },
            { label: "Timing Window", value: result.broadTimingWindow, color: "#e5e2e1" },
          ].map((m) => (
            <TonalCard key={m.label} level="base" className="p-5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(197,197,212,0.5)" }}>{m.label}</p>
              <p className="text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
            </TonalCard>
          ))}
        </div>

        {/* Astrologer's Reading */}
        <TonalCard level="raised" className="md:col-span-7 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
            <Star className="w-24 h-24" style={{ color: "#bac3ff" }} />
          </div>
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4" style={{ color: "#bac3ff" }} />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#bac3ff" }}>Astrologer's Reading</p>
            </div>
            <p className="text-lg leading-relaxed italic" style={{ color: "rgba(229,226,225,0.8)" }}>
              "{result.astrologerSummary}"
            </p>
          </div>
        </TonalCard>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          DASHA LAYER — two large cards side by side
          ════════════════════════════════════════════════════════════════════ */}
      <section id="biz-dasha" className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#e5e2e1" }}>Dasha Layer</h2>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: result.dashaLayer.verdict === "Favorable" ? "rgba(52,211,153,0.1)" :
                          result.dashaLayer.verdict === "Unfavorable" ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)",
              color: result.dashaLayer.verdict === "Favorable" ? "#34d399" :
                     result.dashaLayer.verdict === "Unfavorable" ? "#f87171" : "#fbbf24",
            }}>
            {result.dashaLayer.verdict} Impact
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Mahadasha */}
          <TonalCard level="base" className="p-7 flex items-center gap-7 group hover:brightness-105 transition-all duration-300">
            <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(186,195,255,0.08)", border: "1px solid rgba(186,195,255,0.15)" }}>
              <Star className="w-7 h-7" style={{ color: "#bac3ff" }} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(197,197,212,0.5)" }}>Mahadasha (Main Period)</p>
              <p className="text-3xl font-bold" style={{ color: "#e5e2e1" }}>{result.dashaLayer.mahadasha}</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: "#bac3ff" }}>
                  Houses {result.dashaLayer.mahaHouses.join(", ")}
                </p>
                <span className="text-[10px]" style={{ color: "rgba(229,226,225,0.3)" }}>
                  · Until {result.dashaLayer.mahadasha_end.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </TonalCard>

          {/* Antardasha */}
          <TonalCard level="base" className="p-7 flex items-center gap-7 group hover:brightness-105 transition-all duration-300">
            <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <Clock className="w-7 h-7" style={{ color: "#fbbf24" }} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(197,197,212,0.5)" }}>Antardasha (Sub Period)</p>
              <p className="text-3xl font-bold" style={{ color: "#e5e2e1" }}>{result.dashaLayer.antardasha}</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: "#fbbf24" }}>
                  Houses {result.dashaLayer.antarHouses.join(", ")}
                </p>
                <span className="text-[10px]" style={{ color: "rgba(229,226,225,0.3)" }}>
                  · Until {result.dashaLayer.antardasha_end.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </TonalCard>
        </div>

        {/* Dasha verdict banner */}
        <TonalCard level="raised" className="p-5 flex items-start gap-4"
          style={{
            background: result.dashaLayer.verdict === "Favorable" ? "rgba(52,211,153,0.04)" :
                        result.dashaLayer.verdict === "Unfavorable" ? "rgba(248,113,113,0.04)" : "rgba(251,191,36,0.04)",
          }}>
          {result.dashaLayer.verdict === "Favorable"
            ? <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#34d399" }} />
            : result.dashaLayer.verdict === "Unfavorable"
            ? <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
            : <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#fbbf24" }} />
          }
          <div>
            <p className="text-sm font-bold mb-1" style={{
              color: result.dashaLayer.verdict === "Favorable" ? "#34d399" :
                     result.dashaLayer.verdict === "Unfavorable" ? "#f87171" : "#fbbf24"
            }}>
              Dasha Verdict: {result.dashaLayer.verdict}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(229,226,225,0.55)" }}>{result.dashaLayer.reason}</p>
          </div>
        </TonalCard>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          TRANSIT LAYER — 4 cards in a row
          ════════════════════════════════════════════════════════════════════ */}
      <section id="biz-transits" className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#e5e2e1" }}>Transit Layer</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {result.transitLayer.map((t) => {
            const cfg = TRANSIT_VERDICT_CONFIG[t.verdict];
            return (
              <TonalCard key={t.planet} level="base" className="p-6 space-y-5 group hover:brightness-110 transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${cfg.accent}12` }}>
                    <span className="text-xl" style={{ color: cfg.accent }}>{PLANET_GLYPHS[t.planet] ?? "●"}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.accent }}>
                    {cfg.label}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "#e5e2e1" }}>{t.planet}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "rgba(197,197,212,0.5)" }}>
                    {t.sign} · House {t.transitHouse}{t.isRetrograde ? " · ℞" : ""}
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(229,226,225,0.4)" }}>{t.note}</p>
              </TonalCard>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          DECISION AREAS — clean list with Go / Caution / Hold signals
          ════════════════════════════════════════════════════════════════════ */}
      <section id="biz-decisions" className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#e5e2e1" }}>Decision Areas</h2>

        <div className="space-y-3">
          {result.decisionSignals.map((sig) => {
            const cfg = SIGNAL_CONFIG[sig.signal];
            const Icon = DECISION_ICONS[sig.area] ?? Target;
            const isExpanded = expandedSignal === sig.area;
            const accentColor = sig.signal === "Go" ? "#34d399" : sig.signal === "Caution" ? "#fbbf24" : "#60a5fa";
            return (
              <TonalCard
                key={sig.area}
                level="base"
                className="cursor-pointer group hover:brightness-110 transition-all duration-200"
                onClick={() => setExpandedSignal(isExpanded ? null : sig.area)}
              >
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5" style={{ color: "rgba(197,197,212,0.5)" }} />
                    <span className="text-sm font-semibold tracking-wide" style={{ color: "#e5e2e1" }}>{sig.area}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: accentColor }}>
                      {cfg.label}
                    </span>
                    <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} style={{ color: "rgba(229,226,225,0.3)" }} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-6 pb-5">
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(229,226,225,0.5)" }}>
                      {sig.reason}
                    </p>
                    {sig.activatingHouses.length > 0 && (
                      <p className="text-[10px] mt-2" style={{ color: "rgba(197,197,212,0.35)" }}>
                        Activating Houses: {sig.activatingHouses.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </TonalCard>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          MUHURTA — Today's quality card
          ════════════════════════════════════════════════════════════════════ */}
      <section id="biz-muhurta" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#e5e2e1" }}>Today's Muhurta</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Today's Muhurta — scorecard style */}
          <TonalCard level="base" className="p-8 flex flex-col items-center justify-center space-y-6">
            <ScoreRing score={result.muhurtaToday.score} size={140} />
            <div className="text-center space-y-2">
              <p className="text-lg font-bold" style={{
                color: result.muhurtaToday.score >= 70 ? "#34d399" :
                       result.muhurtaToday.score >= 50 ? "#fbbf24" :
                       result.muhurtaToday.score >= 35 ? "#f97316" : "#f87171"
              }}>{result.muhurtaToday.label}</p>
              <p className="text-xs" style={{ color: "rgba(229,226,225,0.45)" }}>
                {result.muhurtaToday.paksha} Paksha · {result.muhurtaToday.tithiName} · Tara: {result.muhurtaToday.taraName}
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: result.muhurtaToday.isGandanta ? "#f87171" : "#34d399" }} />
                <span className="text-[10px]" style={{ color: "rgba(229,226,225,0.4)" }}>
                  Gandanta: {result.muhurtaToday.isGandanta ? "Active" : "Clear"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: result.muhurtaToday.isRahuKaal ? "#f87171" : "#34d399" }} />
                <span className="text-[10px]" style={{ color: "rgba(229,226,225,0.4)" }}>
                  Rahu Kaal: {result.muhurtaToday.isRahuKaal ? "Active" : "Clear"}
                </span>
              </div>
            </div>
          </TonalCard>

          {/* Quick summary card */}
          <TonalCard level="base" className="p-7 flex flex-col justify-center space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(197,197,212,0.5)" }}>Muhurta Summary</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(229,226,225,0.55)" }}>
                {result.muhurtaToday.score >= 70
                  ? "Today's Muhurta quality is strong. This is a favorable window for executing important business decisions, signing contracts, or initiating new ventures."
                  : result.muhurtaToday.score >= 50
                  ? "Today's Muhurta quality is moderate. Proceed with planned activities but avoid initiating high-stakes decisions. Stick to routine operations."
                  : result.muhurtaToday.score >= 35
                  ? "Today's Muhurta quality is below average. Postpone major commitments if possible. Focus on planning and preparation instead."
                  : "Today's Muhurta quality is weak. Avoid new ventures, large transactions, or critical decisions. Use this time for review and consolidation."
                }
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "rgba(229,226,225,0.25)" }} />
              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(229,226,225,0.3)" }}>
                Scored on Tara Chakra, Tithi, Paksha, Gandanta, and Rahu Kaal. Execute important decisions during morning hours.
              </p>
            </div>
          </TonalCard>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          CONSULTATION — 2-column bento (design-2 style)
          Left: Input + Score ring  |  Right: Advice + Muhurta dates + Tags
          ════════════════════════════════════════════════════════════════════ */}
      <section id="biz-consultation" className="space-y-6">
        <header className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#bac3ff" }}>Precision Insight</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: "#e5e2e1" }}>Vedic Consultation</h2>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Left Column: Query input + Timing Score ── */}
          <div className="lg:col-span-5 space-y-6">

            {/* Query input card */}
            <BusinessDecisionQuery result={result} />

            {/* Timing Score — large centered scorecard */}
            <TonalCard level="base" className="p-8 flex flex-col items-center justify-center space-y-5">
              <ScoreRing score={result.overallScore} size={160} />
              <p className="text-sm text-center leading-relaxed max-w-[260px]" style={{ color: "rgba(197,197,212,0.55)" }}>
                Current cosmic weight indicates{" "}
                <span className="font-bold" style={{ color: phaseCfg.accent }}>
                  {result.overallScore >= 65 ? "Strong" : result.overallScore >= 40 ? "Moderate" : "Weak"}
                </span>{" "}
                alignment.{" "}
                {result.overallScore < 65 ? "Caution is advised for major commitments." : "Conditions support decisive action."}
              </p>
            </TonalCard>
          </div>

          {/* ── Right Column: Advice + Muhurta dates + Planetary tags ── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Astrologer's Advice card — with accent bar */}
            <TonalCard level="base" className="p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.06]">
                <Sparkles className="w-20 h-20" style={{ color: "#bac3ff" }} />
              </div>
              <div className="relative z-10 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-7 rounded-full" style={{ background: "#bac3ff" }} />
                  <h3 className="text-xl font-bold" style={{ color: "#e5e2e1" }}>Vedic Astrologer's Advice</h3>
                </div>
                <p className="text-base leading-relaxed italic" style={{ color: "rgba(229,226,225,0.7)" }}>
                  "{result.astrologerSummary}"
                </p>
              </div>
            </TonalCard>

            {/* Upcoming Muhurta Dates */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <h3 className="text-lg font-bold" style={{ color: "#e5e2e1" }}>Upcoming Muhurta Dates</h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "#bac3ff" }}>Next 30 Days</span>
              </div>

              <div className="space-y-3">
                {result.topMuhurtaDates.length === 0 ? (
                  <TonalCard level="raised" className="p-6 text-center">
                    <p className="text-sm" style={{ color: "rgba(229,226,225,0.4)" }}>
                      No strong Muhurta windows found in the next 30 days.
                    </p>
                  </TonalCard>
                ) : (
                  result.topMuhurtaDates.map((w, i) => {
                    const dateObj = w.date;
                    const month = dateObj.toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
                    const day = dateObj.getDate();
                    const scoreColor = w.score >= 70 ? "#34d399" : w.score >= 50 ? "#fbbf24" : "#94a3b8";
                    return (
                      <TonalCard key={i} level="raised" className="flex items-center justify-between p-5 group hover:brightness-110 transition-all duration-200"
                        style={{ background: "rgba(32,31,31,1)" }}>
                        <div className="flex items-center gap-5">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg"
                            style={{ background: TONAL.base }}>
                            <span className="text-[10px] font-bold" style={{ color: "rgba(229,226,225,0.5)" }}>{month}</span>
                            <span className="text-lg font-extrabold" style={{ color: "#bac3ff" }}>{day}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: "#e5e2e1" }}>{w.label}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: "rgba(197,197,212,0.4)" }}>
                              {w.paksha} · {w.tithiName} · Tara: {w.taraName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold uppercase tracking-tight" style={{ color: scoreColor }}>
                            Score: {w.score}
                          </span>
                          {w.score >= 70
                            ? <TrendingUp className="w-4 h-4" style={{ color: scoreColor }} />
                            : w.score >= 50
                            ? <Minus className="w-4 h-4" style={{ color: scoreColor }} />
                            : <TrendingDown className="w-4 h-4" style={{ color: scoreColor }} />
                          }
                        </div>
                      </TonalCard>
                    );
                  })
                )}
              </div>
            </div>

            {/* Planetary Tags */}
            <div className="flex flex-wrap gap-2.5 pt-4">
              <span className="px-4 py-2 rounded-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ background: TONAL.high, color: "rgba(197,197,212,0.6)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#bac3ff" }} />
                {result.dashaLayer.mahadasha}–{result.dashaLayer.antardasha} Dasha
              </span>
              {result.transitLayer.map(t => {
                const cfg = TRANSIT_VERDICT_CONFIG[t.verdict];
                return (
                  <span key={t.planet} className="px-4 py-2 rounded-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ background: TONAL.high, color: "rgba(197,197,212,0.6)" }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: cfg.accent }} />
                    {t.planet} in H{t.transitHouse}{t.isRetrograde ? " ℞" : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <footer className="pb-4">
        <div className="flex items-start gap-3 px-1">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "rgba(229,226,225,0.2)" }} />
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(229,226,225,0.25)" }}>
            This analysis follows strict Vedic Muhurta principles. No exact ROI or financial amounts are predicted: only timing phase, intensity, and execution windows. Consult a qualified astrologer for critical decisions.
          </p>
        </div>
      </footer>

    </div>
  );
};

export default BusinessTiming;
