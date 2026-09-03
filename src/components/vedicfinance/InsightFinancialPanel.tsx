import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, Clock, Home, Gem, Car, Info, X, Calendar } from "lucide-react";
import type { ReportScores, DashaInfo, ReportTimeline, TransitPlanet, LuxuryAnalysisResponse, AssetType } from "@/lib/vedicfinance-types";

interface Props {
  scores?: ReportScores;
  dasha?: DashaInfo;
  timeline?: ReportTimeline;
  transits?: TransitPlanet[];
}

const cardStyle: React.CSSProperties = {
  background: "rgba(10,18,14,0.75)",
  border: "1px solid rgba(255,255,255,0.07)",
  backdropFilter: "blur(16px)",
  borderRadius: 16,
};

function buildEarningData(scores: ReportScores) {
  const base = scores.income_score;
  const timing = scores.timing_score;
  const wealth = scores.natal_wealth_score;
  const now = new Date();
  const months: { month: string; score: number }[] = [];
  for (let i = -2; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const dist = Math.abs(i - 1);
    const variation = Math.max(-20, 15 - dist * 6);
    const score = Math.max(5, Math.min(100, Math.round(base * 0.5 + timing * 0.3 + wealth * 0.2 + variation)));
    months.push({ month: label, score });
  }
  return months;
}

function derivePhase(scores: ReportScores): { label: string; color: string; avg: number; description: string } {
  const avg = Math.floor((scores.natal_wealth_score + scores.income_score + scores.timing_score) / 3);
  if (avg >= 65) return { label: "Growth Phase",       color: "#34d399", avg, description: "Strong alignment across wealth, income, and timing. A window to act and expand." };
  if (avg >= 45) return { label: "Consolidation Phase", color: "#d4a017", avg, description: "Moderate signals: hold steady, avoid big moves, and build reserves." };
  return             { label: "Caution Phase",          color: "#f87171", avg, description: "Weak signals across key areas. Protect capital and wait for a better window." };
}

function deriveRiskScore(scores: ReportScores): number {
  return Math.round(scores.risk_score * 0.5 + scores.expense_score * 0.3 + (100 - scores.savings_score) * 0.2);
}

function deriveDashaStatus(dasha?: DashaInfo): string {
  if (!dasha) return "Unknown";
  const favorable = ["Jupiter", "Venus", "Mercury", "Moon"];
  return favorable.includes(dasha.mahadasha_lord) ? "Favorable" : "Challenging";
}

function deriveRetroStatus(transits?: TransitPlanet[]): string {
  if (!transits) return "None";
  return transits.some(t => t.retrograde) ? "Active" : "None";
}

function deriveAssets(scores: ReportScores, transits?: TransitPlanet[]) {
  const jupT = transits?.find(t => t.planet === "Jupiter");
  const propertyScore = scores.savings_score * 0.4 + scores.natal_wealth_score * 0.3 + (jupT?.natal_house === 4 ? 20 : 0);
  const goldScore     = scores.natal_wealth_score * 0.4 + scores.savings_score * 0.3 + (jupT?.natal_house === 2 ? 20 : 0);
  const vehicleScore  = scores.investment_score * 0.3 + scores.timing_score * 0.3 + scores.income_score * 0.2;
  const verdict = (s: number) => s >= 55 ? "Auspicious" : s >= 40 ? "Neutral" : "Avoid";
  const color   = (s: number) => s >= 55 ? "#34d399"    : s >= 40 ? "#d4a017" : "#f87171";
  return [
    { icon: Home, label: "Property", status: verdict(propertyScore), color: color(propertyScore) },
    { icon: Gem,  label: "Gold",     status: verdict(goldScore),     color: color(goldScore) },
    { icon: Car,  label: "Vehicle",  status: verdict(vehicleScore),  color: color(vehicleScore) },
  ];
}

// ── sub-components ──────────────────────────────────────────────────────────

function PhaseCard({ scores, dasha }: { scores: ReportScores; dasha?: DashaInfo }) {
  const [showDetail, setShowDetail] = useState(false);
  const phase = derivePhase(scores);
  const timeWindow = dasha ? `${dasha.antardasha_start} to ${dasha.antardasha_end}` : "";

  const contributors = [
    { label: "Wealth Strength", value: scores.natal_wealth_score },
    { label: "Income Support",  value: scores.income_score },
    { label: "Timing Support",  value: scores.timing_score },
  ];

  const scoreColor = (v: number) => v >= 65 ? "#34d399" : v >= 45 ? "#d4a017" : "#f87171";

  return (
    <div className="flex flex-col gap-2">
      {/* ── Phase summary card ── */}
      <div style={cardStyle} className="px-3 py-2.5 flex items-center gap-3">
        <span
          className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0"
          style={{ background: `${phase.color}18`, color: phase.color, border: `1px solid ${phase.color}33` }}
        >
          <TrendingUp className="w-3 h-3" /> {phase.label}
        </span>
        {timeWindow && (
          <span className="flex items-center gap-1.5 text-[10px] text-white/40 min-w-0">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">{timeWindow}</span>
          </span>
        )}
        <button
          className="ml-auto flex items-center justify-center w-5 h-5 rounded-full transition-colors duration-150 shrink-0"
          style={{ background: showDetail ? `${phase.color}22` : "transparent" }}
          onClick={() => setShowDetail(v => !v)}
          aria-label="How is this phase calculated?"
        >
          {showDetail
            ? <X className="w-3 h-3" style={{ color: phase.color }} />
            : <Info className="w-3 h-3 text-white/25 hover:text-white/60" />}
        </button>
      </div>

      {/* Detail overlay */}
      {showDetail && (
        <div
          className="rounded-xl p-2.5 flex flex-col gap-2"
          style={{ ...cardStyle, background: "rgba(255,255,255,0.03)", border: `1px solid ${phase.color}22` }}
        >
          <p className="text-[9px] text-white/40 leading-relaxed">{phase.description}</p>
          <div className="flex flex-col gap-1.5">
            {contributors.map(({ label, value }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-white/40">{label}</span>
                  <span className="text-[9px] font-semibold" style={{ color: scoreColor(value) }}>{value}</span>
                </div>
                <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${value}%`,
                      background: scoreColor(value),
                      boxShadow: `0 0 5px ${scoreColor(value)}55`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-white/[0.05]">
            <span className="text-[8px] text-white/25">avg of 3 scores → phase</span>
            <span className="text-[9px] font-bold" style={{ color: phase.color }}>{phase.avg} / 100</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EarningPhasesCard({ scores, dasha, timeline: _timeline }: { scores: ReportScores; dasha?: DashaInfo; timeline?: ReportTimeline }) {
  const earningData = buildEarningData(scores);

  return (
    <div style={{ ...cardStyle, position: "relative" }} className="p-3">
      <p className="text-xs font-semibold text-white mb-1.5">Your Upcoming Earnings Chart</p>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={earningData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
          <defs>
            <linearGradient id="epGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(43,72%,52%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(220,20%,4%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fontSize: 8, fill: "hsl(220,10%,45%)" }} axisLine={false} tickLine={false} interval={1} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "hsl(220,10%,45%)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 11 }}
            labelStyle={{ color: "hsl(220,10%,90%)" }}
            formatter={(value: number) => [
              <span style={{ color: value < 50 ? "hsl(0,72%,60%)" : value < 65 ? "hsl(43,72%,52%)" : "hsl(170,75%,45%)" }}>
                {value}
              </span>,
              "Score",
            ]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="hsl(43,72%,52%)"
            strokeWidth={2}
            fill="url(#epGrad)"
            style={{ filter: "drop-shadow(0 0 6px hsl(43 72% 52% / 0.4))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DashaRiskCard({ scores, dasha, transits }: { scores: ReportScores; dasha?: DashaInfo; transits?: TransitPlanet[] }) {
  const riskScore   = deriveRiskScore(scores);
  const riskAngle   = (riskScore / 100) * 180;
  const needleX     = 44 + 32 * Math.cos(Math.PI - (riskAngle * Math.PI) / 180);
  const needleY     = 44 - 32 * Math.sin(Math.PI - (riskAngle * Math.PI) / 180);
  const dashaStatus = deriveDashaStatus(dasha);
  const retroStatus = deriveRetroStatus(transits);
  const dashaColor  = dashaStatus === "Favorable" ? "#34d399" : "#f87171";
  const retroColor  = retroStatus === "Active"    ? "#fbbf24" : "#34d399";
  const riskLabel   = riskScore >= 65 ? "High Risk" : riskScore >= 45 ? "Careful about Finance" : "Low Risk";

  return (
    <div style={cardStyle} className="p-3">
      {/* <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Vedic Risk Cockpit</p> */}
      <p className="text-xs font-semibold text-white mb-2">Dasha Risk Meter: {riskLabel}</p>
      <div className="flex items-center gap-4">
        <svg width="88" height="52" viewBox="0 0 88 52">
          <defs>
            <linearGradient id="gaugeG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="hsl(170,75%,45%)" />
              <stop offset="50%"  stopColor="hsl(43,72%,52%)" />
              <stop offset="100%" stopColor="hsl(0,72%,51%)" />
            </linearGradient>
          </defs>
          <path d="M 8 44 A 36 36 0 0 1 80 44" fill="none" stroke="hsl(220,15%,14%)" strokeWidth="7" strokeLinecap="round" />
          <path
            d="M 8 44 A 36 36 0 0 1 80 44"
            fill="none" stroke="url(#gaugeG)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${(riskAngle / 180) * 113} 113`}
            style={{ filter: "drop-shadow(0 0 8px hsl(43 72% 52% / 0.4))" }}
          />
          <line x1="44" y1="44" x2={needleX} y2={needleY} stroke="hsl(220,10%,90%)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="44" cy="44" r="3" fill="hsl(220,10%,90%)" />
          <text x="44" y="38" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{riskScore}</text>
        </svg>
        <div className="flex gap-2 flex-1">
          <div className="flex-1 rounded-lg bg-white/[0.03] p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Dasha</p>
            <p className="text-xs font-semibold" style={{ color: dashaColor }}>{dashaStatus}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.03] p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Retrograde</p>
            <p className="text-xs font-semibold" style={{ color: retroColor }}>{retroStatus}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const LUXURY_VERDICT_LABELS: Record<string, string> = {
  yes: "Auspicious",
  delay: "Delay",
  avoid: "Avoid",
};

const LUXURY_VERDICT_COLORS: Record<string, string> = {
  yes: "#34d399",
  delay: "#d4a017",
  avoid: "#f87171",
};

const LUXURY_ASSET_ICONS: Record<string, typeof Home> = {
  property: Home,
  gold: Gem,
  vehicle: Car,
};

function useLuxuryData(): LuxuryAnalysisResponse | null {
  const [data, setData] = useState<LuxuryAnalysisResponse | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem("luxuryAnalysis");
    if (cached) {
      try { setData(JSON.parse(cached)); } catch { /* ignore */ }
    }

    // Listen for storage changes in case luxury data arrives after mount
    const onStorage = () => {
      const updated = sessionStorage.getItem("luxuryAnalysis");
      if (updated) {
        try { setData(JSON.parse(updated)); } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);
    // Also poll briefly since sessionStorage events don't fire in the same tab
    const interval = setInterval(() => {
      const updated = sessionStorage.getItem("luxuryAnalysis");
      if (updated && !data) {
        try { setData(JSON.parse(updated)); } catch { /* ignore */ }
      }
    }, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [data]);

  return data;
}

function AuspiciousTimingCard({ scores, transits }: { scores: ReportScores; transits?: TransitPlanet[] }) {
  const luxuryData = useLuxuryData();

  // Build asset cards from luxury analysis data if available, otherwise fall back to derived scores
  const assets = luxuryData
    ? (["property", "gold", "vehicle"] as AssetType[]).map((key) => {
        const analysis = luxuryData.assets[key];
        const fmt = (d: string) => {
          const date = new Date(d);
          return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        };
        return {
          icon: LUXURY_ASSET_ICONS[key],
          label: key.charAt(0).toUpperCase() + key.slice(1),
          status: LUXURY_VERDICT_LABELS[analysis.verdict] ?? "—",
          color: LUXURY_VERDICT_COLORS[analysis.verdict] ?? "#d4a017",
          score: analysis.overall_score,
          window: `${fmt(analysis.time_window.start)} → ${fmt(analysis.time_window.end)}`,
        };
      })
    : deriveAssets(scores, transits).map((a) => ({ ...a, score: undefined as number | undefined, window: undefined as string | undefined }));

  return (
    <div style={cardStyle} className="p-3">
      <p className="text-xs font-semibold text-white mb-2">Auspicious Timing to buy</p>
      <div className="grid grid-cols-3 gap-2">
        {assets.map(({ icon: Icon, label, status, color, score, window }) => (
          <div
            key={label}
            className="rounded-xl p-2 flex flex-col items-center gap-1 hover:bg-white/[0.05] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <p className="text-[9px] font-medium text-white/70">{label}</p>
            {score !== undefined && (
              <p className="text-sm font-bold text-white leading-none">{score}</p>
            )}
            <p className="text-[8px] font-semibold" style={{ color }}>{status}</p>
            {window && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Calendar className="w-2.5 h-2.5 text-white/25" />
                <p className="text-[7px] text-white/35 leading-tight">{window}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── named exports ───────────────────────────────────────────────────────────
export { PhaseCard, EarningPhasesCard, DashaRiskCard, AuspiciousTimingCard };

// ── main export ─────────────────────────────────────────────────────────────
export default function InsightFinancialPanel({ scores, dasha, timeline: _timeline, transits }: Props) {
  if (!scores) {
    return (
      <div className="flex flex-col gap-3 h-full items-center justify-center text-white/30 text-sm">
        Complete onboarding to see your financial insights
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 lg:gap-3 h-full">
      <EarningPhasesCard scores={scores} dasha={dasha} />
      <DashaRiskCard scores={scores} dasha={dasha} transits={transits} />
      <AuspiciousTimingCard scores={scores} transits={transits} />
    </div>
  );
}
