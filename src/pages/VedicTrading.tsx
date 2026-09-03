/**
 * VedicTrading — Vedic Muhurta Trading Calculator
 *
 * "Celestial Intelligence" design — dense, asymmetric, glass-layered.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Sun, Moon as MoonIcon, Shield, Zap, AlertTriangle } from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { computeDailyBriefing, type DailyTradingBriefingData } from "@/lib/daily-trading-engine";
import { generateReport } from "@/lib/vedicfinance-api";
import type { ChartData, DashaInfo, TransitPlanet, ReportRequest } from "@/lib/vedicfinance-types";

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  surface:       "#0f1419",
  surfaceLow:    "rgba(15,20,25,0.80)",
  surfaceMid:    "rgba(22,28,36,0.85)",
  surfaceHigh:   "rgba(30,38,48,0.90)",
  primary:       "#00ffcc",
  primaryDim:    "#00cc99",
  secondary:     "#fbbf24",
  secondaryDim:  "#d4a017",
  danger:        "#ff6b6b",
  neutral:       "#64748b",
  textPrimary:   "#f0f4f8",
  textSecondary: "rgba(240,244,248,0.55)",
  textMuted:     "rgba(240,244,248,0.30)",
  ghostBorder:   "rgba(255,255,255,0.06)",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function verdictColor(v: string) {
  if (v === "favorable") return T.primary;
  if (v === "neutral") return T.neutral;
  return T.danger;
}

function getMarketSession(now: Date) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  if (day === 0 || day === 6) return { label: "Market Closed", color: T.neutral, detail: "Weekend" };
  if (mins < 540)  return { label: "Pre-Market", color: T.secondary, detail: "Opens 9:15 AM" };
  if (mins < 555)  return { label: "Pre-Open", color: T.secondary, detail: "Order matching" };
  if (mins <= 930) return { label: "Market Open", color: T.primary, detail: "NSE/BSE Live" };
  return { label: "Market Closed", color: T.neutral, detail: "After hours" };
}

function fmtChange(n: number | null) {
  if (n == null) return { text: "—", color: T.neutral };
  return { text: `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`, color: n >= 0 ? T.primary : T.danger };
}

// ─── Glass Card ──────────────────────────────────────────────────────────────

function GlassCard({ children, className = "", style, glow }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; glow?: string;
}) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{
        background: T.surfaceMid,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: glow ? `0 0 32px -8px ${glow}33, inset 0 1px 0 ${T.ghostBorder}` : `inset 0 1px 0 ${T.ghostBorder}`,
        ...style,
      }}>
      {children}
    </div>
  );
}

function SignalChip({ verdict }: { verdict: string }) {
  const color = verdict === "favorable" ? T.primary : verdict === "neutral" ? T.neutral : verdict === "caution" ? T.secondary : T.danger;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
      style={{ background: `${color}18`, color }}>
      {verdict}
    </span>
  );
}

// ─── Astro-Gauge ─────────────────────────────────────────────────────────────

function AstroGauge({ score, verdict, verdictClr }: { score: number; verdict: string; verdictClr: string }) {
  const r = 70, sw = 9;
  const circ = Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="170" height="100" viewBox="0 0 170 100">
        <defs>
          <linearGradient id="gG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={T.primary} /><stop offset="60%" stopColor={T.secondary} /><stop offset="100%" stopColor={T.danger} />
          </linearGradient>
          <filter id="gGl"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={`M ${85 - r} 90 A ${r} ${r} 0 0 1 ${85 + r} 90`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} strokeLinecap="round" />
        <path d={`M ${85 - r} 90 A ${r} ${r} 0 0 1 ${85 + r} 90`} fill="none" stroke="url(#gG)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`} filter="url(#gGl)" />
        <text x="85" y="72" textAnchor="middle" fill={T.textPrimary}
          style={{ fontSize: 32, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>{score}</text>
        <text x="85" y="90" textAnchor="middle" fill={T.textMuted}
          style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>muhurta score</text>
      </svg>
      <span className="text-xs font-bold mt-1" style={{ color: verdictClr }}>{verdict}</span>
    </div>
  );
}

// ─── Market Indices — vertical list for right column ─────────────────────────

function MarketIndicesVertical({ marketData, marketLoading }: { marketData: any; marketLoading: boolean }) {
  const quotes = marketData?.quotes ?? [];
  const indices = [
    quotes.find((q: any) => q.symbol === "^NSEI"),
    quotes.find((q: any) => q.symbol === "^BSESN"),
    quotes.find((q: any) => q.symbol === "USDINR=X"),
    quotes.find((q: any) => q.symbol === "GC=F"),
    quotes.find((q: any) => q.symbol === "CL=F"),
  ].filter(Boolean);

  const fetchedAt = marketData?.fetchedAt
    ? new Date(marketData.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : null;

  return (
    <GlassCard className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: T.textMuted }}>Markets</p>
        {(fetchedAt || marketLoading) && (
          <p className="text-[9px]" style={{ color: T.textMuted }}>{marketLoading ? "…" : fetchedAt}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {marketLoading && indices.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg h-12 animate-pulse" style={{ background: T.surfaceHigh }} />
          ))
        ) : (
          indices.map((q: any) => {
            const chg = fmtChange(q.changePct);
            const isUp = (q.changePct ?? 0) >= 0;
            return (
              <div key={q.symbol} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors"
                style={{ background: T.surfaceHigh }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {isUp
                    ? <TrendingUp className="h-3.5 w-3.5 shrink-0" style={{ color: T.primary }} />
                    : <TrendingDown className="h-3.5 w-3.5 shrink-0" style={{ color: T.danger }} />}
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium truncate" style={{ color: T.textMuted }}>{q.label}</p>
                    <p className="text-sm font-bold leading-tight" style={{ color: T.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {q.price != null ? q.price.toLocaleString("en-IN", { maximumFractionDigits: q.symbol.includes("=") ? 2 : 0 }) : "—"}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: chg.color }}>{chg.text}</span>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}

// ─── Vedic Signals Grid ─────────────────────────────────────────────────────

const SIGNAL_META = [
  { key: "tara",  icon: Sun,           label: "Tara Chakra" },
  { key: "moon",  icon: MoonIcon,      label: "Moon Phase" },
  { key: "hora",  icon: Zap,           label: "Market Hora" },
  { key: "vara",  icon: Clock,         label: "Vara" },
  { key: "rahu",  icon: AlertTriangle, label: "Rahu Kaal" },
] as const;

function VedicSignalsGrid({ data }: { data: DailyTradingBriefingData }) {
  const signals = [
    { value: data.tara.name,       sub: data.tara.meaning,                                       color: verdictColor(data.tara.verdict),          verdict: data.tara.verdict },
    { value: data.paksha.paksha === "Shukla" ? "Waxing ↑" : "Waning ↓", sub: data.paksha.note,  color: verdictColor(data.paksha.verdict),         verdict: data.paksha.verdict },
    { value: data.marketOpenHora.label, sub: data.marketOpenHora.currentHora,                    color: verdictColor(data.marketOpenHora.verdict), verdict: data.marketOpenHora.verdict },
    { value: `${data.vara.lord}${data.vara.isAligned ? " ✓" : ""}`, sub: data.vara.note,         color: data.vara.isAligned ? T.primary : T.neutral, verdict: data.vara.isAligned ? "favorable" : "neutral" },
    { value: data.rahuKaal.isActive ? "Active" : data.rahuKaal.label, sub: data.rahuKaal.note,  color: data.rahuKaal.isActive ? T.danger : T.neutral, verdict: data.rahuKaal.isActive ? "avoid" : "neutral" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {SIGNAL_META.map((meta, i) => {
        const sig = signals[i];
        const Icon = meta.icon;
        return (
          <GlassCard key={meta.key} className="p-4 flex flex-col gap-2" glow={sig.color}>
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${sig.color}12` }}>
                <Icon className="h-4 w-4" style={{ color: sig.color }} />
              </div>
              <SignalChip verdict={sig.verdict} />
            </div>
            <p className="text-[10px] font-medium" style={{ color: T.textMuted }}>{meta.label}</p>
            <p className="text-sm font-bold" style={{ color: T.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>{sig.value}</p>
            {sig.sub && <p className="text-[10px] leading-snug" style={{ color: T.textSecondary }}>{sig.sub}</p>}
          </GlassCard>
        );
      })}
    </div>
  );
}

// ─── Transit Signals ─────────────────────────────────────────────────────────

function TransitSignalsCard({ data }: { data: DailyTradingBriefingData }) {
  if (data.transitSignals.length === 0 && !data.gandanta.isGandanta) return null;
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: T.textMuted }}>Slow Planet Transits</p>
      <div className="flex flex-col gap-1">
        {data.transitSignals.map(ts => {
          const c = verdictColor(ts.verdict);
          return (
            <div key={ts.planet} className="flex items-center justify-between gap-2 py-2 rounded-lg px-2.5 transition-colors hover:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${c}10` }}>
                  <Shield className="h-3 w-3" style={{ color: c }} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: T.textPrimary }}>{ts.planet}</span>
                <span className="text-[10px]" style={{ color: T.textMuted }}>H{ts.transitHouse}</span>
                <span className="text-[10px] hidden sm:block truncate max-w-[180px]" style={{ color: T.textSecondary }}>
                  {ts.significance.split("—")[1]?.trim()}
                </span>
              </div>
              <SignalChip verdict={ts.verdict} />
            </div>
          );
        })}
        {data.gandanta.isGandanta && (
          <div className="flex items-center gap-2.5 mt-1 rounded-lg px-3 py-2" style={{ background: `${T.danger}08` }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: T.danger }} />
            <p className="text-[11px]" style={{ color: T.danger }}>Gandanta Active: {data.gandanta.note}</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}


// ─── Combined Conclusion + Vedic Now ─────────────────────────────────────────

function ConclusionVedicPanel({ data, now }: { data: DailyTradingBriefingData; now: Date }) {
  const score = data.overallScore;
  const color = data.verdictColor;
  const session = getMarketSession(now);
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  // Vedic Now rows
  const hora = data.hora;
  const rahuKaal = data.rahuKaal;
  const paksha = data.paksha;
  let rahuSub = "";
  if (rahuKaal.isActive) { const r = Math.ceil((rahuKaal.end.getTime() - now.getTime()) / 60000); rahuSub = r > 0 ? `Ends in ${r}m` : "Ending soon"; }
  else if (now < rahuKaal.start) { const m = Math.ceil((rahuKaal.start.getTime() - now.getTime()) / 60000); rahuSub = m < 60 ? `In ${m}m` : ""; }
  else { rahuSub = "Passed"; }

  const vedicRows = [
    { label: "Hora",      value: hora.label,                                                color: verdictColor(hora.verdict) },
    { label: "Rahu Kaal", value: rahuKaal.isActive ? "⚠ Active" : rahuKaal.label,          color: rahuKaal.isActive ? T.danger : T.neutral, sub: rahuSub },
    { label: "Nakshatra", value: data.todayMoonNakshatra,                                   color: T.textSecondary },
    { label: "Tithi",     value: paksha.label.split("·")[1]?.trim() ?? "—",                 color: verdictColor(paksha.verdict), sub: `${paksha.paksha} Paksha` },
  ];

  // Conclusion bullets — concise, max ~5
  const bullets: { icon: string; text: string; type: "good" | "warn" | "bad" }[] = [];
  const tv = data.tara.verdict;
  bullets.push({ icon: "⭐", text: `Tara ${data.tara.name}: ${data.tara.meaning}`, type: tv === "favorable" ? "good" : tv === "avoid" ? "bad" : "warn" });
  bullets.push({ icon: "🌙", text: data.paksha.note, type: data.paksha.verdict === "favorable" ? "good" : "warn" });
  if (data.marketOpenHora.verdict === "favorable") bullets.push({ icon: "⚡", text: `${data.marketOpenHora.label} at open, strong hour`, type: "good" });
  else if (data.marketOpenHora.verdict === "caution") bullets.push({ icon: "⚡", text: `${data.marketOpenHora.label} at open, trade smaller`, type: "warn" });
  if (data.rahuKaal.isActive) bullets.push({ icon: "🚫", text: "Rahu Kaal active: no new trades", type: "bad" });
  else bullets.push({ icon: "✅", text: `Rahu Kaal: ${data.rahuKaal.label}. Avoid entries then`, type: "warn" });
  const badT = data.transitSignals.filter(t => t.verdict === "caution");
  const goodT = data.transitSignals.filter(t => t.verdict === "favorable");
  if (goodT.length) bullets.push({ icon: "🪐", text: `${goodT.map(t => t.planet).join(", ")} transit supports gains`, type: "good" });
  if (badT.length) bullets.push({ icon: "⚠️", text: `${badT.map(t => t.planet).join(", ")} transit, reduce exposure`, type: "warn" });
  if (data.gandanta.isGandanta) bullets.push({ icon: "⚠️", text: "Gandanta active, sit out", type: "bad" });

  // Keep max 5 bullets
  const shown = bullets.slice(0, 5);

  const action =
    score >= 70 ? "Conditions aligned: trade with confidence, size up on high-conviction setups." :
    score >= 55 ? "Moderate alignment: stick to A-grade setups, normal position sizes." :
    score >= 40 ? "Mixed signals: trade defensively, reduce size, protect open profits." :
    "Weak alignment: consider sitting out or managing existing positions only.";

  const bc = (t: "good" | "warn" | "bad") => t === "good" ? T.primary : t === "warn" ? T.secondary : T.danger;

  return (
    <GlassCard className="p-5" glow={color} style={{ background: `${color}06` }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: T.textMuted }}>Today's Conclusion</p>
          <span className="text-[9px]" style={{ color: T.textMuted }}>·</span>
          <span className="text-[9px]" style={{ color: T.textMuted }}>Markets {timeStr}</span>
          <div className="flex items-center gap-1 ml-1">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: session.color, boxShadow: `0 0 5px ${session.color}` }} />
            <span className="text-[9px] font-semibold" style={{ color: session.color }}>{session.label}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md" style={{ background: `${color}18`, color }}>
          {score}/100 · {data.verdict}
        </span>
      </div>

      {/* Action line */}
      <p className="text-xs font-semibold leading-relaxed mb-3" style={{ color: T.textPrimary }}>{action}</p>

      {/* Two-column: bullets left, vedic now right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
        {/* Left: concise bullet list */}
        <div className="flex flex-col gap-1.5">
          {shown.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] shrink-0 mt-px">{b.icon}</span>
              <p className="text-[11px] leading-snug" style={{ color: bc(b.type) }}>{b.text}</p>
            </div>
          ))}
        </div>

        {/* Right: Vedic Now compact */}
        <div className="flex flex-col gap-2 lg:border-l lg:pl-4" style={{ borderColor: T.ghostBorder }}>
          <p className="text-[9px] font-medium uppercase tracking-widest mb-0.5" style={{ color: T.textMuted }}>Vedic Now</p>
          {vedicRows.map(item => (
            <div key={item.label} className="flex items-start justify-between gap-2">
              <span className="text-[10px]" style={{ color: T.textMuted }}>{item.label}</span>
              <div className="text-right">
                <p className="text-[10px] font-semibold" style={{ color: item.color }}>{item.value}</p>
                {"sub" in item && item.sub && <p className="text-[8px]" style={{ color: T.textMuted }}>{item.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const VedicTrading = () => {
  const navigate = useNavigate();
  const [chart, setChart] = useState<ChartData | null>(null);
  const [dasha, setDasha] = useState<DashaInfo | null>(null);
  const [transits, setTransits] = useState<TransitPlanet[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [marketData, setMarketData] = useState<any>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  useEffect(() => {
    import("@/lib/market-data").then(({ fetchMarketData }) => {
      fetchMarketData().then(d => setMarketData(d)).catch(() => {}).finally(() => setMarketLoading(false));
    });
  }, []);

  const briefingData = useMemo(() => {
    if (!chart || !dasha || !transits) return null;
    const moon = chart.planets.find(p => p.planet === "Moon");
    const natalMoonSidLon = moon ? moon.sign_num * 30 + moon.degree : 0;
    return computeDailyBriefing(natalMoonSidLon, dasha.mahadasha_lord, dasha.antardasha_lord,
      transits.map(t => ({ planet: t.planet, natal_house: t.natal_house, impact: t.impact })));
  }, [chart, dasha, transits]);

  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;
    let req: ReportRequest;
    try { req = JSON.parse(raw); } catch { return; }
    const reqKey = `${req.birth_date}|${req.birth_time}|${req.latitude}|${req.longitude}`;
    const cachedRaw = sessionStorage.getItem("kundliReport");
    const cachedKey = sessionStorage.getItem("kundliReportKey");
    if (cachedRaw && cachedKey === reqKey) {
      try { const c = JSON.parse(cachedRaw); if (c.d1_chart?.planets?.length) { applyReport(c); return; } } catch { /* */ }
    }
    generateReport(req).then(report => {
      sessionStorage.setItem("kundliReport", JSON.stringify(report));
      sessionStorage.setItem("kundliReportKey", reqKey);
      window.dispatchEvent(new Event("kundliReportReady"));
      applyReport(report);
    }).catch(() => {});
  }, []);

  function applyReport(report: any) {
    setChart(report.d1_chart);
    if (report.dasha) setDasha(report.dasha);
    if (report.transits) setTransits(report.transits);
  }

  const session = getMarketSession(now);
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const hasData = !!(chart && dasha && transits);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: T.surface }}>
      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Particles className="absolute inset-0 h-full w-full" quantity={60} color={T.primary} size={0.4} staticity={70} ease={90} />
        <div style={{ position: "absolute", width: "55vw", height: "55vw", top: "-18%", left: "-12%",
          background: `radial-gradient(circle, ${T.primary}08 0%, ${T.primaryDim}03 40%, transparent 70%)`, filter: "blur(80px)" }} />
        <div style={{ position: "absolute", width: "45vw", height: "45vw", bottom: "-12%", right: "-8%",
          background: `radial-gradient(circle, ${T.secondary}05 0%, ${T.secondaryDim}02 40%, transparent 70%)`, filter: "blur(90px)" }} />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 lg:px-14 py-5 md:py-6">

        {/* Header */}
        <header className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/home")}
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer hover:scale-105"
              style={{ background: T.surfaceHigh, boxShadow: `inset 0 1px 0 ${T.ghostBorder}` }}
              aria-label="Back to Home">
              <ArrowLeft className="h-4 w-4" style={{ color: T.textSecondary }} />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight" style={{ color: T.textPrimary }}>
                Vedic Trading <span style={{ color: T.primary }}>Calculator</span>
              </h1>
              <p className="text-[10px] font-medium" style={{ color: T.textMuted }}>Pre-Market Vedic Analysis · Refreshes Daily</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-base font-bold" style={{ color: T.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>{timeStr}</p>
              <p className="text-[9px]" style={{ color: T.textMuted }}>{dayNames[now.getDay()]}, {dateStr}</p>
            </div>
            <div className="h-7 px-2.5 rounded-md flex items-center gap-1.5" style={{ background: `${session.color}12` }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: session.color, boxShadow: `0 0 5px ${session.color}` }} />
              <span className="text-[10px] font-semibold" style={{ color: session.color }}>{session.label}</span>
            </div>
          </div>
        </header>

        {hasData && briefingData ? (
          <div className="flex flex-col gap-6 md:gap-8">

            {/* ── Row 1: 3-col — Gauge | Session+Vedic | Markets ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_1fr_260px] gap-4 lg:gap-5">
              {/* Left: Gauge + Moon */}
              <GlassCard className="p-5 flex flex-col items-center justify-center" glow={briefingData.verdictColor}>
                <AstroGauge score={briefingData.overallScore} verdict={briefingData.verdict} verdictClr={briefingData.verdictColor} />
                <div className="mt-4 flex items-center gap-3 text-center">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: T.textMuted }}>Your Moon</p>
                    <p className="text-xs font-semibold" style={{ color: T.textPrimary }}>{briefingData.natalMoonNakshatra}</p>
                  </div>
                  <div className="h-5 w-px" style={{ background: T.ghostBorder }} />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: T.textMuted }}>Today</p>
                    <p className="text-xs font-semibold" style={{ color: T.textPrimary }}>{briefingData.todayMoonNakshatra}</p>
                  </div>
                </div>
              </GlassCard>

              {/* Center: Conclusion + Vedic Now merged */}
              <ConclusionVedicPanel data={briefingData} now={now} />

              {/* Right: Market indices vertical */}
              <MarketIndicesVertical marketData={marketData} marketLoading={marketLoading} />
            </div>

            {/* ── Row 2: 5 Vedic Signal cards ── */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: T.textMuted }}>Vedic Signals</p>
              <VedicSignalsGrid data={briefingData} />
            </div>

            {/* ── Row 3: Transits full width ── */}
            <TransitSignalsCard data={briefingData} />
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <GlassCard className="p-10 md:p-12 text-center max-w-md">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: `${T.primary}10` }}>
                <MoonIcon className="h-7 w-7" style={{ color: T.primary }} />
              </div>
              <h2 className="text-base font-bold mb-2" style={{ color: T.textPrimary }}>No Birth Data Found</h2>
              <p className="text-sm leading-relaxed mb-5" style={{ color: T.textSecondary }}>
                Generate your Kundali report first to unlock your personalized daily trading briefing.
              </p>
              <button onClick={() => navigate("/home")}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${T.primaryDim}, ${T.primary})`, color: T.surface }}>
                Go to Home
              </button>
            </GlassCard>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
};

export default VedicTrading;