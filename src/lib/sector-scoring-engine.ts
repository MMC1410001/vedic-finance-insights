// Sector Favorability Analysis — Scoring Engine
// Deterministic: identical BirthDetails always produce identical output.

import type { BirthDetails } from "./astro-engine";
import type { PlanetName, SectorId } from "./sectorMappings";
import { sectorMappings } from "./sectorMappings";
import { buildExplanation, buildSummaryParagraph } from "./explanation-builder";

// ---------------------------------------------------------------------------
// Seeded-random helpers (same pattern as kundali-engine.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PlanetPlacement {
  planet: PlanetName;
  house: number;        // 1–12
  sign: string;
  degree: number;       // 0–29
  isRetrograde: boolean;
  d9Confirmed: boolean;
}

export interface ChartInput {
  planets: PlanetPlacement[];
  tenthHouseSign: string;
  tenthLord: PlanetName;
  tenthLordHouse: number;
  atmakaraka: PlanetName;
  amatyakaraka: PlanetName;
  mahadashaLord: PlanetName;
  antardashaLord: PlanetName;
  conjunctions: Array<{ house: number; planets: PlanetName[] }>;
  d9Absent: boolean;
  planetsInHouse: (house: number) => PlanetName[];
}

export interface SectorScore {
  sectorId: SectorId;
  rawScore: number;
  tenthHouseScore: number;
  tenthLordScore: number;
  conjunctionScore: number;
  incomeSupportScore: number;
  d9Score: number;
  dashaScore: number;
  directionalScore: number;
  timingActivated: boolean;
  tieProximityFlag: boolean;
  supportingPlanets: PlanetName[];
  activeCombinations: string[];
}

export type FavorabilityLabel = "Highly Favorable" | "Favorable" | "Emerging" | "Neutral" | "Weak";

export interface SectorExplanation {
  headline: string;
  supportType: "career" | "income" | "timing" | "mixed";
  planets: PlanetName[];
  houses: number[];
  tenthHouseLogic: string;
  tenthLordLogic: string;
  incomeSupportLogic: string;
  d9Logic: string;
  dashaLogic: string;
  opportunityThemes: string[];
  riskTendency: string;
  lowConfidenceQualifier?: string;
  timingNote?: string;
}

export interface SectorResult {
  sectorId: SectorId;
  sectorName: string;
  sectorIcon: string;
  overallScore: number;
  favorabilityLabel: FavorabilityLabel;
  confidenceScore: number;
  score: SectorScore;
  explanation: SectorExplanation;
  timingActivated: boolean;
  tieProximityFlag: boolean;
}

export interface SectorFavorabilityOutput {
  sectors: SectorResult[];
  primarySector: SectorResult;
  secondarySector: SectorResult;
  incomeSector: SectorResult;
  activeSector: SectorResult | null;
  summaryParagraph: string;
  mixedSignalsFlag: boolean;
  noActiveDashaFlag: boolean;
  nearEqualSignalsFlag: boolean;
  d9AbsentFlag: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANETS: PlanetName[] = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
];

// Sign → ruling planet (traditional Vedic rulerships)
const SIGN_LORD: Record<string, PlanetName> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

// Vimshottari Dasha sequence (27 nakshatras mapped to 9 lords, repeating)
const VIMSHOTTARI_SEQUENCE: PlanetName[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

// ---------------------------------------------------------------------------
// Standalone exported helper (needed for property tests in Task 4)
// ---------------------------------------------------------------------------

export function assignFavorabilityLabel(score: number): FavorabilityLabel {
  if (score >= 80) return "Highly Favorable";
  if (score >= 60) return "Favorable";
  if (score >= 40) return "Emerging";
  if (score >= 20) return "Neutral";
  return "Weak";
}

// ---------------------------------------------------------------------------
// Step 1 — Derive ChartInput from BirthDetails
// ---------------------------------------------------------------------------

export function deriveChartInput(details: BirthDetails): ChartInput {
  const seed = hashString(
    details.dateOfBirth + details.timeOfBirth + details.placeOfBirth + "sector"
  );
  const rng = seededRandom(seed);

  // Place all 9 planets
  const planets: PlanetPlacement[] = PLANETS.map((planet) => {
    const house = Math.floor(rng() * 12) + 1;
    const degree = Math.floor(rng() * 30);
    const isRetrograde = rng() > 0.7;
    const d9Confirmed = rng() > 0.5;
    const sign = SIGNS[(house - 1) % 12];
    return { planet, house, sign, degree, isRetrograde, d9Confirmed };
  });

  // 10th house sign — derived from ascendant offset
  // ascendant sign index is derived from the first rng call pattern;
  // here we use the 10th house directly: signs[(10-1) % 12] = signs[9] = "Capricorn" as base,
  // but we derive it from the actual planet placements for consistency.
  // The 10th house sign is signs[(10 - 1) % 12] relative to ascendant.
  // Since we don't track ascendant separately, we use the canonical mapping:
  const tenthHouseSign = SIGNS[9]; // Capricorn as the base 10th house sign

  // 10th lord
  const tenthLord: PlanetName = SIGN_LORD[tenthHouseSign];

  // 10th lord's house
  const tenthLordPlacement = planets.find((p) => p.planet === tenthLord);
  const tenthLordHouse = tenthLordPlacement ? tenthLordPlacement.house : 1;

  // Atmakaraka = planet with highest degree
  const sortedByDegree = [...planets].sort((a, b) => b.degree - a.degree);
  const atmakaraka: PlanetName = sortedByDegree[0].planet;
  const amatyakaraka: PlanetName = sortedByDegree[1].planet;

  // Mahadasha lord — derived from Moon's nakshatra
  const moonPlacement = planets.find((p) => p.planet === "Moon")!;
  const moonDegreeTotal = (moonPlacement.house - 1) * 30 + moonPlacement.degree;
  const nakshatraIndex = Math.floor(moonDegreeTotal / (360 / 27));
  const mahadashaIndex = nakshatraIndex % 9;
  const mahadashaLord: PlanetName = VIMSHOTTARI_SEQUENCE[mahadashaIndex];

  // Antardasha lord = next in sequence
  const antardashaLord: PlanetName = VIMSHOTTARI_SEQUENCE[(mahadashaIndex + 1) % 9];

  // Conjunctions — group planets by house, keep groups with 2+ planets
  const houseMap = new Map<number, PlanetName[]>();
  for (const p of planets) {
    const existing = houseMap.get(p.house) ?? [];
    existing.push(p.planet);
    houseMap.set(p.house, existing);
  }
  const conjunctions: Array<{ house: number; planets: PlanetName[] }> = [];
  for (const [house, planetsInHouse] of houseMap.entries()) {
    if (planetsInHouse.length >= 2) {
      conjunctions.push({ house, planets: planetsInHouse });
    }
  }

  // planetsInHouse convenience method
  const planetsInHouse = (house: number): PlanetName[] =>
    planets.filter((p) => p.house === house).map((p) => p.planet);

  return {
    planets,
    tenthHouseSign,
    tenthLord,
    tenthLordHouse,
    atmakaraka,
    amatyakaraka,
    mahadashaLord,
    antardashaLord,
    conjunctions,
    d9Absent: false,
    planetsInHouse,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — Score Each Sector (6-Step Derivation)
// ---------------------------------------------------------------------------

export function scoreSectors(input: ChartInput): SectorScore[] {
  return sectorMappings.map((sector) => {
    const supportingPlanetsSet = new Set<PlanetName>();
    const activeCombinations: string[] = [];

    // --- Step 1: 10th house planet match (0–30 pts) ---
    let tenthHouseScore = 0;
    for (const planet of input.planetsInHouse(10)) {
      if (sector.primaryPlanets.includes(planet)) {
        tenthHouseScore = Math.min(30, tenthHouseScore + 30);
        supportingPlanetsSet.add(planet);
      } else if (sector.secondaryPlanets.includes(planet)) {
        tenthHouseScore = Math.min(30, tenthHouseScore + 15);
        supportingPlanetsSet.add(planet);
      }
    }

    // --- Step 2: 10th lord placement (0–25 pts) ---
    let tenthLordScore = 0;
    if (sector.relevantHouses.includes(input.tenthLordHouse)) {
      tenthLordScore = 25;
      supportingPlanetsSet.add(input.tenthLord);
    } else if (sector.primaryPlanets.includes(input.tenthLord)) {
      tenthLordScore = 20;
      supportingPlanetsSet.add(input.tenthLord);
    }

    // --- Step 3: Conjunction/aspect match (0–20 pts) ---
    let conjunctionScore = 0;
    for (const conjunction of input.conjunctions) {
      for (const trigger of sector.combinationTriggers) {
        const allPresent = trigger.planets.every((p) => conjunction.planets.includes(p));
        if (allPresent) {
          if (trigger.requiresHouse !== undefined && conjunction.house !== trigger.requiresHouse) {
            continue;
          }
          conjunctionScore = Math.min(20, conjunctionScore + 20);
          for (const p of trigger.planets) supportingPlanetsSet.add(p);
          if (!activeCombinations.includes(trigger.label)) {
            activeCombinations.push(trigger.label);
          }
        }
      }
    }

    // --- Step 4: 2nd/11th house income support (0–15 pts) ---
    let incomeSupportScore = 0;
    for (const house of [2, 11]) {
      for (const planet of input.planetsInHouse(house)) {
        if (sector.primaryPlanets.includes(planet)) {
          incomeSupportScore = Math.min(15, incomeSupportScore + 15);
          supportingPlanetsSet.add(planet);
        } else if (sector.secondaryPlanets.includes(planet)) {
          incomeSupportScore = Math.min(15, incomeSupportScore + 8);
          supportingPlanetsSet.add(planet);
        }
      }
    }

    // --- Step 5: D9 confirmation (0–5 pts) ---
    let d9Score = 0;
    if (!input.d9Absent) {
      for (const confirmPlanet of sector.d9ConfirmationPlanets) {
        const placement = input.planets.find((p) => p.planet === confirmPlanet);
        if (placement?.d9Confirmed) {
          d9Score = 5;
          supportingPlanetsSet.add(confirmPlanet);
          break; // first match wins
        }
      }
    }

    // --- Step 6: Dasha timing (0–5 pts) + directional bonus (0–5 pts) ---
    let dashaScore = 0;
    let timingActivated = false;
    if (sector.primaryPlanets.includes(input.mahadashaLord)) {
      dashaScore = 5;
      timingActivated = true;
      supportingPlanetsSet.add(input.mahadashaLord);
    } else if (sector.primaryPlanets.includes(input.antardashaLord)) {
      dashaScore = 5;
      timingActivated = true;
      supportingPlanetsSet.add(input.antardashaLord);
    }

    let directionalScore = 0;
    if (sector.primaryPlanets.includes(input.atmakaraka)) {
      directionalScore = 5;
      supportingPlanetsSet.add(input.atmakaraka);
    } else if (sector.primaryPlanets.includes(input.amatyakaraka)) {
      directionalScore = 5;
      supportingPlanetsSet.add(input.amatyakaraka);
    }

    const rawScore =
      tenthHouseScore +
      tenthLordScore +
      conjunctionScore +
      incomeSupportScore +
      d9Score +
      dashaScore +
      directionalScore;

    return {
      sectorId: sector.id,
      rawScore,
      tenthHouseScore,
      tenthLordScore,
      conjunctionScore,
      incomeSupportScore,
      d9Score,
      dashaScore,
      directionalScore,
      timingActivated,
      tieProximityFlag: false,
      supportingPlanets: Array.from(supportingPlanetsSet),
      activeCombinations,
    };
  });
}

// ---------------------------------------------------------------------------
// Step 3 — Normalize and Label
// ---------------------------------------------------------------------------

export function normalizeSectors(scores: SectorScore[], input: ChartInput): SectorResult[] {
  // Compute normalized overallScore for each sector
  const normalized = scores.map((score) => {
    const overallScore = Math.min(100, Math.round((score.rawScore / 105) * 100));
    return { score, overallScore };
  });

  // Set tieProximityFlag: true if any OTHER sector's normalized score is within 5 points
  const withTieFlag = normalized.map(({ score, overallScore }, i) => {
    const tieProximityFlag = normalized.some(
      (other, j) => j !== i && Math.abs(other.overallScore - overallScore) <= 5
    );
    return { score, overallScore, tieProximityFlag };
  });

  // Build SectorResult array
  const results: SectorResult[] = withTieFlag.map(({ score, overallScore, tieProximityFlag }) => {
    const favorabilityLabel = assignFavorabilityLabel(overallScore);

    // Confidence score
    let confidenceScore = overallScore;
    if (input.d9Absent) confidenceScore -= 20;
    if (input.planets.length < 3) confidenceScore -= 10;
    confidenceScore = Math.min(100, Math.max(0, confidenceScore));

    // Sector metadata from sectorMappings
    const mapping = sectorMappings.find((m) => m.id === score.sectorId)!;

    const explanation = buildExplanation(score, input, mapping, confidenceScore);

    return {
      sectorId: score.sectorId,
      sectorName: mapping.name,
      sectorIcon: mapping.icon,
      overallScore,
      favorabilityLabel,
      confidenceScore,
      score: { ...score, tieProximityFlag },
      explanation,
      timingActivated: score.timingActivated,
      tieProximityFlag,
    };
  });

  // Sort descending by overallScore
  return results.sort((a, b) => b.overallScore - a.overallScore);
}

// ---------------------------------------------------------------------------
// Step 4 — Identify Output Sectors
// ---------------------------------------------------------------------------

export function identifyOutputSectors(
  results: SectorResult[],
  input: ChartInput
): Pick<
  SectorFavorabilityOutput,
  | "primarySector"
  | "secondarySector"
  | "incomeSector"
  | "activeSector"
  | "mixedSignalsFlag"
  | "noActiveDashaFlag"
  | "nearEqualSignalsFlag"
  | "d9AbsentFlag"
> {
  const primarySector = results[0];
  const secondarySector = results[1];

  // incomeSector = sector with max incomeSupportScore
  const incomeSector = results.reduce((best, current) =>
    current.score.incomeSupportScore > best.score.incomeSupportScore ? current : best
  );

  // activeSector = first sector where timingActivated === true, else null
  const activeSector = results.find((r) => r.timingActivated) ?? null;

  // mixedSignalsFlag = true if ALL sectors have overallScore < 40
  const mixedSignalsFlag = results.every((r) => r.overallScore < 40);

  // noActiveDashaFlag = true if activeSector is null
  const noActiveDashaFlag = activeSector === null;

  // nearEqualSignalsFlag = true if top-3 sectors all within 5 points of each other
  const nearEqualSignalsFlag =
    results.length >= 3 &&
    results[0].overallScore - results[2].overallScore <= 5;

  const d9AbsentFlag = input.d9Absent;

  return {
    primarySector,
    secondarySector,
    incomeSector,
    activeSector,
    mixedSignalsFlag,
    noActiveDashaFlag,
    nearEqualSignalsFlag,
    d9AbsentFlag,
  };
}

// ---------------------------------------------------------------------------
// Public API — computeSectorFavorability
// ---------------------------------------------------------------------------

/**
 * Pure function: (BirthDetails) → SectorFavorabilityOutput
 * No side effects, no state, no network calls.
 * Identical BirthDetails always produce identical output.
 *
 * Pipeline:
 *   1. deriveChartInput(details)       → ChartInput
 *   2. scoreSectors(input)             → SectorScore[]
 *   3. normalizeSectors(scores, input) → SectorResult[] (sorted desc)
 *   4. identifyOutputSectors(results, input) → output sector identifiers + flags
 *   5. Attach placeholder summaryParagraph (Task 8 will wire in explanation-builder)
 *   6. Return complete SectorFavorabilityOutput
 */
export function computeSectorFavorability(details: BirthDetails): SectorFavorabilityOutput {
  const input = deriveChartInput(details);
  const scores = scoreSectors(input);
  const results = normalizeSectors(scores, input);
  const outputSectors = identifyOutputSectors(results, input);

  return {
    sectors: results,
    ...outputSectors,
    summaryParagraph: buildSummaryParagraph({ sectors: results, ...outputSectors }),
  };
}
