/**
 * Financial Kundali Premium Dashboard
 * 
 * Renders all 7 insight sections from the Financial Kundali Engine.
 * Each section is a self-contained card that consumes computed data.
 */
import { useState, useMemo } from "react";
import {
  Brain, Calendar, TrendingUp, TrendingDown, Briefcase, CreditCard,
  Landmark, PiggyBank, BarChart3, Shield, AlertTriangle, ChevronDown,
  ChevronUp, Sparkles, Target, Zap, Eye, EyeOff, ArrowUpRight,
  ArrowDownRight, Minus, DollarSign, Building2, Lightbulb, Clock,
  Star, Flame, Heart, Wallet, LineChart, BadgePercent, CircleDollarSign,
} from "lucide-react";
import {
  computeAllInsights,
  type FinancialKundaliInsights,
  type MonthVerdict,
  type MoneyArchetype,
  type YearForecast,
  type CareerInsight,
  type LoanInsight,
  type WealthTimeline,
  type ExpenseInsight,
  type InvestmentPersonality,
} from "@/lib/financial-kundali-engine";
import type {
  ReportScores, ChartData, DashaInfo, TransitPlanet, ReportTimeline,
} from "@/lib/vedicfinance-types";

// ─── Shared Styles ──────────────────────────────────────────────────────────

const sectionCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  backdropFilter: "blur(16px)",
  borderRadius: 20,
};

const innerCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
};

const goldGradient = "linear-gradient(135deg, #F2C572, #FFDFA3)";
const tealColor = "#2FBF9F";
const pinkColor = "#E06BAA";
const goldColor = "#F2C572";

const verdictColors: Record<MonthVerdict, string> = {
  grow: "#34d399",
  hold: "#F2C572",
  protect: "#f87171",
};

const verdictLabels: Record<MonthVerdict, string> = {
  grow: "🟢 Grow",
  hold: "🟡 Hold",
  protect: "🔴 Protect",
};

const verdictBg: Record<MonthVerdict, string> = {
  grow: "rgba(52,211,153,0.1)",
  hold: "rgba(242,197,114,0.1)",
  protect: "rgba(248,113,113,0.1)",
};

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, accentColor = goldColor }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accentColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
      >
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
      <div>
        <h3
          className="text-lg font-bold tracking-tight"
          style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}
        >
          {title}
        </h3>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: `${accentColor}80` }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Score Bar ──────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color ?? (value >= 65 ? "#34d399" : value >= 45 ? "#F2C572" : "#f87171");
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-white/50">{label}</span>
        <span className="text-[10px] font-bold" style={{ color: c }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: c, boxShadow: `0 0 8px ${c}44` }}
        />
      </div>
    </div>
  );
}

// ─── Expandable Section ─────────────────────────────────────────────────────

function Expandable({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={innerCard} className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs font-semibold" style={{ color: "#F5E9FF" }}>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Money Personality Archetype
// ═══════════════════════════════════════════════════════════════════════════

function ArchetypeSection({ archetype }: { archetype: MoneyArchetype }) {
  const [showBlindSpots, setShowBlindSpots] = useState(false);

  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={Brain} title="Your Money Personality DNA" subtitle="Vedic Wealth Archetype" />

      {/* Archetype badge */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: "rgba(242,197,114,0.1)", border: "1px solid rgba(242,197,114,0.2)" }}
        >
          {archetype.emoji}
        </div>
        <div>
          <h4 className="text-xl font-bold mb-1" style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}>
            {archetype.name}
          </h4>
          <p className="text-sm italic mb-2" style={{ color: goldColor }}>{archetype.tagline}</p>
          <p className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>{archetype.description}</p>
        </div>
      </div>

      {/* Ruling planets */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[9px] uppercase tracking-widest text-white/30">Ruling Planets</span>
        {archetype.rulingPlanets.map(p => (
          <span
            key={p}
            className="text-[10px] px-2.5 py-1 rounded-full font-medium"
            style={{ background: "rgba(242,197,114,0.1)", color: goldColor, border: "1px solid rgba(242,197,114,0.2)" }}
          >
            {p}
          </span>
        ))}
        <span className="text-[9px] uppercase tracking-widest text-white/30 ml-3">Key Houses</span>
        {archetype.keyHouses.map(h => (
          <span
            key={h}
            className="text-[10px] px-2 py-1 rounded-full font-medium"
            style={{ background: "rgba(47,191,159,0.1)", color: tealColor, border: "1px solid rgba(47,191,159,0.2)" }}
          >
            {h}{h === 1 ? "st" : h === 2 ? "nd" : h === 3 ? "rd" : "th"}
          </span>
        ))}
      </div>

      {/* Your Relationship with Money */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-3.5 h-3.5" style={{ color: pinkColor }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: pinkColor }}>Your Relationship with Money</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>{archetype.moneyRelationship}</p>
      </div>

      {/* Strengths */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#34d399" }}>Financial Strengths</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {archetype.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[8px] mt-0.5" style={{ color: "#34d399" }}>✦</span>
              <span className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Blind Spots (toggle) */}
      <div style={innerCard} className="p-4">
        <button
          onClick={() => setShowBlindSpots(v => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          {showBlindSpots
            ? <Eye className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
            : <EyeOff className="w-3.5 h-3.5" style={{ color: "#f87171" }} />}
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#f87171" }}>
            Hidden Financial Blind Spots
          </span>
          <span className="text-[9px] text-white/30 ml-auto">{showBlindSpots ? "Hide" : "Reveal"}</span>
        </button>
        {showBlindSpots && (
          <div className="mt-3 flex flex-col gap-1.5">
            {archetype.blindSpots.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
                <span className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Year-Ahead Financial Forecast
// ═══════════════════════════════════════════════════════════════════════════

function YearForecastSection({ forecast }: { forecast: YearForecast }) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={Calendar} title="Year-Ahead Financial Forecast" subtitle="12-Month Money Weather" accentColor={tealColor} />

      <p className="text-xs leading-relaxed mb-4" style={{ color: "#D6C6F5" }}>{forecast.overallOutlook}</p>

      {/* Dasha transition alert */}
      {forecast.dashaTransitionAlert && (
        <div
          className="rounded-xl p-3 mb-4 flex items-start gap-2"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
          <p className="text-[11px] leading-relaxed" style={{ color: "#fca5a5" }}>{forecast.dashaTransitionAlert}</p>
        </div>
      )}

      {/* Best & Caution months summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div style={innerCard} className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpRight className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#34d399" }}>Best 3 Months</span>
          </div>
          <div className="flex flex-col gap-1">
            {forecast.bestMonths.map(idx => (
              <span key={idx} className="text-xs font-semibold" style={{ color: "#F5E9FF" }}>
                {forecast.months[idx].month}: <span style={{ color: "#34d399" }}>{forecast.months[idx].score}</span>
              </span>
            ))}
          </div>
        </div>
        <div style={innerCard} className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDownRight className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#f87171" }}>Caution Months</span>
          </div>
          <div className="flex flex-col gap-1">
            {forecast.cautionMonths.map(idx => (
              <span key={idx} className="text-xs font-semibold" style={{ color: "#F5E9FF" }}>
                {forecast.months[idx].month}: <span style={{ color: "#f87171" }}>{forecast.months[idx].score}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {forecast.months.map((m, i) => (
          <button
            key={i}
            onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
            className="rounded-xl p-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            style={{
              background: expandedMonth === i ? `${verdictColors[m.verdict]}15` : verdictBg[m.verdict],
              border: `1px solid ${expandedMonth === i ? verdictColors[m.verdict] + "40" : "rgba(255,255,255,0.05)"}`,
            }}
          >
            <p className="text-[9px] font-medium text-white/50 mb-1">{m.month}</p>
            <p className="text-lg font-bold mb-0.5" style={{ color: verdictColors[m.verdict] }}>{m.score}</p>
            <p className="text-[8px] font-semibold" style={{ color: verdictColors[m.verdict] }}>
              {verdictLabels[m.verdict]}
            </p>
          </button>
        ))}
      </div>

      {/* Expanded month detail */}
      {expandedMonth !== null && (
        <div
          className="mt-3 rounded-xl p-4 animate-fade-in"
          style={{ ...innerCard, borderColor: `${verdictColors[forecast.months[expandedMonth].verdict]}30` }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ color: "#F5E9FF" }}>
              {forecast.months[expandedMonth].month}
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: `${verdictColors[forecast.months[expandedMonth].verdict]}15`,
                color: verdictColors[forecast.months[expandedMonth].verdict],
              }}
            >
              Score: {forecast.months[expandedMonth].score}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: tealColor }} />
              <span className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>
                {forecast.months[expandedMonth].transitHighlight}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: goldColor }} />
              <span className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>
                {forecast.months[expandedMonth].dashaInfluence}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Career & Salary Insights
// ═══════════════════════════════════════════════════════════════════════════

function CareerSection({ career }: { career: CareerInsight }) {
  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={Briefcase} title="Career & Salary Insights" subtitle="10th House Analysis" accentColor="#E06BAA" />

      <p className="text-xs leading-relaxed mb-4" style={{ color: "#D6C6F5" }}>{career.keyInsight}</p>

      {/* Career strength + Side income */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div style={innerCard} className="p-4 text-center">
          <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Career Strength</p>
          <p className="text-3xl font-bold mb-1" style={{ color: career.careerStrength >= 65 ? "#34d399" : career.careerStrength >= 45 ? goldColor : "#f87171" }}>
            {career.careerStrength}
          </p>
          <p className="text-[9px] text-white/40">out of 100</p>
        </div>
        <div style={innerCard} className="p-4 text-center">
          <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Side Income Potential</p>
          <p className="text-3xl font-bold mb-1" style={{ color: career.sideIncomeScore >= 65 ? "#34d399" : career.sideIncomeScore >= 45 ? goldColor : "#f87171" }}>
            {career.sideIncomeScore}
          </p>
          <p className="text-[9px] text-white/40 capitalize">{career.sideIncomeType}</p>
        </div>
      </div>

      {/* Job change window */}
      <Expandable title="🔄 Best Time for Job Change" defaultOpen>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{career.bestJobChangeWindow}</p>
      </Expandable>

      <div className="h-2" />

      {/* Promotion window */}
      <Expandable title="📈 Promotion Window">
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{career.promotionWindow}</p>
        {career.salaryNegotiationMonths.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Best months for salary negotiation</p>
            <div className="flex flex-wrap gap-1.5">
              {career.salaryNegotiationMonths.map(m => (
                <span key={m} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </Expandable>

      <div className="h-2" />

      {/* Stagnation risk */}
      {career.stagnationRisk.active && (
        <>
          <Expandable title="⚠️ Career Stagnation Risk">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#fbbf24" }} />
              <div>
                <p className="text-[11px] font-semibold mb-1" style={{ color: "#fbbf24" }}>{career.stagnationRisk.period}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{career.stagnationRisk.reason}</p>
              </div>
            </div>
          </Expandable>
          <div className="h-2" />
        </>
      )}

      {/* Sector affinities */}
      <Expandable title="🏢 Career Sector Affinity">
        <div className="flex flex-col gap-2">
          {career.careerSectors.map((s, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px]" style={{ color: "#D6C6F5" }}>
                  {s.sector} <span className="text-white/30">({s.planet})</span>
                </span>
                <span className="text-[10px] font-bold" style={{ color: s.affinity >= 65 ? "#34d399" : s.affinity >= 45 ? goldColor : "#f87171" }}>
                  {s.affinity}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${s.affinity}%`,
                    background: i === 0 ? goldGradient : s.affinity >= 65 ? "#34d399" : s.affinity >= 45 ? goldColor : "#f87171",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Expandable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Loan & EMI Timing Advisor
// ═══════════════════════════════════════════════════════════════════════════

function LoanSection({ loan }: { loan: LoanInsight }) {
  const verdictColor = loan.loanVerdict === "favorable" ? "#34d399" : loan.loanVerdict === "delay" ? goldColor : "#f87171";
  const verdictIcon = loan.loanVerdict === "favorable" ? "✅" : loan.loanVerdict === "delay" ? "⏳" : "🚫";
  const riskColor = loan.debtTrapRisk.level === "low" ? "#34d399" : loan.debtTrapRisk.level === "moderate" ? goldColor : "#f87171";

  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={CreditCard} title="Loan & EMI Advisor" subtitle="6th & 8th House Analysis" accentColor="#fbbf24" />

      {/* Verdict banner */}
      <div
        className="rounded-xl p-4 mb-4 flex items-center gap-3"
        style={{ background: `${verdictColor}10`, border: `1px solid ${verdictColor}25` }}
      >
        <span className="text-2xl">{verdictIcon}</span>
        <div>
          <p className="text-sm font-bold capitalize" style={{ color: verdictColor }}>
            {loan.loanVerdict === "favorable" ? "Good Time for Loans" : loan.loanVerdict === "delay" ? "Consider Delaying" : "Avoid New Debt"}
          </p>
          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: "#D6C6F5" }}>{loan.verdictReason}</p>
        </div>
      </div>

      {/* Scores row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div style={innerCard} className="p-3 text-center">
          <p className="text-[8px] uppercase tracking-widest text-white/30 mb-1">Loan Readiness</p>
          <p className="text-2xl font-bold" style={{ color: loan.loanReadinessScore >= 65 ? "#34d399" : loan.loanReadinessScore >= 45 ? goldColor : "#f87171" }}>
            {loan.loanReadinessScore}
          </p>
        </div>
        <div style={innerCard} className="p-3 text-center">
          <p className="text-[8px] uppercase tracking-widest text-white/30 mb-1">Safe EMI %</p>
          <p className="text-2xl font-bold" style={{ color: tealColor }}>{loan.emiComfortPercent}%</p>
          <p className="text-[7px] text-white/30">of income</p>
        </div>
        <div style={innerCard} className="p-3 text-center">
          <p className="text-[8px] uppercase tracking-widest text-white/30 mb-1">Debt Trap Risk</p>
          <p className="text-sm font-bold capitalize" style={{ color: riskColor }}>{loan.debtTrapRisk.level}</p>
        </div>
      </div>

      {/* Debt trap detail */}
      <Expandable title="🔍 Debt Trap Analysis" defaultOpen>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{loan.debtTrapRisk.reason}</p>
      </Expandable>

      <div className="h-2" />

      {/* Best loan window */}
      <Expandable title="📅 Best Loan Window">
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{loan.bestLoanWindow}</p>
      </Expandable>

      {loan.repaymentPressurePeriods.length > 0 && (
        <>
          <div className="h-2" />
          <Expandable title="⚠️ Repayment Pressure Periods">
            <div className="flex flex-col gap-2">
              {loan.repaymentPressurePeriods.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#fbbf24" }} />
                  <div>
                    <p className="text-[10px] font-semibold" style={{ color: "#fbbf24" }}>{p.period}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{p.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </Expandable>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Wealth Milestones Timeline
// ═══════════════════════════════════════════════════════════════════════════

function WealthTimelineSection({ timeline }: { timeline: WealthTimeline }) {
  const strengthColor = (s: string) => s === "strong" ? "#34d399" : s === "moderate" ? goldColor : "#f87171";

  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={Landmark} title="Wealth Milestones" subtitle="Dasha-Based Life Timeline" accentColor="#C8A2FF" />

      {/* Milestone timeline */}
      <div className="relative mb-5">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.08]" />

        <div className="flex flex-col gap-4">
          {timeline.milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-4 relative">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 z-10"
                style={{ background: `${strengthColor(m.strength)}15`, border: `1px solid ${strengthColor(m.strength)}30` }}
              >
                {m.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold" style={{ color: "#F5E9FF" }}>{m.label}</span>
                  <span
                    className="text-[8px] px-2 py-0.5 rounded-full font-semibold uppercase"
                    style={{ background: `${strengthColor(m.strength)}15`, color: strengthColor(m.strength) }}
                  >
                    {m.strength}
                  </span>
                </div>
                <p className="text-[10px] mb-1" style={{ color: goldColor }}>{m.period}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{m.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Peak earning */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-3.5 h-3.5" style={{ color: goldColor }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: goldColor }}>Peak Earning Period</span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{timeline.peakEarningDasha}</p>
      </div>

      {/* Financial independence */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-3.5 h-3.5" style={{ color: tealColor }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: tealColor }}>Financial Independence Outlook</span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{timeline.financialIndependenceOutlook}</p>
      </div>

      {/* Inheritance & Windfall */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Expandable title="🏛️ Inheritance Indicator">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase"
              style={{
                background: timeline.inheritanceIndicator.likelihood === "high" ? "rgba(52,211,153,0.1)" : timeline.inheritanceIndicator.likelihood === "moderate" ? "rgba(242,197,114,0.1)" : "rgba(255,255,255,0.05)",
                color: timeline.inheritanceIndicator.likelihood === "high" ? "#34d399" : timeline.inheritanceIndicator.likelihood === "moderate" ? goldColor : "#A89BC8",
              }}
            >
              {timeline.inheritanceIndicator.likelihood} likelihood
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{timeline.inheritanceIndicator.reason}</p>
        </Expandable>

        <Expandable title="💰 Windfall Potential">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase"
              style={{
                background: timeline.windfall.likelihood === "high" ? "rgba(52,211,153,0.1)" : timeline.windfall.likelihood === "moderate" ? "rgba(242,197,114,0.1)" : "rgba(255,255,255,0.05)",
                color: timeline.windfall.likelihood === "high" ? "#34d399" : timeline.windfall.likelihood === "moderate" ? goldColor : "#A89BC8",
              }}
            >
              {timeline.windfall.likelihood} likelihood
            </span>
          </div>
          <p className="text-[11px] leading-relaxed mb-1" style={{ color: "#D6C6F5" }}>{timeline.windfall.reason}</p>
          <p className="text-[10px]" style={{ color: goldColor }}>{timeline.windfall.bestPeriod}</p>
        </Expandable>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: Expense & Savings Optimization
// ═══════════════════════════════════════════════════════════════════════════

function ExpenseSection({ expense }: { expense: ExpenseInsight }) {
  const disciplineColor = expense.savingsDisciplineScore >= 70 ? "#34d399" : expense.savingsDisciplineScore >= 50 ? goldColor : "#f87171";

  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={PiggyBank} title="Expense & Savings Optimization" subtitle="12th House Analysis" accentColor="#4FD1C5" />

      {/* Spending leak */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4" style={{ color: "#f87171" }} />
          <span className="text-xs font-bold" style={{ color: "#fca5a5" }}>
            Your Spending Leak: {expense.leakCategory}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{expense.spendingLeakPattern}</p>
      </div>

      {/* Savings discipline */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div style={innerCard} className="p-4 text-center">
          <p className="text-[8px] uppercase tracking-widest text-white/30 mb-2">Savings Discipline</p>
          <p className="text-3xl font-bold mb-1" style={{ color: disciplineColor }}>{expense.savingsDisciplineScore}</p>
          <p className="text-[9px] font-medium" style={{ color: disciplineColor }}>{expense.savingsDisciplineLabel}</p>
        </div>
        <div style={innerCard} className="p-4">
          <p className="text-[8px] uppercase tracking-widest text-white/30 mb-2">Best Savings Months</p>
          <div className="flex flex-wrap gap-1">
            {expense.bestSavingsMonths.map(m => (
              <span key={m} className="text-[10px] px-2 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expense spikes */}
      {expense.expenseSpikeMonths.length > 0 && (
        <>
          <Expandable title="📊 Expense Spike Alerts" defaultOpen>
            <div className="flex flex-col gap-2">
              {expense.expenseSpikeMonths.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Flame className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#fbbf24" }} />
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: "#fbbf24" }}>{s.month}</span>
                    <span className="text-[10px] text-white/40">: {s.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </Expandable>
          <div className="h-2" />
        </>
      )}

      {/* Big purchase months */}
      {expense.bigPurchaseMonths.length > 0 && (
        <>
          <Expandable title="🛍️ Best Months for Big Purchases">
            <div className="flex flex-wrap gap-1.5">
              {expense.bigPurchaseMonths.map(m => (
                <span key={m} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "rgba(242,197,114,0.1)", color: goldColor, border: "1px solid rgba(242,197,114,0.2)" }}>
                  {m}
                </span>
              ))}
            </div>
          </Expandable>
          <div className="h-2" />
        </>
      )}

      {/* Optimization tips */}
      <Expandable title="💡 Personalized Optimization Tips" defaultOpen>
        <div className="flex flex-col gap-2">
          {expense.optimizationTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" style={{ color: tealColor }} />
              <span className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{tip}</span>
            </div>
          ))}
        </div>
      </Expandable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: Investment Personality Profile
// ═══════════════════════════════════════════════════════════════════════════

function InvestmentSection({ personality }: { personality: InvestmentPersonality }) {
  const typeColor = personality.type === "Aggressive" ? "#f87171" : personality.type === "Balanced" ? goldColor : "#34d399";

  return (
    <div style={sectionCard} className="p-5 md:p-7">
      <SectionHeader icon={LineChart} title="Investment Personality" subtitle="5th House & Risk Analysis" accentColor="#E06BAA" />

      {/* Type badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{personality.typeEmoji}</span>
        <div>
          <p className="text-lg font-bold" style={{ color: typeColor, fontFamily: "'Playfair Display', serif" }}>
            {personality.type} Investor
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>{personality.description}</p>
        </div>
      </div>

      {/* Trading temperament */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5" style={{ color: goldColor }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: goldColor }}>Trading Temperament</span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{personality.tradingTemperament}</p>
      </div>

      {/* Greed & Fear */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5" style={{ color: pinkColor }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: pinkColor }}>Your Greed & Fear Index</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <ScoreBar label="Greed Tendency" value={personality.greedFearProfile.greedScore} color="#f87171" />
          </div>
          <div>
            <ScoreBar label="Fear Tendency" value={personality.greedFearProfile.fearScore} color="#60a5fa" />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{personality.greedFearProfile.insight}</p>
      </div>

      {/* SIP vs Lump Sum */}
      <div style={innerCard} className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <CircleDollarSign className="w-3.5 h-3.5" style={{ color: tealColor }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: tealColor }}>SIP vs Lump Sum Verdict</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: `${tealColor}15`, color: tealColor, border: `1px solid ${tealColor}30` }}
          >
            {personality.sipVsLumpSum.verdict}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "#D6C6F5" }}>{personality.sipVsLumpSum.reason}</p>
      </div>

      {/* Sector affinities */}
      <Expandable title="🏢 Sector Affinity by Planetary Alignment">
        <div className="flex flex-col gap-2">
          {personality.sectorAffinities.map((s, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px]" style={{ color: "#D6C6F5" }}>
                  {s.sector} <span className="text-white/30">({s.planet})</span>
                </span>
                <span className="text-[10px] font-bold" style={{ color: s.score >= 65 ? "#34d399" : s.score >= 45 ? goldColor : "#f87171" }}>
                  {s.score}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${s.score}%`,
                    background: i === 0 ? goldGradient : s.score >= 65 ? "#34d399" : s.score >= 45 ? goldColor : "#f87171",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Expandable>

      <div className="h-2" />

      {/* Best entry & avoid months */}
      <div className="grid grid-cols-2 gap-3">
        <Expandable title="✅ Best Entry Months">
          <div className="flex flex-wrap gap-1.5">
            {personality.bestEntryMonths.length > 0 ? personality.bestEntryMonths.map(m => (
              <span key={m} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                {m}
              </span>
            )) : <span className="text-[10px] text-white/40">No strong entry windows identified</span>}
          </div>
        </Expandable>
        <Expandable title="🚫 Avoid Months">
          <div className="flex flex-wrap gap-1.5">
            {personality.avoidMonths.length > 0 ? personality.avoidMonths.map(m => (
              <span key={m} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                {m}
              </span>
            )) : <span className="text-[10px] text-white/40">No high-risk months identified</span>}
          </div>
        </Expandable>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface FinancialKundaliDashboardProps {
  chart: ChartData;
  scores: ReportScores;
  dasha: DashaInfo;
  transits: TransitPlanet[];
  timeline: ReportTimeline | null;
}

export default function FinancialKundaliDashboard({
  chart,
  scores,
  dasha,
  transits,
  timeline,
}: FinancialKundaliDashboardProps) {
  const insights = useMemo(
    () => computeAllInsights(chart, scores, dasha, transits, timeline),
    [chart, scores, dasha, transits, timeline],
  );

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Section title */}
      <div className="text-center">
        <h2
          className="text-2xl md:text-4xl font-bold tracking-tight mb-2"
          style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}
        >
          Your{" "}
          <span
            style={{
              backgroundImage: goldGradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Financial Kundali
          </span>{" "}
          Insights
        </h2>
        <p className="text-sm" style={{ color: "#A89BC8" }}>
          Personalized insights derived from your Vedic birth chart, dasha periods, and current planetary transits
        </p>
      </div>

      {/* 1. Money Personality */}
      <ArchetypeSection archetype={insights.archetype} />

      {/* 2. Year Forecast */}
      <YearForecastSection forecast={insights.yearForecast} />

      {/* 3 & 4: Career + Loan side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <CareerSection career={insights.career} />
        <LoanSection loan={insights.loan} />
      </div>

      {/* 5. Wealth Timeline */}
      <WealthTimelineSection timeline={insights.wealthTimeline} />

      {/* 6 & 7: Expense + Investment side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <ExpenseSection expense={insights.expense} />
        <InvestmentSection personality={insights.investmentPersonality} />
      </div>
    </div>
  );
}
