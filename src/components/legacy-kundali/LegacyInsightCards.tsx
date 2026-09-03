/**
 * InsightCards — the 3 insight cards below TopCards on /kundali.
 *
 * 1. Career & Salary       (score gauge + promotion window)
 * 2. Loan & EMI             (verdict + safe EMI limit)
 * 3. Wealth Milestones      (vertical timeline)
 *
 * All data comes from computeAllInsights() via props.
 */

import { AlertTriangle } from "lucide-react";
import type { CareerInsight, LoanInsight, WealthTimeline } from "@/lib/financial-kundali-engine";
import type { DashaInfo } from "@/lib/vedicfinance-types";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";

/* ─── shared card wrapper ─── */
const Card = ({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`rounded-2xl p-5 ${className}`}
    style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(16px)",
      ...style,
    }}
  >
    {children}
  </div>
);

/* ════════════════════════════════════════════════════════
   1. Career & Salary
   ════════════════════════════════════════════════════════ */

function CareerSalaryCard({ career }: { career: CareerInsight | null }) {
  const score = career?.careerStrength ?? 0;
  const maxScore = 100;
  const status = score >= 70 ? "High Stability" : score >= 45 ? "Moderate" : "Needs Attention";
  const promotionWindow = career?.promotionWindow ?? "—";

  return (
    <Card className="flex flex-col" style={{ borderLeft: "3px solid #F2C572" }}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        <h3
          className="text-base font-bold leading-tight"
          style={{
            color: "#F2C572",
            fontFamily: "'Playfair Display', serif",
            letterSpacing: "-0.3px",
          }}
        >
          Career &amp; Salary
        </h3>
        <InsightInfoTooltip explanation="Career strength is calculated from your 10th house lord's placement and dignity. Promotion windows align with when benefic planets transit your 10th or 11th house. Side income potential comes from 3rd house (skills) and 11th house (gains) activation in your current Dasha." />
        <div className="flex items-baseline gap-1 shrink-0">
          <span
            className="text-3xl font-bold leading-none"
            style={{ color: "#F5E9FF" }}
          >
            {score}
          </span>
          <span
            className="text-sm"
            style={{ color: "rgba(168,155,200,0.45)" }}
          >
            /{maxScore}
          </span>
        </div>
      </div>

      {/* Status label */}
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-5"
        style={{ color: "rgba(168,155,200,0.55)" }}
      >
        Status: {status}
      </p>

      {/* Promotion window pill */}
      <div
        className="rounded-xl px-4 py-3 mt-auto"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(242,197,114,0.12)",
        }}
      >
        <span
          className="block text-[10px] uppercase tracking-[0.12em] mb-1"
          style={{ color: "rgba(168,155,200,0.5)" }}
        >
          Promotion Window
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: "#F5E9FF" }}
        >
          {promotionWindow}
        </span>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════
   2. Loan & EMI
   ════════════════════════════════════════════════════════ */

function LoanEmiCard({ loan }: { loan: LoanInsight | null }) {
  const verdictMap: Record<string, string> = {
    favorable: "Favorable for Loans",
    delay: "Consider Delaying",
    avoid: "Avoid New Debt",
  };
  const verdict = loan ? verdictMap[loan.loanVerdict] ?? "Consider Delaying" : "—";
  const safeEmiPercent = loan?.emiComfortPercent ?? 0;
  const note = loan?.verdictReason ?? "";

  return (
    <Card className="flex flex-col items-center text-center">
      {/* Warning icon + title */}
      <div className="flex items-center gap-2.5 mb-1.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: "rgba(242,197,114,0.1)",
            border: "1px solid rgba(242,197,114,0.2)",
          }}
        >
          <AlertTriangle
            className="h-4 w-4"
            strokeWidth={2}
            style={{ color: "#F2C572" }}
          />
        </div>
        <h3
          className="text-base font-bold leading-tight"
          style={{
            color: "#F2C572",
            fontFamily: "'Playfair Display', serif",
            letterSpacing: "-0.3px",
          }}
        >
          Loan &amp; EMI
        </h3>
        <InsightInfoTooltip explanation="Loan readiness is assessed from your 6th house (debts), income-to-expense ratio, and whether Jupiter supports your 4th house (property/comfort). The safe EMI limit is derived from your income score vs expense pressure. Debt trap risk increases when Rahu occupies the 6th, 8th, or 12th house." />
      </div>

      {/* Verdict */}
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-5"
        style={{ color: "rgba(168,155,200,0.55)" }}
      >
        {verdict}
      </p>

      {/* Safe EMI Limit box */}
      <div
        className="w-full rounded-xl px-4 py-3 flex items-center justify-between mb-5"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "#D6C6F5" }}
        >
          Safe EMI Limit
        </span>
        <span
          className="text-2xl font-bold"
          style={{ color: "#2FBF9F" }}
        >
          {safeEmiPercent}%
        </span>
      </div>

      {/* Note */}
      <p
        className="text-xs leading-relaxed mt-auto"
        style={{ color: "rgba(168,155,200,0.5)" }}
      >
        {note}
      </p>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════
   3. Wealth Milestones
   ════════════════════════════════════════════════════════ */

function WealthMilestonesCard({
  wealthTimeline,
  dasha,
}: {
  wealthTimeline: WealthTimeline | null;
  dasha: DashaInfo | null;
}) {
  // Build milestones from real data
  const milestones = (() => {
    if (wealthTimeline && wealthTimeline.milestones.length > 0) {
      return wealthTimeline.milestones.slice(0, 4).map((m, i) => ({
        label: i === 0 ? "Current Phase" : m.period,
        description: `${m.label}: ${m.description}`,
        isCurrent: i === 0,
      }));
    }
    // Fallback from dasha if no timeline
    if (dasha) {
      return [
        {
          label: "Current Phase",
          description: `${dasha.mahadasha} (${dasha.antardasha})`,
          isCurrent: true,
        },
        {
          label: `Next: ${new Date(dasha.next_mahadasha_start).getFullYear()}`,
          description: `${dasha.next_mahadasha}`,
          isCurrent: false,
        },
      ];
    }
    return [{ label: "—", description: "Loading...", isCurrent: true }];
  })();

  return (
    <Card className="flex flex-col">
      {/* Title */}
      <h3
        className="text-base font-bold leading-tight mb-6"
        style={{
          color: "#F2C572",
          fontFamily: "'Playfair Display', serif",
          letterSpacing: "-0.3px",
        }}
      >
        Wealth Milestones
      </h3>
      <InsightInfoTooltip explanation="Milestones are mapped to your Mahadasha sequence. Each planetary period has a wealth score based on the lord's placement in your chart: benefics in wealth houses (2nd, 11th) score high. The timeline shows when each period starts and what financial energy it brings." />

      {/* Timeline */}
      <div className="relative flex flex-col gap-6 pl-5">
        {/* Vertical line */}
        <div
          className="absolute left-[7px] top-1 bottom-1 w-px"
          style={{ background: "rgba(242,197,114,0.18)" }}
        />

        {milestones.map((m, i) => (
          <div key={i} className="relative flex items-start gap-4">
            {/* Dot */}
            <div
              className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full shrink-0 z-10"
              style={{
                background: m.isCurrent ? "#F2C572" : "rgba(168,155,200,0.25)",
                border: m.isCurrent
                  ? "2px solid rgba(242,197,114,0.4)"
                  : "2px solid rgba(168,155,200,0.15)",
                boxShadow: m.isCurrent
                  ? "0 0 10px rgba(242,197,114,0.4)"
                  : "none",
              }}
            />

            {/* Text */}
            <div className="flex flex-col gap-0.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  color: m.isCurrent ? "#F2C572" : "rgba(168,155,200,0.5)",
                }}
              >
                {m.label}
              </span>
              <span
                className="text-sm font-medium leading-snug"
                style={{
                  color: m.isCurrent ? "#F5E9FF" : "rgba(214,198,245,0.7)",
                }}
              >
                {m.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Named exports for individual cards ─── */
export { CareerSalaryCard, LoanEmiCard, WealthMilestonesCard };
