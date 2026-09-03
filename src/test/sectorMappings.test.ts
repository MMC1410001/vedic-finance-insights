/**
 * Property-Based Tests for sectorMappings structural completeness
 *
 * Property 3: sectorMappings Structural Completeness
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  sectorMappings,
  type PlanetName,
  type SectorId,
} from "../lib/sectorMappings";

const VALID_PLANET_NAMES: PlanetName[] = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
];

const VALID_SECTOR_IDS: SectorId[] = [
  "dairy-beverages",
  "hotels-hospitality",
  "shipping-marine",
  "travel",
  "fmcg",
  "glass",
  "real-estate",
];

const isValidPlanet = (p: string): p is PlanetName =>
  (VALID_PLANET_NAMES as string[]).includes(p);

/**
 * Property 3: sectorMappings Structural Completeness
 * Validates: Requirements 2.2, 2.3, 2.4
 *
 * For any sector entry in sectorMappings, the entry must contain all five
 * required fields with valid planet names, and all required combination
 * triggers must appear in the correct sectors.
 */
describe("sectorMappings, Property 3: Structural Completeness", () => {
  it("exports exactly seven sectors with all required IDs", () => {
    expect(sectorMappings).toHaveLength(7);
    const ids = sectorMappings.map((s) => s.id);
    for (const expectedId of VALID_SECTOR_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  it("every sector has all five required structural fields", () => {
    for (const sector of sectorMappings) {
      expect(sector.primaryPlanets, `${sector.id}: primaryPlanets missing`).toBeDefined();
      expect(sector.primaryPlanets.length, `${sector.id}: primaryPlanets must be non-empty`).toBeGreaterThan(0);

      expect(sector.secondaryPlanets, `${sector.id}: secondaryPlanets missing`).toBeDefined();
      expect(Array.isArray(sector.secondaryPlanets), `${sector.id}: secondaryPlanets must be array`).toBe(true);

      expect(sector.relevantHouses, `${sector.id}: relevantHouses missing`).toBeDefined();
      expect(sector.relevantHouses.length, `${sector.id}: relevantHouses must be non-empty`).toBeGreaterThan(0);

      expect(sector.combinationTriggers, `${sector.id}: combinationTriggers missing`).toBeDefined();
      expect(Array.isArray(sector.combinationTriggers), `${sector.id}: combinationTriggers must be array`).toBe(true);

      expect(sector.d9ConfirmationPlanets, `${sector.id}: d9ConfirmationPlanets missing`).toBeDefined();
      expect(Array.isArray(sector.d9ConfirmationPlanets), `${sector.id}: d9ConfirmationPlanets must be array`).toBe(true);
    }
  });

  it("every planet in primaryPlanets and secondaryPlanets is a valid PlanetName", () => {
    for (const sector of sectorMappings) {
      for (const planet of sector.primaryPlanets) {
        expect(isValidPlanet(planet), `${sector.id}: invalid primary planet "${planet}"`).toBe(true);
      }
      for (const planet of sector.secondaryPlanets) {
        expect(isValidPlanet(planet), `${sector.id}: invalid secondary planet "${planet}"`).toBe(true);
      }
    }
  });

  it("every planet in d9ConfirmationPlanets is a valid PlanetName", () => {
    for (const sector of sectorMappings) {
      for (const planet of sector.d9ConfirmationPlanets) {
        expect(isValidPlanet(planet), `${sector.id}: invalid d9 planet "${planet}"`).toBe(true);
      }
    }
  });

  it("every combination trigger has planets array and required label/description fields", () => {
    for (const sector of sectorMappings) {
      for (const trigger of sector.combinationTriggers) {
        expect(trigger.planets.length, `${sector.id}: trigger planets must be non-empty`).toBeGreaterThan(0);
        expect(typeof trigger.label, `${sector.id}: trigger label must be string`).toBe("string");
        expect(trigger.label.length, `${sector.id}: trigger label must be non-empty`).toBeGreaterThan(0);
        expect(typeof trigger.description, `${sector.id}: trigger description must be string`).toBe("string");
        expect(trigger.description.length, `${sector.id}: trigger description must be non-empty`).toBeGreaterThan(0);
        for (const planet of trigger.planets) {
          expect(isValidPlanet(planet), `${sector.id}: invalid trigger planet "${planet}"`).toBe(true);
        }
      }
    }
  });

  it("all five required combination triggers appear in the correct sectors", () => {
    const findTrigger = (sectorId: SectorId, planets: PlanetName[]) => {
      const sector = sectorMappings.find((s) => s.id === sectorId)!;
      return sector.combinationTriggers.some((t) =>
        planets.every((p) => t.planets.includes(p)) &&
        t.planets.every((p) => planets.includes(p))
      );
    };

    // Moon+Venus in dairy-beverages
    expect(findTrigger("dairy-beverages", ["Moon", "Venus"])).toBe(true);
    // Moon+Venus in hotels-hospitality
    expect(findTrigger("hotels-hospitality", ["Moon", "Venus"])).toBe(true);
    // Moon+Rahu in shipping-marine
    expect(findTrigger("shipping-marine", ["Moon", "Rahu"])).toBe(true);
    // Moon+Rahu in travel
    expect(findTrigger("travel", ["Moon", "Rahu"])).toBe(true);
    // Mercury+Moon in fmcg
    expect(findTrigger("fmcg", ["Mercury", "Moon"])).toBe(true);
    // Venus+Sun in glass
    expect(findTrigger("glass", ["Venus", "Sun"])).toBe(true);
    // Mars+Saturn in real-estate (with requiresHouse: 4)
    const realEstate = sectorMappings.find((s) => s.id === "real-estate")!;
    const marsStrigger = realEstate.combinationTriggers.find(
      (t) => t.planets.includes("Mars") && t.planets.includes("Saturn")
    );
    expect(marsStrigger).toBeDefined();
    expect(marsStrigger?.requiresHouse).toBe(4);
  });

  it("relevant houses are all integers in range 1–12", () => {
    for (const sector of sectorMappings) {
      for (const house of sector.relevantHouses) {
        expect(Number.isInteger(house), `${sector.id}: house ${house} must be integer`).toBe(true);
        expect(house, `${sector.id}: house must be >= 1`).toBeGreaterThanOrEqual(1);
        expect(house, `${sector.id}: house must be <= 12`).toBeLessThanOrEqual(12);
      }
    }
  });

  it("property-based: for any sector index, structural invariants hold across all entries", () => {
    /**
     * Property 3: sectorMappings Structural Completeness
     * Validates: Requirements 2.2, 2.3, 2.4
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: sectorMappings.length - 1 }),
        (idx) => {
          const sector = sectorMappings[idx];

          // primaryPlanets non-empty, all valid
          if (sector.primaryPlanets.length === 0) return false;
          if (!sector.primaryPlanets.every(isValidPlanet)) return false;

          // secondaryPlanets all valid
          if (!sector.secondaryPlanets.every(isValidPlanet)) return false;

          // relevantHouses non-empty, all in 1–12
          if (sector.relevantHouses.length === 0) return false;
          if (!sector.relevantHouses.every((h) => h >= 1 && h <= 12)) return false;

          // combinationTriggers: each trigger has non-empty planets, label, description
          for (const trigger of sector.combinationTriggers) {
            if (trigger.planets.length === 0) return false;
            if (!trigger.planets.every(isValidPlanet)) return false;
            if (!trigger.label) return false;
            if (!trigger.description) return false;
          }

          // d9ConfirmationPlanets all valid
          if (!sector.d9ConfirmationPlanets.every(isValidPlanet)) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
