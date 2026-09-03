import { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import {
  TrendingUp, Shield, Clock, Sparkles, ArrowRight,
  Home, Gem, Car, ChevronRight,
} from "lucide-react";
import {
  type BirthDetails,
  generateProfile,
  generateTimeline,
  generatePredictors,
  generateTransits,
  generateRecommendation,
} from "@/lib/astro-engine";

/* ── helpers ───────────────────────────────────────────── */
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

/* ── Sub-components ────────────────────────────────────── */

const IncomeChart = ({ data }: { data: ReturnType<typeof generateTimeline> }) => (
  <div className="glass-card p-5 h-full">
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Income & Wealth</p>
        <p className="text-sm font-semibold tracking-tight">Earning Phases</p>
      </div>
      <TrendingUp className="h-4 w-4 text-primary" />
    </div>
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(43,72%,52%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(220,20%,4%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(220,10%,45%)" }} axisLine={false} tickLine={false} interval={1} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(220,10%,45%)" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 11 }}
          labelStyle={{ color: "hsl(220,10%,90%)" }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="hsl(43,72%,52%)"
          strokeWidth={2}
          fill="url(#goldGrad)"
          style={{ filter: "drop-shadow(0 0 6px hsl(43 72% 52% / 0.4))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const RiskGauge = ({ details }: { details: BirthDetails }) => {
  const rng = seededRandom(hashStr(details.dateOfBirth + "gauge"));
  const riskScore = Math.floor(rng() * 40) + 30; // 30-70
  const dashaImpact = rng() > 0.5 ? "Favorable" : "Challenging";
  const retrograde = rng() > 0.6;

  const angle = (riskScore / 100) * 180;

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Vedic Risk Cockpit</p>
          <p className="text-sm font-semibold tracking-tight">Dasha Risk Meter</p>
        </div>
        <Shield className="h-4 w-4 text-secondary" />
      </div>

      {/* Semi-circular gauge */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-44 h-24">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="hsl(220,15%,14%)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Colored arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(angle / 180) * 251.2} 251.2`}
              style={{ filter: "drop-shadow(0 0 8px hsl(43 72% 52% / 0.4))" }}
            />
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(170,75%,45%)" />
                <stop offset="50%" stopColor="hsl(43,72%,52%)" />
                <stop offset="100%" stopColor="hsl(0,72%,51%)" />
              </linearGradient>
            </defs>
            {/* Needle */}
            <line
              x1="100"
              y1="100"
              x2={100 + 60 * Math.cos(Math.PI - (angle * Math.PI / 180))}
              y2={100 - 60 * Math.sin(Math.PI - (angle * Math.PI / 180))}
              stroke="hsl(220,10%,90%)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="4" fill="hsl(220,10%,90%)" />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <p className="text-xl font-bold tracking-tight">{riskScore}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <div className="flex-1 rounded-lg bg-white/[0.03] p-2.5 text-center">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Dasha</p>
          <p className={`text-xs font-semibold ${dashaImpact === "Favorable" ? "text-favorable" : "text-warning"}`}>{dashaImpact}</p>
        </div>
        <div className="flex-1 rounded-lg bg-white/[0.03] p-2.5 text-center">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Retrograde</p>
          <p className={`text-xs font-semibold ${retrograde ? "text-warning" : "text-favorable"}`}>{retrograde ? "Active" : "Clear"}</p>
        </div>
      </div>
    </div>
  );
};

const AssetCommitment = ({ details }: { details: BirthDetails }) => {
  const rng = seededRandom(hashStr(details.dateOfBirth + "assets"));
  const assets = [
    { icon: Home, label: "Property", timing: rng() > 0.5 ? "Auspicious" : "Neutral", color: "text-primary" },
    { icon: Gem, label: "Gold", timing: rng() > 0.4 ? "Auspicious" : "Caution", color: "text-primary" },
    { icon: Car, label: "Vehicle", timing: rng() > 0.6 ? "Auspicious" : "Neutral", color: "text-primary" },
  ];

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">Auspicious Timing</p>
        </div>
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="space-y-3">
        {assets.map((a, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <a.icon className={`h-5 w-5 ${a.color}`} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold">{a.label}</p>
              <p className={`text-[10px] font-medium ${a.timing === "Auspicious" ? "text-favorable" : a.timing === "Caution" ? "text-warning" : "text-muted-foreground"}`}>
                {a.timing}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
};

const VolatilityHeatmap = ({ details }: { details: BirthDetails }) => {
  const rng = seededRandom(hashStr(details.dateOfBirth + "heatmap"));
  const grid = Array.from({ length: 100 }, () => rng());

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Market Volatility</p>
          <p className="text-sm font-semibold tracking-tight">Predictive Heatmap</p>
        </div>
      </div>
      <div className="grid grid-cols-10 gap-[2px]">
        {grid.map((v, i) => {
          const hue = v > 0.7 ? `43` : v > 0.4 ? `270` : `260`;
          const light = v > 0.7 ? `${45 + v * 25}%` : `${15 + v * 20}%`;
          const sat = v > 0.7 ? `72%` : `60%`;
          return (
            <div
              key={i}
              className="aspect-square rounded-[3px] transition-all duration-200 hover:scale-125"
              style={{
                background: `hsl(${hue} ${sat} ${light})`,
                boxShadow: v > 0.75 ? `0 0 8px hsl(43 72% 52% / 0.3)` : "none",
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[9px] text-muted-foreground">Low Volatility</span>
        <div className="flex gap-0.5">
          {[15, 25, 35, 45, 55].map((l, i) => (
            <div key={i} className="h-2 w-4 rounded-sm" style={{ background: `hsl(${i > 2 ? 43 : 260} ${i > 2 ? 72 : 60}% ${l}%)` }} />
          ))}
        </div>
        <span className="text-[9px] text-muted-foreground">High Volatility</span>
      </div>
    </div>
  );
};

const KundaliRadar = ({ details }: { details: BirthDetails }) => {
  const rng = seededRandom(hashStr(details.dateOfBirth + "kundali"));
  const dims = ["Wealth", "Career", "Assets", "Income", "Savings", "Growth"];
  const data = dims.map((d) => ({ subject: d, value: Math.floor(rng() * 50) + 40 }));

  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Kundali Analysis</p>
          <p className="text-sm font-semibold tracking-tight">Personal Wealth Profile</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data} outerRadius={70}>
          <PolarGrid stroke="hsl(220,15%,18%)" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "hsl(220,10%,50%)" }} />
          <Radar
            dataKey="value"
            stroke="hsl(43,72%,52%)"
            fill="hsl(43,72%,52%)"
            fillOpacity={0.15}
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 6px hsl(43 72% 52% / 0.3))" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ── Cosmic Banner ─────────────────────────────────────── */
const CosmicBanner = () => (
  <div className="relative rounded-2xl overflow-hidden h-36 mb-1">
    <img
      src="https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&q=80&fm=webp"
      alt="Milky Way galaxy"
      className="absolute inset-0 w-full h-full object-cover object-center"
    loading="lazy" decoding="async" />
    <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
    <div className="relative z-10 flex items-end h-full px-5 pb-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-primary/80 font-semibold">Cosmic Wealth Intelligence</p>
        <p className="text-xs text-muted-foreground mt-0.5">Your stars, your strategy</p>
      </div>
    </div>
  </div>
);

/* ── Main Dashboard ────────────────────────────────────── */

const defaultDetails: BirthDetails = {
  name: "Cosmic Explorer",
  dateOfBirth: "1995-03-15",
  timeOfBirth: "06:30",
  placeOfBirth: "Mumbai",
};

const Dashboard = () => {
  const [details, setDetails] = useState<BirthDetails>(defaultDetails);

  useEffect(() => {
    const stored = sessionStorage.getItem("birthDetails");
    if (stored) setDetails(JSON.parse(stored));
  }, []);

  const profile = generateProfile(details);
  const timeline = generateTimeline(details);
  const recommendation = generateRecommendation(details);

  return (
    <div className="px-3 md:px-5 py-5 space-y-5 relative">
      <CosmicBanner />
      {/* Welcome row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Welcome back</p>
          <h1 className="text-base md:text-lg font-bold tracking-tight">{details.name}'s Cosmic Dashboard</h1>
        </div>
        <div className="flex gap-2">
          {[
            { label: profile.sunSign, sub: "Sun", color: "text-primary" },
            { label: profile.moonSign, sub: "Moon", color: "text-secondary" },
            { label: profile.ascendant, sub: "Asc", color: "text-favorable" },
          ].map((z, i) => (
            <div key={i} className="glass-card px-2 md:px-3 py-1.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{z.sub}</p>
              <p className={`text-xs font-semibold ${z.color}`}>{z.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action card */}
      <div className="glass-card-glow p-3 md:p-4 flex items-center gap-3 md:gap-4 animate-float">
        <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">{recommendation.action}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{recommendation.timing}</span>
          </div>
        </div>
        <button className="text-primary hover:text-primary/80 transition-colors">
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* 3-column masonry grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Col 1: Income chart */}
        <div className="lg:row-span-2">
          <IncomeChart data={timeline} />
        </div>

        {/* Col 2: Risk gauge */}
        <div>
          <RiskGauge details={details} />
        </div>

        {/* Col 3: Asset commitment */}
        <div>
          <AssetCommitment details={details} />
        </div>

        {/* Col 2: Kundali radar */}
        <div>
          <KundaliRadar details={details} />
        </div>

        {/* Col 3: Heatmap */}
        <div>
          <VolatilityHeatmap details={details} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
