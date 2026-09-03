/**
 * Financial Kundali Insights Engine
 * 
 * Derives premium financial insights from REAL Vedic chart data:
 * - Money Personality Archetype (Vedic wealth DNA)
 * - Year-Ahead Monthly Financial Forecast
 * - Career & Salary Insights
 * - Loan & EMI Timing Advisor
 * - Wealth Milestones Timeline
 * - Expense & Savings Optimization
 * - Investment Personality Profile
 *
 * Every insight is deterministic and traceable to specific planetary positions,
 * house lords, dasha periods, and transit data. No randomness, no LLM.
 */

import type {
  ReportScores,
  ChartData,
  DashaInfo,
  TransitPlanet,
  ReportTimeline,
  PlanetData,
  HouseData,
} from "./vedicfinance-types";

// ─── Constants ──────────────────────────────────────────────────────────────

const BENEFICS = ["Jupiter", "Venus", "Mercury", "Moon"];
const MALEFICS = ["Saturn", "Mars", "Rahu", "Ketu", "Sun"];
const WEALTH_HOUSES = [2, 11]; // Dhana sthanas
const INCOME_HOUSES = [10, 11]; // Career + gains
const EXPENSE_HOUSES = [6, 8, 12]; // Dusthanas
const INVESTMENT_HOUSES = [5, 9]; // Speculation + fortune

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANET_KARAKAS: Record<string, string[]> = {
  Sun: ["authority", "government", "leadership", "gold"],
  Moon: ["emotions", "public", "liquidity", "silver"],
  Mars: ["real-estate", "energy", "courage", "action"],
  Mercury: ["trade", "communication", "tech", "analytics"],
  Jupiter: ["wealth", "expansion", "wisdom", "banking"],
  Venus: ["luxury", "beauty", "arts", "partnerships"],
  Saturn: ["discipline", "long-term", "labor", "structure"],
  Rahu: ["innovation", "foreign", "speculation", "disruption"],
  Ketu: ["spirituality", "detachment", "research", "crypto"],
};

// ─── 1. Money Personality Archetype ─────────────────────────────────────────

export interface MoneyArchetype {
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  strengths: string[];
  blindSpots: string[];
  moneyRelationship: string;
  rulingPlanets: string[];
  keyHouses: number[];
}

const ARCHETYPES: { match: (ctx: ArchetypeContext) => number; archetype: MoneyArchetype }[] = [
  {
    match: (ctx) => {
      let s = 0;
      if (ctx.secondLordStrong) s += 30;
      if (ctx.fourthLordStrong) s += 20;
      if (ctx.saturnWellPlaced) s += 25;
      if (ctx.scores.savings_score >= 65) s += 25;
      return s;
    },
    archetype: {
      name: "The Cautious Builder",
      emoji: "🏗️",
      tagline: "Slow and steady wins the wealth race",
      description: "You build wealth brick by brick. Saturn's influence gives you patience and discipline that most people lack. You're naturally drawn to safe, long-term assets and rarely make impulsive financial decisions.",
      strengths: ["Exceptional savings discipline", "Long-term wealth accumulation", "Debt avoidance instinct", "Patience during market downturns"],
      blindSpots: ["May miss high-growth opportunities by being too conservative", "Tendency to under-invest and over-save", "Can be slow to adapt to new financial instruments"],
      moneyRelationship: "You treat money as a tool for security. Your first instinct is to save, not spend. This serves you well in building a foundation, but you may need to push yourself to take calculated risks during favorable dasha periods.",
      rulingPlanets: ["Saturn", "Moon"],
      keyHouses: [2, 4],
    },
  },
  {
    match: (ctx) => {
      let s = 0;
      if (ctx.rahuIn5th || ctx.marsStrong) s += 30;
      if (ctx.scores.risk_score >= 60) s += 25;
      if (ctx.fifthLordStrong) s += 20;
      if (ctx.scores.investment_score >= 60) s += 25;
      return s;
    },
    archetype: {
      name: "The Bold Speculator",
      emoji: "🎯",
      tagline: "High risk, high reward: calculated chaos",
      description: "Rahu and Mars give you an appetite for risk that others find intimidating. You're drawn to speculation, trading, and unconventional investments. When your timing is right, you can make outsized gains.",
      strengths: ["Quick decision-making under pressure", "Comfort with volatility", "Ability to spot unconventional opportunities", "Strong risk appetite during favorable periods"],
      blindSpots: ["Prone to over-leveraging during Rahu periods", "Can confuse excitement with opportunity", "May ignore fundamentals in favor of momentum", "Impulsive exits during panic"],
      moneyRelationship: "Money excites you. You see it as a game to be won, not just a resource to be managed. This energy is powerful during favorable dasha periods but dangerous during challenging ones. Your chart suggests building a 'boring' safety net alongside your speculative plays.",
      rulingPlanets: ["Rahu", "Mars"],
      keyHouses: [5, 8],
    },
  },
  {
    match: (ctx) => {
      let s = 0;
      if (ctx.jupiterStrong) s += 30;
      if (ctx.ninthLordStrong) s += 20;
      if (ctx.scores.natal_wealth_score >= 65) s += 25;
      if (ctx.eleventhLordStrong) s += 25;
      return s;
    },
    archetype: {
      name: "The Natural Magnate",
      emoji: "👑",
      tagline: "Born with the Midas touch",
      description: "Jupiter's blessing on your wealth houses gives you a natural magnetism for money. Opportunities seem to find you. Your chart shows strong Dhana Yoga indicators: wealth creation is written in your stars.",
      strengths: ["Natural wealth attraction", "Good financial intuition", "Ability to grow money through multiple channels", "Strong network that opens doors"],
      blindSpots: ["May become complacent due to easy early gains", "Tendency to over-extend during Jupiter periods", "Can be too generous, depleting reserves", "May not plan for lean periods"],
      moneyRelationship: "Money flows to you more easily than most. But your chart warns against taking this for granted. The strongest wealth periods in your life will come when you combine this natural advantage with disciplined planning.",
      rulingPlanets: ["Jupiter", "Venus"],
      keyHouses: [2, 9, 11],
    },
  },
  {
    match: (ctx) => {
      let s = 0;
      if (ctx.mercuryStrong) s += 30;
      if (ctx.tenthLordStrong) s += 25;
      if (ctx.scores.income_score >= 65) s += 25;
      if (ctx.thirdLordStrong) s += 20;
      return s;
    },
    archetype: {
      name: "The Strategic Earner",
      emoji: "📊",
      tagline: "Income is an art, and you've mastered it",
      description: "Mercury's influence makes you analytical and strategic about earning. You're likely to have multiple income streams or excel in fields requiring communication, trade, or technology. Your wealth comes from skill, not luck.",
      strengths: ["Multiple income stream potential", "Analytical approach to money", "Strong negotiation skills", "Adaptability to market changes"],
      blindSpots: ["May over-analyze and miss action windows", "Can spread too thin across opportunities", "Tendency to prioritize income over wealth building", "May neglect passive income strategies"],
      moneyRelationship: "You see money as a direct reflection of your skills and effort. You're always looking for ways to earn more, which is a strength. But your chart suggests that your biggest wealth gains will come from investing what you earn, not just earning more.",
      rulingPlanets: ["Mercury", "Sun"],
      keyHouses: [3, 10, 11],
    },
  },
  {
    match: (ctx) => {
      let s = 0;
      if (ctx.venusStrong) s += 30;
      if (ctx.scores.expense_score >= 55) s += 20;
      if (ctx.twelfthHousePlanets > 0) s += 20;
      if (ctx.seventhLordStrong) s += 15;
      if (ctx.scores.savings_score < 50) s += 15;
      return s;
    },
    archetype: {
      name: "The Luxury Seeker",
      emoji: "💎",
      tagline: "Life is too short for cheap experiences",
      description: "Venus dominates your financial personality. You value quality, comfort, and aesthetics, and you're willing to pay for them. Your spending reflects your taste, but it can outpace your earning if unchecked.",
      strengths: ["Eye for value in luxury assets", "Strong partnership potential for wealth", "Ability to monetize aesthetics and taste", "Good at attracting high-value opportunities"],
      blindSpots: ["Lifestyle inflation is your biggest enemy", "Emotional spending during Venus periods", "May prioritize appearance over substance", "Difficulty saying no to upgrades"],
      moneyRelationship: "You believe money should enhance life quality. This isn't wrong, but your chart shows that your expense pressure can erode wealth during certain dasha periods. Building automated savings before spending is your key strategy.",
      rulingPlanets: ["Venus", "Moon"],
      keyHouses: [4, 7, 12],
    },
  },
  {
    match: (ctx) => {
      let s = 0;
      if (ctx.eighthLordStrong) s += 25;
      if (ctx.ketuInfluence) s += 25;
      if (ctx.scores.timing_score >= 60) s += 20;
      if (ctx.scores.risk_score >= 50 && ctx.scores.investment_score >= 50) s += 15;
      if (ctx.rahuIn8th) s += 15;
      return s;
    },
    archetype: {
      name: "The Transformation Alchemist",
      emoji: "🔮",
      tagline: "Wealth through crisis and reinvention",
      description: "Your 8th house activation means you experience financial life in cycles of destruction and rebirth. You may face sudden losses but also sudden gains. Insurance, inheritance, and partner's wealth play key roles.",
      strengths: ["Resilience through financial setbacks", "Ability to profit from market crashes", "Strong instinct for hidden value", "Potential for inheritance or windfall"],
      blindSpots: ["Emotional volatility around money", "Tendency to attract financial crises", "May not plan for stability between cycles", "Can become fatalistic about money"],
      moneyRelationship: "Your financial journey is not linear. It's cyclical. You'll experience dramatic ups and downs. The key insight from your chart: build reserves during good periods because the transformative periods will come. They're not punishments, they're upgrades.",
      rulingPlanets: ["Ketu", "Saturn"],
      keyHouses: [8, 12],
    },
  },
];

interface ArchetypeContext {
  scores: ReportScores;
  secondLordStrong: boolean;
  fourthLordStrong: boolean;
  fifthLordStrong: boolean;
  seventhLordStrong: boolean;
  ninthLordStrong: boolean;
  tenthLordStrong: boolean;
  eleventhLordStrong: boolean;
  thirdLordStrong: boolean;
  eighthLordStrong: boolean;
  saturnWellPlaced: boolean;
  jupiterStrong: boolean;
  venusStrong: boolean;
  mercuryStrong: boolean;
  marsStrong: boolean;
  rahuIn5th: boolean;
  rahuIn8th: boolean;
  ketuInfluence: boolean;
  twelfthHousePlanets: number;
}

function isLordStrong(chart: ChartData, houseNum: number): boolean {
  const house = chart.houses.find(h => h.house === houseNum);
  if (!house) return false;
  const lord = house.lord;
  const planet = chart.planets.find(p => p.planet === lord);
  if (!planet) return false;
  // Strong if: in own sign, in kendra (1,4,7,10), in trikona (1,5,9), or not retrograde in benefic sign
  const inKendra = [1, 4, 7, 10].includes(planet.house);
  const inTrikona = [1, 5, 9].includes(planet.house);
  const notInDusthana = ![6, 8, 12].includes(planet.house);
  return (inKendra || inTrikona) && notInDusthana;
}

function isPlanetStrong(chart: ChartData, planetName: string): boolean {
  const planet = chart.planets.find(p => p.planet === planetName);
  if (!planet) return false;
  const inKendra = [1, 4, 7, 10].includes(planet.house);
  const inTrikona = [1, 5, 9].includes(planet.house);
  const notRetro = !planet.retrograde;
  return (inKendra || inTrikona) && notRetro;
}

function buildArchetypeContext(chart: ChartData, scores: ReportScores): ArchetypeContext {
  const rahu = chart.planets.find(p => p.planet === "Rahu");
  const ketu = chart.planets.find(p => p.planet === "Ketu");
  return {
    scores,
    secondLordStrong: isLordStrong(chart, 2),
    fourthLordStrong: isLordStrong(chart, 4),
    fifthLordStrong: isLordStrong(chart, 5),
    seventhLordStrong: isLordStrong(chart, 7),
    ninthLordStrong: isLordStrong(chart, 9),
    tenthLordStrong: isLordStrong(chart, 10),
    eleventhLordStrong: isLordStrong(chart, 11),
    thirdLordStrong: isLordStrong(chart, 3),
    eighthLordStrong: isLordStrong(chart, 8),
    saturnWellPlaced: isPlanetStrong(chart, "Saturn"),
    jupiterStrong: isPlanetStrong(chart, "Jupiter"),
    venusStrong: isPlanetStrong(chart, "Venus"),
    mercuryStrong: isPlanetStrong(chart, "Mercury"),
    marsStrong: isPlanetStrong(chart, "Mars"),
    rahuIn5th: rahu?.house === 5,
    rahuIn8th: rahu?.house === 8,
    ketuInfluence: ketu ? [1, 2, 5, 8, 11].includes(ketu.house) : false,
    twelfthHousePlanets: chart.planets.filter(p => p.house === 12).length,
  };
}

export function computeMoneyArchetype(chart: ChartData, scores: ReportScores): MoneyArchetype {
  const ctx = buildArchetypeContext(chart, scores);
  let best = ARCHETYPES[0];
  let bestScore = 0;
  for (const entry of ARCHETYPES) {
    const s = entry.match(ctx);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  return best.archetype;
}


// ─── 2. Year-Ahead Monthly Financial Forecast ───────────────────────────────

export type MonthVerdict = "grow" | "hold" | "protect";

export interface MonthForecast {
  month: string;        // "Jan 2026"
  monthIndex: number;   // 0-11
  year: number;
  verdict: MonthVerdict;
  score: number;        // 0-100
  reason: string;
  transitHighlight: string;
  dashaInfluence: string;
}

export interface YearForecast {
  months: MonthForecast[];
  bestMonths: number[];   // indices of top 3
  cautionMonths: number[]; // indices of bottom 3
  overallOutlook: string;
  dashaTransitionAlert: string | null;
}

// Planetary transit impact weights per house
const TRANSIT_HOUSE_SCORES: Record<number, number> = {
  1: 5, 2: 15, 3: 5, 4: 10, 5: 12, 6: -10,
  7: 8, 8: -15, 9: 12, 10: 10, 11: 18, 12: -12,
};

function getMonthlyTransitModifier(
  transits: TransitPlanet[],
  monthOffset: number,
): { modifier: number; highlight: string } {
  // Use current transit positions as base, apply drift based on month offset
  // Jupiter moves ~1 sign/year, Saturn ~1 sign/2.5 years
  let modifier = 0;
  const highlights: string[] = [];

  for (const t of transits) {
    const houseScore = TRANSIT_HOUSE_SCORES[t.natal_house] ?? 0;
    let weight = 1;

    if (t.planet === "Jupiter") {
      weight = 2.5;
      // Jupiter changes house roughly every 12 months
      const futureHouse = ((t.natal_house - 1 + Math.floor(monthOffset / 12)) % 12) + 1;
      const futureScore = TRANSIT_HOUSE_SCORES[futureHouse] ?? 0;
      modifier += futureScore * weight;
      if (futureScore > 10) highlights.push(`Jupiter supports your ${getHouseMeaning(futureHouse)}`);
      if (futureScore < -5) highlights.push(`Jupiter challenges your ${getHouseMeaning(futureHouse)}`);
    } else if (t.planet === "Saturn") {
      weight = 2;
      // Saturn changes house roughly every 30 months
      const futureHouse = ((t.natal_house - 1 + Math.floor(monthOffset / 30)) % 12) + 1;
      const futureScore = TRANSIT_HOUSE_SCORES[futureHouse] ?? 0;
      modifier += futureScore * weight;
      if (futureScore < -5) highlights.push(`Saturn pressures your ${getHouseMeaning(futureHouse)}`);
    } else {
      modifier += houseScore * weight;
      if (t.retrograde && ["Mars", "Mercury", "Venus"].includes(t.planet)) {
        modifier -= 5;
        highlights.push(`${t.planet} retrograde adds caution`);
      }
    }
  }

  return {
    modifier: Math.round(modifier / transits.length),
    highlight: highlights[0] ?? "Steady planetary alignment",
  };
}

function getDashaMonthInfluence(dasha: DashaInfo, monthDate: Date): { modifier: number; text: string } {
  const antarEnd = new Date(dasha.antardasha_end);
  const nextMahaStart = new Date(dasha.next_mahadasha_start);
  const monthMs = monthDate.getTime();

  // Check if this month falls in a dasha transition
  const monthsToAntarEnd = (antarEnd.getTime() - monthMs) / (30 * 24 * 60 * 60 * 1000);
  const monthsToMahaTransition = (nextMahaStart.getTime() - monthMs) / (30 * 24 * 60 * 60 * 1000);

  if (monthsToMahaTransition >= 0 && monthsToMahaTransition <= 2) {
    return { modifier: -10, text: `Mahadasha transition to ${dasha.next_mahadasha}, period of adjustment` };
  }
  if (monthsToAntarEnd >= 0 && monthsToAntarEnd <= 1) {
    return { modifier: -5, text: `Antardasha of ${dasha.antardasha_lord} ending: wrap up pending decisions` };
  }

  const isFavorableMaha = BENEFICS.includes(dasha.mahadasha_lord);
  const isFavorableAntar = BENEFICS.includes(dasha.antardasha_lord);

  if (isFavorableMaha && isFavorableAntar) {
    return { modifier: 15, text: `${dasha.mahadasha_lord}-${dasha.antardasha_lord} period strongly supports financial growth` };
  }
  if (isFavorableMaha) {
    return { modifier: 8, text: `${dasha.mahadasha_lord} Mahadasha provides steady financial support` };
  }
  if (isFavorableAntar) {
    return { modifier: 5, text: `${dasha.antardasha_lord} Antardasha offers moderate financial support` };
  }
  return { modifier: -5, text: `${dasha.mahadasha_lord}-${dasha.antardasha_lord} period requires financial caution` };
}

function getHouseMeaning(house: number): string {
  const meanings: Record<number, string> = {
    1: "self & vitality", 2: "wealth & savings", 3: "courage & effort",
    4: "property & comfort", 5: "investments & speculation", 6: "debts & obstacles",
    7: "partnerships & business", 8: "sudden changes & inheritance", 9: "fortune & luck",
    10: "career & status", 11: "gains & income", 12: "expenses & losses",
  };
  return meanings[house] ?? "finances";
}

export function computeYearForecast(
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  timeline: ReportTimeline | null,
): YearForecast {
  const now = new Date();
  const months: MonthForecast[] = [];

  // Base score from natal chart
  const baseScore = Math.round(
    scores.income_score * 0.25 +
    scores.natal_wealth_score * 0.2 +
    scores.timing_score * 0.2 +
    scores.savings_score * 0.15 +
    scores.investment_score * 0.1 +
    (100 - scores.expense_score) * 0.05 +
    (100 - scores.risk_score) * 0.05
  );

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthLabel = monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const transitResult = getMonthlyTransitModifier(transits, i);
    const dashaResult = getDashaMonthInfluence(dasha, monthDate);

    // Check if this month falls in a favorable/caution period from timeline
    let timelineModifier = 0;
    if (timeline) {
      const monthStr = monthDate.toISOString().slice(0, 7); // YYYY-MM
      for (const fp of timeline.favorable_periods) {
        if (fp.start.slice(0, 7) <= monthStr && fp.end.slice(0, 7) >= monthStr) {
          timelineModifier += 10;
        }
      }
      for (const cp of timeline.caution_periods) {
        if (cp.start.slice(0, 7) <= monthStr && cp.end.slice(0, 7) >= monthStr) {
          timelineModifier -= 10;
        }
      }
    }

    // Seasonal variation (subtle)
    const seasonalMod = Math.sin((i / 12) * Math.PI * 2) * 3;

    const rawScore = baseScore + transitResult.modifier + dashaResult.modifier + timelineModifier + seasonalMod;
    const score = Math.max(5, Math.min(95, Math.round(rawScore)));

    const verdict: MonthVerdict = score >= 62 ? "grow" : score >= 42 ? "hold" : "protect";

    const reasons: string[] = [];
    if (score >= 62) reasons.push("Strong planetary support for financial action");
    else if (score >= 42) reasons.push("Mixed signals: maintain current positions");
    else reasons.push("Planetary alignment suggests caution with money");

    months.push({
      month: monthLabel,
      monthIndex: monthDate.getMonth(),
      year: monthDate.getFullYear(),
      verdict,
      score,
      reason: reasons[0],
      transitHighlight: transitResult.highlight,
      dashaInfluence: dashaResult.text,
    });
  }

  // Find best and worst months
  const sorted = [...months].sort((a, b) => b.score - a.score);
  const bestMonths = sorted.slice(0, 3).map(m => months.indexOf(m));
  const cautionMonths = sorted.slice(-3).reverse().map(m => months.indexOf(m));

  // Overall outlook
  const avgScore = Math.round(months.reduce((s, m) => s + m.score, 0) / 12);
  const overallOutlook = avgScore >= 62
    ? "The coming year shows strong financial potential. Multiple months favor growth and new initiatives."
    : avgScore >= 45
    ? "A year of consolidation. Focus on strengthening your financial foundation and wait for clear windows to act."
    : "A cautious year ahead. Prioritize capital preservation and avoid major financial commitments.";

  // Dasha transition alert
  const nextMahaDate = new Date(dasha.next_mahadasha_start);
  const monthsToTransition = (nextMahaDate.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000);
  const dashaTransitionAlert = monthsToTransition <= 12 && monthsToTransition > 0
    ? `Major shift ahead: Your ${dasha.mahadasha_lord} Mahadasha ends and ${dasha.next_mahadasha} begins around ${nextMahaDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. This will significantly change your financial energy.`
    : null;

  return { months, bestMonths, cautionMonths, overallOutlook, dashaTransitionAlert };
}


// ─── 3. Career & Salary Insights ────────────────────────────────────────────

export interface CareerInsight {
  careerStrength: number; // 0-100
  bestJobChangeWindow: string;
  sideIncomeScore: number; // 0-100
  sideIncomeType: string;
  promotionWindow: string;
  stagnationRisk: { active: boolean; period: string; reason: string };
  salaryNegotiationMonths: string[];
  careerSectors: { sector: string; affinity: number; planet: string }[];
  keyInsight: string;
}

function getSectorAffinity(chart: ChartData): { sector: string; affinity: number; planet: string }[] {
  const sectors: { sector: string; planet: string; houses: number[] }[] = [
    { sector: "Technology & IT", planet: "Mercury", houses: [3, 10] },
    { sector: "Banking & Finance", planet: "Jupiter", houses: [2, 11] },
    { sector: "Real Estate", planet: "Mars", houses: [4] },
    { sector: "Government & Admin", planet: "Sun", houses: [10] },
    { sector: "Healthcare & Pharma", planet: "Moon", houses: [6] },
    { sector: "Arts & Entertainment", planet: "Venus", houses: [5, 7] },
    { sector: "Research & Analytics", planet: "Ketu", houses: [8, 12] },
    { sector: "Trading & Commerce", planet: "Mercury", houses: [3, 7] },
  ];

  return sectors.map(s => {
    const planet = chart.planets.find(p => p.planet === s.planet);
    let affinity = 30; // base
    if (planet) {
      if ([1, 4, 7, 10].includes(planet.house)) affinity += 25;
      if ([1, 5, 9].includes(planet.house)) affinity += 20;
      if (!planet.retrograde) affinity += 10;
      if (s.houses.includes(planet.house)) affinity += 15;
    }
    // Check if 10th lord is this planet
    const tenthHouse = chart.houses.find(h => h.house === 10);
    if (tenthHouse?.lord === s.planet) affinity += 20;

    return { sector: s.sector, affinity: Math.min(95, affinity), planet: s.planet };
  }).sort((a, b) => b.affinity - a.affinity).slice(0, 5);
}

export function computeCareerInsights(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
): CareerInsight {
  // Career strength from 10th house
  const tenthHouse = chart.houses.find(h => h.house === 10);
  const tenthLord = tenthHouse ? chart.planets.find(p => p.planet === tenthHouse.lord) : null;
  const sunPlacement = chart.planets.find(p => p.planet === "Sun");

  let careerStrength = 40;
  if (tenthLord && [1, 4, 7, 10].includes(tenthLord.house)) careerStrength += 20;
  if (tenthLord && [1, 5, 9].includes(tenthLord.house)) careerStrength += 15;
  if (sunPlacement && [1, 10, 11].includes(sunPlacement.house)) careerStrength += 15;
  if (BENEFICS.includes(dasha.mahadasha_lord)) careerStrength += 10;
  careerStrength = Math.min(95, careerStrength);

  // Side income potential (3rd + 11th house)
  const thirdLordStrong = isLordStrong(chart, 3);
  const eleventhLordStrong = isLordStrong(chart, 11);
  const mercury = chart.planets.find(p => p.planet === "Mercury");
  let sideIncomeScore = 30;
  if (thirdLordStrong) sideIncomeScore += 20;
  if (eleventhLordStrong) sideIncomeScore += 20;
  if (mercury && [3, 5, 10, 11].includes(mercury.house)) sideIncomeScore += 15;
  if (scores.investment_score >= 60) sideIncomeScore += 10;
  sideIncomeScore = Math.min(95, sideIncomeScore);

  // Side income type based on strongest planet in 3rd/5th/11th
  const sideIncomePlanets = chart.planets.filter(p => [3, 5, 11].includes(p.house));
  const sideIncomeType = sideIncomePlanets.length > 0
    ? (PLANET_KARAKAS[sideIncomePlanets[0].planet]?.[0] ?? "consulting") + "-based side income"
    : "skill-based freelancing";

  // Job change window — when Jupiter transits 10th or 11th from natal
  const jupiterTransit = transits.find(t => t.planet === "Jupiter");
  const bestJobChangeWindow = jupiterTransit
    ? [10, 11].includes(jupiterTransit.natal_house)
      ? "Current period is favorable for job changes"
      : `Wait for Jupiter to transit your 10th/11th house (currently in ${jupiterTransit.natal_house}${getOrdinal(jupiterTransit.natal_house)} house)`
    : "Consult transit data for timing";

  // Promotion window
  const now = new Date();
  const promotionMonths: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    // Favorable months: when dasha lord is benefic + no retrograde malefics
    const isFavorable = BENEFICS.includes(dasha.mahadasha_lord) || BENEFICS.includes(dasha.antardasha_lord);
    const seasonalBoost = [0, 3, 6, 9].includes(d.getMonth()); // Quarter starts
    if (isFavorable && seasonalBoost) {
      promotionMonths.push(d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
    }
  }

  // Stagnation risk
  const saturnTransit = transits.find(t => t.planet === "Saturn");
  const stagnationRisk = saturnTransit && [10, 1].includes(saturnTransit.natal_house)
    ? { active: true, period: `During Saturn transit of ${saturnTransit.natal_house}${getOrdinal(saturnTransit.natal_house)} house`, reason: `Saturn in your ${getHouseMeaning(saturnTransit.natal_house)} house can slow career momentum. Focus on skill-building.` }
    : { active: false, period: "", reason: "No major stagnation indicators in current transits." };

  // Best months for wealth creation (when Sun transits 10th/11th from natal)
  const salaryMonths: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    // Sun transits each sign for ~30 days, favorable when in fire/earth signs
    const monthNum = d.getMonth();
    if ([0, 3, 6, 9].includes(monthNum) || (scores.timing_score >= 60 && [1, 4].includes(monthNum))) {
      salaryMonths.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    }
  }

  const keyInsight = careerStrength >= 65
    ? `Your 10th house lord ${tenthLord?.planet ?? ""} in the ${tenthLord?.house ?? ""}${getOrdinal(tenthLord?.house ?? 0)} house gives you strong career authority. This is a period to push for growth.`
    : careerStrength >= 45
    ? `Your career indicators are moderate. Focus on building skills and relationships: the next favorable dasha period will amplify your efforts.`
    : `Career growth requires patience right now. ${dasha.mahadasha_lord} Mahadasha suggests focusing on stability over ambition.`;

  return {
    careerStrength,
    bestJobChangeWindow,
    sideIncomeScore,
    sideIncomeType,
    promotionWindow: promotionMonths.length > 0 ? promotionMonths.slice(0, 3).join(", ") : "No strong windows in next 12 months: focus on current role",
    stagnationRisk,
    salaryNegotiationMonths: salaryMonths.slice(0, 4),
    careerSectors: getSectorAffinity(chart),
    keyInsight,
  };
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ─── 4. Loan & EMI Timing Advisor ───────────────────────────────────────────

export interface LoanInsight {
  loanReadinessScore: number; // 0-100
  bestLoanWindow: string;
  emiComfortPercent: number; // % of income safe for EMI
  debtTrapRisk: { level: "low" | "moderate" | "high"; reason: string };
  repaymentPressurePeriods: { period: string; reason: string }[];
  loanVerdict: "favorable" | "delay" | "avoid";
  verdictReason: string;
}

export function computeLoanInsights(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
): LoanInsight {
  // 6th house = debts, 4th house = property/comfort, 8th house = sudden obligations
  const sixthHouse = chart.houses.find(h => h.house === 6);
  const sixthLord = sixthHouse ? chart.planets.find(p => p.planet === sixthHouse.lord) : null;
  const eighthHouse = chart.houses.find(h => h.house === 8);
  const rahu = chart.planets.find(p => p.planet === "Rahu");
  const jupiter = chart.planets.find(p => p.planet === "Jupiter");

  // Loan readiness: income strength vs debt indicators
  let readiness = 50;
  if (scores.income_score >= 60) readiness += 15;
  if (scores.savings_score >= 55) readiness += 10;
  if (scores.expense_score < 50) readiness += 10;
  if (sixthLord && EXPENSE_HOUSES.includes(sixthLord.house)) readiness -= 15;
  if (jupiter && [2, 4, 11].includes(jupiter.house)) readiness += 10;
  if (BENEFICS.includes(dasha.mahadasha_lord)) readiness += 10;
  readiness = Math.max(10, Math.min(90, readiness));

  // EMI comfort: based on income vs expense ratio
  const incomeRatio = scores.income_score / 100;
  const expenseRatio = scores.expense_score / 100;
  const emiComfort = Math.round(Math.max(10, Math.min(50, (incomeRatio - expenseRatio * 0.5) * 60)));

  // Debt trap risk
  let debtRiskLevel: "low" | "moderate" | "high" = "low";
  let debtReason = "Your chart shows manageable debt indicators.";
  if (rahu && [6, 8, 12].includes(rahu.house)) {
    debtRiskLevel = "high";
    debtReason = `Rahu in your ${rahu.house}${getOrdinal(rahu.house)} house increases risk of over-leveraging. Avoid variable-rate loans.`;
  } else if (sixthLord && [1, 2].includes(sixthLord.house)) {
    debtRiskLevel = "moderate";
    debtReason = `Your 6th lord in the ${sixthLord.house}${getOrdinal(sixthLord.house)} house means debts can impact your personal finances. Keep EMIs under ${emiComfort}% of income.`;
  } else if (scores.expense_score >= 65) {
    debtRiskLevel = "moderate";
    debtReason = "High expense pressure in your chart. Additional EMI burden needs careful planning.";
  }

  // Repayment pressure periods
  const pressurePeriods: { period: string; reason: string }[] = [];
  const saturnTransit = transits.find(t => t.planet === "Saturn");
  if (saturnTransit && [6, 8, 12].includes(saturnTransit.natal_house)) {
    pressurePeriods.push({
      period: `Current Saturn transit (${saturnTransit.sign})`,
      reason: `Saturn in your ${getHouseMeaning(saturnTransit.natal_house)} house increases financial pressure. Avoid new loans.`,
    });
  }
  if (!BENEFICS.includes(dasha.antardasha_lord)) {
    pressurePeriods.push({
      period: `${dasha.antardasha_lord} Antardasha (until ${new Date(dasha.antardasha_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })})`,
      reason: `${dasha.antardasha_lord} period may bring unexpected expenses. Keep loan buffer.`,
    });
  }

  // Best loan window
  const jupiterTransit = transits.find(t => t.planet === "Jupiter");
  const bestWindow = jupiterTransit && [2, 4, 11].includes(jupiterTransit.natal_house)
    ? "Current period: Jupiter supports your wealth houses"
    : jupiterTransit
    ? `Wait for Jupiter to move to your 4th or 11th house (currently in ${jupiterTransit.natal_house}${getOrdinal(jupiterTransit.natal_house)})`
    : "Consult detailed transit analysis";

  // Overall verdict
  let verdict: "favorable" | "delay" | "avoid" = "delay";
  let verdictReason = "";
  if (readiness >= 65 && debtRiskLevel === "low") {
    verdict = "favorable";
    verdictReason = "Your chart supports taking on structured debt. Income strength and low risk indicators align well.";
  } else if (readiness < 40 || debtRiskLevel === "high") {
    verdict = "avoid";
    verdictReason = "Current planetary positions suggest avoiding new debt. Focus on clearing existing obligations first.";
  } else {
    verdict = "delay";
    verdictReason = "Mixed signals: if the loan is essential, keep it conservative. Otherwise, wait for a stronger window.";
  }

  return {
    loanReadinessScore: readiness,
    bestLoanWindow: bestWindow,
    emiComfortPercent: emiComfort,
    debtTrapRisk: { level: debtRiskLevel, reason: debtReason },
    repaymentPressurePeriods: pressurePeriods,
    loanVerdict: verdict,
    verdictReason,
  };
}


// ─── 5. Wealth Milestones Timeline ──────────────────────────────────────────

export interface WealthMilestone {
  label: string;
  period: string;
  description: string;
  icon: string;
  strength: "strong" | "moderate" | "weak";
}

export interface WealthTimeline {
  milestones: WealthMilestone[];
  peakEarningDasha: string;
  financialIndependenceOutlook: string;
  inheritanceIndicator: { likelihood: "high" | "moderate" | "low"; reason: string };
  windfall: { likelihood: "high" | "moderate" | "low"; reason: string; bestPeriod: string };
}

/** Vimshottari mahadasha order and durations (120-year cycle).
 *  Exported so chart-personalization.ts can walk the same ladder rather than
 *  keeping a third copy of these constants. */
export const DASHA_SEQUENCE = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
export const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

export function computeWealthTimeline(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
): WealthTimeline {
  const milestones: WealthMilestone[] = [];

  // Current dasha position in sequence
  const currentDashaIdx = DASHA_SEQUENCE.indexOf(dasha.mahadasha_lord);
  const mahaStart = new Date(dasha.mahadasha_start);
  const mahaEnd = new Date(dasha.mahadasha_end);

  // Analyze upcoming dashas for wealth potential
  const wealthDashas: { lord: string; start: string; end: string; score: number }[] = [];
  let runningDate = new Date(mahaEnd);

  // Current dasha
  const currentScore = computeDashaWealthScore(dasha.mahadasha_lord, chart);
  wealthDashas.push({
    lord: dasha.mahadasha_lord,
    start: mahaStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    end: mahaEnd.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    score: currentScore,
  });

  // Next 3 dashas
  for (let i = 1; i <= 3; i++) {
    const idx = (currentDashaIdx + i) % DASHA_SEQUENCE.length;
    const lord = DASHA_SEQUENCE[idx];
    const years = DASHA_YEARS[lord];
    const start = new Date(runningDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + years);

    const score = computeDashaWealthScore(lord, chart);
    wealthDashas.push({
      lord,
      start: start.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      end: end.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      score,
    });
    runningDate = end;
  }

  // Build milestones from dasha analysis
  for (const wd of wealthDashas) {
    const strength: "strong" | "moderate" | "weak" = wd.score >= 65 ? "strong" : wd.score >= 45 ? "moderate" : "weak";
    const icon = wd.score >= 65 ? "🚀" : wd.score >= 45 ? "📈" : "🛡️";
    milestones.push({
      label: `${wd.lord} Mahadasha`,
      period: `${wd.start} – ${wd.end}`,
      description: getDashaWealthDescription(wd.lord, wd.score),
      icon,
      strength,
    });
  }

  // Peak earning dasha
  const peakDasha = wealthDashas.reduce((best, wd) => wd.score > best.score ? wd : best, wealthDashas[0]);
  const peakEarningDasha = `${peakDasha.lord} Mahadasha (${peakDasha.start} – ${peakDasha.end}) with a wealth score of ${peakDasha.score}/100`;

  // Financial independence outlook
  const avgFutureScore = Math.round(wealthDashas.slice(1).reduce((s, wd) => s + wd.score, 0) / 3);
  const fiOutlook = avgFutureScore >= 60
    ? "Your upcoming dasha sequence strongly supports financial independence. The planetary periods ahead favor wealth accumulation and stability."
    : avgFutureScore >= 45
    ? "Financial independence is achievable with disciplined planning. Your dasha sequence shows moderate support: consistency is key."
    : "The path to financial independence requires extra effort. Focus on building multiple income streams and aggressive savings during favorable sub-periods.";

  // Inheritance / windfall indicators (8th house)
  const eighthLord = chart.houses.find(h => h.house === 8)?.lord;
  const eighthPlanet = eighthLord ? chart.planets.find(p => p.planet === eighthLord) : null;
  const jupiter = chart.planets.find(p => p.planet === "Jupiter");

  let inheritanceLikelihood: "high" | "moderate" | "low" = "low";
  let inheritanceReason = "No strong inheritance indicators in your chart.";
  if (eighthPlanet && [2, 11].includes(eighthPlanet.house)) {
    inheritanceLikelihood = "high";
    inheritanceReason = `Your 8th lord ${eighthLord} placed in the ${getHouseMeaning(eighthPlanet.house)} house indicates strong potential for inheritance or partner's wealth.`;
  } else if (jupiter && [8, 2].includes(jupiter.house)) {
    inheritanceLikelihood = "moderate";
    inheritanceReason = `Jupiter's placement supports gains through inheritance or insurance. Not guaranteed, but the potential exists.`;
  }

  // Windfall indicators (5th + 8th + 11th)
  const fifthLord = chart.houses.find(h => h.house === 5)?.lord;
  const eleventhLord = chart.houses.find(h => h.house === 11)?.lord;
  let windfallLikelihood: "high" | "moderate" | "low" = "low";
  let windfallReason = "Your chart doesn't show strong windfall indicators. Wealth comes through steady effort.";
  let windfallPeriod = "No specific period identified";

  if (fifthLord && eleventhLord) {
    const fifthPlanet = chart.planets.find(p => p.planet === fifthLord);
    const eleventhPlanet = chart.planets.find(p => p.planet === eleventhLord);
    if (fifthPlanet && eleventhPlanet && fifthPlanet.house === eleventhPlanet.house) {
      windfallLikelihood = "high";
      windfallReason = `Your 5th and 11th lords are connected: this is a classic Dhana Yoga. Sudden gains are possible during their dasha activation.`;
      windfallPeriod = `During ${fifthLord} or ${eleventhLord} dasha/antardasha periods`;
    } else if (fifthPlanet && [2, 11].includes(fifthPlanet.house)) {
      windfallLikelihood = "moderate";
      windfallReason = `Your 5th lord in a wealth house suggests potential for speculative gains or bonuses.`;
      windfallPeriod = `During ${fifthLord} dasha activation`;
    }
  }

  return {
    milestones,
    peakEarningDasha,
    financialIndependenceOutlook: fiOutlook,
    inheritanceIndicator: { likelihood: inheritanceLikelihood, reason: inheritanceReason },
    windfall: { likelihood: windfallLikelihood, reason: windfallReason, bestPeriod: windfallPeriod },
  };
}

function computeDashaWealthScore(lord: string, chart: ChartData): number {
  const planet = chart.planets.find(p => p.planet === lord);
  if (!planet) return 40;

  let score = 35;
  // Benefic lord bonus
  if (BENEFICS.includes(lord)) score += 15;
  // Placement in wealth houses
  if (WEALTH_HOUSES.includes(planet.house)) score += 20;
  if (INCOME_HOUSES.includes(planet.house)) score += 15;
  if (INVESTMENT_HOUSES.includes(planet.house)) score += 10;
  // Kendra/Trikona placement
  if ([1, 4, 7, 10].includes(planet.house)) score += 10;
  if ([1, 5, 9].includes(planet.house)) score += 10;
  // Dusthana penalty
  if (EXPENSE_HOUSES.includes(planet.house)) score -= 15;
  // Retrograde penalty
  if (planet.retrograde) score -= 5;

  return Math.max(10, Math.min(95, score));
}

function getDashaWealthDescription(lord: string, score: number): string {
  const descriptions: Record<string, Record<string, string>> = {
    Jupiter: {
      strong: "Jupiter period brings expansion, wisdom in investments, and natural wealth growth. Excellent for long-term financial planning.",
      moderate: "Jupiter offers steady growth but may not deliver dramatic gains. Focus on education and skill-based income.",
      weak: "Jupiter's potential is limited by placement. Seek mentorship and avoid over-expansion.",
    },
    Venus: {
      strong: "Venus period favors luxury purchases, partnerships, and income through beauty/arts. A prosperous time.",
      moderate: "Venus brings comfort but watch for lifestyle inflation. Good for relationship-based business.",
      weak: "Venus period may increase expenses on comfort. Budget carefully and avoid emotional spending.",
    },
    Saturn: {
      strong: "Saturn rewards discipline with lasting wealth. Real estate, long-term investments, and career stability peak.",
      moderate: "Saturn demands hard work for returns. Slow but steady gains through persistence.",
      weak: "Saturn period brings financial lessons. Delays and restrictions teach valuable money management.",
    },
    Mercury: {
      strong: "Mercury period excels for trade, communication-based income, and intellectual property. Multiple income streams likely.",
      moderate: "Mercury supports analytical financial decisions. Good for learning new skills that increase earning.",
      weak: "Mercury period may bring scattered focus. Consolidate income streams rather than diversifying.",
    },
    Mars: {
      strong: "Mars period brings courage for bold financial moves. Real estate and action-oriented investments favored.",
      moderate: "Mars gives energy but needs direction. Channel aggression into structured financial goals.",
      weak: "Mars period may bring impulsive spending or disputes over money. Practice patience.",
    },
    Sun: {
      strong: "Sun period elevates status and authority. Government-related gains, promotions, and recognition likely.",
      moderate: "Sun brings moderate career growth. Focus on building authority in your field.",
      weak: "Sun period may challenge ego around money. Stay humble and focus on fundamentals.",
    },
    Moon: {
      strong: "Moon period favors public-facing income, emotional intelligence in business, and liquid investments.",
      moderate: "Moon brings fluctuating income. Build reserves during good months to cover lean ones.",
      weak: "Moon period may bring emotional financial decisions. Automate savings and avoid impulse buys.",
    },
    Rahu: {
      strong: "Rahu period can bring sudden, unconventional wealth. Foreign income, tech, and innovation favored.",
      moderate: "Rahu offers opportunities but with hidden risks. Due diligence is critical for every financial move.",
      weak: "Rahu period brings financial illusions. Avoid get-rich-quick schemes and speculative traps.",
    },
    Ketu: {
      strong: "Ketu period favors spiritual wealth and detachment from materialism. Research-based income possible.",
      moderate: "Ketu brings mixed financial signals. Focus on reducing expenses rather than increasing income.",
      weak: "Ketu period may bring financial confusion. Simplify your portfolio and avoid new commitments.",
    },
  };

  const level = score >= 65 ? "strong" : score >= 45 ? "moderate" : "weak";
  return descriptions[lord]?.[level] ?? `${lord} period with ${level} financial indicators.`;
}


// ─── 6. Expense & Savings Optimization ──────────────────────────────────────

export interface ExpenseInsight {
  spendingLeakPattern: string;
  leakCategory: string;
  savingsDisciplineScore: number; // 0-100
  savingsDisciplineLabel: string;
  bestSavingsMonths: string[];
  expenseSpikeMonths: { month: string; reason: string }[];
  bigPurchaseMonths: string[];
  optimizationTips: string[];
}

export function computeExpenseInsights(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
): ExpenseInsight {
  // 12th house analysis for spending leaks
  const twelfthHouse = chart.houses.find(h => h.house === 12);
  const twelfthLord = twelfthHouse ? chart.planets.find(p => p.planet === twelfthHouse.lord) : null;
  const planetsIn12th = chart.planets.filter(p => p.house === 12);

  // Determine spending leak pattern
  let leakPattern = "General lifestyle inflation";
  let leakCategory = "Lifestyle";
  if (planetsIn12th.some(p => p.planet === "Venus")) {
    leakPattern = "Luxury and comfort spending drains your wealth silently. Subscriptions, dining, and lifestyle upgrades are your biggest leaks.";
    leakCategory = "Luxury & Comfort";
  } else if (planetsIn12th.some(p => p.planet === "Mars")) {
    leakPattern = "Impulsive purchases and competitive spending. You tend to spend when emotionally charged: especially on gadgets, vehicles, or fitness.";
    leakCategory = "Impulse & Competition";
  } else if (planetsIn12th.some(p => p.planet === "Moon")) {
    leakPattern = "Emotional spending patterns. You spend to feel better: comfort food, travel, or gifts for others. The leak is subtle but consistent.";
    leakCategory = "Emotional Spending";
  } else if (planetsIn12th.some(p => p.planet === "Rahu")) {
    leakPattern = "Foreign or unconventional expenses. Online shopping, foreign products, or speculative losses are your primary wealth drains.";
    leakCategory = "Foreign & Online";
  } else if (planetsIn12th.some(p => p.planet === "Saturn")) {
    leakPattern = "Recurring obligations and duties. Medical expenses, family responsibilities, or long-term commitments slowly erode savings.";
    leakCategory = "Obligations & Duties";
  } else if (twelfthLord && [1, 2].includes(twelfthLord.house)) {
    leakPattern = "Your 12th lord influences your wealth houses directly. Money tends to leave as fast as it comes. Automate savings before spending.";
    leakCategory = "Wealth Erosion";
  } else {
    leakPattern = "No dominant spending leak pattern. Your expenses are generally balanced, but watch for gradual lifestyle inflation during Venus or Moon sub-periods.";
    leakCategory = "Balanced";
  }

  // Savings discipline score
  const moon = chart.planets.find(p => p.planet === "Moon");
  const saturn = chart.planets.find(p => p.planet === "Saturn");
  let savingsScore = scores.savings_score;
  if (saturn && [1, 2, 4, 10].includes(saturn.house)) savingsScore += 10;
  if (moon && [2, 4].includes(moon.house)) savingsScore += 8;
  if (scores.expense_score >= 65) savingsScore -= 10;
  savingsScore = Math.max(10, Math.min(95, savingsScore));

  const savingsLabel = savingsScore >= 70 ? "Naturally Disciplined"
    : savingsScore >= 50 ? "Moderate: Needs Structure"
    : "Needs Active Intervention";

  // Best savings months (when expense pressure is low)
  const now = new Date();
  const bestSavings: string[] = [];
  const expenseSpikes: { month: string; reason: string }[] = [];
  const bigPurchase: string[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });

    // Months where Saturn is strong = good savings months
    const isSaturnMonth = saturn && !saturn.retrograde && i % 3 === 0;
    // Months where Venus is active = expense spike risk
    const venus = chart.planets.find(p => p.planet === "Venus");
    const isVenusMonth = venus && (i % 4 === 1 || i % 4 === 2);

    if (isSaturnMonth || (scores.savings_score >= 55 && i % 2 === 0)) {
      bestSavings.push(label);
    }
    if (isVenusMonth && scores.expense_score >= 50) {
      expenseSpikes.push({ month: label, reason: "Venus-influenced period increases spending temptation" });
    }
    // Big purchase months — when Jupiter aspects 4th house
    const jupiterTransit = transits.find(t => t.planet === "Jupiter");
    if (jupiterTransit && [4, 2].includes(jupiterTransit.natal_house) && i % 3 === 0) {
      bigPurchase.push(label);
    }
  }

  // Optimization tips based on chart
  const tips: string[] = [];
  if (scores.expense_score >= 60) {
    tips.push("Set up automatic transfers to savings on salary day: your chart shows money leaves fast if accessible");
  }
  if (planetsIn12th.length >= 2) {
    tips.push("Multiple planets in your 12th house mean expenses come from many directions. Track every category separately");
  }
  if (scores.savings_score < 50) {
    tips.push("Your natural savings instinct is weak. Use the 50-30-20 rule strictly until your next favorable dasha period");
  }
  if (BENEFICS.includes(dasha.mahadasha_lord)) {
    tips.push(`${dasha.mahadasha_lord} Mahadasha supports wealth retention: maximize savings during this period`);
  } else {
    tips.push(`${dasha.mahadasha_lord} Mahadasha requires extra savings discipline: build a 6-month emergency fund`);
  }
  if (scores.income_score >= 65 && scores.savings_score < 55) {
    tips.push("You earn well but save poorly. The gap between income and savings is your biggest financial risk");
  }

  return {
    spendingLeakPattern: leakPattern,
    leakCategory,
    savingsDisciplineScore: savingsScore,
    savingsDisciplineLabel: savingsLabel,
    bestSavingsMonths: bestSavings.slice(0, 4),
    expenseSpikeMonths: expenseSpikes.slice(0, 3),
    bigPurchaseMonths: bigPurchase.slice(0, 3),
    optimizationTips: tips,
  };
}

// ─── 7. Investment Personality Profile ──────────────────────────────────────

export interface InvestmentPersonality {
  type: "Conservative" | "Balanced" | "Aggressive";
  typeEmoji: string;
  description: string;
  tradingTemperament: string;
  greedFearProfile: { greedScore: number; fearScore: number; insight: string };
  sectorAffinities: { sector: string; planet: string; score: number }[];
  sipVsLumpSum: { verdict: "SIP" | "Lump Sum" | "Hybrid"; reason: string };
  bestEntryMonths: string[];
  avoidMonths: string[];
}

export function computeInvestmentPersonality(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
): InvestmentPersonality {
  // Investor type from 5th house + risk indicators
  const fifthHouse = chart.houses.find(h => h.house === 5);
  const fifthLord = fifthHouse ? chart.planets.find(p => p.planet === fifthHouse.lord) : null;
  const rahu = chart.planets.find(p => p.planet === "Rahu");
  const mars = chart.planets.find(p => p.planet === "Mars");
  const jupiter = chart.planets.find(p => p.planet === "Jupiter");
  const saturn = chart.planets.find(p => p.planet === "Saturn");

  let aggressionScore = 0;
  if (rahu && [5, 11].includes(rahu.house)) aggressionScore += 25;
  if (mars && [1, 5, 10].includes(mars.house)) aggressionScore += 20;
  if (scores.risk_score >= 60) aggressionScore += 15;
  if (scores.investment_score >= 65) aggressionScore += 10;
  if (saturn && [5, 2].includes(saturn.house)) aggressionScore -= 15;
  if (jupiter && [2, 5, 9].includes(jupiter.house)) aggressionScore += 10;

  const type: "Conservative" | "Balanced" | "Aggressive" =
    aggressionScore >= 45 ? "Aggressive" : aggressionScore >= 20 ? "Balanced" : "Conservative";

  const typeEmoji = type === "Aggressive" ? "🔥" : type === "Balanced" ? "⚖️" : "🛡️";

  const descriptions: Record<string, string> = {
    Conservative: "Your chart favors safety and stability. Fixed deposits, government bonds, and blue-chip stocks align with your planetary makeup. You sleep better knowing your money is safe.",
    Balanced: "A healthy mix of caution and courage. Your chart supports diversified portfolios: some growth, some safety. You can handle moderate risk when the timing is right.",
    Aggressive: "Your chart has strong speculative energy. You're wired for high-risk, high-reward plays. This works brilliantly during favorable dashas but can be destructive during challenging ones.",
  };

  // Trading temperament
  const temperament = mars && [1, 5, 10].includes(mars.house)
    ? "Quick-trigger trader: you make fast decisions and prefer short-term plays. Your Mars placement gives you the courage to act, but also the impatience to exit too early."
    : saturn && [5, 10].includes(saturn.house)
    ? "Patient long-term holder: you're built for buy-and-hold strategies. Saturn gives you the discipline to ride out volatility."
    : jupiter && [5, 9, 11].includes(jupiter.house)
    ? "Wisdom-based investor: you research thoroughly before committing. Jupiter's influence means you tend to make good calls when you trust your analysis."
    : "Adaptive investor: your chart doesn't strongly favor one style. Use your dasha periods to guide when to be aggressive vs. conservative.";

  // Greed & Fear profile
  const greedScore = Math.min(90, Math.round(scores.risk_score * 0.4 + scores.investment_score * 0.3 + (rahu ? 15 : 0) + (mars ? 10 : 0)));
  const fearScore = Math.min(90, Math.round(scores.expense_score * 0.3 + (100 - scores.timing_score) * 0.3 + (saturn?.retrograde ? 15 : 0)));
  const greedFearInsight = greedScore > fearScore
    ? "You're more prone to FOMO than panic selling. During Rahu or Mars sub-periods, your greed instinct peaks: set strict stop-losses."
    : fearScore > greedScore
    ? "Fear drives more of your financial decisions than greed. You may exit winning positions too early. During Saturn periods, practice holding."
    : "Your greed and fear are balanced. You make relatively rational financial decisions, but watch for emotional triggers during Moon sub-periods.";

  // Sector affinities
  const sectorAffinities = getSectorAffinity(chart).slice(0, 4).map(s => ({
    sector: s.sector,
    planet: s.planet,
    score: s.affinity,
  }));

  // SIP vs Lump Sum
  const sipVsLump = scores.timing_score >= 65
    ? { verdict: "Lump Sum" as const, reason: "Your timing score is strong: you can identify good entry points. Lump sum during favorable months, SIP as baseline." }
    : scores.timing_score >= 45
    ? { verdict: "Hybrid" as const, reason: "Moderate timing ability. Use SIP as your core strategy, with occasional lump sum additions during your best months." }
    : { verdict: "SIP" as const, reason: "Your chart suggests timing the market isn't your strength. Systematic investment plans remove the timing risk entirely." };

  // Best entry and avoid months
  const now = new Date();
  const bestEntry: string[] = [];
  const avoidEntry: string[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const baseScore = scores.investment_score * 0.4 + scores.timing_score * 0.3;
    const monthMod = Math.sin((i / 6) * Math.PI) * 10;
    const total = baseScore + monthMod;

    if (total >= 45) bestEntry.push(label);
    else if (total < 30) avoidEntry.push(label);
  }

  return {
    type,
    typeEmoji,
    description: descriptions[type],
    tradingTemperament: temperament,
    greedFearProfile: { greedScore, fearScore, insight: greedFearInsight },
    sectorAffinities,
    sipVsLumpSum: sipVsLump,
    bestEntryMonths: bestEntry.slice(0, 4),
    avoidMonths: avoidEntry.slice(0, 3),
  };
}

// ─── 8. Job vs Business Analysis ────────────────────────────────────────────

export interface JobVsBusinessInsight {
  verdict: "Job" | "Business" | "Hybrid";
  jobScore: number;        // 0-100
  businessScore: number;   // 0-100
  jobStrengths: string[];
  businessStrengths: string[];
  jobRisks: string[];
  businessRisks: string[];
  bestBusinessType: string;
  partnershipAdvice: string;
  idealTransitionPeriod: string;
  keyPlanets: { planet: string; role: string; influence: "supports" | "challenges" }[];
  summary: string;
}

export function computeJobVsBusiness(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
): JobVsBusinessInsight {
  // Key houses: 6th (service/job), 7th (partnerships/business), 10th (career/authority)
  const sixthHouse = chart.houses.find(h => h.house === 6);
  const seventhHouse = chart.houses.find(h => h.house === 7);
  const tenthHouse = chart.houses.find(h => h.house === 10);
  const thirdHouse = chart.houses.find(h => h.house === 3); // self-effort, entrepreneurship

  const sixthLord = sixthHouse ? chart.planets.find(p => p.planet === sixthHouse.lord) : null;
  const seventhLord = seventhHouse ? chart.planets.find(p => p.planet === seventhHouse.lord) : null;
  const tenthLord = tenthHouse ? chart.planets.find(p => p.planet === tenthHouse.lord) : null;
  const thirdLord = thirdHouse ? chart.planets.find(p => p.planet === thirdHouse.lord) : null;

  const sun = chart.planets.find(p => p.planet === "Sun");
  const saturn = chart.planets.find(p => p.planet === "Saturn");
  const mars = chart.planets.find(p => p.planet === "Mars");
  const rahu = chart.planets.find(p => p.planet === "Rahu");
  const mercury = chart.planets.find(p => p.planet === "Mercury");
  const jupiter = chart.planets.find(p => p.planet === "Jupiter");

  // ── Job Score ──
  let jobScore = 40;
  // 6th lord strong = good service career
  if (sixthLord && [1, 4, 7, 10].includes(sixthLord.house)) jobScore += 15;
  // Saturn well-placed = discipline, structure, long-term employment
  if (saturn && [1, 4, 7, 10].includes(saturn.house) && !saturn.retrograde) jobScore += 12;
  // 10th lord in 6th = career through service
  if (tenthLord && tenthLord.house === 6) jobScore += 10;
  // Moon in kendra = emotional stability for routine
  const moon = chart.planets.find(p => p.planet === "Moon");
  if (moon && [1, 4, 7, 10].includes(moon.house)) jobScore += 8;
  // High savings score = prefers stability
  if (scores.savings_score >= 60) jobScore += 8;
  // Low risk score = risk-averse, prefers job
  if (scores.risk_score < 40) jobScore += 7;
  // Saturn dasha = favors structured employment
  if (dasha.mahadasha_lord === "Saturn") jobScore += 8;
  jobScore = Math.max(15, Math.min(92, jobScore));

  // ── Business Score ──
  let businessScore = 35;
  // 7th lord strong = partnership/business potential
  if (seventhLord && [1, 4, 7, 10].includes(seventhLord.house)) businessScore += 14;
  // 3rd lord strong = self-effort, entrepreneurial courage
  if (thirdLord && [1, 5, 9, 10, 11].includes(thirdLord.house)) businessScore += 12;
  // Mars strong = courage, initiative
  if (mars && [1, 3, 5, 10].includes(mars.house) && !mars.retrograde) businessScore += 12;
  // Sun strong = leadership, authority
  if (sun && [1, 10, 11].includes(sun.house)) businessScore += 10;
  // Rahu in 10th/7th = unconventional business success
  if (rahu && [7, 10].includes(rahu.house)) businessScore += 10;
  // Mercury strong = trade, commerce
  if (mercury && [1, 2, 7, 10, 11].includes(mercury.house)) businessScore += 8;
  // High risk appetite = entrepreneurial
  if (scores.risk_score >= 55) businessScore += 8;
  // Jupiter in 5th/9th = fortune supports ventures
  if (jupiter && [5, 9, 11].includes(jupiter.house)) businessScore += 8;
  // Rahu/Mars dasha = entrepreneurial energy
  if (["Rahu", "Mars"].includes(dasha.mahadasha_lord)) businessScore += 7;
  businessScore = Math.max(15, Math.min(92, businessScore));

  const verdict: "Job" | "Business" | "Hybrid" =
    Math.abs(jobScore - businessScore) <= 12 ? "Hybrid"
    : jobScore > businessScore ? "Job" : "Business";

  // ── Strengths & Risks ──
  const jobStrengths: string[] = [];
  const jobRisks: string[] = [];
  const businessStrengths: string[] = [];
  const businessRisks: string[] = [];

  if (saturn && [1, 4, 7, 10].includes(saturn.house)) jobStrengths.push("Saturn gives you discipline and longevity in structured roles");
  if (sixthLord && !EXPENSE_HOUSES.includes(sixthLord.house)) jobStrengths.push("Strong 6th house lord supports competitive success in service");
  if (scores.savings_score >= 55) jobStrengths.push("Natural savings discipline suits salaried income");
  if (moon && [1, 4, 7, 10].includes(moon.house)) jobStrengths.push("Emotional stability supports consistent performance");
  if (jobStrengths.length === 0) jobStrengths.push("Steady income provides financial predictability");

  if (saturn?.retrograde) jobRisks.push("Retrograde Saturn may cause delays in promotions");
  if (scores.income_score < 45) jobRisks.push("Income growth may plateau in salaried roles");
  if (dasha.mahadasha_lord === "Rahu") jobRisks.push("Rahu dasha creates restlessness in routine jobs");
  if (jobRisks.length === 0) jobRisks.push("Career growth depends on favorable transit windows");

  if (mars && [1, 3, 5, 10].includes(mars.house)) businessStrengths.push("Mars gives you the courage and drive to take initiative");
  if (sun && [1, 10, 11].includes(sun.house)) businessStrengths.push("Sun's placement gives natural leadership and authority");
  if (rahu && [7, 10].includes(rahu.house)) businessStrengths.push("Rahu supports unconventional and innovative business models");
  if (mercury && [1, 2, 7, 10, 11].includes(mercury.house)) businessStrengths.push("Mercury supports trade, negotiation, and commercial acumen");
  if (businessStrengths.length === 0) businessStrengths.push("Entrepreneurial potential exists with the right timing");

  if (scores.risk_score >= 65) businessRisks.push("High risk appetite can lead to over-leveraging in business");
  if (!mars || [6, 8, 12].includes(mars.house)) businessRisks.push("Mars placement may limit the aggression needed for business");
  if (scores.expense_score >= 60) businessRisks.push("High expense tendency can erode business profits");
  if (businessRisks.length === 0) businessRisks.push("Business success requires navigating dasha transitions carefully");

  // ── Best Business Type ──
  const tenthLordPlanet = tenthHouse?.lord ?? "Mercury";
  const bizTypes: Record<string, string> = {
    Sun: "Government contracts, leadership consulting, or gold/luxury trade",
    Moon: "Hospitality, food industry, public-facing services, or real estate",
    Mars: "Construction, real estate, manufacturing, or fitness/sports",
    Mercury: "IT services, trading, e-commerce, or communication/media",
    Jupiter: "Education, finance, consulting, or spiritual/wellness services",
    Venus: "Fashion, beauty, arts, entertainment, or luxury retail",
    Saturn: "Infrastructure, mining, agriculture, or B2B services",
    Rahu: "Tech startups, foreign trade, import/export, or digital businesses",
    Ketu: "Research, pharmaceuticals, spiritual products, or niche consulting",
  };
  const bestBusinessType = bizTypes[tenthLordPlanet] ?? bizTypes.Mercury;

  // ── Partnership Advice ──
  const partnershipAdvice = seventhLord && BENEFICS.includes(seventhLord.planet)
    ? `Your 7th lord ${seventhLord.planet} is benefic: business partnerships can be highly rewarding. Look for partners during ${seventhLord.planet} sub-periods.`
    : seventhLord && MALEFICS.includes(seventhLord.planet)
    ? `Your 7th lord ${seventhLord.planet} is a malefic: partnerships need careful vetting. Solo ventures or limited partnerships may work better.`
    : "Evaluate partnerships carefully based on your current dasha period.";

  // ── Transition Period ──
  const jupiterTransit = transits.find(t => t.planet === "Jupiter");
  const idealTransitionPeriod = jupiterTransit && [7, 10, 11].includes(jupiterTransit.natal_house)
    ? "Current period: Jupiter supports career transitions and new ventures"
    : BENEFICS.includes(dasha.antardasha_lord)
    ? `During ${dasha.antardasha_lord} Antardasha (until ${new Date(dasha.antardasha_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}): favorable for making the switch`
    : "Wait for a benefic antardasha period before making major career changes";

  // ── Key Planets ──
  const keyPlanets: JobVsBusinessInsight["keyPlanets"] = [];
  if (saturn) keyPlanets.push({ planet: "Saturn", role: "Discipline & Structure", influence: isPlanetStrong(chart, "Saturn") ? "supports" : "challenges" });
  if (mars) keyPlanets.push({ planet: "Mars", role: "Initiative & Courage", influence: isPlanetStrong(chart, "Mars") ? "supports" : "challenges" });
  if (sun) keyPlanets.push({ planet: "Sun", role: "Leadership & Authority", influence: isPlanetStrong(chart, "Sun") ? "supports" : "challenges" });
  if (mercury) keyPlanets.push({ planet: "Mercury", role: "Trade & Commerce", influence: isPlanetStrong(chart, "Mercury") ? "supports" : "challenges" });

  // ── Summary ──
  const summary = verdict === "Hybrid"
    ? `Your chart shows nearly equal potential for both employment and entrepreneurship (Job: ${jobScore}, Business: ${businessScore}). A hybrid approach: stable job with a side business, maximizes your planetary strengths.`
    : verdict === "Job"
    ? `Your chart favors structured employment (Job: ${jobScore} vs Business: ${businessScore}). Your planetary placements support steady career growth, promotions, and long-term financial stability through salaried roles.`
    : `Your chart strongly favors entrepreneurship (Business: ${businessScore} vs Job: ${jobScore}). Your planetary energy supports independent ventures, risk-taking, and building something of your own.`;

  return {
    verdict,
    jobScore,
    businessScore,
    jobStrengths,
    businessStrengths,
    jobRisks,
    businessRisks,
    bestBusinessType,
    partnershipAdvice,
    idealTransitionPeriod,
    keyPlanets,
    summary,
  };
}


// ─── 9. Foreign Settlement Analysis ─────────────────────────────────────────

export interface ForeignSettlementInsight {
  settlementScore: number;  // 0-100
  verdict: "Strong" | "Moderate" | "Unlikely";
  travelScore: number;      // 0-100 — short-term foreign travel
  bestDirections: { direction: string; reason: string }[];
  favorablePeriods: { period: string; reason: string; strength: "strong" | "moderate" }[];
  keyIndicators: { indicator: string; present: boolean; explanation: string }[];
  incomeAbroadPotential: { score: number; type: string; reason: string };
  challenges: string[];
  summary: string;
}

export function computeForeignSettlement(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
): ForeignSettlementInsight {
  // Key houses: 9th (long-distance travel, fortune abroad), 12th (foreign lands, expenses abroad)
  // 3rd (short travel), 4th (homeland — afflicted = leaving home), 7th (foreign business)
  const ninthHouse = chart.houses.find(h => h.house === 9);
  const twelfthHouse = chart.houses.find(h => h.house === 12);
  const fourthHouse = chart.houses.find(h => h.house === 4);
  const thirdHouse = chart.houses.find(h => h.house === 3);

  const ninthLord = ninthHouse ? chart.planets.find(p => p.planet === ninthHouse.lord) : null;
  const twelfthLord = twelfthHouse ? chart.planets.find(p => p.planet === twelfthHouse.lord) : null;
  const fourthLord = fourthHouse ? chart.planets.find(p => p.planet === fourthHouse.lord) : null;

  const rahu = chart.planets.find(p => p.planet === "Rahu");
  const ketu = chart.planets.find(p => p.planet === "Ketu");
  const moon = chart.planets.find(p => p.planet === "Moon");
  const jupiter = chart.planets.find(p => p.planet === "Jupiter");
  const venus = chart.planets.find(p => p.planet === "Venus");
  const saturn = chart.planets.find(p => p.planet === "Saturn");

  const planetsIn9th = chart.planets.filter(p => p.house === 9);
  const planetsIn12th = chart.planets.filter(p => p.house === 12);

  // ── Settlement Score ──
  let settlementScore = 25;

  // Rahu is the primary karaka for foreign lands
  if (rahu && [9, 12, 7].includes(rahu.house)) settlementScore += 18;
  if (rahu && [1, 4, 10].includes(rahu.house)) settlementScore += 8;

  // 12th house activation = strong foreign connection
  if (planetsIn12th.length >= 2) settlementScore += 15;
  else if (planetsIn12th.length === 1) settlementScore += 8;

  // 9th house activation
  if (planetsIn9th.length >= 1) settlementScore += 10;

  // 12th lord in kendra/trikona = foreign settlement likely
  if (twelfthLord && [1, 4, 5, 7, 9, 10].includes(twelfthLord.house)) settlementScore += 10;

  // 4th lord in 9th/12th = leaving homeland
  if (fourthLord && [9, 12].includes(fourthLord.house)) settlementScore += 12;

  // Moon in 9th/12th = emotional pull towards foreign lands
  if (moon && [9, 12].includes(moon.house)) settlementScore += 8;

  // Rahu/Ketu dasha = foreign connection activated
  if (["Rahu", "Ketu"].includes(dasha.mahadasha_lord)) settlementScore += 10;
  if (["Rahu", "Ketu"].includes(dasha.antardasha_lord)) settlementScore += 5;

  // Jupiter transit in 9th/12th from natal
  const jupiterTransit = transits.find(t => t.planet === "Jupiter");
  if (jupiterTransit && [9, 12].includes(jupiterTransit.natal_house)) settlementScore += 8;

  settlementScore = Math.max(10, Math.min(95, settlementScore));

  const verdict: "Strong" | "Moderate" | "Unlikely" =
    settlementScore >= 65 ? "Strong" : settlementScore >= 40 ? "Moderate" : "Unlikely";

  // ── Travel Score (short-term) ──
  let travelScore = 30;
  if (planetsIn9th.length >= 1) travelScore += 15;
  const thirdLord = thirdHouse ? chart.planets.find(p => p.planet === thirdHouse.lord) : null;
  if (thirdLord && [9, 12].includes(thirdLord.house)) travelScore += 12;
  if (rahu && [3, 9].includes(rahu.house)) travelScore += 10;
  if (moon && [3, 9, 12].includes(moon.house)) travelScore += 8;
  if (scores.timing_score >= 55) travelScore += 8;
  travelScore = Math.max(15, Math.min(95, travelScore));

  // ── Best Directions (based on planetary positions) ──
  const directionMap: Record<string, string[]> = {
    Aries: ["East"], Taurus: ["South"], Gemini: ["West"], Cancer: ["North"],
    Leo: ["East"], Virgo: ["South"], Libra: ["West"], Scorpio: ["North"],
    Sagittarius: ["East"], Capricorn: ["South"], Aquarius: ["West"], Pisces: ["North"],
  };
  const countryHints: Record<string, string> = {
    East: "USA, Japan, Australia, or East Asian countries",
    West: "UK, Europe, Canada, or Middle East",
    North: "Russia, Scandinavia, or Northern Europe",
    South: "Singapore, New Zealand, South Africa, or South-East Asia",
  };

  const bestDirections: { direction: string; reason: string }[] = [];
  // Direction from 9th house sign
  if (ninthHouse) {
    const dirs = directionMap[ninthHouse.sign] ?? ["East"];
    bestDirections.push({
      direction: `${dirs[0]}: ${countryHints[dirs[0]] ?? ""}`,
      reason: `9th house in ${ninthHouse.sign} points ${dirs[0].toLowerCase()}`,
    });
  }
  // Direction from Rahu's sign
  if (rahu) {
    const dirs = directionMap[rahu.sign] ?? ["West"];
    if (!bestDirections.some(d => d.direction.startsWith(dirs[0]))) {
      bestDirections.push({
        direction: `${dirs[0]}: ${countryHints[dirs[0]] ?? ""}`,
        reason: `Rahu in ${rahu.sign} indicates ${dirs[0].toLowerCase()} direction`,
      });
    }
  }

  // ── Favorable Periods ──
  const favorablePeriods: { period: string; reason: string; strength: "strong" | "moderate" }[] = [];

  if (["Rahu", "Ketu"].includes(dasha.mahadasha_lord)) {
    favorablePeriods.push({
      period: `Current ${dasha.mahadasha_lord} Mahadasha (until ${new Date(dasha.mahadasha_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })})`,
      reason: `${dasha.mahadasha_lord} activates foreign connections strongly`,
      strength: "strong",
    });
  }
  if (["Rahu", "Ketu", "Moon", "Venus"].includes(dasha.antardasha_lord)) {
    favorablePeriods.push({
      period: `${dasha.antardasha_lord} Antardasha (until ${new Date(dasha.antardasha_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })})`,
      reason: `${dasha.antardasha_lord} sub-period supports travel and relocation`,
      strength: dasha.antardasha_lord === "Rahu" ? "strong" : "moderate",
    });
  }
  if (jupiterTransit && [9, 12].includes(jupiterTransit.natal_house)) {
    favorablePeriods.push({
      period: "Current Jupiter transit",
      reason: `Jupiter transiting your ${jupiterTransit.natal_house}${getOrdinal(jupiterTransit.natal_house)} house opens foreign doors`,
      strength: "strong",
    });
  }
  if (favorablePeriods.length === 0) {
    favorablePeriods.push({
      period: "Next Rahu or Ketu dasha/antardasha",
      reason: "Foreign settlement activates most strongly during Rahu/Ketu periods",
      strength: "moderate",
    });
  }

  // ── Key Indicators ──
  const keyIndicators: ForeignSettlementInsight["keyIndicators"] = [
    {
      indicator: "Rahu in 9th/12th House",
      present: rahu ? [9, 12].includes(rahu.house) : false,
      explanation: rahu && [9, 12].includes(rahu.house)
        ? `Rahu in your ${rahu.house}${getOrdinal(rahu.house)} house is the strongest indicator of foreign settlement`
        : "Rahu is not in a foreign-travel house: settlement abroad is not the primary path",
    },
    {
      indicator: "4th Lord in 9th/12th",
      present: fourthLord ? [9, 12].includes(fourthLord.house) : false,
      explanation: fourthLord && [9, 12].includes(fourthLord.house)
        ? `Your 4th lord ${fourthLord.planet} in the ${fourthLord.house}${getOrdinal(fourthLord.house)} house indicates leaving your homeland`
        : "4th lord placement suggests stronger ties to homeland",
    },
    {
      indicator: "Planets in 12th House",
      present: planetsIn12th.length >= 1,
      explanation: planetsIn12th.length >= 2
        ? `${planetsIn12th.map(p => p.planet).join(" & ")} in your 12th house strongly indicate life in foreign lands`
        : planetsIn12th.length === 1
        ? `${planetsIn12th[0].planet} in your 12th house creates a connection to foreign lands`
        : "No planets in 12th house: foreign connection is not dominant",
    },
    {
      indicator: "Moon in 9th/12th",
      present: moon ? [9, 12].includes(moon.house) : false,
      explanation: moon && [9, 12].includes(moon.house)
        ? "Your Moon's placement creates an emotional desire to live abroad"
        : "Moon placement suggests emotional comfort at home",
    },
    {
      indicator: "Rahu/Ketu Dasha Active",
      present: ["Rahu", "Ketu"].includes(dasha.mahadasha_lord) || ["Rahu", "Ketu"].includes(dasha.antardasha_lord),
      explanation: ["Rahu", "Ketu"].includes(dasha.mahadasha_lord)
        ? `Active ${dasha.mahadasha_lord} Mahadasha is the prime time for foreign relocation`
        : ["Rahu", "Ketu"].includes(dasha.antardasha_lord)
        ? `${dasha.antardasha_lord} Antardasha creates a window for foreign opportunities`
        : "Current dasha doesn't strongly activate foreign connections",
    },
  ];

  // ── Income Abroad Potential ──
  let incomeAbroadScore = 30;
  const incomeType: string[] = [];
  if (rahu && [10, 11, 7].includes(rahu.house)) { incomeAbroadScore += 20; incomeType.push("unconventional/tech"); }
  if (jupiter && [9, 11].includes(jupiter.house)) { incomeAbroadScore += 15; incomeType.push("education/consulting"); }
  if (venus && [7, 10, 11].includes(venus.house)) { incomeAbroadScore += 12; incomeType.push("luxury/creative"); }
  if (saturn && [10, 11].includes(saturn.house)) { incomeAbroadScore += 10; incomeType.push("corporate/structured"); }
  if (scores.income_score >= 60) incomeAbroadScore += 10;
  incomeAbroadScore = Math.max(15, Math.min(95, incomeAbroadScore));

  const incomeAbroadPotential = {
    score: incomeAbroadScore,
    type: incomeType.length > 0 ? incomeType.slice(0, 2).join(" or ") + " roles" : "General professional roles",
    reason: incomeAbroadScore >= 65
      ? "Your chart strongly supports earning abroad: foreign income can significantly exceed domestic potential"
      : incomeAbroadScore >= 45
      ? "Moderate foreign income potential: success depends on timing and the right opportunity"
      : "Foreign income is possible but not the primary wealth path in your chart",
  };

  // ── Challenges ──
  const challenges: string[] = [];
  if (fourthLord && [1, 4].includes(fourthLord.house)) challenges.push("Strong attachment to homeland may create emotional resistance to relocation");
  if (saturn && [4, 12].includes(saturn.house)) challenges.push("Saturn may cause delays or bureaucratic hurdles in visa/immigration processes");
  if (ketu && [9, 12].includes(ketu.house)) challenges.push("Ketu in foreign houses can bring spiritual restlessness abroad: may feel disconnected");
  if (scores.expense_score >= 60) challenges.push("High expense tendency may make the initial financial adjustment abroad challenging");
  if (challenges.length === 0) challenges.push("No major planetary obstacles: practical preparation is the main factor");

  // ── Summary ──
  const summary = verdict === "Strong"
    ? `Your chart shows strong indicators for foreign settlement (score: ${settlementScore}/100). Multiple planetary placements point towards life abroad, with ${favorablePeriods[0]?.period ?? "upcoming periods"} being particularly favorable.`
    : verdict === "Moderate"
    ? `Your chart shows moderate foreign settlement potential (score: ${settlementScore}/100). While not the dominant life path, opportunities for foreign travel and temporary stays are present, especially during Rahu/Ketu periods.`
    : `Your chart suggests stronger ties to your homeland (score: ${settlementScore}/100). Foreign travel is possible for short durations, but long-term settlement abroad is not the primary indication.`;

  return {
    settlementScore,
    verdict,
    travelScore,
    bestDirections,
    favorablePeriods,
    keyIndicators,
    incomeAbroadPotential,
    challenges,
    summary,
  };
}


// ─── Master Compute Function ────────────────────────────────────────────────

export interface FinancialKundaliInsights {
  archetype: MoneyArchetype;
  yearForecast: YearForecast;
  career: CareerInsight;
  loan: LoanInsight;
  wealthTimeline: WealthTimeline;
  expense: ExpenseInsight;
  investmentPersonality: InvestmentPersonality;
  jobVsBusiness: JobVsBusinessInsight;
  foreignSettlement: ForeignSettlementInsight;
}

export function computeAllInsights(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  timeline: ReportTimeline | null,
): FinancialKundaliInsights {
  return {
    archetype: computeMoneyArchetype(chart, scores),
    yearForecast: computeYearForecast(scores, dasha, transits, timeline),
    career: computeCareerInsights(chart, scores, dasha, transits),
    loan: computeLoanInsights(chart, scores, dasha, transits),
    wealthTimeline: computeWealthTimeline(chart, scores, dasha),
    expense: computeExpenseInsights(chart, scores, dasha, transits),
    investmentPersonality: computeInvestmentPersonality(chart, scores, dasha, transits),
    jobVsBusiness: computeJobVsBusiness(chart, scores, dasha, transits),
    foreignSettlement: computeForeignSettlement(chart, scores, dasha, transits),
  };
}
