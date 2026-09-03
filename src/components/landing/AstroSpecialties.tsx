const specialties = [
  "When to Invest", "Peak Earning Years", "Hidden Wealth Windows", "Risk-Free Periods",
  "Career vs Business", "Ideal Loan Timing", "Property Buy Signals", "Gold Accumulation Cycles",
  "Startup Launch Timing", "Foreign Income Potential", "Salary Growth Phases", "Debt Closure Windows",
  "Side Income Triggers", "Financial Blind Spots", "Wealth Retention Zones", "Smart Exit Timing",
];

const insightCards = [
  { text: "Income Growth",       highlight: false },
  { text: "Scam Warning",        highlight: true  },
  { text: "Luxury Item Timings", highlight: false },
  { text: "Dasha Risk Meter",    highlight: true  },
  { text: "Surprise Wealth",     highlight: false },
  { text: "Investments & Assets", highlight: true },
  { text: "Job vs Business",     highlight: false },
  { text: "Foreign Settlement",  highlight: true  },
  { text: "Inheritance & Legacy", highlight: false },
  { text: "Money Weakness",      highlight: true  },
  { text: "Best Business Start", highlight: false },
  { text: "Earnings Strength",   highlight: true  },
];

// Triplicate for infinite scroll — animate-ticker-scroll travels -33.3333%,
// exactly one copy, so the loop is seamless.
const row1 = [...specialties, ...specialties, ...specialties];
const row2 = [...insightCards, ...insightCards, ...insightCards];

/** Overrides the utility's default 55s. Matches the previous Framer timing. */
const MARQUEE_DURATION = "11s";

const Dot = () => (
  <span className="mx-3 text-xs select-none" style={{ color: "rgba(255,255,255,0.4)" }}>✦</span>
);

export const AstroSpecialties = () => (
  <section
    // Clarity hints — mirrors AstroTicker. Both rows here use the same
    // tripled-content + `animate-ticker-scroll` marquee pattern that defeated
    // Clarity's heatmap iframe reconstruction on `/home` (see ANALYTICS.md →
    // "Heatmap rendering — the AstroTicker gotcha"). Masking preemptively so
    // this section never surprises us in a future heatmap capture; click
    // tracking is unaffected because Clarity records clicks separately from
    // the screenshot layer.
    data-clarity-mask="true"
    data-clarity-region="astro-specialties"
    className="relative py-16 overflow-hidden"
    style={{ 
      background: "#a22c1c", 
      borderTop: "1px solid rgba(0,0,0,0.06)", 
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      contain: "layout style paint",
    }}
  >

    <div className="relative z-10">
      {/* Label */}
      <p className="text-center text-xs font-bold tracking-[0.3em] uppercase mb-8"
        style={{ color: "#F2C572" }}>
        What Your Kundali Reveals About Money
      </p>

      {/* Row 1 — Specialties, scrolls left.
          Pure CSS via animate-ticker-scroll (see tailwind.config.ts), the same
          compositor-only marquee AstroTicker uses. Framer Motion drove this on
          the main thread, where it competed with the Hero's Lottie canvases and
          the navbar scroll handler; its -33.33% also fell short of the tripled
          content's exact -33.3333% loop distance, snapping every cycle. */}
      <div className="overflow-hidden mb-5">
        <div
          // `flex-nowrap` — keeps the tripled row on one line even when the
          // parent's flex context is not fully honoured (Clarity iframe,
          // print stylesheets, forced-colors mode). See AstroTicker for the
          // same guard.
          className="flex flex-nowrap items-center animate-ticker-scroll"
          style={{
            animationDuration: MARQUEE_DURATION,
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {row1.map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <span
                className="text-lg md:text-xl font-bold whitespace-nowrap"
                style={{ color: "#ffffff", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.3px" }}
              >
                {item}
              </span>
              <Dot />
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — Insight Cards, scrolls right (same keyframes, reversed) */}
      <div className="overflow-hidden">
        <div
          // See row 1 for the `flex-nowrap` rationale.
          className="flex flex-nowrap items-center animate-ticker-scroll"
          style={{
            animationDuration: MARQUEE_DURATION,
            animationDirection: "reverse",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {row2.map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <span
                className="text-lg md:text-xl whitespace-nowrap"
                style={{
                  fontWeight: 700,
                  color: item.highlight ? "#F2C572" : "#ffffff",
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "-0.3px",
                }}
              >
                {item.text}
              </span>
              <Dot />
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
