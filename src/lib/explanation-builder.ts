// Sector Favorability Analysis — Explanation Builder
// Generates deterministic interpretation text from scored sector data.
// Uses authentic Vedic terminology throughout.

import type {
  SectorScore,
  ChartInput,
  SectorExplanation,
  SectorFavorabilityOutput,
} from "./sector-scoring-engine";
import type { SectorMapping } from "./sectorMappings";

// ---------------------------------------------------------------------------
// Forbidden phrase guard
// ---------------------------------------------------------------------------

const FORBIDDEN_PHRASES = ["buy", "sell", "invest in", "guaranteed", "stock ticker", "returns of"];

export function checkForbiddenPhrases(text: string): string {
  let result = text;
  for (const phrase of FORBIDDEN_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    if (regex.test(result)) {
      if (import.meta.env.DEV) {
        throw new Error(`Forbidden phrase detected in explanation text: "${phrase}"`);
      } else {
        console.warn(`[explanation-builder] Forbidden phrase stripped: "${phrase}"`);
        result = result.replace(new RegExp(phrase, "gi"), "");
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-sector opportunity themes and risk tendencies
// ---------------------------------------------------------------------------

const SECTOR_THEMES: Record<string, { opportunities: string[]; risk: string }> = {
  "dairy-beverages": {
    opportunities: [
      "Consumer dairy and beverage brand development",
      "Liquid-based product distribution networks",
      "Nourishment and wellness-linked ventures",
    ],
    risk: "Seasonal demand fluctuations may affect consistency of results.",
  },
  "hotels-hospitality": {
    opportunities: [
      "Premium hospitality and resort ventures",
      "Food & beverage brand building",
      "Experiential travel and accommodation services",
    ],
    risk: "Over-expansion without operational infrastructure can dilute quality.",
  },
  "shipping-marine": {
    opportunities: [
      "Maritime logistics and freight services",
      "Foreign trade facilitation and port operations",
      "Navigation infrastructure and ocean-linked commerce",
    ],
    risk: "Regulatory complexity in international waters requires careful navigation.",
  },
  travel: {
    opportunities: [
      "Travel services and tour operations",
      "Aviation and mobility platforms",
      "Cross-border hospitality and tourism",
    ],
    risk: "External disruptions can impact travel demand unpredictably.",
  },
  fmcg: {
    opportunities: [
      "Fast-moving consumer goods distribution",
      "Mass-market retail and trade networks",
      "Daily-use product brand building",
    ],
    risk: "Thin margins require high volume and operational efficiency.",
  },
  glass: {
    opportunities: [
      "Specialty glass and refined material manufacturing",
      "Luxury packaging and aesthetic product lines",
      "Architectural and decorative glass applications",
    ],
    risk: "Capital-intensive production cycles require sustained financial backing.",
  },
  "real-estate": {
    opportunities: [
      "Residential and commercial property development",
      "Land acquisition and infrastructure projects",
      "Construction and heavy industry ventures",
    ],
    risk: "Real estate cycles are long; liquidity constraints may arise in downturns.",
  },
};

// ---------------------------------------------------------------------------
// Helper: ordinal numbers
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------------------
// buildExplanation — uses Vedic terminology throughout
// ---------------------------------------------------------------------------

export function buildExplanation(
  score: SectorScore,
  input: ChartInput,
  mapping: SectorMapping,
  confidenceScore: number
): SectorExplanation {
  // 1. headline — uses Vedic terms
  let headline: string;
  if (score.activeCombinations.length > 0) {
    headline = `${score.activeCombinations[0]} Graha Yoga strengthens ${mapping.name} inclination`;
  } else {
    const tenthPlanets = input.planetsInHouse(10);
    const matchingTenthPlanet = tenthPlanets.find(
      (p) => mapping.primaryPlanets.includes(p) || mapping.secondaryPlanets.includes(p)
    );
    if (score.tenthHouseScore > 0 && matchingTenthPlanet) {
      headline = `${matchingTenthPlanet} in Karma Bhava (10th) activates ${mapping.name} themes`;
    } else {
      headline = `Kundali patterns indicate inclination toward ${mapping.name} themes`;
    }
  }

  // 2. supportType
  let supportType: SectorExplanation["supportType"];
  if (score.timingActivated && score.tenthHouseScore > 0) {
    supportType = "mixed";
  } else if (score.timingActivated) {
    supportType = "timing";
  } else if (score.incomeSupportScore > 0 && score.tenthHouseScore === 0) {
    supportType = "income";
  } else {
    supportType = "career";
  }

  // 3. planets & 4. houses
  const planets = score.supportingPlanets;
  const houses: number[] = [];
  if (score.tenthHouseScore > 0) houses.push(10);
  if (score.incomeSupportScore > 0) {
    const h2Match = input.planetsInHouse(2).some(
      (p) => mapping.primaryPlanets.includes(p) || mapping.secondaryPlanets.includes(p)
    );
    const h11Match = input.planetsInHouse(11).some(
      (p) => mapping.primaryPlanets.includes(p) || mapping.secondaryPlanets.includes(p)
    );
    if (h2Match && !houses.includes(2)) houses.push(2);
    if (h11Match && !houses.includes(11)) houses.push(11);
  }
  if (score.tenthLordScore > 0 && !houses.includes(input.tenthLordHouse)) {
    houses.push(input.tenthLordHouse);
  }

  // 5. tenthHouseLogic — Karma Bhava
  let tenthHouseLogic: string;
  if (score.tenthHouseScore > 0) {
    const matchedPlanet = input.planetsInHouse(10).find(
      (p) => mapping.primaryPlanets.includes(p) || mapping.secondaryPlanets.includes(p)
    );
    tenthHouseLogic = matchedPlanet
      ? `${matchedPlanet} occupies Karma Bhava (10th house), directly activating ${mapping.name} vocational themes.`
      : `No Graha in Karma Bhava aligns with ${mapping.name} primary rulers.`;
  } else {
    tenthHouseLogic = `No Graha in Karma Bhava (10th house) directly aligns with ${mapping.name} primary rulers.`;
  }

  // 6. tenthLordLogic — Dashamesh
  let tenthLordLogic: string;
  if (score.tenthLordScore > 0) {
    const isRelevant = mapping.relevantHouses.includes(input.tenthLordHouse);
    tenthLordLogic = `Dashamesh (10th lord) ${input.tenthLord} is placed in the ${ordinal(input.tenthLordHouse)} Bhava, ${isRelevant ? "a favorable placement" : "an aligned position"} for ${mapping.name} themes.`;
  } else {
    tenthLordLogic = `Dashamesh ${input.tenthLord} placement in the ${ordinal(input.tenthLordHouse)} Bhava does not directly activate ${mapping.name} themes.`;
  }

  // 7. incomeSupportLogic — Dhana & Labha Bhava
  let incomeSupportLogic: string;
  if (score.incomeSupportScore > 0) {
    let matchedPlanet: string | undefined;
    let matchedHouse: number | undefined;
    for (const house of [2, 11]) {
      const found = input.planetsInHouse(house).find(
        (p) => mapping.primaryPlanets.includes(p) || mapping.secondaryPlanets.includes(p)
      );
      if (found) { matchedPlanet = found; matchedHouse = house; break; }
    }
    incomeSupportLogic = matchedPlanet && matchedHouse !== undefined
      ? `${matchedPlanet} in ${matchedHouse === 2 ? "Dhana Bhava (2nd)" : "Labha Bhava (11th)"} supports income through ${mapping.name}-aligned activities.`
      : `Income Bhavas do not strongly support ${mapping.name} at this time.`;
  } else {
    incomeSupportLogic = `Dhana Bhava (2nd) and Labha Bhava (11th) do not strongly support ${mapping.name} at this time.`;
  }

  // 8. d9Logic — Navamsa
  let d9Logic: string;
  if (input.d9Absent) {
    d9Logic = `Navamsa (D9) data unavailable: D9 confirmation omitted from this reading.`;
  } else if (score.d9Score > 0) {
    const confirmedPlanet = mapping.d9ConfirmationPlanets.find((p) => {
      const placement = input.planets.find((pl) => pl.planet === p);
      return placement?.d9Confirmed;
    });
    d9Logic = confirmedPlanet
      ? `${confirmedPlanet}'s strength is confirmed in the Navamsa (D9) chart, reinforcing ${mapping.name} inclination.`
      : `Navamsa chart does not provide additional confirmation for ${mapping.name}.`;
  } else {
    d9Logic = `Navamsa (D9) chart does not provide additional confirmation for ${mapping.name} at this time.`;
  }

  // 9. dashaLogic — Vimshottari Dasha
  let dashaLogic: string;
  if (score.dashaScore > 0 && mapping.primaryPlanets.includes(input.mahadashaLord)) {
    dashaLogic = `Vimshottari ${input.mahadashaLord} Mahadasha activates ${mapping.name} themes: this is a particularly relevant period.`;
  } else if (score.dashaScore > 0) {
    dashaLogic = `${input.antardashaLord} Antardasha within the current Mahadasha activates ${mapping.name} themes in this sub-period.`;
  } else {
    dashaLogic = `No active Mahadasha or Antardasha currently aligns with ${mapping.name} primary Grahas.`;
  }

  // 10–11. themes & risk
  const opportunityThemes = SECTOR_THEMES[mapping.id]?.opportunities ?? [];
  const riskTendency = SECTOR_THEMES[mapping.id]?.risk ?? "";

  // 12. timingNote
  const timingNote = score.timingActivated
    ? `Active ${input.mahadashaLord} Mahadasha (Vimshottari) makes this a particularly relevant window for ${mapping.name} themes.`
    : undefined;

  // 13. lowConfidenceQualifier
  const lowConfidenceQualifier =
    confidenceScore < 40
      ? `Note: Limited Graha alignment reduces confidence in this reading. Treat as a directional signal.`
      : undefined;

  const explanation: SectorExplanation = {
    headline: checkForbiddenPhrases(headline),
    supportType,
    planets,
    houses,
    tenthHouseLogic: checkForbiddenPhrases(tenthHouseLogic),
    tenthLordLogic: checkForbiddenPhrases(tenthLordLogic),
    incomeSupportLogic: checkForbiddenPhrases(incomeSupportLogic),
    d9Logic: checkForbiddenPhrases(d9Logic),
    dashaLogic: checkForbiddenPhrases(dashaLogic),
    opportunityThemes: opportunityThemes.map(checkForbiddenPhrases),
    riskTendency: checkForbiddenPhrases(riskTendency),
    ...(timingNote !== undefined ? { timingNote: checkForbiddenPhrases(timingNote) } : {}),
    ...(lowConfidenceQualifier !== undefined ? { lowConfidenceQualifier: checkForbiddenPhrases(lowConfidenceQualifier) } : {}),
  };

  return explanation;
}

// ---------------------------------------------------------------------------
// buildSummaryParagraph — uses Vedic terminology
// ---------------------------------------------------------------------------

export function buildSummaryParagraph(
  output: Omit<SectorFavorabilityOutput, "summaryParagraph">
): string {
  const primaryPlanet = output.primarySector.score.supportingPlanets[0] ?? "planetary";
  const secondaryPlanet = output.secondarySector.score.supportingPlanets[0] ?? "supporting";

  const activeSectorLine = output.activeSector
    ? `Current ${output.activeSector.score.supportingPlanets[0] ?? "planetary"} Mahadasha activates ${output.activeSector.sectorName}, making this a favorable period to explore these themes.`
    : `No active Mahadasha currently aligns with a specific sector.`;

  const incomeLine = `Dhana and Labha Bhavas indicate stronger income potential in ${output.incomeSector.sectorName}-aligned activities.`;

  const paragraph = `Your Kundali shows ${primaryPlanet} influence on Karma Bhava (10th house), supported by ${secondaryPlanet}. This indicates stronger inclination toward ${output.primarySector.sectorName} and ${output.secondarySector.sectorName} themes. ${activeSectorLine} ${incomeLine}`;

  return checkForbiddenPhrases(paragraph);
}
