/**
 * IncomeStabilityOverview — Top Insights version.
 * Handwriting-style title, ring gauge on left, description on right.
 */

import type { ReportScores } from "@/lib/vedicfinance-types";
import type { FinancialKundaliInsights } from "@/lib/financial-kundali-engine";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";

interface Props {
  scores: ReportScores | null;
  insights: FinancialKundaliInsights | null;
}

export default function IncomeStabilityOverview({ scores, insights }: Props) {
  const percent = scores
    ? Math.round(scores.income_score * 0.5 + scores.timing_score * 0.3 + scores.savings_score * 0.2)
    : 0;
  const radius = 54;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (percent / 100);

  const description = insights?.career
    ? `Career Strength: ${insights.career.careerStrength}/100. ${insights.career.keyInsight}`
    : scores
      ? `Income score ${scores.income_score}, timing score ${scores.timing_score}.`
      : "Loading...";

  return (
    <div
      className="rounded-2xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-6 sm:pb-8 flex flex-col"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Card title */}
      <div className="flex items-center gap-1.5 mb-5 sm:mb-7">
        <h3
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "clamp(14px, 2.2vw, 26px)",
            color: "#F5E9FF",
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.3px",
          }}
        >
          How Stable is your Income?
        </h3>
        <InsightInfoTooltip explanation="Income stability is derived from your income score (earning consistency), timing score (how well planetary periods support steady flow), and savings score (buffer capacity). A high score means your chart supports reliable, predictable income rather than volatile swings." />
      </div>

      {/* Ring + description side by side */}
      <div className="flex items-center gap-5 sm:gap-7">
        {/* Ring gauge */}
        <div className="relative w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] shrink-0">
          <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={stroke}
            />
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke="#F2C572"
              strokeWidth={stroke}
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              style={{
                filter: "drop-shadow(0 0 8px rgba(242,197,114,0.5))",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-3xl font-bold"
              style={{ color: "#F2C572" }}
            >
              {percent}%
            </span>
          </div>
        </div>

        {/* Description */}
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "rgba(214,198,245,0.6)" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
