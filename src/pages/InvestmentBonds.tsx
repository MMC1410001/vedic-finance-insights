/**
 * InvestmentBonds — "Best Cosmic Connected Investment Option for You"
 * Redesigned to fit entirely within 100vh — no scrolling.
 * Left: heading + selector + compact charts.
 * Right: condensed detail panel.
 */
import { useState, useEffect, useMemo } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";
import { Sparkles, TrendingUp, Shield, ChevronDown } from "lucide-react";
import { generateInvestmentBaskets } from "@/lib/vedicfinance-api";
import type {
  InvestmentBasketResponse,
  BasketType,
  ReportRequest,
} from "@/lib/vedicfinance-types";
import {
  generateBondAnalysis,
  zodiacSigns,
  zodiacSymbols,
  type InvestmentType,
} from "@/lib/bonds-engine";

const SUITABILITY_COLORS: Record<string, string> = {
  highly_suitable: "hsl(170 70% 50%)", suitable: "hsl(200 70% 55%)",
  moderate: "hsl(43 80% 55%)", low: "hsl(25 80% 55%)", avoid: "hsl(0 70% 55%)",
};
const SUITABILITY_LABELS: Record<string, string> = {
  highly_suitable: "Highly Suitable", suitable: "Suitable",
  moderate: "Moderate", low: "Low", avoid: "Avoid",
};
const PIE_COLORS = [
  "hsl(170 70% 50%)", "hsl(43 80% 55%)", "hsl(239 70% 60%)",
  "hsl(200 70% 55%)", "hsl(280 60% 55%)", "hsl(15 80% 55%)",
];
const SCORE_COLORS: Record<string, string> = {
  natal: "#10b981", dasha: "#f59e0b", transit: "#3b82f6",
};
const SCORE_LABELS: Record<string, string> = {
  natal: "Natal", dasha: "Dasha", transit: "Transit",
};
const BASKET_ICON_MAP: Record<string, string> = {
  mutual_funds: "📊", gold: "🥇", stocks: "📈", real_estate: "🏠", fixed_income: "💵", high_risk: "⚡",
};
const BASKET_TO_BOND: Partial<Record<BasketType, InvestmentType>> = {
  gold: "gold", mutual_funds: "mf", stocks: "trading",
  high_risk: "trading", fixed_income: "silver", real_estate: "silver",
};

const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] text-white/40 w-12 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}90, ${color})` }} />
    </div>
    <span className="text-[10px] font-semibold text-white/60 w-6 text-right">{value}</span>
  </div>
);

const InvestmentBonds = () => {
  const [data, setData] = useState<InvestmentBasketResponse | null>(null);
  const [selected, setSelected] = useState<BasketType>("mutual_funds");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;
    let req: ReportRequest;
    try { req = JSON.parse(raw); } catch { return; }

    const cached = sessionStorage.getItem("investmentBaskets");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setSelected(parsed.ranked[0] || "mutual_funds");
        return;
      } catch { /* fall through */ }
    }

    setLoading(true);
    generateInvestmentBaskets(req)
      .then((result) => {
        sessionStorage.setItem("investmentBaskets", JSON.stringify(result));
        setData(result);
        setSelected(result.ranked[0] || "mutual_funds");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = data ? data.baskets[selected] : null;
  const suitColor = active ? (SUITABILITY_COLORS[active.suitability] ?? "hsl(220 10% 50%)") : "";
  const bondType = BASKET_TO_BOND[selected] ?? "gold";
  const activeBond = useMemo(() => generateBondAnalysis(bondType, "cosmic-user"), [bondType]);
  const allBaskets = data ? [...data.ranked, ...data.avoided] : [];

  const radarData = useMemo(() => {
    if (!data) return [];
    const axes = ["Natal", "Dasha", "Transit"];
    return axes.map((axis, i) => {
      const key = (["natal", "dasha", "transit"] as const)[i];
      const entry: Record<string, string | number> = { axis };
      for (const b of data.ranked) entry[b] = data.baskets[b].scores[key];
      return entry;
    });
  }, [data]);

  const pieData = useMemo(() =>
    data ? data.ranked.map((b) => ({ name: data.baskets[b].label, value: data.allocation[b] || 0, basket: b })) : [],
  [data]);

  const barData = useMemo(() =>
    data ? allBaskets.map((b) => ({
      key: b,
      name: data.baskets[b].label,
      score: data.baskets[b].overall_score,
    })).sort((a, b) => b.score - a.score) : [],
  [data, allBaskets]);

  if (!data || !active) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 text-sm">
        {loading ? "Analyzing your chart…" : "Complete onboarding to see investment baskets"}
      </div>
    );
  }

  const aspectColors: Record<string, string> = {
    Strongest: "hsl(43 80% 55%)", Supportive: "hsl(170 70% 50%)",
    Growth: "hsl(200 80% 55%)", Challenge: "hsl(15 80% 55%)", Tension: "hsl(350 70% 55%)",
  };
  const dotColor = (label: string) => {
    if (label === "Strongest") return "bg-amber-400";
    if (label === "Supportive") return "bg-emerald-400";
    if (label === "Growth") return "bg-blue-400";
    if (label === "Challenge") return "bg-orange-400";
    return "bg-red-400";
  };

  return (
    <div className="lg:h-full flex flex-col overflow-hidden">

      {/* ── Top row: badge + heading + picker ── */}
      <div className="flex items-start justify-between gap-4 mb-5 lg:mb-8 shrink-0">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 self-start">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span className="text-[10px] font-medium text-violet-300 tracking-widest uppercase">Cosmic Investment</span>
          </div>
          <h2 className="text-lg md:text-2xl font-bold text-white leading-snug tracking-tight">
            Best Cosmic Connected{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300">
              Investment Option
            </span>{" "}for You
          </h2>
          <p className="text-white/40 text-[11px] lg:text-xs leading-relaxed max-w-md">
            Based on natal chart houses, planetary strengths, current Dasha period, and transit positions.
          </p>
        </div>

        {/* Picker — desktop only */}
        <div className="hidden lg:flex items-end gap-4 shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-6 py-4">
          {/* You avatar */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500/60 to-indigo-500/60 border-2 border-white/20 flex items-center justify-center"
              style={{ boxShadow: "0 0 24px -4px rgba(139,92,246,0.6)" }}>
              <span className="text-2xl">🌟</span>
            </div>
            <span className="text-[10px] text-white/50">You</span>
          </div>

          <span className="text-white/25 text-base mb-5">&amp;</span>

          {/* Asset picker card */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400/50 to-yellow-600/50 border-2 border-white/20 flex items-center justify-center"
              style={{ boxShadow: `0 0 24px -4px ${suitColor}70` }}>
              <span className="text-2xl">{active.icon || BASKET_ICON_MAP[selected] || "📊"}</span>
            </div>
            {/* Select asset card */}
            <div className="relative rounded-xl border border-dashed border-violet-400/40 bg-white/[0.05] px-3 py-1.5 min-w-[130px]">
              <p className="text-[8px] uppercase tracking-widest text-white/30 mb-0.5 text-center">Select Asset</p>
              <select value={selected} onChange={(e) => setSelected(e.target.value as BasketType)}
                className="appearance-none w-full bg-transparent text-[11px] font-medium text-white/90 cursor-pointer focus:outline-none pr-4 text-center">
                {allBaskets.map((b) => (
                  <option key={b} value={b}>{data.baskets[b].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/4 h-3 w-3 text-white/40 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: 2-row compact card ── */}
      <div className="lg:hidden flex flex-col mb-4 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        {/* Row 1: avatars + selector + suitability + signal */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500/60 to-indigo-500/60 border border-white/20 flex items-center justify-center shrink-0"
            style={{ boxShadow: "0 0 10px -4px rgba(139,92,246,0.5)" }}>
            <span className="text-xs">🌟</span>
          </div>
          <span className="text-white/20 text-[9px]">&amp;</span>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-400/50 to-yellow-600/50 border border-white/20 flex items-center justify-center shrink-0"
            style={{ boxShadow: `0 0 10px -4px ${suitColor}60` }}>
            <span className="text-xs">{active.icon || BASKET_ICON_MAP[selected] || "📊"}</span>
          </div>
          <div className="relative flex-1 min-w-0">
            <select value={selected} onChange={(e) => setSelected(e.target.value as BasketType)}
              className="appearance-none w-full bg-transparent text-[11px] font-medium text-white/80 pr-4 cursor-pointer focus:outline-none truncate">
              {allBaskets.map((b) => (
                <option key={b} value={b}>{data.baskets[b].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40 pointer-events-none" />
          </div>
          <div className="w-px h-5 bg-white/[0.08] shrink-0" />
          <span className="text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
            style={{ color: suitColor, border: `1px solid ${suitColor}40`, background: `${suitColor}10` }}>
            {SUITABILITY_LABELS[active.suitability]}
          </span>
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${
            activeBond.signal === "buy" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
            : activeBond.signal === "sell" ? "text-red-400 border-red-400/30 bg-red-400/10"
            : "text-amber-400 border-amber-400/30 bg-amber-400/10"
          }`}>
            {activeBond.signal}
          </span>
        </div>
        {/* Row 2: score / alloc / type stats strip */}
        <div className="flex items-center border-t border-white/[0.06] divide-x divide-white/[0.06]">
          <div className="flex-1 flex flex-col items-center py-1.5">
            <span className="text-[7px] uppercase tracking-widest text-white/30">Score</span>
            <span className="text-sm font-bold text-white leading-tight">{active.overall_score}<span className="text-[8px] text-white/25 font-normal">/100</span></span>
          </div>
          {data.allocation[selected] != null && (
            <div className="flex-1 flex flex-col items-center py-1.5">
              <span className="text-[7px] uppercase tracking-widest text-white/30">Alloc</span>
              <span className="text-sm font-bold text-violet-300 leading-tight">{data.allocation[selected]}%</span>
            </div>
          )}
          <div className="flex-1 flex flex-col items-center py-1.5">
            <span className="text-[7px] uppercase tracking-widest text-white/30">Type</span>
            <span className="text-[11px] font-medium text-violet-300 leading-tight">{data.investor_type}</span>
          </div>
        </div>
      </div>

      {/* ── Main content: stacked on mobile, 2-col on desktop ── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 lg:gap-12 lg:overflow-hidden">

        {/* LEFT — Charts grid */}
        <div className="w-full lg:w-[50%] shrink-0 lg:shrink flex flex-col gap-2.5 lg:gap-3 min-h-0">
          {/* Mobile: 2x2 grid | Desktop: bar chart on top + 3-col row below */}

          {/* Bar chart — hidden on mobile (moved into grid) */}
          <div className="hidden lg:flex rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-2.5 lg:p-3 flex-col h-[120px] lg:h-[30%]">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30 mb-0.5 shrink-0">Comparison</p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 7 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 7 }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15,10,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10 }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    itemStyle={{ color: "rgba(255,255,255,0.5)" }}
                    cursor={{ fill: "rgba(139,92,246,0.08)" }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={10}>
                    {barData.map((entry) => (
                      <Cell key={entry.key} fill={entry.key === selected ? "hsl(263 70% 60%)" : "hsl(220 15% 25%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mobile 2x2 grid + desktop 3-col row */}
          <div className="min-h-0 grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3 lg:flex-1 lg:max-h-[220px]">

            {/* [Mobile row 1, col 1] Comparison bar — mobile only */}
            <div className="lg:hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-2.5 flex flex-col min-h-0 h-[130px]">
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30 mb-0.5 shrink-0">Comparison</p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 2, bottom: 0, left: 0 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 6 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 6 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      contentStyle={{ background: "rgba(15,10,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10 }}
                      labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                      itemStyle={{ color: "rgba(255,255,255,0.5)" }}
                      cursor={{ fill: "rgba(139,92,246,0.08)" }}
                    />
                    <Bar dataKey="score" radius={[0, 3, 3, 0]} maxBarSize={8}>
                      {barData.map((entry) => (
                        <Cell key={entry.key} fill={entry.key === selected ? "hsl(263 70% 60%)" : "hsl(220 15% 25%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* [Mobile row 1, col 2 | Desktop col 1] Radar */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-2.5 lg:p-3 flex flex-col min-h-0 h-[130px] lg:h-auto">
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30 mb-0.5 shrink-0">Basket Strength</p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%">
                    <PolarGrid stroke="hsl(220 15% 20%)" strokeOpacity={0.5} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 7 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    {data.ranked.slice(0, 4).map((b, i) => (
                      <Radar key={b} dataKey={b} stroke={PIE_COLORS[i]} fill={PIE_COLORS[i]}
                        fillOpacity={selected === b ? 0.25 : 0.05} strokeWidth={selected === b ? 2 : 1} />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* [Mobile row 2, col 1 | Desktop col 2] Allocation Pie */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-2.5 lg:p-3 flex flex-col min-h-0 h-[130px] lg:h-auto">
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30 mb-0.5 shrink-0">Allocation</p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="30%" outerRadius="60%" paddingAngle={2} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => (
                        <Cell key={entry.basket} fill={PIE_COLORS[i % PIE_COLORS.length]}
                          opacity={selected === entry.basket ? 1 : 0.4} style={{ cursor: "pointer" }}
                          onClick={() => setSelected(entry.basket as BasketType)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-1.5 gap-y-0 shrink-0">
                {pieData.map((entry, i) => (
                  <div key={entry.basket} className="flex items-center gap-0.5">
                    <span className="h-1 w-1 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[6px] text-white/35">{entry.name} {entry.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* [Mobile row 2, col 2 | Desktop col 3] Synastry Wheel */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-2.5 lg:p-3 flex flex-col min-h-0 h-[130px] lg:h-auto lg:col-span-1">
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30 mb-0.5 shrink-0">
                Synastry: {activeBond.investment.name}
              </p>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <svg viewBox="0 0 400 400" className="w-full h-full" style={{ maxHeight: "100%" }}>
                  <circle cx="200" cy="200" r="180" fill="none" stroke="hsl(220 15% 20%)" strokeWidth="1" opacity="0.5" />
                  <circle cx="200" cy="200" r="155" fill="none" stroke="hsl(220 15% 18%)" strokeWidth="0.5" opacity="0.3" />
                  <circle cx="200" cy="200" r="120" fill="none" stroke="hsl(220 15% 16%)" strokeWidth="0.5" opacity="0.3" />
                  <circle cx="200" cy="200" r="80" fill="hsl(220 18% 8%)" fillOpacity="0.6" stroke="hsl(220 15% 15%)" strokeWidth="0.5" />
                  {zodiacSigns.map((sign, i) => {
                    const angle = (i * 30 - 90) * (Math.PI / 180);
                    const mid = ((i * 30 + 15) - 90) * (Math.PI / 180);
                    return (
                      <g key={sign}>
                        <line x1={200 + 155 * Math.cos(angle)} y1={200 + 155 * Math.sin(angle)} x2={200 + 180 * Math.cos(angle)} y2={200 + 180 * Math.sin(angle)} stroke="hsl(220 15% 25%)" strokeWidth="0.5" opacity="0.4" />
                        <text x={200 + 167 * Math.cos(mid)} y={200 + 167 * Math.sin(mid)} textAnchor="middle" dominantBaseline="central" fill="hsl(220 10% 50%)" fontSize="10">{zodiacSymbols[sign]}</text>
                      </g>
                    );
                  })}
                  {activeBond.aspects.map((aspect, i) => {
                    const a1 = ((i * 67 + 20) % 360 - 90) * (Math.PI / 180);
                    const off = aspect.type === "conjunction" ? 10 : aspect.type === "trine" ? 120 : aspect.type === "sextile" ? 60 : aspect.type === "opposition" ? 180 : 90;
                    const a2 = ((i * 67 + 20 + off) % 360 - 90) * (Math.PI / 180);
                    const r = 100;
                    const c = aspectColors[aspect.label] ?? "hsl(220 10% 50%)";
                    return (
                      <g key={i}>
                        <line x1={200 + r * Math.cos(a1)} y1={200 + r * Math.sin(a1)} x2={200 + r * Math.cos(a2)} y2={200 + r * Math.sin(a2)} stroke={c} strokeWidth={aspect.label === "Strongest" ? 2 : 1} opacity={0.6} strokeDasharray={aspect.type === "square" || aspect.type === "opposition" ? "4 3" : "none"} />
                        <circle cx={200 + r * Math.cos(a1)} cy={200 + r * Math.sin(a1)} r="4" fill={c} opacity="0.8">
                          <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={200 + r * Math.cos(a2)} cy={200 + r * Math.sin(a2)} r="3" fill={c} opacity="0.6">
                          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="4s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    );
                  })}
                  <text x="200" y="195" textAnchor="middle" dominantBaseline="central" fontSize="28" fill="hsl(43 80% 60%)">{activeBond.investment.icon}</text>
                  <text x="200" y="220" textAnchor="middle" fontSize="10" fill="hsl(220 10% 60%)" fontWeight="600">{activeBond.investment.name}</text>
                </svg>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-white/15 text-center shrink-0">{data.current_dasha} • Strict Vedic</p>
        </div>

        {/* RIGHT — Detail panel with breathing room */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-5 min-h-0 overflow-hidden lg:justify-center">

          {/* Combined hero bar: icon + name + score + alloc + type + suitability + signal */}
          <div className="hidden lg:flex items-center gap-3 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            {/* Icon */}
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.20)" }}>
              <span className="text-lg">{active.icon || BASKET_ICON_MAP[selected] || "📊"}</span>
            </div>

            {/* Name + status */}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white truncate">{active.label}</h3>
              <p className="text-[9px] text-white/30">{active.is_active ? "Active in Your Dasha" : "Not Active"}</p>
            </div>

            {/* Score */}
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-3xl font-bold text-white">{active.overall_score}</span>
              <span className="text-xs text-white/25">/ 100</span>
            </div>

            {/* Alloc */}
            {data.allocation[selected] != null && (
              <div className="shrink-0 text-center pl-3 border-l border-white/[0.08]">
                <p className="text-[8px] uppercase tracking-widest text-white/30">Alloc</p>
                <p className="text-sm font-semibold text-violet-300">{data.allocation[selected]}%</p>
              </div>
            )}

            {/* Type */}
            <div className="shrink-0 text-center pl-3 border-l border-white/[0.08]">
              <p className="text-[8px] uppercase tracking-widest text-white/30">Type</p>
              <p className="text-xs font-medium text-violet-300">{data.investor_type}</p>
            </div>

            {/* Suitability + signal */}
            <div className="shrink-0 flex flex-col items-end gap-1 pl-3 border-l border-white/[0.08]">
              <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ color: suitColor, border: `1px solid ${suitColor}40`, background: `${suitColor}10` }}>
                {SUITABILITY_LABELS[active.suitability]}
              </span>
              <div className="flex gap-1">
                <span className="text-[9px] font-bold text-white bg-white/[0.08] border border-white/10 px-1.5 py-0.5 rounded-full">
                  {active.overall_score}%
                </span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                  activeBond.signal === "buy" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                  : activeBond.signal === "sell" ? "text-red-400 border-red-400/30 bg-red-400/10"
                  : "text-amber-400 border-amber-400/30 bg-amber-400/10"
                }`}>
                  {activeBond.signal}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent shrink-0" />

          {/* Vedic Insight — 2 lines max */}
          <div className="shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25 mb-0.5">Vedic Insight</p>
            <p className="text-[11px] text-white/45 leading-relaxed line-clamp-2">{active.summary}</p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent shrink-0" />

          {/* Score Breakdown */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-violet-400/50" />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/25">Score Breakdown</span>
            </div>
            {(["natal", "dasha", "transit"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-0.5">
                <ScoreBar label={SCORE_LABELS[key]} value={active.scores[key]} color={SCORE_COLORS[key]} />
                {active.reasoning[key]?.slice(0, 1).map((r, i) => (
                  <p key={i} className="text-[9px] text-white/30 leading-snug pl-14 line-clamp-1">{r}</p>
                ))}
              </div>
            ))}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent shrink-0" />

          {/* Cosmic Bond Aspects */}
          <div className="flex flex-col gap-2.5 min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <Shield className="h-3 w-3 text-violet-400/50" />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/25">Cosmic Bond Aspects</span>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 shrink-0">{activeBond.insight}</p>
            <div className="flex flex-col gap-2 min-h-0">
              {activeBond.aspects.slice(0, 3).map((aspect, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor(aspect.label)}`} />
                  <span className="text-[10px] text-white/45 truncate flex-1">{aspect.aspect}</span>
                  <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500/50 to-violet-400" style={{ width: `${aspect.strength}%` }} />
                  </div>
                  <span className="text-[9px] text-white/30 w-6 text-right shrink-0">{aspect.strength}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InvestmentBonds;