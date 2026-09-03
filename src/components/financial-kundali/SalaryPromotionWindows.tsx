/**
 * SalaryPromotionWindows — Shows job change timing and salary negotiation months.
 * Design: handwriting-style title, prominent gold month pills.
 */

import type { CareerInsight } from "@/lib/financial-kundali-engine";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";

interface Props {
  career: CareerInsight | null;
}

export default function SalaryPromotionWindows({ career }: Props) {
  const salaryMonths = career?.salaryNegotiationMonths ?? [];

  return (
    <div
      className="best-months-card rounded-2xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-6 sm:pb-8 flex flex-col justify-between"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
        minHeight: "140px",
      }}
    >
      {/* Card title */}
      <div className="flex items-start justify-between mb-4">
        <h3
          className="leading-snug"
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "clamp(14px, 2.2vw, 26px)",
            color: "#F5E9FF",
            fontWeight: 700,
            letterSpacing: "-0.2px",
          }}
        >
          Your Best Months For Wealth
        </h3>
        <InsightInfoTooltip explanation="Wealth creation windows align with when benefic planets transit your 2nd, 11th, or 10th house. These months are when planetary energy supports income growth, investments, and financial gains." />
      </div>

      {/* Month pills */}
      {salaryMonths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {salaryMonths.map((m) => (
            <span
              key={m}
              className="text-xs font-medium px-3.5 py-1.5 rounded-full"
              style={{
                color: "#F2C572",
                background: "rgba(242,197,114,0.08)",
                border: "1px solid rgba(242,197,114,0.3)",
                letterSpacing: "0.01em",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
