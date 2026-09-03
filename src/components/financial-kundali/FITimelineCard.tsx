/**
 * FITimelineCard — Financial Independence & Retirement card for /kundali.
 *
 * Layout (matches the design reference):
 *   ┌────────────────────────────────────────────────┬───────────────────────┐
 *   │  At what age will you achieve                  │                 [ 41%] │
 *   │  financial independence?                       │                       │
 *   │                                                │  Retire early by      │
 *   │  window: Age 51–55                             │  doing this           │
 *   │  (2053–2057)                                   │                       │
 *   │                                                │  ✅ accelerators …    │
 *   │             [ floating style callout ]         │                       │
 *   │                       │                        │  ┌─ 🔴 BLOCKERS ───┐  │
 *   │  ━━━━━━━━━━━━━━━━━━━━▼━━━━━━━━━━━━━━━━━━━━━━━  │  │ ⚠ …             │  │
 *   │  Now(24)        FI(51)           retire 60+    │  └─────────────────┘  │
 *   │  ● Growth  ● Consolidation  ● Passive  ● Caut. │                       │
 *   └────────────────────────────────────────────────┴───────────────────────┘
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReportScores, DashaInfo, TransitPlanet } from "@/lib/vedicfinance-types";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  scores: ReportScores | null;
  dasha: DashaInfo | null;
  transits: TransitPlanet[] | null;
  birthYear?: number;
}

const GROWTH_LORDS = ["Jupiter", "Venus", "Mercury"];
const CAUTION_LORDS = ["Saturn", "Rahu", "Ketu", "Mars"];
const FAVORABLE_LORDS = ["Jupiter", "Venus", "Mercury", "Moon"];

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃",
  Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};

const PHASE_COLORS: Record<string, string> = {
  growth: "#2FBF9F",
  consolidation: "#F2C572",
  passive: "#C8A2FF",
  caution: "#E06BAA",
};

export default function FITimelineCard({ scores, dasha, transits: _transits, birthYear }: Props) {
  const [showRetireEarly, setShowRetireEarly] = useState(false);
  const isMobile = useIsMobile();

  if (!scores || !dasha) return null;

  const currentYear = new Date().getFullYear();
  const currentAge = birthYear ? currentYear - birthYear : 30;
  const dashaLord = dasha.mahadasha_lord;
  const antarLord = dasha.antardasha_lord;
  const nextDasha = dasha.next_mahadasha ?? "Saturn";

  // FI age calculation
  const wealthPower =
    scores.natal_wealth_score * 0.3 +
    scores.income_score * 0.3 +
    scores.investment_score * 0.25 +
    scores.timing_score * 0.15;
  const baseFIAge = 65 - (wealthPower / 100) * 20;
  const dashaBonus = GROWTH_LORDS.includes(dashaLord) ? -3 : CAUTION_LORDS.includes(dashaLord) ? 2 : 0;
  const fiAge = Math.round(Math.max(currentAge + 8, Math.min(62, baseFIAge + dashaBonus)));
  const fiAgeHigh = fiAge + 4;
  const retireAge = 60;
  const fiYear = currentYear + (fiAge - currentAge);
  const fiYearHigh = currentYear + (fiAgeHigh - currentAge);

  // Savings power
  const savingsPower = Math.round(
    Math.min(
      85,
      Math.max(
        20,
        scores.income_score * 0.4 +
          scores.natal_wealth_score * 0.3 -
          scores.risk_score * 0.15 +
          scores.timing_score * 0.15,
      ),
    ),
  );

  // Dasha segments
  const sequence = [
    { lord: dashaLord, duration: 5 },
    { lord: antarLord, duration: 3 },
    { lord: nextDasha, duration: 7 },
    { lord: FAVORABLE_LORDS.includes(nextDasha) ? "Saturn" : "Jupiter", duration: 6 },
    { lord: "Venus", duration: 5 },
  ];
  const segments: { lord: string; startAge: number; endAge: number; phase: string }[] = [];
  let age = currentAge;
  sequence.forEach(({ lord, duration }) => {
    const endAge = age + duration;
    const phase = GROWTH_LORDS.includes(lord)
      ? "growth"
      : lord === "Saturn"
        ? "consolidation"
        : age >= fiAge - 5 && FAVORABLE_LORDS.includes(lord)
          ? "passive"
          : "caution";
    segments.push({ lord, startAge: age, endAge, phase });
    age = endAge;
  });

  // Timeline scale
  const timelineEnd = Math.max(retireAge + 3, fiAgeHigh + 3, segments[segments.length - 1]?.endAge ?? 65);
  const timelineRange = timelineEnd - currentAge;
  const xPct = (a: number) => Math.min(100, Math.max(0, ((a - currentAge) / timelineRange) * 100));

  // Retirement style
  const STYLE_CONFIG: Record<string, { label: string; description: string; icon: string; color: string }> = {
    "early-lean": {
      label: "Early & Lean",
      description: "Minimalist FI: freedom over luxury, achievable sooner with discipline.",
      icon: "🏕️",
      color: "#2FBF9F",
    },
    comfortable: {
      label: "Comfortable at Standard Age",
      description: "Balanced approach: steady accumulation leads to a secure, comfortable retirement.",
      icon: "🏡",
      color: "#F2C572",
    },
    "luxurious-late": {
      label: "Luxurious & Late",
      description: "High lifestyle needs push FI later, but retirement will be abundant.",
      icon: "✨",
      color: "#C8A2FF",
    },
    "serial-entrepreneur": {
      label: "Never Fully Retire",
      description: "Your chart favors continuous creation: you'll always have ventures running.",
      icon: "🚀",
      color: "#E06BAA",
    },
  };

  let retirementStyle: string;
  if (scores.risk_score > 60 && scores.income_score > 55) retirementStyle = "serial-entrepreneur";
  else if (scores.natal_wealth_score > 60 && scores.investment_score > 55 && fiAge < 50) retirementStyle = "early-lean";
  else if (scores.natal_wealth_score > 50 && scores.income_score > 50) retirementStyle = "luxurious-late";
  else retirementStyle = "comfortable";
  const styleConfig = STYLE_CONFIG[retirementStyle];

  // Accelerators
  const accelerators: { label: string; detail: string }[] = [];
  if (GROWTH_LORDS.includes(dashaLord)) {
    const end = new Date(dasha.mahadasha_end).getFullYear();
    accelerators.push({
      label: `${dashaLord} Mahadasha`,
      detail: `Peak wealth-building window active (${currentYear}–${end}).`,
    });
  }
  if (scores.investment_score > 50) {
    accelerators.push({
      label: "Strong investment aptitude",
      detail: "Diversify portfolio now. Transit window supports compounding.",
    });
  }
  if (accelerators.length < 2) {
    accelerators.push({
      label: "Consistent income flow",
      detail: "Steady accumulation supports early FI if savings rate increases.",
    });
  }

  // Blockers
  const blockers: { label: string; detail: string }[] = [];
  if (scores.expense_score > 55) {
    blockers.push({
      label: "High lifestyle creep",
      detail: "Analyze and optimize monthly expenses.",
    });
  }
  if (scores.savings_score < 50) {
    blockers.push({
      label: "Low savings discipline",
      detail: "Review savings structures and automate transfers.",
    });
  }
  if (CAUTION_LORDS.includes(dashaLord)) {
    blockers.push({
      label: `${dashaLord} Mahadasha caution`,
      detail: "Avoid high-risk moves. Focus on capital preservation.",
    });
  }
  if (blockers.length < 2) {
    blockers.push({
      label: "Missing passive income streams",
      detail: "Build income sources that work without active effort.",
    });
  }

  return (
    <div
      className="fi-timeline-card relative rounded-2xl px-5 sm:px-7 lg:px-10 pt-8 sm:pt-10 pb-8 sm:pb-10"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(242,197,114,0.18)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 24px rgba(242,197,114,0.08), inset 0 0 0 1px rgba(242,197,114,0.06)",
      }}
    >
      {/* Single-column layout */}
      <div className="min-w-0">
        {/* Headline */}
          <div className="flex items-center gap-1.5">
          <h2
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(14px, 2.2vw, 26px)",
              color: "#F5E9FF",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.3px",
              maxWidth: "28ch",
            }}
          >
            At what age will you achieve
            <br />
            <span className="fi-independence-text" style={{ color: "#F2C572" }}>financial independence?</span>
          </h2>
          <InsightInfoTooltip explanation="Your FI age is derived from your natal wealth score, income score, investment aptitude, and timing score, weighted together to estimate when passive income can cover expenses. Dasha lords accelerate or delay this: Jupiter/Venus/Mercury dashas pull it earlier, while Saturn/Rahu push it later." />
          </div>

          {/* Progress ring — top right corner */}
          <div className="absolute top-6 right-5 sm:top-8 sm:right-7 lg:right-10">
            <div className="relative shrink-0">
              <svg width={88} height={88} viewBox="0 0 88 88">
                <circle
                  cx={44}
                  cy={44}
                  r={36}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={6}
                />
                <circle
                  cx={44}
                  cy={44}
                  r={36}
                  fill="none"
                  stroke="#C8A2FF"
                  strokeWidth={6}
                  strokeDasharray={`${2 * Math.PI * 36 * (savingsPower / 100)} ${2 * Math.PI * 36}`}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                  style={{ filter: "drop-shadow(0 0 8px rgba(200,162,255,0.55))" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="font-bold"
                  style={{
                    color: "#C8A2FF",
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "clamp(14px, 1.5vw, 18px)",
                  }}
                >
                  {savingsPower}%
                </span>
              </div>
            </div>
          </div>

          {/* FI target — Age range ▫ year range */}
          <div className="mt-8 sm:mt-10 flex items-center gap-4 sm:gap-5 flex-wrap">
            {/* Age range + year range */}
            <div className="min-w-0">
              <p
                className="font-bold leading-none fi-age-text"
                style={{
                  color: "#F2C572",
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "clamp(20px, 2.6vw, 28px)",
                  letterSpacing: "-0.5px",
                }}
              >
                Age {fiAge}–{fiAgeHigh}
              </p>
              <p
                className="mt-2 text-[13px] sm:text-[14px]"
                style={{ color: "rgba(168,155,200,0.55)", fontFamily: "'Poppins', sans-serif" }}
              >
                ({fiYear}–{fiYearHigh})
              </p>
            </div>
          </div>

          {/* Timeline wrapper */}
          <div className="relative mt-8 sm:mt-10">
            {/* Track */}
            <div
              className="relative h-3 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {segments.map((seg, i) => {
                const left = xPct(seg.startAge);
                const width = xPct(seg.endAge) - left;
                return (
                  <motion.div
                    key={i}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: PHASE_COLORS[seg.phase],
                      opacity: 0.82,
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                  />
                );
              })}
            </div>

            {/* Now marker */}
            <div className="absolute top-0 h-3 flex items-center" style={{ left: `${xPct(currentAge)}%` }}>
              <div
                className="w-3.5 h-3.5 rounded-full border-2 -translate-x-1/2"
                style={{
                  background: "#F5E9FF",
                  borderColor: "#0D0618",
                  boxShadow: "0 0 6px rgba(245,233,255,0.6)",
                }}
              />
            </div>

            {/* FI marker (short gold line) */}
            <div
              className="absolute"
              style={{ left: `${xPct(fiAge)}%`, top: "-4px", transform: "translateX(-50%)" }}
            >
              <div
                className="w-[2px] h-5 mx-auto"
                style={{ background: "#F2C572", boxShadow: "0 0 8px rgba(242,197,114,0.7)" }}
              />
              {/* small star above mark */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: "#F2C572" }}>
                ★
              </div>
            </div>

            {/* Planet glyphs above the centre of each segment */}
            <div className="relative h-0">
              {segments.map((seg, i) => {
                const midPct = (xPct(seg.startAge) + xPct(seg.endAge)) / 2;
                return (
                  <span
                    key={i}
                    className="absolute text-[13px]"
                    style={{
                      left: `${midPct}%`,
                      top: "-22px",
                      transform: "translateX(-50%)",
                      color: PHASE_COLORS[seg.phase],
                      opacity: 0.9,
                      textShadow: `0 0 8px ${PHASE_COLORS[seg.phase]}55`,
                    }}
                  >
                    {PLANET_GLYPHS[seg.lord] ?? "⭐"}
                  </span>
                );
              })}
            </div>

            {/* Age labels */}
            {(() => {
              // Determine if FI and Retire labels are too close (< 8 pct-points apart)
              // and if Now and FI are too close. When close, stagger onto a second row.
              const fiPct = xPct(fiAge);
              const retirePct = xPct(retireAge);
              const nowPct = xPct(currentAge);

              // A gap of < 8 pct-points causes visible overlap at most screen sizes
              const fiRetireClose = retireAge <= timelineEnd && Math.abs(retirePct - fiPct) < 8;
              const nowFiClose = Math.abs(nowPct - fiPct) < 8;

              // Retire goes to row-2 if it's close to FI; FI goes to row-2 if it's close to Now
              const retireRow = fiRetireClose ? 1 : 0;
              const fiRow = nowFiClose ? 1 : 0;
              const nowRow = 0;

              // Each row is 14px tall (or 26px on mobile for two-line labels); container height must fit all rows
              const rowHeight = isMobile ? 26 : 14;
              const maxRow = Math.max(nowRow, fiRow, retireRow);
              const containerHeight = (maxRow + 1) * rowHeight + 2; // px

              return (
                <div className="relative mt-4" style={{ height: `${containerHeight}px` }}>
                  {/* Regular age ticks */}
                  {Array.from({ length: Math.ceil(timelineRange / 5) + 1 }, (_, i) => {
                    const tickAge = Math.ceil(currentAge / 5) * 5 + i * 5;
                    if (tickAge > timelineEnd) return null;
                    const tooClose =
                      Math.abs(tickAge - currentAge) < 4 ||
                      Math.abs(tickAge - fiAge) < 4 ||
                      Math.abs(tickAge - retireAge) < 4;
                    if (tooClose) return null;
                    return (
                      <span
                        key={tickAge}
                        className="absolute text-[10px]"
                        style={{
                          left: `${xPct(tickAge)}%`,
                          top: 0,
                          transform: "translateX(-50%)",
                          color: "rgba(168,155,200,0.45)",
                          fontWeight: 500,
                          fontFamily: "'Poppins', sans-serif",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tickAge}
                      </span>
                    );
                  })}
                  {/* Now label */}
                  <span
                    className="absolute text-[10px] font-bold"
                    style={{
                      left: `${nowPct}%`,
                      top: `${nowRow * rowHeight}px`,
                      transform: "translateX(-50%)",
                      color: "#F5E9FF",
                      fontFamily: "'Poppins', sans-serif",
                      whiteSpace: isMobile ? "normal" : "nowrap",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {isMobile ? (
                      <><span style={{ display: "block" }}>Now</span><span style={{ display: "block" }}>({currentAge})</span></>
                    ) : (
                      `Now (${currentAge})`
                    )}
                  </span>
                  {/* FI label */}
                  <span
                    className="absolute text-[10px] font-bold"
                    style={{
                      left: `${fiPct}%`,
                      top: `${fiRow * rowHeight}px`,
                      transform: "translateX(-50%)",
                      color: "#F2C572",
                      fontFamily: "'Poppins', sans-serif",
                      whiteSpace: isMobile ? "normal" : "nowrap",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {isMobile ? (
                      <><span style={{ display: "block" }}>FI</span><span style={{ display: "block" }}>({fiAge})</span></>
                    ) : (
                      `FI (${fiAge})`
                    )}
                  </span>
                  {/* Retire label */}
                  {retireAge <= timelineEnd && (
                    <span
                      className="absolute text-[10px]"
                      style={{
                        left: `${retirePct}%`,
                        top: `${retireRow * rowHeight}px`,
                        transform: "translateX(-50%)",
                        color: "rgba(168,155,200,0.55)",
                        fontFamily: "'Poppins', sans-serif",
                        whiteSpace: isMobile ? "normal" : "nowrap",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {isMobile ? (
                        <><span style={{ display: "block" }}>Retire</span><span style={{ display: "block" }}>({retireAge})</span></>
                      ) : (
                        `Retire (${retireAge})`
                      )}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Retirement-style callout removed */}
          </div>
        </div>

      {/* Phase legend — bottom-center */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {(
          [
            ["growth", "Growth"],
            ["consolidation", "Consolidation"],
            ["passive", "Passive"],
            ["caution", "Caution"],
          ] as const
        ).map(([key, label]) => (
          <span
            key={key}
            className="flex items-center gap-2 text-[12px] sm:text-[13px]"
            style={{ color: "rgba(214,198,245,0.78)", fontFamily: "'Poppins', sans-serif" }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full phase-dot"
              style={{
                background: PHASE_COLORS[key],
                boxShadow: `0 0 6px ${PHASE_COLORS[key]}66`,
              }}
            />
            {label}
          </span>
        ))}
      </div>

      <p className="text-[9px] mt-6 text-center" style={{ color: "rgba(168,155,200,0.25)" }}>
        Based on Dasha cycles &amp; Wealth Yogas
      </p>

      {/* ─────── Learn more toggler — inside the card ─────── */}
      <div className="mt-6" style={{ borderTop: "1px solid rgba(242,197,114,0.18)" }}>
        <button
          type="button"
          onClick={() => setShowRetireEarly((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3.5 text-left transition-all duration-200 rounded-xl mt-3"
          aria-expanded={showRetireEarly}
          style={{
            background: showRetireEarly
              ? "rgba(242,197,114,0.10)"
              : "rgba(242,197,114,0.05)",
            border: "1px solid rgba(242,197,114,0.25)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(242,197,114,0.12)";
            (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(242,197,114,0.45)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = showRetireEarly
              ? "rgba(242,197,114,0.10)"
              : "rgba(242,197,114,0.05)";
            (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(242,197,114,0.25)";
          }}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex items-center justify-center rounded-md shrink-0"
              style={{
                width: 22,
                height: 22,
                background: "rgba(242,197,114,0.12)",
                border: "1px solid rgba(242,197,114,0.35)",
                color: "#F2C572",
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              ★
            </span>
            <span
              className="font-semibold truncate"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "clamp(14px, 1.3vw, 16px)",
                color: "#F5E9FF",
                letterSpacing: "-0.2px",
              }}
            >
              Open to know how to retire early
            </span>
          </span>
          <motion.span
            animate={{ rotate: showRetireEarly ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0"
            style={{ color: "#F2C572", fontSize: 18, lineHeight: 1 }}
            aria-hidden
          >
            ▾
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {showRetireEarly && (
            <motion.div
              key="retire-early-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div
                className="pb-4 pt-1 flex flex-col gap-5"
                style={{ borderTop: "1px solid rgba(242,197,114,0.08)" }}
              >
                <h3
                  className="mt-4"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "clamp(16px, 1.8vw, 20px)",
                    color: "#F5E9FF",
                    fontWeight: 600,
                    lineHeight: 1.2,
                    letterSpacing: "-0.2px",
                  }}
                >
                  Retire early by doing this
                </h3>

                {/* Accelerators */}
                <div className="flex flex-col gap-3.5">
                  {accelerators.slice(0, 2).map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span
                        className="inline-flex items-center justify-center rounded-md shrink-0 mt-0.5"
                        style={{
                          width: 18,
                          height: 18,
                          background: "rgba(47,191,159,0.18)",
                          border: "1px solid rgba(47,191,159,0.45)",
                          color: "#2FBF9F",
                          fontSize: 11,
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                      <p
                        className="text-[12.5px] leading-relaxed"
                        style={{
                          color: "rgba(214,198,245,0.75)",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        <span className="font-semibold" style={{ color: "#F5E9FF" }}>
                          {a.label}:
                        </span>{" "}
                        {a.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Blockers */}
                <div
                  className="rounded-xl px-4 py-3.5"
                  style={{
                    background: "rgba(224,107,170,0.04)",
                    border: "1px solid rgba(224,107,170,0.18)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full phase-dot"
                      style={{
                        background: "#E06060",
                        boxShadow: "0 0 8px rgba(224,96,96,0.6)",
                      }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: "#E8B4B4", fontFamily: "'Poppins', sans-serif" }}
                    >
                      Blockers
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {blockers.slice(0, 2).map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-sm mt-0.5">⚠️</span>
                        <p
                          className="text-[12.5px] leading-relaxed"
                          style={{
                            color: "rgba(214,198,245,0.75)",
                            fontFamily: "'Poppins', sans-serif",
                          }}
                        >
                          <span className="font-semibold" style={{ color: "#F5E9FF" }}>
                            {b.label}:
                          </span>{" "}
                          {b.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
