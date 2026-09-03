import type { BirthDetails } from "./astro-engine";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export type InvestmentSignal = "favorable" | "neutral" | "risky";
export type RiskLevel = "low" | "medium" | "high";
export type Strategy = "long-term" | "short-term" | "hold" | "avoid";

export interface CurrentPhase {
  signal: InvestmentSignal;
  riskLevel: RiskLevel;
  strategy: Strategy;
  confidenceScore: number; // 1-10
  suggestedAction: string;
  timeWindow: string;
}

export interface TimelineDay {
  date: Date;
  signal: InvestmentSignal;
  riskLevel: RiskLevel;
  strategy: Strategy;
  note: string;
}

export interface StrategyGuidance {
  bestApproach: string[];
  whatToAvoid: string[];
}

export interface BehavioralAlert {
  type: "volatility" | "reminder";
  title: string;
  message: string;
}

export function generateCurrentPhase(details: BirthDetails): CurrentPhase {
  const seed = hashString(details.dateOfBirth + details.name + new Date().toDateString());
  const rng = seededRandom(seed);

  const signals: InvestmentSignal[] = ["favorable", "neutral", "risky"];
  const risks: RiskLevel[] = ["low", "medium", "high"];
  const strategies: Strategy[] = ["long-term", "short-term", "hold", "avoid"];

  const signal = signals[Math.floor(rng() * 3)];
  const riskLevel = risks[Math.floor(rng() * 3)];
  const confidence = Math.floor(rng() * 5) + 5; // 5-10

  const actions: Record<InvestmentSignal, string[]> = {
    favorable: [
      "Gradual entry: stagger investments over the next 2 weeks",
      "Strong window for systematic investment plans",
      "Consider increasing allocation to growth assets",
    ],
    neutral: [
      "Maintain current positions, avoid new large entries",
      "Focus on portfolio rebalancing rather than new investments",
      "Small, calculated entries are acceptable",
    ],
    risky: [
      "Pause new investments, focus on capital preservation",
      "Reduce exposure to volatile assets",
      "Wait for the next favorable window before committing capital",
    ],
  };

  const strategy: Strategy = signal === "favorable" ? (rng() > 0.5 ? "long-term" : "short-term") : signal === "risky" ? (rng() > 0.5 ? "hold" : "avoid") : "hold";

  const now = new Date();
  const windowStart = new Date(now.getTime() + Math.floor(rng() * 7) * 86400000);
  const windowEnd = new Date(windowStart.getTime() + (Math.floor(rng() * 10) + 5) * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });

  return {
    signal,
    riskLevel,
    strategy,
    confidenceScore: confidence,
    suggestedAction: actions[signal][Math.floor(rng() * actions[signal].length)],
    timeWindow: `${fmt(windowStart)} – ${fmt(windowEnd)}`,
  };
}

export function generateTimeline(details: BirthDetails, days: number = 60): TimelineDay[] {
  const seed = hashString(details.dateOfBirth + details.placeOfBirth + "timeline");
  const rng = seededRandom(seed);
  const now = new Date();

  const notes: Record<InvestmentSignal, string[]> = {
    favorable: ["Strong entry window", "Positive momentum period", "Growth-aligned phase", "Accumulation opportunity"],
    neutral: ["Stable consolidation", "Hold current positions", "No strong directional signal", "Wait for clarity"],
    risky: ["Elevated volatility expected", "Caution advised", "Reduce exposure", "Capital preservation phase"],
  };

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getTime() + i * 86400000);
    const r = rng();
    const signal: InvestmentSignal = r > 0.55 ? "favorable" : r > 0.25 ? "neutral" : "risky";
    const riskLevel: RiskLevel = signal === "favorable" ? "low" : signal === "risky" ? "high" : "medium";
    const strategy: Strategy = signal === "favorable" ? "long-term" : signal === "risky" ? "avoid" : "hold";
    const pool = notes[signal];
    return { date, signal, riskLevel, strategy, note: pool[Math.floor(rng() * pool.length)] };
  });
}

export function generateStrategyGuidance(details: BirthDetails): StrategyGuidance {
  const seed = hashString(details.dateOfBirth + details.name + "strategy");
  const rng = seededRandom(seed);

  const approaches = [
    ["Prefer long-term investments with a 12+ month horizon", "Systematic investment plans (SIPs) are well-aligned with current signals", "Focus on fundamentally strong, blue-chip assets"],
    ["Balanced approach: mix of growth and stability", "Consider debt instruments for partial allocation", "Diversify across asset classes to manage risk"],
    ["Conservative positioning, prioritize capital safety", "Favor fixed-income and low-volatility assets", "Keep a higher cash reserve for upcoming opportunities"],
  ];

  const avoidances = [
    ["Avoid impulsive entries during volatile trading sessions", "Do not over-leverage positions in any asset class", "Resist FOMO-driven decisions on trending assets"],
    ["Avoid concentrating more than 20% in a single asset", "Do not chase short-term momentum trades", "Avoid making financial decisions during emotional states"],
    ["Avoid liquidating long-term positions for short-term gains", "Do not ignore stop-loss levels on active trades", "Avoid investing borrowed capital in speculative instruments"],
  ];

  const idx = Math.floor(rng() * 3);
  return { bestApproach: approaches[idx], whatToAvoid: avoidances[idx] };
}

export function generateBehavioralAlerts(details: BirthDetails): BehavioralAlert[] {
  const seed = hashString(details.dateOfBirth + new Date().getMonth().toString());
  const rng = seededRandom(seed);

  const alerts: BehavioralAlert[][] = [
    [
      { type: "volatility", title: "Volatility Alert", message: "Upcoming period may trigger impulsive decisions. Step back and review your plan before acting." },
      { type: "reminder", title: "Smart Reminder", message: "Stick to your planned strategy instead of reacting to short-term market noise." },
    ],
    [
      { type: "volatility", title: "Emotional Caution", message: "Market fluctuations ahead: avoid checking portfolio too frequently during this phase." },
      { type: "reminder", title: "Discipline Check", message: "Review your investment thesis before making changes. If fundamentals haven't changed, stay the course." },
    ],
    [
      { type: "volatility", title: "High Sensitivity Period", message: "External events may create urgency to act. Pause for 24 hours before any major financial decision." },
      { type: "reminder", title: "Focus Anchor", message: "Your long-term goals haven't changed. Short-term turbulence is part of the journey." },
    ],
  ];

  return alerts[Math.floor(rng() * alerts.length)];
}
