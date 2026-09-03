import { Star, Moon, Sun } from "lucide-react";
import type { ReportReasoning } from "@/lib/vedicfinance-types";

function parseBullets(text: string): string[] {
  return text
    .split(/[;.]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function deriveActionPoints(type: "natal" | "dasha" | "transit", bullets: string[]): string[] {
  const text = bullets.join(" ").toLowerCase();
  const actions: string[] = [];

  if (type === "natal") {
    if (/jupiter|dhana yoga|wealth|11th|2nd lord/.test(text))
      actions.push("Prioritise long-term wealth building: your chart supports compounding assets like equity mutual funds or index funds.");
    if (/venus|taurus|libra|luxury/.test(text))
      actions.push("Luxury or real-estate purchases are karmically supported: plan major acquisitions during Venus-strong transits.");
    if (/saturn|capricorn|aquarius|discipline/.test(text))
      actions.push("Adopt a disciplined SIP or recurring investment habit: Saturn rewards consistent, structured effort.");
    if (/mars|aries|scorpio|risk|aggressive/.test(text))
      actions.push("Keep speculative exposure below 15% of portfolio: Mars energy can amplify both gains and losses.");
    if (/rahu|ketu|shadow|karmic/.test(text))
      actions.push("Avoid impulsive financial decisions during eclipses or Rahu/Ketu transits over your natal positions.");
    if (/moon|cancer|emotional/.test(text))
      actions.push("Avoid making investment decisions based on market sentiment or fear: your Moon placement makes you susceptible to emotional trading.");
    if (actions.length === 0)
      actions.push("Review your natal wealth houses (2nd, 11th) with a financial advisor to align investments with your chart strengths.");
  }

  if (type === "dasha") {
    if (/jupiter mahadasha|jupiter dasha/.test(text))
      actions.push("You are in a Jupiter Mahadasha: an ideal window to expand investments, start a business, or pursue higher education.");
    if (/venus mahadasha|venus dasha|venus antardasha/.test(text))
      actions.push("Venus period favours luxury assets, real estate, and creative ventures: act on property or gold purchases now.");
    if (/saturn mahadasha|saturn dasha/.test(text))
      actions.push("Saturn Mahadasha demands patience: focus on debt reduction, building emergency funds, and avoiding high-risk speculation.");
    if (/rahu mahadasha|rahu dasha/.test(text))
      actions.push("Rahu periods bring unconventional opportunities: consider tech, foreign markets, or emerging sectors, but hedge carefully.");
    if (/ketu mahadasha|ketu dasha/.test(text))
      actions.push("Ketu Mahadasha is better for spiritual growth than financial expansion: preserve capital and avoid new ventures.");
    if (/mars mahadasha|mars dasha/.test(text))
      actions.push("Mars Dasha supports bold moves: good for starting a business or making a calculated high-risk investment.");
    if (/antardasha|sub-period/.test(text))
      actions.push("The current sub-period (Antardasha) fine-tunes timing: align major financial moves to the start of a favourable Antardasha.");
    if (actions.length === 0)
      actions.push("Track your Dasha transitions: major financial decisions are best timed to the start of a new favourable Mahadasha.");
  }

  if (type === "transit") {
    if (/jupiter transit|jupiter in/.test(text))
      actions.push("Jupiter's current transit is activating income or wealth houses: this is a good window to increase SIP amounts or open new investment positions.");
    if (/saturn transit|saturn in/.test(text))
      actions.push("Saturn's transit may slow returns: stay patient, avoid panic-selling, and use this period to rebalance your portfolio.");
    if (/retrograde/.test(text))
      actions.push("Retrograde planets in transit signal a review phase: audit existing investments rather than initiating new ones.");
    if (/house 8|8th house/.test(text))
      actions.push("8th house transits indicate sudden changes: keep 3–6 months of expenses as liquid reserves.");
    if (/house 11|11th house|income/.test(text))
      actions.push("11th house activation supports income growth: negotiate a raise, launch a side income stream, or increase equity exposure.");
    if (/house 12|12th house|expense/.test(text))
      actions.push("12th house transits increase hidden expenses: review subscriptions, insurance, and recurring costs now.");
    if (actions.length === 0)
      actions.push("Monitor current planetary transits over your 2nd, 11th, and 10th houses for the best timing on financial moves.");
  }

  return actions;
}

const SECTION_META: Record<string, { icon: React.ReactNode; accent: string; type: "natal" | "dasha" | "transit" }> = {
  "Natal Chart Analysis": {
    icon: <Star className="w-3.5 h-3.5" />,
    accent: "#a78bfa",
    type: "natal",
  },
  "Dasha Analysis": {
    icon: <Moon className="w-3.5 h-3.5" />,
    accent: "#34d399",
    type: "dasha",
  },
  "Transit Analysis": {
    icon: <Sun className="w-3.5 h-3.5" />,
    accent: "#f59e0b",
    type: "transit",
  },
};

function ReasoningSection({ title, content }: { title: string; content: string }) {
  const bullets = parseBullets(content);
  const meta = SECTION_META[title] ?? { icon: null, accent: "#a78bfa", type: "natal" as const };
  const actions = deriveActionPoints(meta.type, bullets);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span style={{ color: meta.accent }}>{meta.icon}</span>
        <span className="text-sm font-semibold text-white/90">{title}</span>
      </div>
      <ul className="space-y-2 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 leading-relaxed">
            <span
              className="w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0"
              style={{ background: meta.accent }}
            />
            <span className="text-sm text-white/70">{b}</span>
          </li>
        ))}
      </ul>
      {actions.length > 0 && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{
            background: "rgba(16, 185, 129, 0.06)",
            border: "1px solid rgba(16, 185, 129, 0.18)",
          }}
        >
          <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "#6ee7b7" }}>
            ✦ What this means for you
          </p>
          <ul className="space-y-1.5">
            {actions.map((a, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-relaxed" style={{ color: "rgba(167,243,208,0.85)" }}>
                <span className="shrink-0 mt-[3px]" style={{ color: "#34d399" }}>→</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface Props {
  reasoning: ReportReasoning;
}

export default function ReasoningAccordion({ reasoning }: Props) {
  return (
    <div
      className="rounded-2xl p-5 h-full"
      style={{
        background: "rgba(15, 8, 30, 0.82)",
        border: "1px solid rgba(167, 139, 250, 0.2)",
        backdropFilter: "blur(24px)",
        boxShadow: "0 0 40px rgba(139, 92, 246, 0.08), inset 0 1px 0 rgba(167,139,250,0.1)",
      }}
    >
      <p className="text-[10px] uppercase tracking-widest text-white/35 mb-5">Detailed Reasoning</p>
      <div className="space-y-6">
        <ReasoningSection title="Natal Chart Analysis" content={reasoning.natal_analysis} />
        <ReasoningSection title="Dasha Analysis" content={reasoning.dasha_analysis} />
        <ReasoningSection title="Transit Analysis" content={reasoning.transit_analysis} />
      </div>
    </div>
  );
}
