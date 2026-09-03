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

export type RiskPhase = "stable" | "caution" | "elevated";

export interface RiskHero {
  phase: RiskPhase;
  intensity: number; // 1-10
  suggestedAction: string;
}

export interface RiskTimelineDay {
  date: Date;
  phase: RiskPhase;
  action: string;
}

export interface DefensiveStrategy {
  recommended: string[];
  avoid: string[];
}

export interface RiskAlert {
  title: string;
  message: string;
}

export function generateRiskHero(details: BirthDetails): RiskHero {
  const seed = hashString(details.dateOfBirth + details.name + new Date().toDateString() + "risk");
  const rng = seededRandom(seed);

  const phases: RiskPhase[] = ["stable", "caution", "elevated"];
  const phase = phases[Math.floor(rng() * 3)];
  const intensity = phase === "elevated" ? Math.floor(rng() * 3) + 7 : phase === "caution" ? Math.floor(rng() * 3) + 4 : Math.floor(rng() * 3) + 1;

  const actions: Record<RiskPhase, string[]> = {
    stable: [
      "Maintain current positions with confidence",
      "Steady course: no defensive action needed",
      "Continue planned strategy without adjustments",
    ],
    caution: [
      "Review exposure and tighten stop-losses",
      "Reduce speculative positions gradually",
      "Shift allocation toward stable instruments",
    ],
    elevated: [
      "Reduce exposure & stay defensive",
      "Prioritize capital preservation over growth",
      "Pause new entries, wait for stability",
    ],
  };

  return {
    phase,
    intensity,
    suggestedAction: actions[phase][Math.floor(rng() * actions[phase].length)],
  };
}

export function generateRiskTimeline(details: BirthDetails, days = 60): RiskTimelineDay[] {
  const seed = hashString(details.dateOfBirth + details.placeOfBirth + "risktimeline");
  const rng = seededRandom(seed);
  const now = new Date();

  const actions: Record<RiskPhase, string[]> = {
    stable: ["No action needed", "Safe to hold positions", "Stable outlook"],
    caution: ["Monitor closely", "Tighten risk controls", "Reduce speculative trades"],
    elevated: ["Avoid major financial decisions", "Defensive positioning recommended", "Capital preservation phase"],
  };

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getTime() + i * 86400000);
    const r = rng();
    const phase: RiskPhase = r > 0.6 ? "stable" : r > 0.25 ? "caution" : "elevated";
    const pool = actions[phase];
    return { date, phase, action: pool[Math.floor(rng() * pool.length)] };
  });
}

export function generateDefensiveStrategy(details: BirthDetails): DefensiveStrategy {
  const seed = hashString(details.dateOfBirth + details.name + "defense");
  const rng = seededRandom(seed);

  const recs = [
    ["Prioritize liquidity over returns", "Favor fixed-income instruments", "Keep 30%+ in cash reserves"],
    ["Diversify across uncorrelated assets", "Reduce single-position concentration", "Shift toward defensive sectors"],
    ["Maintain emergency fund at 6+ months", "Avoid leverage in current phase", "Consider hedging active positions"],
  ];

  const avoids = [
    ["Avoid high-risk leveraged positions", "Do not chase momentum trades", "Delay major financial commitments"],
    ["Avoid concentrating in volatile assets", "Do not ignore risk signals", "Refrain from emotional rebalancing"],
    ["Avoid overexposure to speculative assets", "Do not commit to long-term illiquid positions", "Resist pressure to act quickly"],
  ];

  const idx = Math.floor(rng() * 3);
  return { recommended: recs[idx], avoid: avoids[idx] };
}

export function generateRiskAlerts(details: BirthDetails): RiskAlert[] {
  const seed = hashString(details.dateOfBirth + new Date().getMonth().toString() + "riskalert");
  const rng = seededRandom(seed);

  const sets: RiskAlert[][] = [
    [
      { title: "Sensitive phase approaching", message: "A period of heightened sensitivity begins in 4 days. Prepare by reviewing positions." },
      { title: "Defensive window active", message: "You are currently in a defensive window. Focus on stability over growth." },
    ],
    [
      { title: "Transition period ahead", message: "The next 10 days mark a transition: avoid large new commitments." },
      { title: "Stability focus recommended", message: "Current signals suggest prioritizing capital protection over aggressive moves." },
    ],
    [
      { title: "Low-activity phase optimal", message: "This is an ideal period for review and planning, not execution." },
      { title: "Patience recommended", message: "Conditions suggest waiting for clearer signals before making changes." },
    ],
  ];

  return sets[Math.floor(rng() * sets.length)];
}
