import { useState, useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from "recharts";
import { Shield, Star, AlertTriangle, Zap, Activity, TrendingDown, Eye } from "lucide-react";
import {
  generateRiskHero, generateRiskTimeline, generateDefensiveStrategy,
  generateRiskAlerts, type RiskPhase,
} from "@/lib/risk-engine";

/* ── deterministic helpers ─────────────────────────── */
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

const mockBirth = { name: "Arjun", dateOfBirth: "1995-03-15", timeOfBirth: "06:30", placeOfBirth: "Mumbai" };

type RiskMode = "emotional" | "volatility" | "transit";

const riskModes: { key: RiskMode; label: string; gradient: string; glowColor: string }[] = [
  { key: "emotional", label: "Emotional Risk", gradient: "from-blue-500 to-cyan-400", glowColor: "rgba(59,130,246,0.5)" },
  { key: "volatility", label: "Market Volatility", gradient: "from-purple-500 to-violet-400", glowColor: "rgba(139,92,246,0.5)" },
  { key: "transit", label: "Transit Impact", gradient: "from-orange-500 to-amber-400", glowColor: "rgba(249,115,22,0.5)" },
];

const radarDimensions: Record<RiskMode, string[]> = {
  emotional: ["Fear Index", "Greed Pull", "Patience", "Discipline", "Confidence", "Detachment"],
  volatility: ["Equity Risk", "Crypto Exp.", "Forex Swing", "Bond Safety", "Commodity", "Alt. Assets"],
  transit: ["Saturn", "Jupiter", "Rahu-Ketu", "Venus", "Mars", "Mercury"],
};

export default function RiskShield() {
  const hero = useMemo(() => generateRiskHero(mockBirth), []);
  const timeline = useMemo(() => generateRiskTimeline(mockBirth, 60), []);
  const strategy = useMemo(() => generateDefensiveStrategy(mockBirth), []);
  const alerts = useMemo(() => generateRiskAlerts(mockBirth), []);

  const [activeMode, setActiveMode] = useState<RiskMode>("emotional");

  /* generate radar data for current mode */
  const radarData = useMemo(() => {
    const rng = seededRandom(hashStr(mockBirth.dateOfBirth + activeMode));
    return radarDimensions[activeMode].map((dim) => ({
      subject: dim,
      value: Math.floor(rng() * 55) + 30,
      fullMark: 100,
    }));
  }, [activeMode]);

  /* risk spectrum position 0-100 */
  const spectrumPosition = hero.intensity * 10;

  /* timeline phases count */
  const phaseCounts = useMemo(() => {
    const counts: Record<RiskPhase, number> = { stable: 0, caution: 0, elevated: 0 };
    timeline.forEach((d) => counts[d.phase]++);
    return counts;
  }, [timeline]);

  const modeConfig = riskModes.find((m) => m.key === activeMode)!;

  return (
    <div className="min-h-full px-5 py-5 md:px-8 lg:px-10 relative overflow-hidden">

      {/* Background nebula image */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1400&q=80&fm=webp"
          alt="Nebula in space"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.07]"
        loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5">
          <Shield className="h-4 w-4 text-primary" />
          <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-foreground/50">Mystic Risk Nebula</h1>
        </div>

        {/* ── Main Card ── */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, hsl(220 25% 8% / 0.85), hsl(240 20% 6% / 0.9))",
            backdropFilter: "blur(16px)",
            boxShadow: "inset 0 1px 0 0 hsl(0 0% 100% / 0.04), 0 0 80px -20px hsl(240 60% 40% / 0.12)",
          }}
        >
          {/* Inner nebula glow */}
          <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: `
                radial-gradient(ellipse at 25% 50%, hsl(200 80% 45% / 0.3) 0%, transparent 50%),
                radial-gradient(ellipse at 75% 50%, hsl(20 80% 50% / 0.25) 0%, transparent 50%)
              `,
            }}
          />

          <div className="relative p-6 lg:p-8">
            {/* ── Risk Mode Pills ── */}
            <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
              {riskModes.map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setActiveMode(mode.key)}
                  className="relative px-4 py-2 rounded-full text-[11px] font-semibold tracking-wide transition-all duration-300"
                  style={{
                    background: activeMode === mode.key
                      ? "hsl(0 0% 100% / 0.08)"
                      : "hsl(0 0% 100% / 0.03)",
                    border: `1px solid ${activeMode === mode.key ? "hsl(0 0% 100% / 0.2)" : "hsl(0 0% 100% / 0.06)"}`,
                    color: activeMode === mode.key ? "hsl(0 0% 95%)" : "hsl(0 0% 55%)",
                    boxShadow: activeMode === mode.key ? `0 0 20px -5px ${mode.glowColor}` : "none",
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* ── Content Grid: Radar + Stats + Guidelines ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Risk Annotations */}
              <div className="lg:col-span-2 flex flex-col justify-center gap-6">
                <div className="flex items-center gap-2.5 lg:flex-col lg:items-start">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(200 80% 45% / 0.15)" }}>
                    <Shield className="h-4 w-4" style={{ color: "hsl(200 80% 65%)" }} />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-foreground/30">Low Risk</p>
                    <p className="text-xs font-semibold text-foreground/60">Safe Zone</p>
                  </div>
                </div>
                {/* Phase breakdown */}
                <div className="space-y-2">
                  {([
                    { phase: "stable" as RiskPhase, label: "Stable", color: "hsl(200 70% 55%)" },
                    { phase: "caution" as RiskPhase, label: "Caution", color: "hsl(43 72% 52%)" },
                    { phase: "elevated" as RiskPhase, label: "Elevated", color: "hsl(15 80% 55%)" },
                  ]).map(({ phase, label, color }) => (
                    <div key={phase} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: color }} />
                      <span className="text-[10px] text-foreground/30">{label}</span>
                      <span className="text-[10px] font-semibold text-foreground/50 ml-auto">{phaseCounts[phase]}d</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center: Radar Chart */}
              <div className="lg:col-span-5 flex items-center justify-center">
                <div
                  className="w-full max-w-sm rounded-2xl p-4 relative"
                  style={{
                    background: "hsl(0 0% 100% / 0.03)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid hsl(0 0% 100% / 0.06)",
                    boxShadow: `0 0 60px -15px ${modeConfig.glowColor}`,
                  }}
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData} outerRadius={90}>
                      <PolarGrid stroke="hsl(0 0% 100% / 0.06)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fontSize: 9, fill: "hsl(0 0% 60%)" }}
                      />
                      <Radar
                        dataKey="value"
                        stroke={
                          activeMode === "emotional" ? "hsl(200 80% 60%)"
                          : activeMode === "volatility" ? "hsl(270 70% 65%)"
                          : "hsl(30 90% 60%)"
                        }
                        fill={
                          activeMode === "emotional" ? "hsl(200 80% 60%)"
                          : activeMode === "volatility" ? "hsl(270 70% 65%)"
                          : "hsl(30 90% 60%)"
                        }
                        fillOpacity={0.12}
                        strokeWidth={2}
                        dot={{ r: 3, fill: "hsl(0 0% 100%)", strokeWidth: 0 }}
                        style={{
                          filter: `drop-shadow(0 0 8px ${modeConfig.glowColor})`,
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  <p className="text-center text-[10px] tracking-[0.15em] uppercase text-foreground/25 mt-1">
                    {modeConfig.label} Profile
                  </p>
                </div>
              </div>

              {/* Right: Stats + Guidelines */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Hero stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Activity, label: "Intensity", value: `${hero.intensity}/10`, color: "hsl(43 72% 52%)" },
                    { icon: Eye, label: "Phase", value: hero.phase === "elevated" ? "Elevated" : hero.phase === "caution" ? "Caution" : "Stable", color: hero.phase === "elevated" ? "hsl(15 80% 55%)" : hero.phase === "caution" ? "hsl(43 72% 52%)" : "hsl(200 70% 55%)" },
                    { icon: TrendingDown, label: "Exposure", value: `${Math.round(hero.intensity * 8.5)}%`, color: "hsl(270 70% 65%)" },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3 text-center"
                      style={{
                        background: "hsl(0 0% 100% / 0.03)",
                        border: "1px solid hsl(0 0% 100% / 0.05)",
                      }}
                    >
                      <Icon className="h-4 w-4 mx-auto mb-1.5" style={{ color }} />
                      <p className="text-[9px] tracking-[0.15em] uppercase text-foreground/25 mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-foreground/80">{value}</p>
                    </div>
                  ))}
                </div>

                {/* High Risk annotation */}
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(15 80% 50% / 0.15)" }}>
                    <AlertTriangle className="h-4 w-4" style={{ color: "hsl(15 80% 60%)" }} />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-foreground/30">High Risk</p>
                    <p className="text-xs font-semibold text-foreground/60">Caution Zone</p>
                  </div>
                </div>

                {/* Guidelines card */}
                <div
                  className="rounded-xl p-4 flex-1"
                  style={{
                    background: "hsl(220 20% 6% / 0.8)",
                    border: "1px solid hsl(0 0% 100% / 0.05)",
                  }}
                >
                  <p className="text-[10px] tracking-[0.2em] uppercase text-foreground/30 mb-3">Defensive Guidelines</p>
                  <div className="space-y-2.5">
                    {strategy.recommended.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Star className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "hsl(43 72% 52% / 0.6)" }} />
                        <span className="text-[11px] text-foreground/45 leading-relaxed">{item}</span>
                      </div>
                    ))}
                    {strategy.avoid.slice(0, 2).map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "hsl(15 70% 55% / 0.5)" }} />
                        <span className="text-[11px] text-foreground/35 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Risk Spectrum Bar ── */}
            <div className="mt-8">
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "hsl(0 0% 100% / 0.04)" }}>
                {/* Gradient fill */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, hsl(220 70% 45%), hsl(200 70% 50%), hsl(170 65% 45%), hsl(80 60% 50%), hsl(43 72% 52%), hsl(30 80% 50%), hsl(10 80% 50%))",
                  }}
                />
                {/* Marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 transition-all duration-700 ease-out"
                  style={{
                    left: `calc(${spectrumPosition}% - 10px)`,
                    background: "hsl(0 0% 100% / 0.95)",
                    borderColor: "hsl(0 0% 100% / 0.3)",
                    boxShadow: "0 0 15px 3px hsl(0 0% 100% / 0.4)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] tracking-wide uppercase text-foreground/20">Low Risk</span>
                <span className="text-[9px] tracking-wide uppercase text-foreground/20">High Risk</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Timeline + Alerts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Timeline mini heatmap */}
          <div
            className="lg:col-span-2 rounded-2xl p-5"
            style={{
              background: "hsl(220 20% 7% / 0.7)",
              border: "1px solid hsl(0 0% 100% / 0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.2em] uppercase text-foreground/30">60-Day Risk Forecast</p>
              <Zap className="h-3.5 w-3.5 text-primary/50" />
            </div>
            <div className="grid grid-cols-15 gap-[3px]" style={{ gridTemplateColumns: "repeat(15, 1fr)" }}>
              {timeline.map((day, i) => {
                const color = day.phase === "elevated"
                  ? "hsl(15 75% 50%)"
                  : day.phase === "caution"
                  ? "hsl(43 70% 45%)"
                  : "hsl(200 60% 40%)";
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-[3px] transition-all duration-200 hover:scale-125 cursor-pointer"
                    style={{
                      background: color,
                      opacity: 0.35 + (day.phase === "elevated" ? 0.55 : day.phase === "caution" ? 0.35 : 0.15),
                      boxShadow: day.phase === "elevated" ? `0 0 6px ${color}` : "none",
                    }}
                    title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${day.phase}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              {[
                { label: "Stable", color: "hsl(200 60% 40%)" },
                { label: "Caution", color: "hsl(43 70% 45%)" },
                { label: "Elevated", color: "hsl(15 75% 50%)" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm" style={{ background: color }} />
                  <span className="text-[9px] text-foreground/25">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{
                  background: "hsl(220 20% 7% / 0.7)",
                  border: "1px solid hsl(0 0% 100% / 0.06)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "hsl(43 72% 52% / 0.1)" }}>
                    <Star className="h-3 w-3 text-primary/60" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-wide uppercase text-foreground/40 mb-1">{alert.title}</p>
                    <p className="text-[11px] text-foreground/30 leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
