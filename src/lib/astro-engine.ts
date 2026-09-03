// Mock Vedic Astrology Engine for wealth timing predictions

export interface BirthDetails {
  name: string;
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
}

export interface ZodiacProfile {
  sunSign: string;
  moonSign: string;
  ascendant: string;
  wealthPlanets: { planet: string; house: number; sign: string; impact: "favorable" | "neutral" | "challenging" }[];
}

export type PeriodType = "growth" | "stagnant" | "pressure";

export interface MonthForecast {
  month: string;
  type: PeriodType;
  score: number; // 0-100
  insight: string;
}

export interface PredictorCard {
  title: string;
  category: "salary" | "bonus" | "income";
  dateRange: string;
  confidence: number; // 0-100
  reasoning: string;
  impact: "favorable" | "neutral" | "challenging";
}

export interface TransitInfo {
  planet: string;
  sign: string;
  house: number;
  impact: "favorable" | "neutral" | "challenging";
  description: string;
}

export interface RecommendedAction {
  action: string;
  timing: string;
  reasoning: string;
  urgency: "act-now" | "plan-ahead" | "wait";
}

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓"
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export function getZodiacSymbol(sign: string): string {
  return ZODIAC_SYMBOLS[sign] || "⭐";
}

export function generateProfile(details: BirthDetails): ZodiacProfile {
  const seed = hashString(details.dateOfBirth + details.timeOfBirth + details.placeOfBirth);
  const rng = seededRandom(seed);

  const sunIdx = Math.floor(rng() * 12);
  const moonIdx = (sunIdx + Math.floor(rng() * 6) + 3) % 12;
  const ascIdx = (sunIdx + Math.floor(rng() * 8) + 1) % 12;

  const impacts: Array<"favorable" | "neutral" | "challenging"> = ["favorable", "neutral", "challenging"];

  return {
    sunSign: ZODIAC_SIGNS[sunIdx],
    moonSign: ZODIAC_SIGNS[moonIdx],
    ascendant: ZODIAC_SIGNS[ascIdx],
    wealthPlanets: [
      { planet: "Jupiter", house: 2, sign: ZODIAC_SIGNS[(sunIdx + 1) % 12], impact: impacts[Math.floor(rng() * 2)] },
      { planet: "Venus", house: 11, sign: ZODIAC_SIGNS[(sunIdx + 10) % 12], impact: impacts[Math.floor(rng() * 2)] },
      { planet: "Saturn", house: 10, sign: ZODIAC_SIGNS[(sunIdx + 9) % 12], impact: impacts[Math.floor(rng() * 3)] },
      { planet: "Mercury", house: 2, sign: ZODIAC_SIGNS[(sunIdx + 1) % 12], impact: impacts[Math.floor(rng() * 2)] },
    ],
  };
}

export function generateTimeline(details: BirthDetails): MonthForecast[] {
  const seed = hashString(details.dateOfBirth + details.name);
  const rng = seededRandom(seed);

  const insights = {
    growth: [
      "Jupiter's transit favors wealth accumulation",
      "Venus in your 2nd house boosts earnings",
      "Strong planetary alignment for financial growth",
      "Mercury supports new income opportunities",
    ],
    stagnant: [
      "Saturn's aspect suggests consolidation",
      "Focus on savings during this transit",
      "Planetary energies favor stability over growth",
      "Rahu transit calls for patience",
    ],
    pressure: [
      "Ketu transit may cause unexpected expenses",
      "Mars aspect requires careful financial planning",
      "Eclipse season demands caution with investments",
    ],
  };

  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthLabel = `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
    const r = rng();
    const type: PeriodType = r > 0.55 ? "growth" : r > 0.25 ? "stagnant" : "pressure";
    const score = type === "growth" ? 60 + Math.floor(rng() * 40) : type === "stagnant" ? 35 + Math.floor(rng() * 25) : 10 + Math.floor(rng() * 25);
    const pool = insights[type];
    return { month: monthLabel, type, score, insight: pool[Math.floor(rng() * pool.length)] };
  });
}

export function generatePredictors(details: BirthDetails): PredictorCard[] {
  const seed = hashString(details.dateOfBirth + details.placeOfBirth);
  const rng = seededRandom(seed);
  const now = new Date();

  const makeRange = (offsetWeeks: number, durationWeeks: number) => {
    const start = new Date(now.getTime() + offsetWeeks * 7 * 86400000);
    const end = new Date(start.getTime() + durationWeeks * 7 * 86400000);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  return [
    {
      title: "Salary Hike Window",
      category: "salary",
      dateRange: makeRange(Math.floor(rng() * 8) + 2, 3),
      confidence: 70 + Math.floor(rng() * 25),
      reasoning: "Jupiter transiting your 10th house lord creates favorable conditions for career advancement and salary negotiations.",
      impact: "favorable",
    },
    {
      title: "Bonus Period",
      category: "bonus",
      dateRange: makeRange(Math.floor(rng() * 12) + 4, 2),
      confidence: 60 + Math.floor(rng() * 30),
      reasoning: "Venus conjunction with your natal Mercury in the 11th house indicates gains through recognition and rewards.",
      impact: "favorable",
    },
    {
      title: "New Income Stream",
      category: "income",
      dateRange: makeRange(Math.floor(rng() * 16) + 6, 4),
      confidence: 50 + Math.floor(rng() * 30),
      reasoning: "Rahu's transit through your 2nd house opens doors for unconventional or secondary income sources.",
      impact: rng() > 0.4 ? "favorable" : "neutral",
    },
    {
      title: "Stagnation Risk",
      category: "salary",
      dateRange: makeRange(Math.floor(rng() * 20) + 10, 6),
      confidence: 55 + Math.floor(rng() * 25),
      reasoning: "Saturn's retrograde aspect on your 10th house may slow career progress: plan finances conservatively.",
      impact: "challenging",
    },
  ];
}

export function generateTransits(details: BirthDetails): TransitInfo[] {
  const seed = hashString(details.dateOfBirth);
  const rng = seededRandom(seed);
  const impacts: Array<"favorable" | "neutral" | "challenging"> = ["favorable", "neutral", "challenging"];

  return [
    { planet: "Jupiter", sign: ZODIAC_SIGNS[Math.floor(rng() * 12)], house: 2, impact: impacts[Math.floor(rng() * 2)], description: "Expanding wealth potential and financial wisdom" },
    { planet: "Saturn", sign: ZODIAC_SIGNS[Math.floor(rng() * 12)], house: 10, impact: impacts[1 + Math.floor(rng() * 2)], description: "Structuring career growth with discipline" },
    { planet: "Venus", sign: ZODIAC_SIGNS[Math.floor(rng() * 12)], house: 11, impact: impacts[Math.floor(rng() * 2)], description: "Attracting gains through social connections" },
    { planet: "Mercury", sign: ZODIAC_SIGNS[Math.floor(rng() * 12)], house: 2, impact: impacts[Math.floor(rng() * 2)], description: "Enhancing financial intelligence and communication" },
    { planet: "Mars", sign: ZODIAC_SIGNS[Math.floor(rng() * 12)], house: 6, impact: impacts[Math.floor(rng() * 3)], description: "Driving ambition but watch for impulsive spending" },
  ];
}

export function generateRecommendation(details: BirthDetails): RecommendedAction {
  const seed = hashString(details.dateOfBirth + details.name + new Date().toDateString());
  const rng = seededRandom(seed);

  const actions: RecommendedAction[] = [
    { action: "Negotiate your salary or ask for a raise", timing: "Within the next 3 weeks", reasoning: "Jupiter's favorable transit through your 10th house creates an ideal window for career advancement discussions.", urgency: "act-now" },
    { action: "Start building a secondary income source", timing: "Begin planning this month", reasoning: "Rahu's transit through your 2nd house supports unconventional income. Consider freelancing, investments, or a side business.", urgency: "plan-ahead" },
    { action: "Consolidate savings and reduce discretionary spending", timing: "For the next 6 weeks", reasoning: "Saturn's aspect on your wealth houses suggests a period of financial discipline will yield long-term rewards.", urgency: "act-now" },
    { action: "Invest in skill development for career growth", timing: "Over the next 2 months", reasoning: "Mercury's transit supports learning. Upskilling now will position you for the upcoming Jupiter-driven growth period.", urgency: "plan-ahead" },
  ];

  return actions[Math.floor(rng() * actions.length)];
}
