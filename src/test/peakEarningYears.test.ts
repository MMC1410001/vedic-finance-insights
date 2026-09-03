/**
 * The reported bug: "Peak Earning Years" showed the same years to every user.
 * `derivePeakYears` in PeakEarningYears.tsx built them as `currentYear + 2/5/9/14`,
 * so the card was identical for every birth chart.
 *
 * These lock in the replacement: years derived from the user's own Vimshottari
 * ladder (`buildDashaLadder`) scored against their natal chart.
 */

import { describe, it, expect } from "vitest";
import {
  buildDashaLadder,
  buildPeakEarningYears,
  sampleDashaLadder,
} from "../lib/chart-personalization";
import type { ChartData, DashaInfo, ReportScores, PlanetData } from "../lib/vedicfinance-types";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const SIGN_LORDS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};
const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

/** Build a chart with the given lagna, placing each planet in the listed house. */
function makeChart(lagnaIdx: number, houseOf: Record<string, number>): ChartData {
  const planets: PlanetData[] = PLANETS.map((planet, i) => {
    const house = houseOf[planet] ?? ((i % 12) + 1);
    const signNum = (lagnaIdx + house - 1) % 12;
    return {
      planet,
      sign: SIGNS[signNum],
      sign_num: signNum,
      degree: (i * 7.3) % 30,
      house,
      retrograde: false,
      nakshatra: "Rohini",
      nakshatra_lord: "Moon",
    };
  });

  return {
    lagna_sign: SIGNS[lagnaIdx],
    lagna_degree: 12.5,
    planets,
    houses: Array.from({ length: 12 }, (_, i) => {
      const signNum = (lagnaIdx + i) % 12;
      return { house: i + 1, sign: SIGNS[signNum], sign_num: signNum, lord: SIGN_LORDS[SIGNS[signNum]] };
    }),
  };
}

const SCORES: ReportScores = {
  natal_wealth_score: 72,
  income_score: 68,
  savings_score: 55,
  investment_score: 61,
  risk_score: 40,
  expense_score: 50,
  timing_score: 65,
};

/** A dasha block anchored on real dates, the way computeDasha returns it. */
function makeDasha(over: Partial<DashaInfo>): DashaInfo {
  return {
    mahadasha: "Moon",
    mahadasha_lord: "Moon",
    mahadasha_start: "2020-01-01",
    mahadasha_end: "2030-01-01",
    antardasha: "Moon",
    antardasha_lord: "Moon",
    antardasha_start: "2020-01-01",
    antardasha_end: "2020-11-01",
    next_mahadasha: "Mars",
    next_mahadasha_start: "2030-01-01",
    ...over,
  } as DashaInfo;
}

// Two clearly different people.
const CHART_A = makeChart(0, { Jupiter: 11, Venus: 2, Mercury: 10, Saturn: 6, Mars: 8 });
const DASHA_A = makeDasha({});
const BIRTH_A = 1988;

const CHART_B = makeChart(7, { Jupiter: 8, Venus: 12, Mercury: 6, Saturn: 11, Mars: 2 });
const DASHA_B = makeDasha({
  mahadasha: "Saturn",
  mahadasha_lord: "Saturn",
  mahadasha_start: "2016-06-15",
  mahadasha_end: "2035-06-15",
  antardasha: "Saturn",
  antardasha_lord: "Saturn",
  antardasha_start: "2016-06-15",
  antardasha_end: "2019-06-15",
  next_mahadasha: "Mercury",
  next_mahadasha_start: "2035-06-15",
});
const BIRTH_B = 2001;

describe("buildDashaLadder", () => {
  it("reproduces the report's own current antardasha boundaries", () => {
    // computeDasha subdivides the mahadasha as duration * years/120 starting at
    // the maha lord. The ladder must land on the same first sub-period, or the
    // card contradicts the dasha the rest of the report shows.
    const ladder = buildDashaLadder(DASHA_A, 30);
    expect(ladder[0].lord).toBe("Moon");
    expect(ladder[0].subLord).toBe("Moon");
    expect(ladder[0].start.toISOString().slice(0, 10)).toBe("2020-01-01");
    // Moon maha = 10y span, Moon antar = 10/120 of it ≈ 10 months.
    expect(ladder[0].end.getFullYear()).toBe(2020);
    expect(ladder[0].end.getMonth()).toBe(9); // Oct — matches antardasha_end 2020-11-01 within rounding
  });

  it("follows the Vimshottari order into the next mahadasha", () => {
    const ladder = buildDashaLadder(DASHA_A, 30);
    const lords = [...new Set(ladder.map((p) => p.lord))];
    expect(lords.slice(0, 3)).toEqual(["Moon", "Mars", "Rahu"]);
  });

  it("returns [] for unusable dates rather than throwing", () => {
    expect(buildDashaLadder(makeDasha({ mahadasha_start: "", mahadasha_end: "" }))).toEqual([]);
    expect(buildDashaLadder(makeDasha({ mahadasha_start: "not-a-date" }))).toEqual([]);
    expect(buildDashaLadder(makeDasha({ mahadasha_lord: "Nibiru" }))).toEqual([]);
  });
});

describe("buildPeakEarningYears", () => {
  it("gives two different charts different peak years (the reported bug)", () => {
    const a = buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A);
    const b = buildPeakEarningYears(CHART_B, SCORES, DASHA_B, BIRTH_B);

    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a.map((p) => p.year)).not.toEqual(b.map((p) => p.year));
  });

  it("varies with the chart even when the dasha is identical", () => {
    const a = buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A);
    const b = buildPeakEarningYears(CHART_B, SCORES, DASHA_A, BIRTH_A);
    expect(a).not.toEqual(b);
  });

  it("is deterministic — same input, same output", () => {
    const once = buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A);
    const twice = buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A);
    expect(once).toEqual(twice);
  });

  it("never returns a year in the past", () => {
    const thisYear = new Date().getFullYear();
    for (const peak of buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A)) {
      expect(peak.year).toBeGreaterThanOrEqual(thisYear);
    }
  });

  it("returns chronological years at least 2 apart, with ages matching the birth year", () => {
    const peaks = buildPeakEarningYears(CHART_B, SCORES, DASHA_B, BIRTH_B);
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i].year - peaks[i - 1].year).toBeGreaterThanOrEqual(2);
    }
    for (const peak of peaks) {
      expect(peak.age).toBe(peak.year - BIRTH_B);
    }
  });

  it("respects `count` and ranks exactly one window as the peak", () => {
    const peaks = buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A, 3);
    expect(peaks.length).toBeLessThanOrEqual(3);
    expect(peaks.filter((p) => p.intensity === "peak")).toHaveLength(1);
  });

  it("names a real dasha lord and explains why", () => {
    for (const peak of buildPeakEarningYears(CHART_A, SCORES, DASHA_A, BIRTH_A)) {
      expect(PLANETS).toContain(peak.planet);
      expect(peak.reason.length).toBeGreaterThan(10);
    }
  });

  it("returns [] when the dasha dates are unusable so the caller can fall back", () => {
    expect(buildPeakEarningYears(CHART_A, SCORES, makeDasha({ mahadasha_start: "" }), BIRTH_A)).toEqual([]);
  });
});

describe("sampleDashaLadder", () => {
  it("returns strictly advancing years for the growth timeline", () => {
    const samples = sampleDashaLadder(DASHA_A, 9, 24);
    expect(samples).toHaveLength(9);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].year).toBeGreaterThan(samples[i - 1].year);
    }
  });

  it("gives different lord sequences for different dashas", () => {
    const a = sampleDashaLadder(DASHA_A, 9, 24).map((s) => `${s.lord}/${s.subLord}`);
    const b = sampleDashaLadder(DASHA_B, 9, 24).map((s) => `${s.lord}/${s.subLord}`);
    expect(a).not.toEqual(b);
  });

  it("returns [] for unusable dates", () => {
    expect(sampleDashaLadder(makeDasha({ mahadasha_end: "" }), 9)).toEqual([]);
  });
});
