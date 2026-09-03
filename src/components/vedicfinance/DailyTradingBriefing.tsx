/**
 * DailyTradingBriefing
 * Pre-market Vedic briefing card — refreshes daily.
 * Shows: Overall score, Tara Chakra, Vara, Market-open Hora,
 *        Moon Paksha, Gandanta warning, Rahu Kaal, Transit signals.
 */
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";
import type { DashaInfo, TransitPlanet, ChartData } from "@/lib/vedicfinance-types";
import { computeDailyBriefing, type DailyTradingBriefingData } from "@/lib/daily-trading-engine";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getNatalMoonSidLon(chart: ChartData): number {
  const moon = chart.planets.find(p => p.planet === "Moon");
  if (!moon) return 0;
  // sign_num * 30 + degree gives approximate sidereal longitude
  return moon.sign_num * 30 + moon.degree;
}

const cardStyle: React.CSSProperties = {
  background: "rgba(10, 6, 22, 0.88)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  backdropFilter: "blur(20px)",
};

const pillStyle = (color: string): React.CSSProperties => ({
  background: `${color}18`,
  border: `1px solid ${color}33`,
  color,
  borderRadius: 999,
  padding: "2px 10px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.04em",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
});

function VerdictIcon({ verdict }: { verdict: DailyTradingBriefingData["verdict"] }) {
  if (verdict === "Trade Confidently") return <TrendingUp className="w-4 h-4" />;
  if (verdict === "Trade Cautiously")  return <Minus className="w-4 h-4" />;
  return <TrendingDown className="w-4 h-4" />;
}

function ScoreArc({ score, color }: { score: number; color: string }) {
  const r = 34;
  const circ = Math.PI * r; // half-circle circumference
  const filled = (score / 100) * circ;
  return (
    <svg width="90" height="54" viewBox="0 0 90 54">
      <defs>
        <linearGradient id="dtbGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f87171" />
        </linearGradient>
      </defs>
      {/* Track */}
      <path d="M 11 46 A 34 34 0 0 1 79 46" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" strokeLinecap="round" />
      {/* Fill */}
      <path
        d="M 11 46 A 34 34 0 0 1 79 46"
        fill="none"
        stroke="url(#dtbGrad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
      />
      <text x="45" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{score}</text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  chart: ChartData;
  dasha: DashaInfo;
  transits: TransitPlanet[];
}

export default function DailyTradingBriefing({ chart, dasha, transits }: Props) {
  const data = useMemo(() => {
    const natalMoonSidLon = getNatalMoonSidLon(chart);
    const transitInput = transits.map(t => ({
      planet: t.planet,
      natal_house: t.natal_house,
      impact: t.impact,
    }));
    return computeDailyBriefing(
      natalMoonSidLon,
      dasha.mahadasha_lord,
      dasha.antardasha_lord,
      transitInput,
    );
  }, [chart, dasha, transits]);

  const today = data.date.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div style={cardStyle} className="p-4 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white">Daily Trading Muhurta</p>
          <p className="text-[9px] text-white/30 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: `${data.verdictColor}12`, border: `1px solid ${data.verdictColor}30` }}>
          <VerdictIcon verdict={data.verdict} />
          <span className="text-xs font-bold" style={{ color: data.verdictColor }}>{data.verdict}</span>
        </div>
      </div>

      {/* Score gauge + Moon nakshatras */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <ScoreArc score={data.overallScore} color={data.verdictColor} />
          <p className="text-[8px] uppercase tracking-widest text-white/25 -mt-1">Readiness Score</p>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="rounded-lg bg-white/[0.03] p-2">
            <p className="text-[8px] uppercase tracking-widest text-white/25 mb-0.5">Your Moon Nakshatra</p>
            <p className="text-xs font-semibold text-white">{data.natalMoonNakshatra}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-2">
            <p className="text-[8px] uppercase tracking-widest text-white/25 mb-0.5">Today's Moon</p>
            <p className="text-xs font-semibold text-white">{data.todayMoonNakshatra}</p>
          </div>
        </div>
      </div>

      {/* Gandanta — only show if active */}
      {data.gandanta.isGandanta && (
        <div className="flex items-start gap-2.5 py-2 rounded-lg px-2"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "#f8717115", border: "1px solid #f8717130" }}>
            <Shield className="w-3 h-3 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-white/35">Gandanta</span>
              <span style={pillStyle("#f87171")}>⚠ Active</span>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{data.gandanta.note}</p>
          </div>
        </div>
      )}

      {/* Transit signals */}
      {data.transitSignals.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Slow Planet Transits</p>
          <div className="flex flex-col gap-1.5">
            {data.transitSignals.map(ts => (
              <div key={ts.planet} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-white/60">{ts.planet}</span>
                  <span className="text-[9px] text-white/30">House {ts.transitHouse}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-white/40 text-right max-w-[140px] leading-tight">{ts.significance.split("—")[1]?.trim()}</span>
                  <span style={pillStyle(ts.verdict === "favorable" ? "#34d399" : ts.verdict === "neutral" ? "#94a3b8" : "#f87171")}>
                    {ts.verdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
