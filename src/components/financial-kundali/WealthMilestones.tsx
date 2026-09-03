/**
 * WealthMilestones — Mahadasha-based wealth milestone timeline.
 *
 * Shows the current Mahadasha phase highlighted in gold, followed by
 * upcoming Mahadasha periods as a vertical timeline with date ranges
 * and brief financial insights for each period.
 */

import { motion } from "framer-motion";
import type { ReportScores, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits?: TransitPlanet[] | null;
}

interface MilestonePeriod {
  lord: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  insight: string;
}

const MAHADASHA_YEARS: Record<string, number> = {
  Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16,
  Saturn: 19, Mercury: 17, Ketu: 7, Venus: 20,
};

const MAHADASHA_INSIGHTS: Record<string, string> = {
  Jupiter:
    "Jupiter period brings expansion, wisdom in investments, and natural wealth growth. Excellent for long-term financial planning.",
  Saturn:
    "Saturn period brings financial lessons. Delays and restrictions teach valuable money management.",
  Mercury:
    "Mercury supports analytical financial decisions. Good for learning new skills that increase earning.",
  Venus:
    "Venus period favors luxury, comfort, and creative income streams. Strong for business and partnerships.",
  Moon:
    "Moon period brings fluctuating income. Emotional spending patterns need careful management.",
  Sun:
    "Sun period boosts career authority and recognition. Leadership roles and salary hikes are likely.",
  Mars:
    "Mars period drives aggressive wealth-building. High energy for entrepreneurship and bold investments.",
  Rahu:
    "Rahu brings unconventional income opportunities. Foreign connections and tech ventures can pay off.",
  Ketu:
    "Ketu brings mixed financial signals. Focus on reducing expenses rather than increasing income.",
};

const DASHA_ORDER = [
  "Sun", "Moon", "Mars", "Rahu", "Jupiter",
  "Saturn", "Mercury", "Ketu", "Venus",
];

function parseDateYear(dateStr: string): number {
  const d = new Date(dateStr);
  return isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
}

function formatPeriod(start: string, end: string): string {
  const sy = parseDateYear(start);
  const ey = parseDateYear(end);
  const sm = new Date(start).toLocaleString("en-US", { month: "short" }).toUpperCase();
  const em = new Date(end).toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${sm} ${sy} – ${em} ${ey}`;
}

function buildMilestones(dasha: DashaInfo): MilestonePeriod[] {
  const milestones: MilestonePeriod[] = [];

  // Current mahadasha
  milestones.push({
    lord: dasha.mahadasha_lord,
    startDate: dasha.mahadasha_start,
    endDate: dasha.mahadasha_end,
    isCurrent: true,
    insight: MAHADASHA_INSIGHTS[dasha.mahadasha_lord] ?? `${dasha.mahadasha_lord} period shapes your financial journey.`,
  });

  // Build subsequent dashas from the end of the current one
  const currentIdx = DASHA_ORDER.indexOf(dasha.mahadasha_lord);
  let prevEnd = dasha.mahadasha_end;

  for (let i = 1; i <= 4; i++) {
    const nextLord = DASHA_ORDER[(currentIdx + i) % DASHA_ORDER.length];
    const duration = MAHADASHA_YEARS[nextLord] ?? 10;
    const startYear = parseDateYear(prevEnd);
    const startDate = prevEnd;
    const endYear = startYear + duration;
    const endDate = `${endYear}-${prevEnd.slice(5)}`;

    milestones.push({
      lord: nextLord,
      startDate,
      endDate,
      isCurrent: false,
      insight: MAHADASHA_INSIGHTS[nextLord] ?? `${nextLord} period shapes your financial journey.`,
    });

    prevEnd = endDate;
  }

  return milestones;
}

export default function WealthMilestones({ scores, dasha }: Props) {
  if (!dasha) return null;

  const milestones = buildMilestones(dasha);

  return (
    <div
      className="rounded-2xl px-5 pt-5 pb-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <h3
          className="text-base md:text-lg font-bold tracking-tight"
          style={{ color: "#F2C572", fontFamily: "'Poppins', sans-serif" }}
        >
          Wealth Milestones
        </h3>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-[9px] top-3 bottom-3 w-px"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="flex flex-col gap-0">
          {milestones.map((m, i) => (
            <motion.div
              key={i}
              className="relative flex gap-4 pb-6 last:pb-0"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            >
              {/* Dot */}
              <div className="relative z-10 shrink-0 mt-1">
                {m.isCurrent ? (
                  <div
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                      boxShadow: "0 0 10px rgba(242,197,114,0.6)",
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#2A0E4A]" />
                  </div>
                ) : (
                  <div
                    className="w-[18px] h-[18px] rounded-full border-2"
                    style={{
                      borderColor: "rgba(168,155,200,0.3)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Label row */}
                {m.isCurrent ? (
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded"
                      style={{
                        color: "#F2C572",
                        background: "rgba(242,197,114,0.1)",
                        border: "1px solid rgba(242,197,114,0.2)",
                      }}
                    >
                      Current Phase
                    </span>
                  </div>
                ) : (
                  <p
                    className="text-[10px] font-medium uppercase tracking-widest mb-1"
                    style={{ color: "rgba(168,155,200,0.5)" }}
                  >
                    {formatPeriod(m.startDate, m.endDate)}
                  </p>
                )}

                {/* Insight text */}
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: m.isCurrent ? "rgba(214,198,245,0.85)" : "rgba(168,155,200,0.6)" }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: m.isCurrent ? "#F5E9FF" : "rgba(214,198,245,0.7)" }}
                  >
                    {m.lord} Mahadasha
                  </span>
                  {" — "}
                  {m.insight}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-[8px] mt-4 text-center" style={{ color: "rgba(168,155,200,0.25)" }}>
        Based on Vimshottari Dasha system
      </p>
    </div>
  );
}
