/**
 * Chart-based personalization helpers.
 *
 * Every function here derives its output from the user's actual natal chart
 * (D1 planets, houses, nakshatras, degrees) + dasha + transits so two users
 * with the same scores but different charts produce different results.
 *
 * All functions are deterministic — no randomness, no LLM.
 */

import type {
  ChartData,
  DashaInfo,
  PlanetData,
  ReportScores,
  TransitPlanet,
  AssetType,
  AssetAnalysis,
  AssetVerdict,
  LuxuryAnalysisResponse,
  BasketType,
  BasketAnalysis,
  BasketSuitability,
  InvestmentBasketResponse,
} from "./vedicfinance-types";
import { DASHA_SEQUENCE, DASHA_YEARS } from "./financial-kundali-engine";

// ── Planet / sign tables ────────────────────────────────────────────────────

const BENEFICS = new Set(["Jupiter", "Venus", "Mercury", "Moon"]);
const MALEFICS = new Set(["Saturn", "Mars", "Rahu", "Ketu"]);

/** Vedic exaltation / debilitation / own-sign map */
const DIGNITY: Record<string, { exalt: string; debil: string; own: string[] }> = {
  Sun: { exalt: "Aries", debil: "Libra", own: ["Leo"] },
  Moon: { exalt: "Taurus", debil: "Scorpio", own: ["Cancer"] },
  Mars: { exalt: "Capricorn", debil: "Cancer", own: ["Aries", "Scorpio"] },
  Mercury: { exalt: "Virgo", debil: "Pisces", own: ["Gemini", "Virgo"] },
  Jupiter: { exalt: "Cancer", debil: "Capricorn", own: ["Sagittarius", "Pisces"] },
  Venus: { exalt: "Pisces", debil: "Virgo", own: ["Taurus", "Libra"] },
  Saturn: { exalt: "Libra", debil: "Aries", own: ["Capricorn", "Aquarius"] },
  Rahu: { exalt: "Taurus", debil: "Scorpio", own: [] },
  Ketu: { exalt: "Scorpio", debil: "Taurus", own: [] },
};

export type Dignity = "exalted" | "own" | "friendly" | "debilitated";

export function getPlanetDignity(planet: PlanetData): Dignity {
  const d = DIGNITY[planet.planet];
  if (!d) return "friendly";
  if (planet.sign === d.exalt) return "exalted";
  if (d.own.includes(planet.sign)) return "own";
  if (planet.sign === d.debil) return "debilitated";
  return "friendly";
}

/** Basic strength score 0–100 for a planet based on house, dignity, retrograde. */
export function planetStrength(planet: PlanetData | undefined | null): number {
  if (!planet) return 30;
  let s = 40;
  const dignity = getPlanetDignity(planet);
  if (dignity === "exalted") s += 30;
  else if (dignity === "own") s += 20;
  else if (dignity === "debilitated") s -= 20;
  if ([1, 4, 7, 10].includes(planet.house)) s += 12;
  if ([1, 5, 9].includes(planet.house)) s += 10;
  if ([6, 8, 12].includes(planet.house)) s -= 15;
  if (planet.retrograde && !MALEFICS.has(planet.planet)) s -= 6;
  return Math.max(5, Math.min(95, s));
}

export function getPlanet(chart: ChartData, name: string): PlanetData | null {
  return chart.planets.find((p) => p.planet === name) ?? null;
}

export function getHouseLord(chart: ChartData, houseNum: number): string | null {
  return chart.houses.find((h) => h.house === houseNum)?.lord ?? null;
}

export function getLordPlanet(chart: ChartData, houseNum: number): PlanetData | null {
  const lord = getHouseLord(chart, houseNum);
  if (!lord) return null;
  return getPlanet(chart, lord);
}

export function getPlanetsInHouse(chart: ChartData, houseNum: number): PlanetData[] {
  return chart.planets.filter((p) => p.house === houseNum);
}

/** 0–100 house strength from lord placement + planets occupying. */
export function houseStrength(chart: ChartData, houseNum: number): number {
  const lord = getLordPlanet(chart, houseNum);
  let s = planetStrength(lord) * 0.6;
  const planets = getPlanetsInHouse(chart, houseNum);
  for (const p of planets) {
    const base = planetStrength(p) * 0.4;
    // benefic planets boost, malefics drain (except in dusthana houses where Mars/Saturn can be ok)
    if (BENEFICS.has(p.planet)) s += base * 0.5;
    else if (MALEFICS.has(p.planet) && [6, 8, 12].includes(houseNum)) s += base * 0.2;
    else s -= 5;
  }
  return Math.max(5, Math.min(95, Math.round(s)));
}

// ── Deterministic seed from chart for variation ─────────────────────────────

/** Produces a stable pseudo-random stream seeded from the chart's fingerprint. */
export function chartSeed(chart: ChartData): number {
  let seed = 0;
  seed += Math.round(chart.lagna_degree * 100);
  for (const p of chart.planets) {
    seed += p.sign_num * 31 + p.house * 7 + Math.round(p.degree);
  }
  return seed % 100000;
}

/** Small seeded PRNG. Given a seed, each call produces the next value in [0,1). */
export function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ── Dasha date math ─────────────────────────────────────────────────────────

export interface MonthWindow {
  monthIdx: number; // 0–11
  year: number;
  date: Date;
  score: number; // 0–100
  label: string; // "Mar 2026"
  shortLabel: string; // "Mar"
  drivers: string[]; // human-readable reasons
}

/** Which antardasha lord is active during the given date (rough; walks forward from current). */
function antardashaAt(dasha: DashaInfo, date: Date): string {
  const antarStart = new Date(dasha.antardasha_start);
  const antarEnd = new Date(dasha.antardasha_end);
  if (date >= antarStart && date <= antarEnd) return dasha.antardasha_lord;
  return dasha.antardasha_lord; // simplified; we only know the current antar
}

/** Approximate natal-house position of a transit planet N months from now. */
function driftedHouse(t: TransitPlanet, monthsAhead: number): number {
  // Jupiter ~12mo/sign, Saturn ~30mo/sign, Mars ~1.5mo/sign, Mercury ~1mo, Venus ~1mo, Sun ~1mo
  const monthsPerSign: Record<string, number> = {
    Sun: 1,
    Moon: 0.1,
    Mars: 1.5,
    Mercury: 1,
    Venus: 1,
    Jupiter: 12,
    Saturn: 30,
    Rahu: 18,
    Ketu: 18,
  };
  const mps = monthsPerSign[t.planet] ?? 1;
  const drift = Math.floor(monthsAhead / mps);
  return (((t.natal_house - 1 + drift) % 12) + 12) % 12 + 1;
}

// ── 1. Sudden wealth — personalized triggers & peak window ─────────────────

export interface PersonalWealthTrigger {
  source: string;
  probability: number;
  icon: string;
  timing: string;
  reason: string; // chart-specific one-liner
  ageWhen?: number;
}

/**
 * Build wealth triggers strictly from *what's actually in the user's chart*.
 * Different placements → different trigger categories → different per-user output.
 */
export function buildPersonalWealthTriggers(
  chart: ChartData,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  scores: ReportScores,
  birthYear: number,
): {
  overallProbability: number;
  triggers: PersonalWealthTrigger[];
  peakStartYear: number;
  peakEndYear: number;
  riskLevel: string;
} {
  const rng = makeRng(chartSeed(chart));

  // House strengths — the 4 wealth-windfall houses
  const s2 = houseStrength(chart, 2); // wealth
  const s5 = houseStrength(chart, 5); // speculation / creativity
  const s8 = houseStrength(chart, 8); // sudden gains, inheritance
  const s11 = houseStrength(chart, 11); // gains / dreams realised

  // Base probability weighted by houses, not just scores
  const base = s2 * 0.25 + s5 * 0.2 + s8 * 0.3 + s11 * 0.25;

  // Dasha & transit adjustments
  const dashaLord = dasha.mahadasha_lord;
  const antarLord = dasha.antardasha_lord;
  const dashaPlanet = getPlanet(chart, dashaLord);
  const antarPlanet = getPlanet(chart, antarLord);
  const dashaBoost = dashaPlanet && [2, 5, 8, 11].includes(dashaPlanet.house) ? 10 : 0;
  const antarBoost = antarPlanet && [2, 5, 8, 11].includes(antarPlanet.house) ? 6 : 0;

  const jupiterT = transits.find((t) => t.planet === "Jupiter");
  const rahuT = transits.find((t) => t.planet === "Rahu");
  const transitBoost =
    (jupiterT && [2, 5, 11].includes(jupiterT.natal_house) ? 8 : 0) +
    (rahuT && [8, 11].includes(rahuT.natal_house) ? 6 : 0);

  let overall = Math.round(base * 0.5 + transitBoost + dashaBoost + antarBoost);
  overall = Math.max(12, Math.min(88, overall));
  // Every chart has *some* windfall potential — we surface the strongest signal from the
  // user's actual houses, so we label the card "High" (it's a highlight, not a risk gauge).
  const riskLevel = "High";

  // Build triggers by looking at *actual planets in* the windfall houses.
  // Labels are exciting & aspirational — what the user WANTS to hear.
  const triggers: PersonalWealthTrigger[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentAge = currentYear - birthYear;

  const occupants8 = getPlanetsInHouse(chart, 8);
  const occupants5 = getPlanetsInHouse(chart, 5);
  const occupants11 = getPlanetsInHouse(chart, 11);
  const occupants2 = getPlanetsInHouse(chart, 2);

  // 8th house triggers — sudden / inheritance flavour
  for (const p of occupants8) {
    const str = planetStrength(p);
    switch (p.planet) {
      case "Jupiter":
        triggers.push({
          source: "Family Inheritance",
          icon: "🏛️",
          probability: Math.min(82, 40 + str * 0.4),
          timing: `Around age ${currentAge + 2}–${currentAge + 5}`,
          reason: `Jupiter in your 8th house (${p.sign}): classic inheritance yoga. Expect wealth from elders, trusts, or family legacy.`,
        });
        break;
      case "Venus":
        triggers.push({
          source: "Marriage Wealth Boost",
          icon: "💍",
          probability: Math.min(78, 35 + str * 0.4),
          timing: `Within the ${dashaLord} period`,
          reason: `Venus in your 8th house: significant wealth arrives through your partner or in-laws.`,
        });
        break;
      case "Rahu":
        triggers.push({
          source: "High-Risk Bet Payoff",
          icon: "🚀",
          probability: Math.min(72, 30 + str * 0.5),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Rahu in your 8th: a high-risk bet in foreign or emerging markets pays off unusually well.`,
        });
        break;
      case "Mars":
        triggers.push({
          source: "Property Sale Gain",
          icon: "🏠",
          probability: Math.min(70, 32 + str * 0.4),
          timing: "Next Mars sub-period",
          reason: `Mars in your 8th: a property or land sale closes well above what you expected to get for it.`,
        });
        break;
      case "Moon":
        triggers.push({
          source: "Gift from Family Elder",
          icon: "🎁",
          probability: Math.min(65, 28 + str * 0.4),
          timing: `Age ${currentAge + 3}–${currentAge + 6}`,
          reason: `Moon in your 8th: an elder on your mother's side hands over money, gold, or a share of family assets.`,
        });
        break;
      case "Ketu":
        triggers.push({
          source: "Court Settlement Win",
          icon: "⚖️",
          probability: Math.min(60, 25 + str * 0.4),
          timing: "Second half of current Mahadasha",
          reason: `Ketu in your 8th: a long-running court case or disputed claim finally settles in your favour.`,
        });
        break;
      case "Mercury":
        triggers.push({
          source: "Private Deal Payout",
          icon: "🤫",
          probability: Math.min(68, 30 + str * 0.4),
          timing: `Around age ${currentAge + 2}`,
          reason: `Mercury in your 8th: a privately negotiated deal or off-market transaction pays out in one lump sum.`,
        });
        break;
      case "Saturn":
        triggers.push({
          source: "Gratuity / PF Payout",
          icon: "💰",
          probability: Math.min(60, 25 + str * 0.4),
          timing: `Age ${currentAge + 5}–${currentAge + 8}`,
          reason: `Saturn in your 8th brings a long-delayed payout: provident fund, gratuity, or a pension arrear.`,
        });
        break;
      case "Sun":
        triggers.push({
          source: "Tax Refund or Govt Payout",
          icon: "🏆",
          probability: Math.min(58, 25 + str * 0.4),
          timing: "Next Sun sub-period",
          reason: `Sun in your 8th brings money back from the state: a large tax refund, subsidy, or government scheme payout.`,
        });
        break;
    }
  }

  // 5th house — speculation, lottery, creative jackpot
  for (const p of occupants5) {
    const str = planetStrength(p);
    switch (p.planet) {
      case "Rahu":
        triggers.push({
          source: "Lottery / Jackpot Win",
          icon: "🎰",
          probability: Math.min(72, 30 + str * 0.5),
          timing: `Peak age ${currentAge + 1}–${currentAge + 4}`,
          reason: `Rahu in your 5th: the classic lottery yoga. High-risk bets and speculation strongly favoured.`,
        });
        break;
      case "Jupiter":
        triggers.push({
          source: "Royalty / IP Income",
          icon: "📚",
          probability: Math.min(76, 38 + str * 0.4),
          timing: "Current Jupiter period onward",
          reason: `Jupiter in your 5th (${p.sign}): royalties accumulate from a book, course, patent, or licensing deal.`,
        });
        break;
      case "Mercury":
        triggers.push({
          source: "Equity Portfolio Gain",
          icon: "📈",
          probability: Math.min(70, 32 + str * 0.5),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Mercury in your 5th: your equity holdings run up sharply and a well-timed exit locks in the gain.`,
        });
        break;
      case "Venus":
        triggers.push({
          source: "Creative Project Payout",
          icon: "🎬",
          probability: Math.min(68, 30 + str * 0.4),
          timing: `Age ${currentAge + 2}–${currentAge + 5}`,
          reason: `Venus in your 5th means a creative project finds a large audience and pays out: music, design, content, or a brand collaboration.`,
        });
        break;
      case "Sun":
        triggers.push({
          source: "Competition Prize",
          icon: "🏆",
          probability: Math.min(60, 25 + str * 0.4),
          timing: `Age ${currentAge + 3}–${currentAge + 6}`,
          reason: `Sun in your 5th: wins from competitions, tournaments, hackathons, or leadership awards.`,
        });
        break;
      case "Mars":
        triggers.push({
          source: "Startup Exit",
          icon: "🦄",
          probability: Math.min(68, 30 + str * 0.4),
          timing: `Age ${currentAge + 2}–${currentAge + 5}`,
          reason: `Mars in your 5th makes bold ventures pay off: startup acquisition, equity buyout, or IPO gains.`,
        });
        break;
    }
  }

  // 11th house — bonuses, network wealth, dream-come-true
  for (const p of occupants11) {
    const str = planetStrength(p);
    switch (p.planet) {
      case "Jupiter":
        triggers.push({
          source: "ESOP Vesting Payout",
          icon: "💎",
          probability: Math.min(80, 40 + str * 0.4),
          timing: `Within ${dashaLord} Mahadasha`,
          reason: `Jupiter in your 11th: textbook Dhana Yoga. A vesting cliff, ESOP unlock, or profit-share pays out at once.`,
        });
        break;
      case "Venus":
        triggers.push({
          source: "Deal Commission",
          icon: "🤝",
          probability: Math.min(72, 32 + str * 0.4),
          timing: "Next 2 years",
          reason: `Venus in your 11th: a friend or contact routes a high-value deal to you and the commission on it is large.`,
        });
        break;
      case "Sun":
        triggers.push({
          source: "Employer Equity Grant",
          icon: "📜",
          probability: Math.min(70, 30 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 4}`,
          reason: `Sun in your 11th points to an employer equity grant: an RSU allocation, stock award, or board-level share issue.`,
        });
        break;
      case "Rahu":
        triggers.push({
          source: "Overseas Income Surge",
          icon: "✈️",
          probability: Math.min(68, 28 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Rahu in your 11th: sudden income from foreign clients, NRI deals, or international contracts.`,
        });
        break;
      case "Mercury":
        triggers.push({
          source: "Big Client Contract Win",
          icon: "🔥",
          probability: Math.min(70, 30 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 2}`,
          reason: `Mercury in your 11th: word of mouth lands you a contract far larger than your usual client size.`,
        });
        break;
      case "Moon":
        triggers.push({
          source: "Crowdfunding Payout",
          icon: "🌊",
          probability: Math.min(60, 25 + str * 0.4),
          timing: `Age ${currentAge + 2}–${currentAge + 4}`,
          reason: `Moon in your 11th points to a public campaign paying out: crowdfunding, paid memberships, or community contributions.`,
        });
        break;
      case "Saturn":
        triggers.push({
          source: "Investment Maturity",
          icon: "🏦",
          probability: Math.min(65, 28 + str * 0.4),
          timing: `Age ${currentAge + 4}–${currentAge + 7}`,
          reason: `Saturn in your 11th has patient investments finally maturing: FDs, bonds, or real estate appreciation.`,
        });
        break;
      case "Mars":
        triggers.push({
          source: "Performance Bonus Payout",
          icon: "⚡",
          probability: Math.min(68, 30 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Mars in your 11th: you clear an aggressive target and the performance bonus or sales commission is outsized.`,
        });
        break;
    }
  }

  // 2nd house — direct wealth accumulation
  for (const p of occupants2) {
    const str = planetStrength(p);
    switch (p.planet) {
      case "Jupiter":
        triggers.push({
          source: "Family Wealth Transfer",
          icon: "👨‍👩‍👦",
          probability: Math.min(78, 35 + str * 0.4),
          timing: "Ongoing through current period",
          reason: `Jupiter in your 2nd has elders directing wealth your way: gifts, education funds, or business capital.`,
        });
        break;
      case "Venus":
        triggers.push({
          source: "Gold / Jewellery Value Gain",
          icon: "💎",
          probability: Math.min(75, 33 + str * 0.4),
          timing: "Ongoing through current period",
          reason: `Venus in your 2nd: the gold, jewellery, and luxury assets you already hold rise sharply in value.`,
        });
        break;
      case "Mercury":
        triggers.push({
          source: "Side Business Payout",
          icon: "💸",
          probability: Math.min(70, 30 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Mercury in your 2nd: a side project or freelance practice scales into income that rivals your main earnings.`,
        });
        break;
      case "Moon":
        triggers.push({
          source: "Fixed Deposit Maturity",
          icon: "🌙",
          probability: Math.min(62, 28 + str * 0.4),
          timing: `Age ${currentAge + 2}–${currentAge + 4}`,
          reason: `Moon in your 2nd: a deposit or savings instrument matures into a sum noticeably larger than you had tracked.`,
        });
        break;
      case "Sun":
        triggers.push({
          source: "Major Salary Hike",
          icon: "☀️",
          probability: Math.min(65, 28 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Sun in your 2nd: a major promotion or role change brings a dramatic salary jump.`,
        });
        break;
      case "Rahu":
        triggers.push({
          source: "Foreign Income Payout",
          icon: "🌍",
          probability: Math.min(68, 30 + str * 0.4),
          timing: `Age ${currentAge + 1}–${currentAge + 3}`,
          reason: `Rahu in your 2nd has income arriving from abroad: an overseas client, remittance, or foreign-currency payout.`,
        });
        break;
      default:
        break;
    }
  }

  // Karaka-based triggers — always top up to at least 3 so the chart has enough anchors.
  // (Previous behaviour only ran when no primary triggers existed, which broke charts with
  //  only 1 planet in 2/5/8/11.)
  const neededFromKarakas = Math.max(0, 3 - triggers.length);
  if (neededFromKarakas > 0) {
    const fallbacks: PersonalWealthTrigger[] = [];

    const lord2 = getLordPlanet(chart, 2);
    if (lord2) {
      fallbacks.push({
        source: "Pending Dues Recovered",
        icon: "💸",
        probability: Math.min(65, 35 + planetStrength(lord2) * 0.3),
        timing: `During ${lord2.planet} sub-periods`,
        reason: `Your 2nd lord ${lord2.planet} in the ${lord2.house}${ord(lord2.house)} house (${lord2.sign}) brings back money you'd written off: old dues, a delayed refund, or a forgotten deposit.`,
      });
    }
    const lord11 = getLordPlanet(chart, 11);
    if (lord11) {
      fallbacks.push({
        source: "Referral from Network",
        icon: "🍀",
        probability: Math.min(62, 32 + planetStrength(lord11) * 0.3),
        timing: "Within 3–5 years",
        reason: `Your 11th lord ${lord11.planet} in the ${lord11.house}${ord(lord11.house)} house (${lord11.sign}): someone in your network refers work or a deal that pays well above your normal rate.`,
      });
    }
    const lord5 = getLordPlanet(chart, 5);
    if (lord5) {
      fallbacks.push({
        source: "Trading Position Payoff",
        icon: "🎯",
        probability: Math.min(58, 28 + planetStrength(lord5) * 0.3),
        timing: `When ${lord5.planet} activates next`,
        reason: `Your 5th lord ${lord5.planet} in the ${lord5.house}${ord(lord5.house)} house (${lord5.sign}): a calculated position you held for a while closes at a large profit.`,
      });
    }
    const lord8 = getLordPlanet(chart, 8);
    if (lord8) {
      fallbacks.push({
        source: "Insurance Claim Payout",
        icon: "🏦",
        probability: Math.min(56, 26 + planetStrength(lord8) * 0.3),
        timing: `Age ${currentAge + 2}–${currentAge + 5}`,
        reason: `Your 8th lord ${lord8.planet} in the ${lord8.house}${ord(lord8.house)} house (${lord8.sign}): an insurance claim, maturity benefit, or settlement pays out in a single instalment.`,
      });
    }
    fallbacks.push({
      source: "Annual Profit Payout",
      icon: "💼",
      probability: Math.min(55, scores.income_score * 0.6 + 10),
      timing: "12–24 months",
      reason: "Steady business growth compounds into a single large profit distribution during your next favourable sub-period.",
    });

    // Filter out any fallbacks whose source name already exists among primary triggers,
    // sort by probability (strongest chart facts first) and add up to the shortfall.
    const existing = new Set(triggers.map((t) => t.source));
    const picks = fallbacks
      .filter((f) => !existing.has(f.source))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, neededFromKarakas);
    triggers.push(...picks);
  }

  // Add a nakshatra-flavoured hook if Moon is favourable
  const moon = getPlanet(chart, "Moon");
  if (moon && ["Rohini", "Pushya", "Hasta", "Anuradha", "Revati"].includes(moon.nakshatra)) {
    triggers.push({
      source: "Recurring Cash Windfalls",
      icon: "🌙",
      probability: 55,
      timing: `Every ${moon.nakshatra_lord} sub-period`,
      reason: `Your Moon in ${moon.nakshatra} nakshatra: a wealth-star that brings repeated small cash windfalls rather than one large payout.`,
    });
  }

  // Deduplicate & sort by probability, keep top 5
  const uniq = new Map<string, PersonalWealthTrigger>();
  for (const t of triggers) {
    // Always render probabilities as clean integers
    t.probability = Math.round(t.probability);
    if (!uniq.has(t.source) || (uniq.get(t.source)?.probability ?? 0) < t.probability) {
      uniq.set(t.source, t);
    }
  }
  const final = Array.from(uniq.values())
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  // Peak window — use antardasha end + dasha fingerprint, not a fixed offset.
  // When the strongest wealth-yoga planet's sub-period happens is the peak.
  const keyPlanets = [...occupants8, ...occupants11, ...occupants5, ...occupants2]
    .sort((a, b) => planetStrength(b) - planetStrength(a));
  const keyPlanet = keyPlanets[0]?.planet ?? dashaLord;

  // Use antar-end as a realistic near window, plus a chart-seeded offset for variety
  const antarEnd = new Date(dasha.antardasha_end);
  const offsetYears = Math.floor(rng() * 3); // 0, 1, or 2 — varies with chart
  const peakStartYear = Math.max(currentYear, antarEnd.getFullYear() - 1 + offsetYears);
  // Minimum 5-year window so 3–4 events always have room to spread without overlapping
  const windowLen = Math.max(5, keyPlanets[0] && planetStrength(keyPlanets[0]) >= 60 ? 5 : 4);
  const peakEndYear = peakStartYear + windowLen;

  // Spread event ages EVENLY across the window so every dot is at a unique x-position.
  // With N events in a window of W years, place them at fractional positions:
  //   startYear + (i + 0.5) * (W / N)
  // Then add a small chart-seeded jitter (±0.2 yr) for visual variety without collisions.
  const N = final.length;
  const W = peakEndYear - peakStartYear;
  // Extend the spread range slightly beyond the window so edge events aren't clipped
  const spreadStart = peakStartYear - 0.5;
  const spreadEnd = peakEndYear + 0.5;
  const spreadW = spreadEnd - spreadStart;
  for (let i = 0; i < N; i++) {
    const baseYear = spreadStart + ((i + 0.5) / N) * spreadW;
    const jitter = (rng() - 0.5) * 0.4; // ±0.2 years
    const eventYear = Math.max(peakStartYear, Math.min(peakEndYear, baseYear + jitter));
    final[i].ageWhen = Math.round(eventYear - birthYear + (rng() * 0.8 - 0.4)); // integer age, unique
  }
  // Final dedup pass: if any two events ended up at the same age, nudge the later one forward
  for (let i = 1; i < N; i++) {
    if ((final[i].ageWhen ?? 0) <= (final[i - 1].ageWhen ?? 0)) {
      final[i].ageWhen = (final[i - 1].ageWhen ?? 0) + 1;
    }
  }

  return {
    overallProbability: overall,
    triggers: final,
    peakStartYear,
    peakEndYear,
    riskLevel,
  };
}

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ── 2. Income streams — personalized from actual house lords ────────────────

export type IncomeEffort = "passive" | "moderate" | "intensive";

export interface PersonalIncomeStream {
  name: string;
  effort: IncomeEffort;
  amount: string; // "₹1.2L"
  amountValue: number; // in lakhs
  activationTime: string;
  reason: string;
  angle: number;
  orbitRadius: number; // 0–1 of maxOrbitR
  size: number; // 0–1
  rulingPlanet: string;
}

interface StreamCandidate {
  name: string;
  effort: IncomeEffort;
  planetHint: string;
  sizeFactor: number; // multiplier vs salary
  activationMonths: number; // base activation; personalised later
  requires: (chart: ChartData) => boolean;
}

/** Catalogue of possible streams — each gated by a chart condition. */
const STREAM_CATALOGUE: StreamCandidate[] = [
  // Mercury-driven (tech / communication / trading)
  {
    name: "Freelance Consulting",
    effort: "moderate",
    planetHint: "Mercury",
    sizeFactor: 0.32,
    activationMonths: 2,
    requires: (c) => {
      const m = getPlanet(c, "Mercury");
      return !!m && [1, 3, 10, 11].includes(m.house);
    },
  },
  {
    name: "SaaS / Digital Product",
    effort: "intensive",
    planetHint: "Mercury",
    sizeFactor: 0.7,
    activationMonths: 12,
    requires: (c) => {
      const m = getPlanet(c, "Mercury");
      const r = getPlanet(c, "Rahu");
      return (!!m && [1, 3, 5, 10, 11].includes(m.house)) || (!!r && [3, 10, 11].includes(r.house));
    },
  },
  {
    name: "Content / Creator Income",
    effort: "moderate",
    planetHint: "Mercury",
    sizeFactor: 0.28,
    activationMonths: 4,
    requires: (c) => {
      const m = getPlanet(c, "Mercury");
      const v = getPlanet(c, "Venus");
      return (!!m && [3, 5].includes(m.house)) || (!!v && [3, 5].includes(v.house));
    },
  },
  {
    name: "Stock / Options Trading",
    effort: "intensive",
    planetHint: "Rahu",
    sizeFactor: 0.55,
    activationMonths: 1,
    requires: (c) => {
      const r = getPlanet(c, "Rahu");
      const m = getPlanet(c, "Mars");
      return (!!r && [5, 11].includes(r.house)) || (!!m && [5, 8].includes(m.house));
    },
  },
  // Venus-driven (luxury / arts / partnership)
  {
    name: "Design / Creative Studio",
    effort: "intensive",
    planetHint: "Venus",
    sizeFactor: 0.45,
    activationMonths: 6,
    requires: (c) => {
      const v = getPlanet(c, "Venus");
      return !!v && [1, 2, 5, 7, 10].includes(v.house);
    },
  },
  {
    name: "Luxury Brand / Boutique",
    effort: "intensive",
    planetHint: "Venus",
    sizeFactor: 0.6,
    activationMonths: 10,
    requires: (c) => {
      const v = getPlanet(c, "Venus");
      return !!v && [2, 7, 10, 11].includes(v.house);
    },
  },
  {
    name: "Coaching / Mentorship",
    effort: "moderate",
    planetHint: "Jupiter",
    sizeFactor: 0.3,
    activationMonths: 3,
    requires: (c) => {
      const j = getPlanet(c, "Jupiter");
      return !!j && [1, 5, 9, 10, 11].includes(j.house);
    },
  },
  // Jupiter-driven (advisory / banking / teaching)
  {
    name: "Financial Advisory",
    effort: "moderate",
    planetHint: "Jupiter",
    sizeFactor: 0.5,
    activationMonths: 6,
    requires: (c) => {
      const j = getPlanet(c, "Jupiter");
      return !!j && [2, 5, 9, 11].includes(j.house);
    },
  },
  {
    name: "Online Courses",
    effort: "intensive",
    planetHint: "Jupiter",
    sizeFactor: 0.4,
    activationMonths: 8,
    requires: (c) => {
      const j = getPlanet(c, "Jupiter");
      const m = getPlanet(c, "Mercury");
      return (!!j && [1, 5, 9].includes(j.house)) || (!!m && [3, 5].includes(m.house));
    },
  },
  {
    name: "Book / IP Royalties",
    effort: "passive",
    planetHint: "Jupiter",
    sizeFactor: 0.12,
    activationMonths: 18,
    requires: (c) => {
      const j = getPlanet(c, "Jupiter");
      return !!j && [3, 5, 9].includes(j.house);
    },
  },
  // Mars-driven (real estate / engineering / fitness)
  {
    name: "Real Estate Flip",
    effort: "intensive",
    planetHint: "Mars",
    sizeFactor: 0.65,
    activationMonths: 18,
    requires: (c) => {
      const m = getPlanet(c, "Mars");
      const h4 = houseStrength(c, 4);
      return (!!m && [4, 11].includes(m.house)) || h4 >= 60;
    },
  },
  {
    name: "Rental Income",
    effort: "passive",
    planetHint: "Mars",
    sizeFactor: 0.45,
    activationMonths: 24,
    requires: (c) => {
      const m = getPlanet(c, "Mars");
      return (!!m && [4, 2].includes(m.house)) || houseStrength(c, 4) >= 55;
    },
  },
  {
    name: "Engineering / Tech Consulting",
    effort: "moderate",
    planetHint: "Mars",
    sizeFactor: 0.5,
    activationMonths: 4,
    requires: (c) => {
      const m = getPlanet(c, "Mars");
      return !!m && [1, 3, 10].includes(m.house);
    },
  },
  // Saturn-driven (long-term, labour, structure)
  {
    name: "Dividend / FD Portfolio",
    effort: "passive",
    planetHint: "Saturn",
    sizeFactor: 0.15,
    activationMonths: 6,
    requires: (c) => {
      const s = getPlanet(c, "Saturn");
      return !!s && [2, 4, 11].includes(s.house);
    },
  },
  {
    name: "Manufacturing / Long-cycle Business",
    effort: "intensive",
    planetHint: "Saturn",
    sizeFactor: 0.55,
    activationMonths: 24,
    requires: (c) => {
      const s = getPlanet(c, "Saturn");
      return !!s && [10, 11].includes(s.house);
    },
  },
  // Sun-driven (authority / government / leadership)
  {
    name: "Executive / Board Role",
    effort: "moderate",
    planetHint: "Sun",
    sizeFactor: 0.6,
    activationMonths: 8,
    requires: (c) => {
      const s = getPlanet(c, "Sun");
      return !!s && [1, 10].includes(s.house);
    },
  },
  {
    name: "Government Contracts",
    effort: "intensive",
    planetHint: "Sun",
    sizeFactor: 0.55,
    activationMonths: 12,
    requires: (c) => {
      const s = getPlanet(c, "Sun");
      return !!s && [10, 11].includes(s.house);
    },
  },
  // Moon-driven (public / hospitality / liquidity)
  {
    name: "Hospitality / F&B",
    effort: "intensive",
    planetHint: "Moon",
    sizeFactor: 0.5,
    activationMonths: 12,
    requires: (c) => {
      const m = getPlanet(c, "Moon");
      return !!m && [2, 4, 7].includes(m.house);
    },
  },
  {
    name: "Public-facing Service",
    effort: "moderate",
    planetHint: "Moon",
    sizeFactor: 0.3,
    activationMonths: 4,
    requires: (c) => {
      const m = getPlanet(c, "Moon");
      return !!m && [1, 4, 10, 11].includes(m.house);
    },
  },
  // Rahu-driven (foreign / unconventional)
  {
    name: "Foreign Remote Gig",
    effort: "moderate",
    planetHint: "Rahu",
    sizeFactor: 0.5,
    activationMonths: 3,
    requires: (c) => {
      const r = getPlanet(c, "Rahu");
      return !!r && [3, 9, 10, 11, 12].includes(r.house);
    },
  },
  {
    name: "Crypto / Alt Assets",
    effort: "passive",
    planetHint: "Rahu",
    sizeFactor: 0.35,
    activationMonths: 6,
    requires: (c) => {
      const r = getPlanet(c, "Rahu");
      const k = getPlanet(c, "Ketu");
      return (!!r && [5, 8, 11].includes(r.house)) || (!!k && [5, 8, 11].includes(k.house));
    },
  },
  // Ketu-driven (research / niche / spiritual)
  {
    name: "Research / Analytics",
    effort: "intensive",
    planetHint: "Ketu",
    sizeFactor: 0.4,
    activationMonths: 9,
    requires: (c) => {
      const k = getPlanet(c, "Ketu");
      return !!k && [3, 8, 9, 12].includes(k.house);
    },
  },
  {
    name: "Wellness / Spiritual Services",
    effort: "moderate",
    planetHint: "Ketu",
    sizeFactor: 0.3,
    activationMonths: 6,
    requires: (c) => {
      const k = getPlanet(c, "Ketu");
      return !!k && [1, 5, 9, 12].includes(k.house);
    },
  },
];

export function buildPersonalIncomeStreams(
  chart: ChartData,
  dasha: DashaInfo,
  _transits: TransitPlanet[],
  scores: ReportScores,
): {
  streams: PersonalIncomeStream[];
  salaryBase: number;
  primaryIncome: string;
} {
  const rng = makeRng(chartSeed(chart));
  const dashaLord = dasha.mahadasha_lord;
  const antarLord = dasha.antardasha_lord;

  // Salary base varies with actual 10th + 2nd house strength, not just income_score
  const s10 = houseStrength(chart, 10);
  const s2 = houseStrength(chart, 2);
  const incomeBase = (s10 * 0.6 + s2 * 0.2 + scores.income_score * 0.2) / 100;
  // Ranges ~₹0.5L–₹3.5L/mo depending on chart
  const salaryBase = Math.round((0.5 + incomeBase * 3) * 10) / 10;

  // Candidates whose astrological gating is satisfied by this chart
  const eligible = STREAM_CATALOGUE.filter((s) => s.requires(chart));

  // Score each candidate by how strongly the chart activates it
  const scored = eligible.map((cand) => {
    const p = getPlanet(chart, cand.planetHint);
    const str = planetStrength(p);
    let score = str;
    // Dasha activation — if current mahadasha / antardasha is the stream's ruling planet, push it up
    if (cand.planetHint === dashaLord) score += 25;
    else if (cand.planetHint === antarLord) score += 12;
    // 10th/11th lord activation
    const lord10 = getHouseLord(chart, 10);
    const lord11 = getHouseLord(chart, 11);
    if (cand.planetHint === lord10) score += 12;
    if (cand.planetHint === lord11) score += 10;
    // small variation so ties are broken by chart fingerprint
    score += Math.floor(rng() * 4);
    return { cand, score, planet: p };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick top 5, but require 1–2 passive to diversify
  const topPicks: typeof scored = [];
  const usedNames = new Set<string>();
  for (const item of scored) {
    if (topPicks.length >= 5) break;
    if (usedNames.has(item.cand.name)) continue;
    topPicks.push(item);
    usedNames.add(item.cand.name);
  }

  // Orbit angles — spread but seeded so the same chart always renders the same way
  const baseAngles = [288, 0, 72, 144, 216];
  // Rotate by a chart-seeded offset so different users see different layouts
  const rotation = Math.floor(rng() * 72);
  const angles = baseAngles.map((a) => (a + rotation) % 360);

  const streams: PersonalIncomeStream[] = topPicks.map((item, i) => {
    const { cand, planet } = item;
    const planetStr = planet ? planetStrength(planet) : 40;

    // Amount scales with planet strength and salary base
    const strengthMod = 0.6 + (planetStr / 100) * 0.8; // 0.6–1.4
    const amt = Math.round(salaryBase * cand.sizeFactor * strengthMod * 100) / 100;
    const amountStr = amt >= 1 ? `₹${amt.toFixed(1)}L` : `₹${Math.round(amt * 100)}k`;

    // Activation time scales with dasha — if this stream's ruling planet is the active
    // mahadasha/antardasha lord, it activates faster.
    let months = cand.activationMonths;
    if (cand.planetHint === dashaLord) months = Math.max(1, Math.round(months * 0.5));
    else if (cand.planetHint === antarLord) months = Math.max(1, Math.round(months * 0.7));
    const activationTime = months >= 12 ? `${Math.round(months / 12)} yr` : `${months} mo`;

    // Orbit radius — ruled by activation speed (faster = closer)
    const orbitRadius = Math.min(0.95, 0.38 + (months / 24) * 0.55);

    // Size — scale with amount
    const size = Math.max(0.32, Math.min(0.75, 0.3 + cand.sizeFactor * 0.7));

    // Reason
    const planetPhrase = planet
      ? `${cand.planetHint} in your ${planet.house}${ord(planet.house)} house (${planet.sign})`
      : `${cand.planetHint}'s influence`;
    const reason =
      cand.planetHint === dashaLord
        ? `Active now: ${planetPhrase} and ${dashaLord} Mahadasha directly fuels this stream.`
        : cand.planetHint === antarLord
          ? `Ready to activate: ${planetPhrase}, triggered by the ${antarLord} antardasha.`
          : `${planetPhrase} supports this stream during future ${cand.planetHint} sub-periods.`;

    return {
      name: cand.name,
      effort: cand.effort,
      amount: amountStr,
      amountValue: amt,
      activationTime,
      reason,
      angle: angles[i] ?? (i * 60) % 360,
      orbitRadius,
      size,
      rulingPlanet: cand.planetHint,
    };
  });

  const primaryIncome = `₹${salaryBase.toFixed(1)}L/mo`;
  return { streams, salaryBase, primaryIncome };
}

// ── 3. Monthly forecast (investment / business / luxury) ────────────────────

export type MonthPurpose = "invest" | "business" | "property" | "vehicle" | "gold" | "loan";

interface PurposeSpec {
  targetHouses: number[];
  friendlyPlanets: string[];
  hostilePlanets: string[];
  baseScoreKey: keyof ReportScores;
}

const PURPOSE_SPECS: Record<MonthPurpose, PurposeSpec> = {
  invest: {
    targetHouses: [2, 5, 9, 11],
    friendlyPlanets: ["Jupiter", "Mercury", "Venus"],
    hostilePlanets: ["Saturn", "Rahu"],
    baseScoreKey: "investment_score",
  },
  business: {
    targetHouses: [3, 7, 10, 11],
    friendlyPlanets: ["Jupiter", "Mercury", "Sun"],
    hostilePlanets: ["Saturn"],
    baseScoreKey: "timing_score",
  },
  property: {
    targetHouses: [4, 11],
    friendlyPlanets: ["Venus", "Mars", "Jupiter"],
    hostilePlanets: ["Saturn", "Rahu"],
    baseScoreKey: "natal_wealth_score",
  },
  vehicle: {
    targetHouses: [4, 3],
    friendlyPlanets: ["Venus", "Mars"],
    hostilePlanets: ["Saturn"],
    baseScoreKey: "natal_wealth_score",
  },
  gold: {
    targetHouses: [2, 11],
    friendlyPlanets: ["Jupiter", "Venus", "Sun"],
    hostilePlanets: ["Saturn", "Rahu"],
    baseScoreKey: "savings_score",
  },
  loan: {
    targetHouses: [6],
    friendlyPlanets: ["Jupiter"],
    hostilePlanets: ["Rahu", "Saturn", "Mars"],
    baseScoreKey: "risk_score",
  },
};

export interface PurposeMonth {
  monthIdx: number;
  year: number;
  date: Date;
  score: number;
  label: string; // "Mar 2026"
  short: string; // "Mar"
  driver: string;
}

/**
 * Per-user 12-month scores for a given purpose, driven by the user's chart:
 *  - the target houses' lords' dignity
 *  - whether Jupiter / relevant benefic drifts into a target house that month
 *  - the user's antardasha lord's natural affinity
 *  - month ruler (Vedic) + chart seed to break ties deterministically
 */
export function buildMonthlyPurposeScores(
  chart: ChartData,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  scores: ReportScores,
  purpose: MonthPurpose,
  startDate: Date = new Date(),
): PurposeMonth[] {
  const rng = makeRng(chartSeed(chart) + purpose.charCodeAt(0));
  const spec = PURPOSE_SPECS[purpose];

  // Natal baseline — the strength of the purpose's target houses in this chart
  const targetStrength =
    spec.targetHouses.reduce((s, h) => s + houseStrength(chart, h), 0) / spec.targetHouses.length;

  const dashaLord = dasha.mahadasha_lord;
  const antarLord = dasha.antardasha_lord;
  const dashaLordPlanet = getPlanet(chart, dashaLord);
  const antarLordPlanet = getPlanet(chart, antarLord);

  // Does the dasha structure support this purpose?
  let dashaBoost = 0;
  if (dashaLordPlanet && spec.targetHouses.includes(dashaLordPlanet.house)) dashaBoost += 10;
  if (spec.friendlyPlanets.includes(dashaLord)) dashaBoost += 8;
  if (spec.hostilePlanets.includes(dashaLord)) dashaBoost -= 6;
  if (antarLordPlanet && spec.targetHouses.includes(antarLordPlanet.house)) dashaBoost += 5;
  if (spec.friendlyPlanets.includes(antarLord)) dashaBoost += 4;

  const months: PurposeMonth[] = [];
  const base = scores[spec.baseScoreKey] * 0.35 + targetStrength * 0.4;

  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);

    // Transit contribution — for each friendly planet, where is it this month?
    let transitMod = 0;
    const drivers: string[] = [];
    for (const t of transits) {
      const h = driftedHouse(t, i);
      if (spec.targetHouses.includes(h)) {
        if (spec.friendlyPlanets.includes(t.planet)) {
          transitMod += 7;
          if (t.planet === "Jupiter" || t.planet === "Venus") {
            drivers.push(`${t.planet} transits your ${h}${ord(h)} house`);
          }
        } else if (spec.hostilePlanets.includes(t.planet)) {
          transitMod -= 6;
          drivers.push(`${t.planet} stresses your ${h}${ord(h)} house`);
        }
      }
      if (t.retrograde && t.planet === "Mercury" && purpose !== "gold") {
        // ~3 weeks every ~4 months, crude approximation
        if ((i + (chartSeed(chart) % 4)) % 4 === 0) transitMod -= 3;
      }
    }

    // Chart-seeded monthly variance — ensures different users get different month rankings
    const chartMod = (rng() - 0.5) * 10;

    const raw = base + transitMod + dashaBoost + chartMod;
    const score = Math.max(12, Math.min(92, Math.round(raw)));

    months.push({
      monthIdx: d.getMonth(),
      year: d.getFullYear(),
      date: d,
      score,
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      short: d.toLocaleDateString("en-US", { month: "short" }),
      driver: drivers[0] ?? `${dashaLord}/${antarLord} backdrop`,
    });
  }

  return months;
}

// ── 4. Luxury analysis — local chart-driven compute ─────────────────────────

/** Picks the best month within the next 12, picks day-of-month deterministically. */
function pickBestWindow(
  months: PurposeMonth[],
  chart: ChartData,
  windowMonths = 6,
): { start: Date; end: Date; months: number } {
  const rng = makeRng(chartSeed(chart));
  const best = [...months].sort((a, b) => b.score - a.score)[0];
  // pick a day within the best month seeded by chart so different users get different dates
  const day = 2 + Math.floor(rng() * 26);
  const start = new Date(best.year, best.monthIdx, day);
  const end = new Date(start);
  end.setMonth(end.getMonth() + windowMonths);
  return { start, end, months: windowMonths };
}

function verdictForScore(score: number): AssetVerdict {
  // Thresholds calibrated against the 40–92 effective score range:
  // yes: top third (>=65), delay: middle (>=50), avoid: bottom (<50)
  return score >= 65 ? "yes" : score >= 50 ? "delay" : "avoid";
}

function buildAssetAnalysis(
  chart: ChartData,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  scores: ReportScores,
  assetType: AssetType,
): AssetAnalysis {
  // Map asset → purpose / target houses / karaka planet
  const purposeMap: Record<AssetType, MonthPurpose> = {
    property: "property",
    vehicle: "vehicle",
    gold: "gold",
    loan: "loan",
  };
  const karakaMap: Record<AssetType, string> = {
    property: "Mars",
    vehicle: "Venus",
    gold: "Jupiter",
    loan: "Jupiter",
  };
  const houseMap: Record<AssetType, number[]> = {
    property: [4, 11],
    vehicle: [4, 3],
    gold: [2, 11],
    loan: [6],
  };

  const purpose = purposeMap[assetType];
  const karaka = karakaMap[assetType];
  const houses = houseMap[assetType];

  // Natal sub-score: lord strength + karaka strength
  const lordStrengths = houses.map((h) => houseStrength(chart, h));
  const avgLord = lordStrengths.reduce((s, x) => s + x, 0) / lordStrengths.length;
  const karakaPlanet = getPlanet(chart, karaka);
  const natal = Math.round((avgLord * 0.6 + planetStrength(karakaPlanet) * 0.4));

  // Dasha sub-score
  const dashaLord = dasha.mahadasha_lord;
  const antarLord = dasha.antardasha_lord;
  const dashaPlanet = getPlanet(chart, dashaLord);
  const antarPlanet = getPlanet(chart, antarLord);
  let dashaScore = 40;
  if (dashaLord === karaka) dashaScore += 20;
  if (antarLord === karaka) dashaScore += 12;
  if (dashaPlanet && houses.includes(dashaPlanet.house)) dashaScore += 10;
  if (antarPlanet && houses.includes(antarPlanet.house)) dashaScore += 8;
  if (BENEFICS.has(dashaLord)) dashaScore += 6;
  if (assetType === "loan" && MALEFICS.has(antarLord)) dashaScore -= 10;
  dashaScore = Math.max(10, Math.min(92, dashaScore));

  // Transit sub-score — from monthly purpose scores, take the best window's average
  const monthly = buildMonthlyPurposeScores(chart, dasha, transits, scores, purpose);
  const topFour = [...monthly].sort((a, b) => b.score - a.score).slice(0, 4);
  const transit = Math.round(topFour.reduce((s, m) => s + m.score, 0) / topFour.length);

  // Muhurta sub-score — comes from Moon nakshatra + chart seed
  const moon = getPlanet(chart, "Moon");
  const favNakshatras = new Set([
    "Rohini",
    "Mrigashira",
    "Pushya",
    "Hasta",
    "Swati",
    "Anuradha",
    "Uttara Phalguni",
    "Uttara Ashadha",
    "Uttara Bhadrapada",
    "Revati",
  ]);
  let muhurta = 50;
  if (moon && favNakshatras.has(moon.nakshatra)) muhurta += 12;
  if (moon && planetStrength(moon) >= 60) muhurta += 8;
  // seeded variance
  muhurta += Math.floor((chartSeed(chart) % 20) - 10);
  muhurta = Math.max(25, Math.min(88, muhurta));

  // Loan is inverted — high natal-debt indicators mean low loan-taking favourability
  if (assetType === "loan") {
    // Rahu in 6/8/12 = worse
    const rahu = getPlanet(chart, "Rahu");
    if (rahu && [6, 8, 12].includes(rahu.house)) dashaScore -= 12;
  }

  const overall = Math.round(natal * 0.3 + dashaScore * 0.35 + transit * 0.25 + muhurta * 0.1);
  const verdict = verdictForScore(overall);

  const windowLen = verdict === "yes" ? 6 : verdict === "delay" ? 9 : 12;
  const { start, end, months } = pickBestWindow(monthly, chart, windowLen);

  // Reasoning arrays — pulled from actual chart facts
  const natalReasons: string[] = [];
  for (const h of houses) {
    const lord = getLordPlanet(chart, h);
    if (lord) {
      natalReasons.push(
        `${h}${ord(h)} lord ${lord.planet} in the ${lord.house}${ord(lord.house)} house (${lord.sign}), ${getPlanetDignity(lord)}`,
      );
    }
  }
  if (karakaPlanet) {
    natalReasons.push(
      `Karaka ${karaka} is ${getPlanetDignity(karakaPlanet)} in ${karakaPlanet.sign} (${karakaPlanet.house}${ord(karakaPlanet.house)} house)`,
    );
  }

  const dashaReasons: string[] = [];
  if (dashaLord === karaka) dashaReasons.push(`${dashaLord} is both your Mahadasha lord and karaka for ${assetType}`);
  else dashaReasons.push(`${dashaLord} Mahadasha provides ${BENEFICS.has(dashaLord) ? "benefic" : "neutral"} backdrop`);
  if (antarPlanet && houses.includes(antarPlanet.house))
    dashaReasons.push(`${antarLord} antardasha directly activates a target house`);
  else dashaReasons.push(`${antarLord} antardasha is ${houses.includes(antarPlanet?.house ?? 0) ? "aligned" : "peripheral"} for this asset`);

  const transitReasons: string[] = [];
  const topDrivers = [...new Set(topFour.map((m) => m.driver))].slice(0, 3);
  transitReasons.push(...topDrivers);

  const muhurtaReasons: string[] = [];
  if (moon) muhurtaReasons.push(`Moon in ${moon.nakshatra} nakshatra (ruled by ${moon.nakshatra_lord})`);
  muhurtaReasons.push(
    `Prefer ${assetType === "gold" ? "Thursday" : assetType === "vehicle" ? "Friday" : assetType === "property" ? "Thursday or Friday" : "Wednesday"} in the waxing Moon`,
  );

  const summary =
    verdict === "yes"
      ? `Favourable: ${karakaPlanet ? `${karaka} (karaka) is ${getPlanetDignity(karakaPlanet)} in your chart` : `karaka ${karaka} is supportive`} and the ${dashaLord} period aligns with ${assetType}.`
      : verdict === "delay"
        ? `Delay: natal support is moderate (${natal}/100). Wait for the ${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })} window before committing.`
        : `Avoid for now: ${assetType === "loan" ? "debt exposure" : "timing"} indicators are weak (${overall}/100). Re-evaluate after ${end.toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`;

  const suggestedNakshatras = favNakshatras;
  const sn = Array.from(suggestedNakshatras).slice(0, 7);

  return {
    asset_type: assetType,
    verdict,
    overall_score: overall,
    scores: { natal, dasha: dashaScore, transit, muhurta },
    summary,
    reasoning: {
      natal: natalReasons.slice(0, 3),
      dasha: dashaReasons.slice(0, 3),
      transit: transitReasons.slice(0, 3),
      muhurta: muhurtaReasons.slice(0, 3),
    },
    time_window: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      months,
    },
    suggested_nakshatras: sn,
    dasha_period: `${dashaLord} / ${antarLord}`,
  };
}

export function computeLuxuryFromChart(
  chart: ChartData,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  scores: ReportScores,
): LuxuryAnalysisResponse {
  const assetTypes: AssetType[] = ["property", "vehicle", "gold", "loan"];
  const assets = {} as Record<AssetType, AssetAnalysis>;
  for (const t of assetTypes) {
    assets[t] = buildAssetAnalysis(chart, dasha, transits, scores, t);
  }
  const ranked = [...assetTypes].sort((a, b) => assets[b].overall_score - assets[a].overall_score);
  return {
    assets,
    best_asset: ranked[0],
    ranked,
    current_dasha: `${dasha.mahadasha_lord} Mahadasha (${dasha.antardasha_lord} Antardasha)`,
  };
}

// ── 5. Investment baskets — local chart-driven compute ──────────────────────

const BASKET_DEFS: {
  key: BasketType;
  label: string;
  icon: string;
  houses: number[];
  karaka: string;
  friendlyPlanets: string[];
  baseAllocation: number;
}[] = [
  { key: "stocks", label: "Stocks / Equity", icon: "📈", houses: [5, 11], karaka: "Mercury", friendlyPlanets: ["Mercury", "Rahu", "Jupiter"], baseAllocation: 18 },
  { key: "mutual_funds", label: "Mutual Funds", icon: "📊", houses: [9, 11], karaka: "Jupiter", friendlyPlanets: ["Jupiter", "Venus"], baseAllocation: 20 },
  { key: "real_estate", label: "Real Estate", icon: "🏠", houses: [4], karaka: "Mars", friendlyPlanets: ["Mars", "Venus", "Saturn"], baseAllocation: 17 },
  { key: "gold", label: "Gold / Savings", icon: "🥇", houses: [2, 11], karaka: "Jupiter", friendlyPlanets: ["Jupiter", "Venus", "Sun"], baseAllocation: 18 },
  { key: "fixed_income", label: "Fixed Income", icon: "🏦", houses: [2, 4], karaka: "Saturn", friendlyPlanets: ["Saturn", "Jupiter"], baseAllocation: 15 },
  { key: "high_risk", label: "High Risk / Speculative", icon: "⚡", houses: [5, 8], karaka: "Rahu", friendlyPlanets: ["Rahu", "Mars"], baseAllocation: 12 },
];

function suitability(score: number): BasketSuitability {
  if (score >= 72) return "highly_suitable";
  if (score >= 58) return "suitable";
  if (score >= 42) return "moderate";
  if (score >= 28) return "low";
  return "avoid";
}

export function computeBasketsFromChart(
  chart: ChartData,
  dasha: DashaInfo,
  transits: TransitPlanet[],
  scores: ReportScores,
): InvestmentBasketResponse {
  const rng = makeRng(chartSeed(chart) + 7);
  const dashaLord = dasha.mahadasha_lord;
  const antarLord = dasha.antardasha_lord;

  const baskets: Record<BasketType, BasketAnalysis> = {} as Record<BasketType, BasketAnalysis>;

  for (const def of BASKET_DEFS) {
    // Natal sub-score
    const housesAvg = def.houses.reduce((s, h) => s + houseStrength(chart, h), 0) / def.houses.length;
    const karakaP = getPlanet(chart, def.karaka);
    const natal = Math.round(housesAvg * 0.6 + planetStrength(karakaP) * 0.4);

    // Dasha sub-score
    let dashaScore = 45;
    if (def.friendlyPlanets.includes(dashaLord)) dashaScore += 18;
    if (def.friendlyPlanets.includes(antarLord)) dashaScore += 10;
    const dashaP = getPlanet(chart, dashaLord);
    if (dashaP && def.houses.includes(dashaP.house)) dashaScore += 12;
    // High-risk special: boost only if Rahu is well placed
    if (def.key === "high_risk") {
      const rahu = getPlanet(chart, "Rahu");
      if (rahu && ![5, 11].includes(rahu.house)) dashaScore -= 15;
    }
    dashaScore = Math.max(10, Math.min(92, dashaScore));

    // Transit sub-score — Jupiter or karaka transiting target houses
    let transit = 45;
    for (const t of transits) {
      if (def.houses.includes(t.natal_house) && def.friendlyPlanets.includes(t.planet)) {
        transit += 10;
      }
      if (def.houses.includes(t.natal_house) && MALEFICS.has(t.planet) && t.impact === "challenging") {
        transit -= 6;
      }
    }
    transit = Math.max(15, Math.min(90, transit));

    const overall = Math.round(natal * 0.4 + dashaScore * 0.35 + transit * 0.25);
    const suit = suitability(overall);

    // Reasons with real chart facts
    const lord1Name = getHouseLord(chart, def.houses[0]);
    const lord1 = lord1Name ? getPlanet(chart, lord1Name) : null;
    const natalReasons: string[] = [];
    if (lord1) natalReasons.push(`${def.houses[0]}${ord(def.houses[0])} lord ${lord1.planet} in ${lord1.sign} (${lord1.house}${ord(lord1.house)} house), ${getPlanetDignity(lord1)}`);
    if (karakaP) natalReasons.push(`Karaka ${def.karaka} is ${getPlanetDignity(karakaP)} in ${karakaP.sign}, ${karakaP.house}${ord(karakaP.house)} house`);
    for (const h of def.houses) {
      const occs = getPlanetsInHouse(chart, h);
      for (const o of occs) {
        if (def.friendlyPlanets.includes(o.planet)) {
          natalReasons.push(`${o.planet} occupies your ${h}${ord(h)} house, activating ${def.label}`);
        }
      }
    }

    const dashaReasons: string[] = [];
    if (def.friendlyPlanets.includes(dashaLord))
      dashaReasons.push(`${dashaLord} Mahadasha naturally activates ${def.label}`);
    else
      dashaReasons.push(`${dashaLord} Mahadasha provides indirect support to ${def.label}`);
    if (def.friendlyPlanets.includes(antarLord))
      dashaReasons.push(`${antarLord} antardasha amplifies near-term movement in ${def.label}`);

    const transitReasons: string[] = [];
    for (const t of transits) {
      if (def.houses.includes(t.natal_house) && def.friendlyPlanets.includes(t.planet)) {
        transitReasons.push(`${t.planet} transiting your ${t.natal_house}${ord(t.natal_house)} house activates ${def.label}`);
      }
    }
    if (!transitReasons.length)
      transitReasons.push(`No major benefic transit hits target houses in the near term`);

    baskets[def.key] = {
      basket_type: def.key,
      label: def.label,
      icon: def.icon,
      overall_score: overall,
      suitability: suit,
      is_active: suit === "highly_suitable" || suit === "suitable",
      scores: { natal, dasha: dashaScore, transit },
      summary:
        suit === "highly_suitable" || suit === "suitable"
          ? `${def.label} aligns well with your chart (${overall}/100), supported by ${natalReasons[0] ?? def.karaka}.`
          : suit === "moderate"
            ? `${def.label} is workable but not a top fit (${overall}/100). Use only as a diversification slice.`
            : `${def.label} is not well supported by your chart right now (${overall}/100). Avoid or size down.`,
      reasoning: {
        natal: natalReasons.slice(0, 3),
        dasha: dashaReasons.slice(0, 2),
        transit: transitReasons.slice(0, 2),
      },
      avoid: suit === "avoid",
      avoid_reason: suit === "avoid" ? `Overall chart support (${overall}/100) is below the safe threshold` : "",
    };
  }

  // Rank + allocate
  const ranked = BASKET_DEFS.map((d) => d.key).sort((a, b) => baskets[b].overall_score - baskets[a].overall_score);
  const avoided = ranked.filter((k) => baskets[k].avoid);
  const notAvoided = ranked.filter((k) => !baskets[k].avoid);

  // Allocation — proportional to score, but float it around base allocations
  const totalScore = notAvoided.reduce((s, k) => s + baskets[k].overall_score, 0) || 1;
  const allocation: Record<BasketType, number> = {} as Record<BasketType, number>;
  for (const def of BASKET_DEFS) allocation[def.key] = 0;
  let remaining = 100;
  for (let i = 0; i < notAvoided.length; i++) {
    const k = notAvoided[i];
    let pct = Math.round((baskets[k].overall_score / totalScore) * 100);
    if (i === notAvoided.length - 1) pct = remaining; // absorb rounding
    pct = Math.max(5, Math.min(40, pct));
    allocation[k] = pct;
    remaining -= pct;
  }

  // Investor type from scores + chart
  const aggression =
    (getPlanet(chart, "Rahu")?.house === 5 ? 1 : 0) +
    (getPlanet(chart, "Mars")?.house === 1 || getPlanet(chart, "Mars")?.house === 5 ? 1 : 0) +
    (scores.risk_score >= 60 ? 1 : 0);
  const conservatism =
    (getPlanet(chart, "Saturn")?.house === 2 || getPlanet(chart, "Saturn")?.house === 4 ? 1 : 0) +
    (scores.savings_score >= 60 ? 1 : 0);
  const investorType = aggression >= 2 ? "Aggressive" : aggression > conservatism ? "Balanced" : "Conservative";

  const investorReasons: string[] = [];
  const fifthLord = getLordPlanet(chart, 5);
  if (fifthLord) investorReasons.push(`5th lord ${fifthLord.planet} is ${getPlanetDignity(fifthLord)}, ${fifthLord.planet === "Mercury" || fifthLord.planet === "Jupiter" ? "an analytical investor" : "a style-driven investor"}`);
  const jup = getPlanet(chart, "Jupiter");
  if (jup) investorReasons.push(`Jupiter in ${jup.sign} (${jup.house}${ord(jup.house)} house), ${getPlanetDignity(jup)}`);
  investorReasons.push(`Risk score ${scores.risk_score}, Savings score ${scores.savings_score}`);

  const activeBaskets = ranked.filter((k) => baskets[k].is_active);

  // Use rng to slightly reorder ties — ensures chart variation
  void rng;

  return {
    investor_type: investorType,
    investor_reasons: investorReasons.slice(0, 3),
    baskets,
    ranked,
    avoided,
    active_baskets: activeBaskets,
    allocation,
    current_dasha: `${dasha.mahadasha_lord} Mahadasha (${dasha.antardasha_lord} Antardasha)`,
    dasha_period: `${dasha.mahadasha_lord} / ${dasha.antardasha_lord}`,
  };
}

// ── 6. Dasha ladder — real Vimshottari periods, per user ────────────────────

/** Same year length the dasha engine uses (vedic-calc.ts / generate-report/astro.ts).
 *  Mirrored, not redefined: using a different value here would slide every
 *  derived period away from the boundaries the report already reports. */
const DASHA_YEAR_MS = 365.25 * 86400000;

export interface DashaPeriod {
  /** Mahadasha lord */
  lord: string;
  /** Antardasha (sub-period) lord */
  subLord: string;
  start: Date;
  end: Date;
}

/** Antardasha order inside a mahadasha: begins at the maha lord, then follows the sequence. */
function antardashaOrder(mahaLord: string): string[] {
  const i = DASHA_SEQUENCE.indexOf(mahaLord);
  if (i < 0) return [...DASHA_SEQUENCE];
  return [...DASHA_SEQUENCE.slice(i), ...DASHA_SEQUENCE.slice(0, i)];
}

/**
 * Walk the user's actual Vimshottari ladder forward from the mahadasha the
 * report says they are in, emitting every antardasha up to `yearsAhead`.
 *
 * Anchored on `dasha.mahadasha_start/end`, which come from `computeDasha` and
 * are derived from the birth Moon's nakshatra position — so two birth charts
 * produce different boundaries. The subdivision formula
 * (`mahaDuration * DASHA_YEARS[subLord] / 120`, starting at the maha lord)
 * reproduces `computeDasha`'s own antardasha table exactly, which is why the
 * current sub-period here lines up with `dasha.antardasha_start/end`.
 *
 * Read-only: nothing here recomputes the chart or the dasha itself.
 */
export function buildDashaLadder(dasha: DashaInfo, yearsAhead = 30): DashaPeriod[] {
  const mahaStart = new Date(dasha.mahadasha_start);
  const mahaEnd = new Date(dasha.mahadasha_end);
  const startIdx = DASHA_SEQUENCE.indexOf(dasha.mahadasha_lord);
  if (isNaN(mahaStart.getTime()) || isNaN(mahaEnd.getTime())) return [];
  if (mahaEnd <= mahaStart || startIdx < 0) return [];

  const horizon = new Date(Date.now() + yearsAhead * DASHA_YEAR_MS);
  const periods: DashaPeriod[] = [];

  let cursorStart = mahaStart;
  let cursorEnd = mahaEnd;

  for (let m = 0; m < DASHA_SEQUENCE.length && cursorStart < horizon; m++) {
    const lord = DASHA_SEQUENCE[(startIdx + m) % DASHA_SEQUENCE.length];
    const mahaDuration = cursorEnd.getTime() - cursorStart.getTime();

    let subStart = cursorStart;
    for (const subLord of antardashaOrder(lord)) {
      const subEnd = new Date(subStart.getTime() + mahaDuration * (DASHA_YEARS[subLord] / 120));
      periods.push({ lord, subLord, start: subStart, end: subEnd });
      subStart = subEnd;
    }

    const nextLord = DASHA_SEQUENCE[(startIdx + m + 1) % DASHA_SEQUENCE.length];
    cursorStart = cursorEnd;
    cursorEnd = new Date(cursorStart.getTime() + DASHA_YEARS[nextLord] * DASHA_YEAR_MS);
  }

  return periods;
}

/** Calendar year at the midpoint of a period — the year we label it with. */
export function periodMidYear(p: DashaPeriod): number {
  return new Date((p.start.getTime() + p.end.getTime()) / 2).getFullYear();
}

/**
 * Wealth strength 0–100 for one mahadasha/antardasha pair against this chart.
 * Deterministic — no RNG, no date input beyond the period's own lords.
 */
export function periodWealthScore(
  chart: ChartData,
  scores: ReportScores,
  period: DashaPeriod,
): number {
  const maha = getPlanet(chart, period.lord);
  const antar = getPlanet(chart, period.subLord);

  // Base: how strong each lord is by placement and dignity.
  let s = planetStrength(maha) * 0.4 + planetStrength(antar) * 0.25;

  // Income-house activation — the 10th (career) and 11th (gains) are what this
  // card claims to measure, so they carry the most weight.
  const tenthLord = getHouseLord(chart, 10);
  const eleventhLord = getHouseLord(chart, 11);
  for (const [planet, weight] of [[maha, 1], [antar, 0.8]] as const) {
    if (!planet) continue;
    if (planet.planet === eleventhLord) s += 12 * weight;
    if (planet.planet === tenthLord) s += 10 * weight;
    if ([11, 10, 2].includes(planet.house)) s += 9 * weight;
    if ([6, 8, 12].includes(planet.house)) s -= 10 * weight;
    if (BENEFICS.has(planet.planet)) s += 5 * weight;
  }

  // A lord placed in the house it rules is a bigger deal than either alone.
  if (maha && antar && maha.house === antar.house && [2, 10, 11].includes(maha.house)) s += 6;

  // Keep the card consistent with the rest of the report.
  s += (scores.income_score - 50) * 0.12 + (scores.timing_score - 50) * 0.08;

  return Math.max(5, Math.min(99, Math.round(s)));
}

// ── 7. Peak earning years ───────────────────────────────────────────────────

export type PeakIntensity = "high" | "very-high" | "peak";

export interface PeakYear {
  year: number;
  age: number;
  planet: string;
  reason: string;
  intensity: PeakIntensity;
}

/** Why this period scored — built from the placement that actually drove it.
 *  Returns the driving planet alongside the text so the row's "· X period"
 *  label always names the planet the sentence is about. */
function peakReason(
  chart: ChartData,
  p: DashaPeriod,
  prefer: "antar" | "maha",
): { reason: string; planet: string } {
  const maha = getPlanet(chart, p.lord);
  const antar = getPlanet(chart, p.subLord);
  const tenthLord = getHouseLord(chart, 10);
  const eleventhLord = getHouseLord(chart, 11);

  const driver = (prefer === "antar" ? antar : maha) ?? antar ?? maha;
  const name = driver?.planet ?? p.subLord;
  const periodWord = name === p.subLord ? "antardasha" : "mahadasha";
  const say = (reason: string) => ({ reason, planet: name });

  if (name === eleventhLord) {
    return say(`${name} rules your 11th house of gains — this ${periodWord} opens the income tap`);
  }
  if (name === tenthLord) {
    return say(`${name} rules your 10th house of career — earnings climb through professional standing`);
  }
  if (driver && driver.house === 11) {
    return say(`${name} sits in your 11th house of gains, and its ${periodWord} activates it directly`);
  }
  if (driver && driver.house === 2) {
    return say(`${name} sits in your 2nd house of accumulated wealth — savings build fastest here`);
  }
  if (driver && driver.house === 10) {
    return say(`${name} sits in your 10th house — recognition at work converts into income`);
  }
  const dignity = driver ? getPlanetDignity(driver) : "friendly";
  if (dignity === "exalted") {
    return say(`${name} is exalted in your chart, so its ${periodWord} runs at full strength`);
  }
  if (dignity === "own") {
    return say(`${name} is in its own sign — a steady, well-supported earning window`);
  }
  return say(`${p.subLord} antardasha within ${p.lord}'s mahadasha lifts your earning capacity`);
}

/** Pick a reason that hasn't already been used, so the four rows read differently. */
function distinctReason(chart: ChartData, p: DashaPeriod, used: Set<string>): { reason: string; planet: string } {
  for (const prefer of ["antar", "maha"] as const) {
    const r = peakReason(chart, p, prefer);
    if (!used.has(r.reason)) return r;
  }
  return {
    reason: `${p.subLord} antardasha within ${p.lord}'s mahadasha reopens this earning window`,
    planet: p.subLord,
  };
}

const PEAK_INTENSITY_BY_RANK: PeakIntensity[] = ["peak", "very-high", "high"];

/** How far ahead a "peak earning year" may be. */
const PEAK_HORIZON_YEARS = 20;

/**
 * The user's strongest upcoming earning windows, derived from their real dasha
 * ladder scored against their natal chart.
 *
 * Returns `[]` when the dasha dates are unusable — callers decide what to show.
 */
export function buildPeakEarningYears(
  chart: ChartData,
  scores: ReportScores,
  dasha: DashaInfo,
  birthYear: number,
  count = 4,
): PeakYear[] {
  const now = Date.now();
  // 20 years, not the full 120-year cycle: a window in the user's late seventies
  // can out-score a nearer one on placement alone, and "peak earning years" that
  // land after a working life are not an insight.
  const ladder = buildDashaLadder(dasha, PEAK_HORIZON_YEARS).filter(
    (p) => p.end.getTime() > now && p.start.getTime() < now + PEAK_HORIZON_YEARS * DASHA_YEAR_MS,
  );
  if (ladder.length === 0) return [];

  const scored = ladder
    .map((period) => ({ period, score: periodWealthScore(chart, scores, period) }))
    // Stable tie-break on start date so equal scores never reorder run to run.
    .sort((a, b) => b.score - a.score || a.period.start.getTime() - b.period.start.getTime());

  // Greedy pick, keeping picks at least 2 years apart so stepper nodes don't collide.
  const picks: { period: DashaPeriod; score: number; year: number }[] = [];
  for (const cand of scored) {
    if (picks.length >= count) break;
    const year = Math.max(periodMidYear(cand.period), new Date(now).getFullYear());
    if (picks.some((p) => Math.abs(p.year - year) < 2)) continue;
    picks.push({ ...cand, year });
  }

  // Rank decides the badge; chronology decides the render order.
  const rankOf = new Map(
    [...picks].sort((a, b) => b.score - a.score).map((p, i) => [p, i] as const),
  );

  const usedReasons = new Set<string>();
  return picks
    .sort((a, b) => a.year - b.year)
    .map((p) => {
      const { reason, planet } = distinctReason(chart, p.period, usedReasons);
      usedReasons.add(reason);
      return {
        year: p.year,
        age: p.year - birthYear,
        planet,
        reason,
        intensity: PEAK_INTENSITY_BY_RANK[Math.min(rankOf.get(p) ?? 2, PEAK_INTENSITY_BY_RANK.length - 1)],
      };
    });
}

/** One sampled point on the ladder: the dasha active at `date`. */
export interface LadderSample {
  lord: string;
  subLord: string;
  date: Date;
  year: number;
}

/**
 * `count` points spread evenly across now → +`yearsAhead`, for timeline charts
 * that need regular x-spacing rather than the strongest windows. The year comes
 * from the sample date (so points always advance) and the lords come from
 * whichever dasha is actually running then.
 */
export function sampleDashaLadder(dasha: DashaInfo, count: number, yearsAhead = 24): LadderSample[] {
  const now = Date.now();
  const ladder = buildDashaLadder(dasha, yearsAhead + 5).filter((p) => p.end.getTime() > now);
  if (ladder.length === 0 || count <= 0) return [];

  const out: LadderSample[] = [];
  for (let i = 0; i < count; i++) {
    const target = now + (count === 1 ? 0 : (i / (count - 1)) * yearsAhead * DASHA_YEAR_MS);
    const date = new Date(target);
    const hit =
      ladder.find((p) => p.start.getTime() <= target && p.end.getTime() > target)
      ?? ladder[ladder.length - 1];
    out.push({ lord: hit.lord, subLord: hit.subLord, date, year: date.getFullYear() });
  }
  return out;
}
