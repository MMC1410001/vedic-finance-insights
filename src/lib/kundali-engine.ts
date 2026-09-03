// Kundali (Birth Chart) Engine for Financial Analysis
import type { BirthDetails } from "./astro-engine";

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const PLANETS = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"];
const PLANET_NAMES: Record<string, string> = {
  Su: "Sun", Mo: "Moon", Ma: "Mars", Me: "Mercury",
  Ju: "Jupiter", Ve: "Venus", Sa: "Saturn", Ra: "Rahu", Ke: "Ketu"
};

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0;
  }
  return Math.abs(hash);
}

export interface KundaliPlanet {
  abbr: string;
  name: string;
  house: number;
  sign: string;
  degree: number;
  isRetrograde: boolean;
}

export interface HouseData {
  house: number;
  sign: string;
  planets: KundaliPlanet[];
  strength: "strong" | "moderate" | "weak";
}

export interface FinancialHouseInsight {
  houseNumber: number;
  houseName: string;
  strength: "strong" | "moderate" | "weak";
  wealthScore: number; // 1-10
  planets: KundaliPlanet[];
  incomePattern: string;
  spendingBehavior: string;
  savingsAbility: string;
  assetPotential: string;
  guidance: string[];
  transitImpact: string;
}

export interface KundaliChart {
  houses: HouseData[];
  planets: KundaliPlanet[];
  ascendantSign: string;
  financialHouses: FinancialHouseInsight[];
  overallWealthScore: number;
  radarData: { axis: string; value: number }[];
}

const INCOME_PATTERNS = [
  "Income grows steadily over time with consistent effort",
  "Multiple income streams develop naturally over career",
  "Income tends to arrive in large, periodic bursts",
  "Slow initial growth followed by exponential acceleration",
  "Steady earnings with occasional windfall gains",
];

const SPENDING_BEHAVIORS = [
  "Tendency to spend on comfort and lifestyle upgrades",
  "Naturally frugal with occasional splurge tendencies",
  "Balanced spending with strong budgeting instincts",
  "Generous spending on experiences and relationships",
  "Conservative spending with focus on quality over quantity",
];

const SAVINGS_ABILITIES = [
  "Strong ability to accumulate wealth if disciplined",
  "Natural saver with good instinct for value preservation",
  "Moderate savings ability: needs structured approach",
  "Excellent long-term wealth building potential",
  "Savings improve significantly after age 30",
];

const ASSET_POTENTIALS = [
  "Strong potential for real estate and tangible assets",
  "Financial instruments and equity yield best returns",
  "Gold and precious metals align with your chart",
  "Diversified portfolio approach yields optimal results",
  "Property and land investments strongly favored",
];

const GUIDANCES = [
  "Focus on long-term investments over short-term gains",
  "Avoid impulsive luxury spending during transit periods",
  "Build consistent saving habits: automate contributions",
  "Consider real estate investments during favorable windows",
  "Diversify income sources to leverage multiple house strengths",
  "Maintain an emergency fund of 6+ months expenses",
  "Review and rebalance portfolio quarterly",
  "Avoid financial decisions during retrograde periods",
];

const TRANSIT_IMPACTS = [
  "Current phase supports steady income growth and accumulation",
  "Favorable window for new investments and asset acquisition",
  "Caution advised: avoid major financial commitments this month",
  "Strong period for career-driven income increases",
  "Consolidation phase: focus on preserving existing wealth",
];

export function generateKundali(details: BirthDetails): KundaliChart {
  const seed = hashString(details.dateOfBirth + details.timeOfBirth + details.placeOfBirth + "kundali");
  const rng = seededRandom(seed);

  const ascIdx = Math.floor(rng() * 12);

  // Place planets in houses
  const planets: KundaliPlanet[] = PLANETS.map((abbr) => {
    const house = Math.floor(rng() * 12) + 1;
    const signIdx = (ascIdx + house - 1) % 12;
    return {
      abbr,
      name: PLANET_NAMES[abbr],
      house,
      sign: ZODIAC_SIGNS[signIdx],
      degree: Math.floor(rng() * 30),
      isRetrograde: abbr !== "Su" && abbr !== "Mo" && rng() > 0.7,
    };
  });

  // Build houses
  const strengths: Array<"strong" | "moderate" | "weak"> = ["strong", "moderate", "weak"];
  const houses: HouseData[] = Array.from({ length: 12 }, (_, i) => {
    const houseNum = i + 1;
    const signIdx = (ascIdx + i) % 12;
    const housePlanets = planets.filter((p) => p.house === houseNum);
    const strengthIdx = housePlanets.length >= 2 ? 0 : housePlanets.length === 1 ? (rng() > 0.4 ? 0 : 1) : (rng() > 0.3 ? 1 : 2);
    return {
      house: houseNum,
      sign: ZODIAC_SIGNS[signIdx],
      planets: housePlanets,
      strength: strengths[strengthIdx],
    };
  });

  // Financial houses: 2nd (Wealth), 1st (Self), 10th (Career), 11th (Gains)
  const financialHouseNums = [
    { num: 2, name: "Wealth & Income" },
    { num: 1, name: "Personality & Self" },
    { num: 10, name: "Career & Status" },
    { num: 11, name: "Gains & Aspirations" },
  ];

  const financialHouses: FinancialHouseInsight[] = financialHouseNums.map(({ num, name }) => {
    const house = houses[num - 1];
    const wealthScore = house.strength === "strong" ? 7 + Math.floor(rng() * 3) + 1
      : house.strength === "moderate" ? 4 + Math.floor(rng() * 3) + 1
      : 1 + Math.floor(rng() * 4);

    const guidanceCount = 2 + Math.floor(rng() * 2);
    const shuffled = [...GUIDANCES].sort(() => rng() - 0.5);

    return {
      houseNumber: num,
      houseName: name,
      strength: house.strength,
      wealthScore: Math.min(10, wealthScore),
      planets: house.planets,
      incomePattern: INCOME_PATTERNS[Math.floor(rng() * INCOME_PATTERNS.length)],
      spendingBehavior: SPENDING_BEHAVIORS[Math.floor(rng() * SPENDING_BEHAVIORS.length)],
      savingsAbility: SAVINGS_ABILITIES[Math.floor(rng() * SAVINGS_ABILITIES.length)],
      assetPotential: ASSET_POTENTIALS[Math.floor(rng() * ASSET_POTENTIALS.length)],
      guidance: shuffled.slice(0, guidanceCount),
      transitImpact: TRANSIT_IMPACTS[Math.floor(rng() * TRANSIT_IMPACTS.length)],
    };
  });

  const overallWealthScore = Math.round(
    financialHouses.reduce((sum, h) => sum + h.wealthScore, 0) / financialHouses.length
  );

  const radarData = [
    { axis: "Income", value: financialHouses[0].wealthScore * 10 },
    { axis: "Savings", value: Math.floor(rng() * 40) + 50 },
    { axis: "Assets", value: Math.floor(rng() * 40) + 40 },
    { axis: "Career", value: financialHouses[2].wealthScore * 10 },
    { axis: "Gains", value: financialHouses[3].wealthScore * 10 },
    { axis: "Stability", value: Math.floor(rng() * 30) + 55 },
  ];

  return {
    houses,
    planets,
    ascendantSign: ZODIAC_SIGNS[ascIdx],
    financialHouses,
    overallWealthScore,
    radarData,
  };
}
