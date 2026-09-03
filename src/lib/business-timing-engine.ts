/**
 * Business Decision, Transaction & Expansion Timing Engine
 * Strict Vedic Astrology — Muhurta + Dasha + Transit based
 *
 * Method: Permission (Dasha) → Environment (Transit) → Execution (Muhurta)
 * No assumptions. All values derived from real birth data + astronomy-engine.
 */

import * as Astro from "astronomy-engine";
import {
  buildVedicChart,
  SIGN_LORDS,
  type BirthInput,
  type VedicChart,
} from "./vedic-calc";
import {
  computeTara,
  computePaksha,
  checkGandanta,
  computeRahuKaal,
} from "./daily-trading-engine";

// ─── helpers ──────────────────────────────────────────────────────────────────

function mod360(x: number) {
  return ((x % 360) + 360) % 360;
}

function toJD(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function ayanamsaForDate(date: Date): number {
  const jd = toJD(date);
  const T = (jd - 2451545.0) / 36525;
  return 23.8531 + (50.2878 / 3600) * T * 100;
}

function getPlanetSidLon(body: Astro.Body, date: Date): number {
  const vec = Astro.GeoVector(body, date, true);
  const ecl = Astro.Ecliptic(vec);
  const trop = mod360(ecl.elon);
  return mod360(trop - ayanamsaForDate(date));
}

function getMoonSidLon(date: Date): number {
  const sph = Astro.EclipticGeoMoon(date);
  const trop = mod360(sph.lon);
  return mod360(trop - ayanamsaForDate(date));
}

function getRahuSidLon(date: Date): number {
  const jd = toJD(date);
  const T = (jd - 2451545.0) / 36525;
  const trop = mod360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000);
  return mod360(trop - ayanamsaForDate(date));
}

function sidLonToHouse(sidLon: number, ascSignNum: number): number {
  const signNum = Math.floor(mod360(sidLon) / 30) % 12;
  return ((signNum - ascSignNum + 12) % 12) + 1;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BusinessPhase = "Expansion" | "Stable" | "Risk" | "Hold";
export type ActionVerdict = "Expand" | "Invest Cautiously" | "Hold" | "Cut Costs";
export type Intensity = "High" | "Medium" | "Low";
export type DecisionArea =
  | "Business Expansion"
  | "Large Investment"
  | "Transaction (Buy/Sell)"
  | "Cash Flow"
  | "Scaling vs Holding";

export interface DashaEligibility {
  mahadasha: string;
  mahadasha_end: Date;
  antardasha: string;
  antardasha_end: Date;
  mahaHouses: number[];   // houses ruled by mahadasha lord in natal chart
  antarHouses: number[];  // houses ruled by antardasha lord in natal chart
  verdict: "Favorable" | "Neutral" | "Unfavorable";
  reason: string;
}

export interface TransitLayer {
  planet: string;
  sign: string;
  transitHouse: number;
  isRetrograde: boolean;
  verdict: "Expansion" | "Consolidation" | "Caution" | "Neutral";
  note: string;
  score: number;
}

export interface DecisionSignal {
  area: DecisionArea;
  signal: "Go" | "Caution" | "Hold";
  reason: string;
  activatingHouses: number[];
}

export interface MuhurtaWindow {
  date: Date;
  taraName: string;
  taraVerdict: "favorable" | "neutral" | "avoid";
  tithi: number;
  tithiName: string;
  paksha: "Shukla" | "Krishna";
  isGandanta: boolean;
  isRahuKaal: boolean;
  score: number;
  label: string;
}

export interface BusinessTimingResult {
  phase: BusinessPhase;
  action: ActionVerdict;
  intensity: Intensity;
  dashaLayer: DashaEligibility;
  transitLayer: TransitLayer[];
  decisionSignals: DecisionSignal[];
  muhurtaToday: MuhurtaWindow;
  topMuhurtaDates: MuhurtaWindow[];   // top 3 from next 30 days
  broadTimingWindow: string;          // e.g. "Until Mar 2026"
  astrologerSummary: string;
  overallScore: number;               // 0–100
}

// ─── House lord lookup ────────────────────────────────────────────────────────
// Returns which houses a planet rules in the natal chart (1–12)

function housesRuledBy(planet: string, ascSignNum: number): number[] {
  const ruled: number[] = [];
  for (let h = 0; h < 12; h++) {
    const signNum = (ascSignNum + h) % 12;
    const signs = [
      "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
      "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
    ];
    const lord = SIGN_LORDS[signs[signNum]];
    if (lord === planet) ruled.push(h + 1);
  }
  return ruled;
}

// ─── Layer 1: Dasha Eligibility ───────────────────────────────────────────────

const FAVORABLE_HOUSES = [2, 7, 9, 10, 11];
const NEUTRAL_HOUSES   = [1, 3, 4, 5, 6];
const UNFAVORABLE_HOUSES = [6, 8, 12];

function computeDashaEligibility(chart: VedicChart): DashaEligibility {
  const { dasha, ascendant } = chart;
  const ascSignNum = ascendant.signNum;

  const mahaHouses  = housesRuledBy(dasha.mahadasha, ascSignNum);
  const antarHouses = housesRuledBy(dasha.antardasha, ascSignNum);
  const allHouses   = [...mahaHouses, ...antarHouses];

  const hasFavorable   = allHouses.some(h => FAVORABLE_HOUSES.includes(h));
  const hasUnfavorable = allHouses.some(h => UNFAVORABLE_HOUSES.includes(h));

  // 8th and 12th are hard stops; 6th alone is manageable
  const hasHardStop = allHouses.some(h => h === 8 || h === 12);

  let verdict: DashaEligibility["verdict"];
  let reason: string;

  if (hasHardStop && !hasFavorable) {
    verdict = "Unfavorable";
    reason = `${dasha.mahadasha}–${dasha.antardasha} period activates the ${allHouses.filter(h => [8,12].includes(h)).join("th, ")}th house: avoid expansion, focus on stability and cost control.`;
  } else if (hasFavorable && !hasHardStop) {
    verdict = "Favorable";
    const fav = allHouses.filter(h => FAVORABLE_HOUSES.includes(h));
    reason = `${dasha.mahadasha}–${dasha.antardasha} period activates the ${fav.join("th, ")}th house: business decisions and financial growth are supported.`;
  } else {
    verdict = "Neutral";
    reason = `${dasha.mahadasha}–${dasha.antardasha} period shows mixed house activation: proceed only with safe, small-scale decisions.`;
  }

  return {
    mahadasha: dasha.mahadasha,
    mahadasha_end: dasha.mahadasha_end,
    antardasha: dasha.antardasha,
    antardasha_end: dasha.antardasha_end,
    mahaHouses,
    antarHouses,
    verdict,
    reason,
  };
}

// ─── Layer 2: Transit Analysis ────────────────────────────────────────────────

function computeTransitLayer(ascSignNum: number, now: Date): TransitLayer[] {
  const planets: { name: string; body: Astro.Body | null; isRahu?: boolean }[] = [
    { name: "Jupiter", body: Astro.Body.Jupiter },
    { name: "Saturn",  body: Astro.Body.Saturn  },
    { name: "Mars",    body: Astro.Body.Mars     },
    { name: "Rahu",    body: null, isRahu: true  },
  ];

  return planets.map(({ name, body, isRahu }) => {
    const sidLon = isRahu ? getRahuSidLon(now) : getPlanetSidLon(body!, now);
    const signNum = Math.floor(sidLon / 30) % 12;
    const signs = [
      "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
      "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
    ];
    const sign = signs[signNum];
    const transitHouse = sidLonToHouse(sidLon, ascSignNum);

    // Retrograde check for non-Rahu
    let isRetrograde = false;
    if (!isRahu && body) {
      const dayMs = 86400000;
      const before = getPlanetSidLon(body, new Date(now.getTime() - dayMs));
      const after  = getPlanetSidLon(body, new Date(now.getTime() + dayMs));
      let diff = after - before;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      isRetrograde = diff < 0;
    }

    let verdict: TransitLayer["verdict"] = "Neutral";
    let note = "";
    let score = 50;

    if (name === "Jupiter") {
      if ([2, 5, 9, 11].includes(transitHouse)) {
        verdict = "Expansion"; score = 85;
        note = `Jupiter transiting ${transitHouse}th house: growth, opportunity, and wealth activation. Favorable for scaling and investment.`;
      } else if ([6, 8, 12].includes(transitHouse)) {
        verdict = "Caution"; score = 25;
        note = `Jupiter transiting ${transitHouse}th house: expansion is blocked. Focus on consolidation, not growth.`;
      } else {
        verdict = "Neutral"; score = 55;
        note = `Jupiter transiting ${transitHouse}th house: moderate support. Proceed with measured decisions.`;
      }
    } else if (name === "Saturn") {
      if ([3, 6, 11].includes(transitHouse)) {
        verdict = "Consolidation"; score = 65;
        note = `Saturn transiting ${transitHouse}th house: disciplined gains possible. Focus on cost efficiency and structured growth.`;
      } else if ([1, 4, 7, 8, 12].includes(transitHouse)) {
        verdict = "Caution"; score = 20;
        note = `Saturn transiting ${transitHouse}th house: pressure and delays. Reduce exposure, avoid large commitments.`;
      } else {
        verdict = "Neutral"; score = 45;
        note = `Saturn transiting ${transitHouse}th house: neutral influence. Maintain discipline in cash flow.`;
      }
    } else if (name === "Mars") {
      if ([3, 6, 10, 11].includes(transitHouse)) {
        verdict = "Expansion"; score = 70;
        note = `Mars transiting ${transitHouse}th house: energy for short-term action. Suitable for quick transactions, not long-term commitments.`;
      } else if ([1, 2, 4, 7, 8, 12].includes(transitHouse)) {
        verdict = "Caution"; score = 30;
        note = `Mars transiting ${transitHouse}th house: aggression and impulsive decisions. Avoid major financial moves.`;
      } else {
        verdict = "Neutral"; score = 50;
        note = `Mars transiting ${transitHouse}th house: moderate energy. Short-term actions only.`;
      }
    } else if (name === "Rahu") {
      if ([3, 6, 10, 11].includes(transitHouse)) {
        verdict = "Expansion"; score = 60;
        note = `Rahu transiting ${transitHouse}th house: unconventional opportunities possible. High risk, high reward. Proceed with caution.`;
      } else if ([1, 2, 4, 7, 8, 12].includes(transitHouse)) {
        verdict = "Caution"; score = 25;
        note = `Rahu transiting ${transitHouse}th house: unpredictable disruptions. Avoid large transactions or new ventures.`;
      } else {
        verdict = "Neutral"; score = 45;
        note = `Rahu transiting ${transitHouse}th house: ambiguous signals. Verify all decisions carefully.`;
      }
    }

    return { planet: name, sign, transitHouse, isRetrograde, verdict, note, score };
  });
}

// ─── Layer 3: Decision Area Signals ──────────────────────────────────────────

function computeDecisionSignals(
  dashaEligibility: DashaEligibility,
  transitLayer: TransitLayer[],
  chart: VedicChart
): DecisionSignal[] {
  const ascSignNum = chart.ascendant.signNum;
  const allDashaHouses = [...dashaEligibility.mahaHouses, ...dashaEligibility.antarHouses];

  const jupiter = transitLayer.find(t => t.planet === "Jupiter")!;
  const saturn  = transitLayer.find(t => t.planet === "Saturn")!;
  const mars    = transitLayer.find(t => t.planet === "Mars")!;
  const rahu    = transitLayer.find(t => t.planet === "Rahu")!;

  const dashaOk = dashaEligibility.verdict !== "Unfavorable";
  const dashaStrong = dashaEligibility.verdict === "Favorable";

  // House lords for key financial houses
  const signs = [
    "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
    "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
  ];
  const houseLord = (h: number) => SIGN_LORDS[signs[(ascSignNum + h - 1) % 12]];

  const areas: DecisionSignal[] = [];

  // 1. Business Expansion — needs 10th + 11th + 9th activation
  {
    const activatingHouses = [9, 10, 11].filter(h => allDashaHouses.includes(h));
    const jupiterExpands = jupiter.verdict === "Expansion";
    const saturnBlocks  = saturn.verdict === "Caution";
    let signal: DecisionSignal["signal"] = "Hold";
    let reason = "";
    if (dashaStrong && jupiterExpands && !saturnBlocks) {
      signal = "Go";
      reason = `Dasha supports career/gains houses. Jupiter's transit activates expansion. Favorable window for business growth.`;
    } else if (dashaOk && (jupiterExpands || activatingHouses.length >= 1)) {
      signal = "Caution";
      reason = `Partial support from Dasha and transit. Moderate expansion possible: avoid overcommitting.`;
    } else {
      signal = "Hold";
      reason = `Dasha or transit does not support expansion at this time. Focus on consolidation.`;
    }
    areas.push({ area: "Business Expansion", signal, reason, activatingHouses });
  }

  // 2. Large Investment — needs 5th + 11th + Mercury/Jupiter
  {
    const activatingHouses = [5, 11].filter(h => allDashaHouses.includes(h));
    const jupiterFav = [85, 55].includes(jupiter.score) || jupiter.score >= 55;
    let signal: DecisionSignal["signal"] = "Hold";
    let reason = "";
    if (dashaStrong && jupiterFav && activatingHouses.length >= 1) {
      signal = "Go";
      reason = `5th/11th house activation with Jupiter support: suitable for large investments with calculated risk.`;
    } else if (dashaOk && jupiterFav) {
      signal = "Caution";
      reason = `Jupiter is supportive but Dasha activation is partial. Invest moderately, avoid lump-sum commitments.`;
    } else {
      signal = "Hold";
      reason = `Insufficient Dasha + Jupiter support for large investments. Wait for a stronger period.`;
    }
    areas.push({ area: "Large Investment", signal, reason, activatingHouses });
  }

  // 3. Transaction (Buy/Sell) — needs 2nd + 7th house support
  {
    const activatingHouses = [2, 7].filter(h => allDashaHouses.includes(h));
    const marsOk = mars.verdict !== "Caution";
    let signal: DecisionSignal["signal"] = "Hold";
    let reason = "";
    if (dashaOk && activatingHouses.length >= 1 && marsOk) {
      signal = "Go";
      reason = `2nd/7th house activation supports transactions. Mars is not obstructing. Execute during a favorable Muhurta.`;
    } else if (dashaOk && marsOk) {
      signal = "Caution";
      reason = `Dasha is permissive but 2nd/7th house activation is weak. Small transactions only.`;
    } else {
      signal = "Hold";
      reason = `Dasha or Mars transit creates friction for transactions. Delay until conditions improve.`;
    }
    areas.push({ area: "Transaction (Buy/Sell)", signal, reason, activatingHouses });
  }

  // 4. Cash Flow — needs 2nd + 6th house support
  {
    const activatingHouses = [2, 6].filter(h => allDashaHouses.includes(h));
    const saturnDiscipline = saturn.verdict === "Consolidation";
    let signal: DecisionSignal["signal"] = "Caution";
    let reason = "";
    if (saturnDiscipline || activatingHouses.includes(6)) {
      signal = "Go";
      reason = `Saturn's disciplined influence and 6th house activation support structured cash flow management.`;
    } else if (activatingHouses.includes(2)) {
      signal = "Caution";
      reason = `2nd house is active: income is possible but monitor outflows carefully.`;
    } else {
      signal = "Hold";
      reason = `No strong 2nd/6th house activation. Tighten cash flow controls and avoid new liabilities.`;
    }
    areas.push({ area: "Cash Flow", signal, reason, activatingHouses });
  }

  // 5. Scaling vs Holding — Saturn + overall dasha verdict
  {
    const activatingHouses = allDashaHouses;
    const saturnPressure = saturn.verdict === "Caution";
    let signal: DecisionSignal["signal"] = "Hold";
    let reason = "";
    if (dashaStrong && !saturnPressure && jupiter.score >= 70) {
      signal = "Go";
      reason = `Strong Dasha + Jupiter support with no Saturn obstruction: this is a scaling phase.`;
    } else if (saturnPressure || dashaEligibility.verdict === "Unfavorable") {
      signal = "Hold";
      reason = `Saturn's pressure or unfavorable Dasha indicates a holding phase. Consolidate existing positions.`;
    } else {
      signal = "Caution";
      reason = `Mixed signals: scale selectively. Prioritize high-confidence opportunities only.`;
    }
    areas.push({ area: "Scaling vs Holding", signal, reason, activatingHouses });
  }

  return areas;
}

// ─── Muhurta scoring for a single day ────────────────────────────────────────

const FAVORABLE_TITHIS = [2, 3, 5, 7, 10, 11, 12, 13]; // standard Muhurta rule

const TITHI_NAMES = [
  "Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami",
  "Shashthi","Saptami","Ashtami","Navami","Dashami",
  "Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Purnima",
  "Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami",
  "Shashthi","Saptami","Ashtami","Navami","Dashami",
  "Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Amavasya",
];

function scoreMuhurtaDay(
  date: Date,
  natalMoonNakIdx: number
): MuhurtaWindow {
  const moonSid = getMoonSidLon(date);
  const todayNakIdx = Math.floor(moonSid / (360 / 27)) % 27;

  const tara = computeTara(natalMoonNakIdx, todayNakIdx);
  const paksha = computePaksha(date);
  const gandanta = checkGandanta(date);
  const rahuKaal = computeRahuKaal(date);

  const tithi = paksha.tithi;
  const tithiName = TITHI_NAMES[(tithi - 1) % 30];
  const tithiFavorable = FAVORABLE_TITHIS.includes(tithi <= 15 ? tithi : tithi - 15);

  // Moon strength: not in 6/8/12 from ascendant is checked via Gandanta + Paksha
  // Moon in Shukla Paksha = strong; Krishna = weaker
  let score = 0;
  score += tara.score * 0.35;
  score += paksha.score * 0.25;
  score += (tithiFavorable ? 80 : 30) * 0.20;
  if (gandanta.isGandanta) score -= 25;
  if (rahuKaal.isActive) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const label =
    score >= 70 ? "Excellent Muhurta" :
    score >= 50 ? "Good Muhurta" :
    score >= 35 ? "Moderate" :
    "Avoid";

  return {
    date,
    taraName: tara.name,
    taraVerdict: tara.verdict,
    tithi,
    tithiName,
    paksha: paksha.paksha,
    isGandanta: gandanta.isGandanta,
    isRahuKaal: rahuKaal.isActive,
    score,
    label,
  };
}

// ─── Top 3 Muhurta dates from next 30 days ────────────────────────────────────

function findTopMuhurtaDates(natalMoonNakIdx: number, from: Date): MuhurtaWindow[] {
  const candidates: MuhurtaWindow[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    d.setHours(10, 0, 0, 0); // mid-morning reference time
    const w = scoreMuhurtaDay(d, natalMoonNakIdx);
    if (!w.isGandanta && w.taraVerdict !== "avoid") {
      candidates.push(w);
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}

// ─── Phase + Action derivation ────────────────────────────────────────────────

function derivePhaseAndAction(
  dasha: DashaEligibility,
  transits: TransitLayer[]
): { phase: BusinessPhase; action: ActionVerdict; intensity: Intensity } {
  const jupiter = transits.find(t => t.planet === "Jupiter")!;
  const saturn  = transits.find(t => t.planet === "Saturn")!;

  if (dasha.verdict === "Favorable" && jupiter.verdict === "Expansion") {
    return { phase: "Expansion", action: "Expand", intensity: "High" };
  }
  if (dasha.verdict === "Favorable" && jupiter.verdict === "Neutral") {
    return { phase: "Stable", action: "Invest Cautiously", intensity: "Medium" };
  }
  if (dasha.verdict === "Neutral" && saturn.verdict === "Consolidation") {
    return { phase: "Stable", action: "Invest Cautiously", intensity: "Low" };
  }
  if (dasha.verdict === "Unfavorable" || saturn.verdict === "Caution") {
    if (jupiter.verdict === "Caution") {
      return { phase: "Risk", action: "Cut Costs", intensity: "Low" };
    }
    return { phase: "Hold", action: "Hold", intensity: "Low" };
  }
  if (dasha.verdict === "Neutral") {
    return { phase: "Stable", action: "Hold", intensity: "Low" };
  }
  return { phase: "Stable", action: "Invest Cautiously", intensity: "Medium" };
}

// ─── Broad timing window ──────────────────────────────────────────────────────

function broadTimingWindow(dasha: DashaEligibility): string {
  const end = dasha.antardasha_end;
  return `Until ${end.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`;
}

// ─── Astrologer-style summary ─────────────────────────────────────────────────

function buildSummary(
  dasha: DashaEligibility,
  transits: TransitLayer[],
  phase: BusinessPhase,
  action: ActionVerdict,
  intensity: Intensity
): string {
  const jupiter = transits.find(t => t.planet === "Jupiter")!;
  const saturn  = transits.find(t => t.planet === "Saturn")!;

  const dashaLine = dasha.reason;

  const jupiterLine =
    jupiter.verdict === "Expansion"
      ? `With Jupiter transiting the ${jupiter.transitHouse}th house, this is a suitable phase for expansion and moderate investment.`
      : jupiter.verdict === "Caution"
      ? `Jupiter's transit through the ${jupiter.transitHouse}th house is restricting growth: expansion should be deferred.`
      : `Jupiter's transit through the ${jupiter.transitHouse}th house offers moderate support for measured decisions.`;

  const saturnLine =
    saturn.verdict === "Consolidation"
      ? `Saturn's influence suggests maintaining discipline in cash flow and structured scaling.`
      : saturn.verdict === "Caution"
      ? `Saturn's pressure through the ${saturn.transitHouse}th house advises caution: avoid large-scale commitments.`
      : `Saturn's transit is neutral: standard financial discipline applies.`;

  const actionLine =
    action === "Expand"
      ? `Large-scale expansion should be executed during a favorable Muhurta when the Moon is strong and unafflicted.`
      : action === "Invest Cautiously"
      ? `Moderate investments are permissible: execute only during a favorable Muhurta with strong Tara and Tithi alignment.`
      : action === "Hold"
      ? `This is a holding phase. Avoid new financial commitments until the Dasha or transit environment improves.`
      : `Focus on cost reduction and stabilization. Avoid expansion until planetary support returns.`;

  return `${dashaLine} ${jupiterLine} ${saturnLine} ${actionLine}`;
}

// ─── Master function ──────────────────────────────────────────────────────────

export function computeBusinessTiming(
  birthInput: BirthInput,
  now: Date = new Date()
): BusinessTimingResult {
  const chart: VedicChart = buildVedicChart(birthInput);
  const ascSignNum = chart.ascendant.signNum;

  // Layer 1 — Dasha
  const dashaLayer = computeDashaEligibility(chart);

  // Layer 2 — Transits
  const transitLayer = computeTransitLayer(ascSignNum, now);

  // Layer 3 — Decision signals
  const decisionSignals = computeDecisionSignals(dashaLayer, transitLayer, chart);

  // Phase + Action
  const { phase, action, intensity } = derivePhaseAndAction(dashaLayer, transitLayer);

  // Muhurta — today
  const moon = chart.planets.find(p => p.abbr === "Mo")!;
  const natalMoonNakIdx = Math.floor(moon.siderealLon / (360 / 27)) % 27;
  const muhurtaToday = scoreMuhurtaDay(now, natalMoonNakIdx);

  // Muhurta — top 3 upcoming
  const topMuhurtaDates = findTopMuhurtaDates(natalMoonNakIdx, now);

  // Broad window
  const broadWindow = broadTimingWindow(dashaLayer);

  // Summary
  const astrologerSummary = buildSummary(dashaLayer, transitLayer, phase, action, intensity);

  // Overall score
  const transitAvg = transitLayer.reduce((s, t) => s + t.score, 0) / transitLayer.length;
  const dashaScore = dashaLayer.verdict === "Favorable" ? 85 : dashaLayer.verdict === "Neutral" ? 50 : 20;
  const overallScore = Math.round(dashaScore * 0.45 + transitAvg * 0.35 + muhurtaToday.score * 0.20);

  return {
    phase,
    action,
    intensity,
    dashaLayer,
    transitLayer,
    decisionSignals,
    muhurtaToday,
    topMuhurtaDates,
    broadTimingWindow: broadWindow,
    astrologerSummary,
    overallScore: Math.max(0, Math.min(100, overallScore)),
  };
}
