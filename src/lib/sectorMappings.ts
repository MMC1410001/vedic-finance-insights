// Sector Favorability Analysis — Planet-Sector Configuration
// Pure data module: no logic, no side effects.

export type PlanetName =
  | "Sun"
  | "Moon"
  | "Mars"
  | "Mercury"
  | "Jupiter"
  | "Venus"
  | "Saturn"
  | "Rahu"
  | "Ketu";

export type SectorId =
  | "dairy-beverages"
  | "hotels-hospitality"
  | "shipping-marine"
  | "travel"
  | "fmcg"
  | "glass"
  | "real-estate";

export interface CombinationTrigger {
  planets: PlanetName[];
  requiresHouse?: number; // optional house requirement (e.g., 4th for real estate)
  label: string;
  description: string;
}

export interface SectorMapping {
  id: SectorId;
  name: string;
  icon: string; // emoji
  primaryPlanets: PlanetName[];
  secondaryPlanets: PlanetName[];
  relevantHouses: number[];
  combinationTriggers: CombinationTrigger[];
  d9ConfirmationPlanets: PlanetName[];
}

export const sectorMappings: SectorMapping[] = [
  {
    id: "dairy-beverages",
    name: "Dairy & Beverages",
    icon: "🥛",
    primaryPlanets: ["Moon"],
    secondaryPlanets: ["Venus", "Jupiter"],
    relevantHouses: [4, 2, 11],
    combinationTriggers: [
      {
        planets: ["Moon", "Venus"],
        label: "Moon+Venus",
        description:
          "Moon and Venus conjunction activates luxury food and beverage themes, blending emotional nourishment with refined taste.",
      },
    ],
    d9ConfirmationPlanets: ["Moon", "Venus", "Jupiter"],
  },
  {
    id: "hotels-hospitality",
    name: "Hotels & Hospitality",
    icon: "🏨",
    primaryPlanets: ["Moon", "Venus"],
    secondaryPlanets: ["Jupiter"],
    relevantHouses: [4, 7, 11],
    combinationTriggers: [
      {
        planets: ["Moon", "Venus"],
        label: "Moon+Venus",
        description:
          "Moon and Venus conjunction strengthens hospitality inclination, combining public-facing warmth with luxury service.",
      },
    ],
    d9ConfirmationPlanets: ["Moon", "Venus", "Jupiter"],
  },
  {
    id: "shipping-marine",
    name: "Shipping & Navigation/Marine",
    icon: "🚢",
    primaryPlanets: ["Moon", "Rahu"],
    secondaryPlanets: ["Saturn"],
    relevantHouses: [12, 9, 3],
    combinationTriggers: [
      {
        planets: ["Moon", "Rahu"],
        label: "Moon+Rahu",
        description:
          "Moon and Rahu conjunction activates foreign maritime trade and unconventional navigation themes.",
      },
    ],
    d9ConfirmationPlanets: ["Moon", "Rahu", "Saturn"],
  },
  {
    id: "travel",
    name: "Travel Industry",
    icon: "✈️",
    primaryPlanets: ["Moon", "Rahu"],
    secondaryPlanets: ["Mercury"],
    relevantHouses: [9, 3, 12],
    combinationTriggers: [
      {
        planets: ["Moon", "Rahu"],
        label: "Moon+Rahu",
        description:
          "Moon and Rahu conjunction drives travel and aviation inclination, blending public-facing mobility with foreign connections.",
      },
    ],
    d9ConfirmationPlanets: ["Moon", "Rahu", "Mercury"],
  },
  {
    id: "fmcg",
    name: "FMCG/Consumer Goods",
    icon: "🛒",
    primaryPlanets: ["Mercury", "Moon"],
    secondaryPlanets: ["Venus"],
    relevantHouses: [3, 6, 11],
    combinationTriggers: [
      {
        planets: ["Mercury", "Moon"],
        label: "Mercury+Moon",
        description:
          "Mercury and Moon conjunction activates fast-moving consumer goods and trading themes, combining analytical commerce with mass-market appeal.",
      },
    ],
    d9ConfirmationPlanets: ["Mercury", "Moon", "Venus"],
  },
  {
    id: "glass",
    name: "Glass Industry",
    icon: "🔮",
    primaryPlanets: ["Venus", "Sun"],
    secondaryPlanets: ["Mercury"],
    relevantHouses: [2, 11],
    combinationTriggers: [
      {
        planets: ["Venus", "Sun"],
        label: "Venus+Sun",
        description:
          "Venus and Sun conjunction activates glass and luxury material industries, combining aesthetic refinement with governmental or energy-sector backing.",
      },
    ],
    d9ConfirmationPlanets: ["Venus", "Sun", "Mercury"],
  },
  {
    id: "real-estate",
    name: "Real Estate/Property",
    icon: "🏠",
    primaryPlanets: ["Mars", "Saturn"],
    secondaryPlanets: ["Moon"],
    relevantHouses: [4, 2, 10],
    combinationTriggers: [
      {
        planets: ["Mars", "Saturn"],
        requiresHouse: 4,
        label: "Mars+Saturn+4th house",
        description:
          "Mars and Saturn conjunction with 4th house involvement activates real estate and construction themes, combining drive and discipline with property foundations.",
      },
    ],
    d9ConfirmationPlanets: ["Mars", "Saturn", "Moon"],
  },
];
