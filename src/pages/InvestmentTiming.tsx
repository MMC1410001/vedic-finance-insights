import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck, Shield, ShieldAlert, Clock, Target, AlertTriangle,
  Lightbulb, ChevronRight, Activity, BarChart3, Gauge, Calendar,
  Ban, CheckCircle2, Info,
} from "lucide-react";
import type { BirthDetails } from "@/lib/astro-engine";
import {
  generateCurrentPhase, generateTimeline, generateStrategyGuidance,
  generateBehavioralAlerts, type InvestmentSignal, type TimelineDay,
} from "@/lib/investment-engine";

const signalConfig: Record<InvestmentSignal, { label: string; bgClass: string; borderClass: string; textClass: string; dotClass: string }> = {
  favorable: { label: "Favorable", bgClass: "bg-favorable/10", borderClass: "border-favorable/20", textClass: "text-favorable", dotClass: "bg-favorable" },
  neutral: { label: "Neutral", bgClass: "bg-warning/10", borderClass: "border-warning/20", textClass: "text-warning", dotClass: "bg-warning" },
  risky: { label: "Risky", bgClass: "bg-destructive/10", borderClass: "border-destructive/20", textClass: "text-destructive", dotClass: "bg-destructive" },
};

const riskIcons = { low: ShieldCheck, medium: Shield, high: ShieldAlert };

const defaultDetails: BirthDetails = {
  name: "Cosmic Explorer",
  dateOfBirth: "1995-03-15",
  timeOfBirth: "06:30",
  placeOfBirth: "Mumbai",
};

const InvestmentTiming = () => {
  const [details, setDetails] = useState<BirthDetails>(defaultDetails);
  const [selectedDay, setSelectedDay] = useState<TimelineDay | null>(null);
  const [timelineDays, setTimelineDays] = useState(60);

  useEffect(() => {
    const stored = sessionStorage.getItem("birthDetails");
    if (stored) setDetails(JSON.parse(stored));
  }, []);

  const phase = useMemo(() => generateCurrentPhase(details), [details]);
  const timeline = useMemo(() => generateTimeline(details, timelineDays), [details, timelineDays]);
  const guidance = useMemo(() => generateStrategyGuidance(details), [details]);
  const alerts = useMemo(() => generateBehavioralAlerts(details), [details]);

  const RiskIcon = riskIcons[phase.riskLevel];
  const signalCfg = signalConfig[phase.signal];

  const weeks = [];
  for (let i = 0; i < timeline.length; i += 7) weeks.push(timeline.slice(i, i + 7));

  return (
    <div className="px-5 py-5 space-y-5 max-w-6xl mx-auto">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden h-28">
        <img
          src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80&fm=webp"
          alt="Stock market finance chart"
          className="absolute inset-0 w-full h-full object-cover object-center"
        loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/65 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between h-full px-5">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Investment Timing Assistant</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Personalized signals for calm, informed decisions</p>
          </div>
          <div className="flex gap-1.5">
            {[30, 60, 90].map((d) => (
              <button key={d} onClick={() => setTimelineDays(d)}
                className={`px-2.5 py-1 text-[10px] rounded-lg font-medium transition-all ${timelineDays === d ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground bg-white/[0.03]"}`}>
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary card */}
      <div className={`glass-card-glow p-5 border ${signalCfg.borderClass}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl ${signalCfg.bgClass} flex items-center justify-center`}>
              <Activity className={`h-4 w-4 ${signalCfg.textClass}`} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Current Phase</p>
              <p className={`text-sm font-semibold ${signalCfg.textClass}`}>
                {phase.signal === "favorable" ? "Moderate Opportunity" : phase.signal === "neutral" ? "Consolidation Period" : "Caution Phase"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <BarChart3 className="h-3 w-3" /> Signal
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${signalCfg.bgClass} ${signalCfg.textClass} border ${signalCfg.borderClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${signalCfg.dotClass}`} />
                {signalCfg.label}
              </span>
            </div>
            <div className="glass-card p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <RiskIcon className="h-3 w-3" /> Risk Level
              </div>
              <p className="text-xs font-semibold capitalize">{phase.riskLevel}</p>
            </div>
            <div className="glass-card p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Gauge className="h-3 w-3" /> Confidence
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${phase.confidenceScore * 10}%`, background: "linear-gradient(90deg, hsl(43,72%,52%), hsl(170,75%,45%))" }} />
                </div>
                <span className="text-xs font-bold">{phase.confidenceScore}/10</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="glass-card px-3.5 py-2.5 flex items-start gap-2.5 flex-1">
              <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Action</p>
                <p className="text-xs">{phase.suggestedAction}</p>
              </div>
            </div>
            <div className="glass-card px-3.5 py-2.5 flex items-start gap-2.5">
              <Clock className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Window</p>
                <p className="text-xs font-medium">{phase.timeWindow}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Timeline</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-favorable" /> Favorable</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Neutral</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Risky</span>
          </div>
        </div>
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex gap-1">
              <span className="text-[9px] text-muted-foreground w-14 shrink-0 pt-1">{week[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <div className="flex gap-1 flex-1">
                {week.map((day, di) => {
                  const sel = selectedDay?.date.getTime() === day.date.getTime();
                  return (
                    <button key={di} onClick={() => setSelectedDay(sel ? null : day)}
                      className={`flex-1 h-7 rounded-lg transition-all duration-200 border ${day.signal === "favorable" ? "bg-favorable/15 border-favorable/15 hover:bg-favorable/25" : day.signal === "risky" ? "bg-destructive/15 border-destructive/15 hover:bg-destructive/25" : "bg-warning/10 border-warning/10 hover:bg-warning/20"} ${sel ? "ring-1 ring-primary scale-105" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {selectedDay && (
          <div className={`glass-card p-3.5 border ${signalConfig[selectedDay.signal].borderClass} animate-fade-in`}>
            <p className="text-xs font-semibold mb-1">{selectedDay.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-[10px] text-muted-foreground block">Risk</span><span className="capitalize font-medium">{selectedDay.riskLevel}</span></div>
              <div><span className="text-[10px] text-muted-foreground block">Strategy</span><span className="capitalize font-medium">{selectedDay.strategy}</span></div>
              <div><span className="text-[10px] text-muted-foreground block">Note</span><span className="text-muted-foreground">{selectedDay.note}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Strategy + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Strategy Guidance</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-favorable mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Best Approach</p>
            <ul className="space-y-1.5">
              {guidance.bestApproach.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80"><ChevronRight className="h-3 w-3 text-favorable mt-0.5 shrink-0" />{item}</li>
              ))}
            </ul>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-[10px] uppercase tracking-wider text-destructive mb-2 flex items-center gap-1"><Ban className="h-3 w-3" /> Avoid</p>
            <ul className="space-y-1.5">
              {guidance.whatToAvoid.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80"><ChevronRight className="h-3 w-3 text-destructive mt-0.5 shrink-0" />{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Behavioral Guardrails</p>
          </div>
          {alerts.map((alert, i) => (
            <div key={i} className={`glass-card p-4 border ${alert.type === "volatility" ? "border-warning/15" : "border-primary/15"}`}>
              <div className="flex items-start gap-2.5">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${alert.type === "volatility" ? "bg-warning/10" : "bg-primary/10"}`}>
                  {alert.type === "volatility" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <Lightbulb className="h-4 w-4 text-primary" />}
                </div>
                <div>
                  <p className={`text-xs font-semibold mb-0.5 ${alert.type === "volatility" ? "text-warning" : "text-primary"}`}>{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="glass-card p-3.5 border border-white/[0.06]">
            <div className="flex items-start gap-2.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Signals are calibrated to your birth chart. For refined insights, specify investment type and horizon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestmentTiming;
