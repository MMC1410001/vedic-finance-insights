/**
 * Vedic Astrology Engine — powered by astronomy-engine for high-precision calculations.
 *
 * Uses the astronomy-engine library (sub-arcminute accuracy) for tropical planetary
 * longitudes, then applies Lahiri (Chitrapaksha) ayanamsa for sidereal conversion.
 * Computes proper Lagna (Ascendant) from birth latitude/longitude + local sidereal time.
 * Detects retrograde motion for all applicable planets.
 */
import * as Astro from "https://esm.sh/astronomy-engine@2.1.19";

// ─── Vedic Constants ──────────────────────────────────────────────────────────

export const ZODIAC = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];

export const SIGN_LORDS: Record<string,string> = {
  Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon",
  Leo:"Sun", Virgo:"Mercury", Libra:"Venus", Scorpio:"Mars",
  Sagittarius:"Jupiter", Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter"
};

export const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha","Shatabhisha",
  "Purva Bhadrapada","Uttara Bhadrapada","Revati"
];

export const NAK_LORDS = [
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"
];

export const DASHA_SEQ = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
export const DASHA_YRS: Record<string,number> = {
  Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
function mod360(x: number) { return ((x % 360) + 360) % 360; }

// ─── Julian Day ───────────────────────────────────────────────────────────────

export function toJulianDay(dateStr: string, timeStr: string, tzOffset: number): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const utHour = h + min / 60 - tzOffset;
  const a = Math.floor((14 - m) / 12);
  const yr = y + 4800 - a;
  const mo = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4)
    - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
  return jdn - 0.5 + utHour / 24;
}

/** Convert date string + time string + tz offset to a JS Date in UTC */
function toUTCDate(dateStr: string, timeStr: string, tzOffset: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h, min) - tzOffset * 3600000;
  return new Date(utcMs);
}

// ─── Lahiri Ayanamsa (Chitrapaksha) ───────────────────────────────────────────
// Reference: Lahiri ayanamsa at J2000.0 = 23.8531° (23°51'11")
// Precession rate ≈ 50.2878"/year

export function lahiriAyanamsa(jd: number): number {
  const T = (jd - 2451545.0) / 36525; // Julian centuries from J2000
  // IAU 1976 precession + Lahiri base
  const ayanamsaJ2000 = 23.8531;
  const precessionPerYear = 50.2878 / 3600; // degrees per year
  const years = T * 100;
  return ayanamsaJ2000 + precessionPerYear * years;
}

// ─── Tropical → Sidereal conversion ──────────────────────────────────────────

function tropicalToSidereal(tropicalLon: number, jd: number): number {
  return mod360(tropicalLon - lahiriAyanamsa(jd));
}

// ─── High-precision planetary longitudes via astronomy-engine ─────────────────

const BODY_MAP: Record<string, Astro.Body> = {
  Sun: Astro.Body.Sun,
  Moon: Astro.Body.Moon,
  Mars: Astro.Body.Mars,
  Mercury: Astro.Body.Mercury,
  Jupiter: Astro.Body.Jupiter,
  Venus: Astro.Body.Venus,
  Saturn: Astro.Body.Saturn,
};

/** Get geocentric tropical ecliptic longitude for a body */
function getTropicalLongitude(body: Astro.Body, date: Date): number {
  const vec = Astro.GeoVector(body, date, true); // aberration-corrected
  const ecl = Astro.Ecliptic(vec);
  return mod360(ecl.elon);
}

/** Get geocentric tropical ecliptic longitude for the Moon */
function getMoonTropicalLongitude(date: Date): number {
  const sph = Astro.EclipticGeoMoon(date);
  return mod360(sph.lon);
}

/** Detect retrograde by comparing longitude 1 day before and after */
function isRetrograde(body: Astro.Body, date: Date): boolean {
  const dayMs = 86400000;
  const before = new Date(date.getTime() - dayMs);
  const after = new Date(date.getTime() + dayMs);
  const lonBefore = getTropicalLongitude(body, before);
  const lonAfter = getTropicalLongitude(body, after);
  // If longitude decreased (accounting for 360° wrap), planet is retrograde
  let diff = lonAfter - lonBefore;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

/** Compute Rahu (Mean Lunar Node) tropical longitude */
function getRahuTropicalLongitude(date: Date): number {
  // astronomy-engine doesn't directly expose lunar nodes,
  // so we use the standard mean node formula (very accurate for Rahu)
  const jd = toJulianDayFromDate(date);
  const T = (jd - 2451545.0) / 36525;
  // Mean longitude of ascending node (Meeus, Astronomical Algorithms)
  const omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000;
  return mod360(omega);
}

function toJulianDayFromDate(date: Date): number {
  return 2440587.5 + date.getTime() / 86400000;
}

// ─── Lagna (Ascendant) Calculation ────────────────────────────────────────────
// Uses Local Sidereal Time + obliquity of ecliptic + geographic latitude
// to compute the exact rising degree of the ecliptic (Ascendant).

function computeAscendant(date: Date, lat: number, lon: number): number {
  // Greenwich Apparent Sidereal Time in hours
  const gast = Astro.SiderealTime(date);
  // Local Sidereal Time in degrees
  const lst = mod360(gast * 15 + lon);

  // Mean obliquity of ecliptic (Meeus formula)
  const jd = toJulianDayFromDate(date);
  const T = (jd - 2451545.0) / 36525;
  const eps = 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;

  const epsRad = eps * DEG;
  const latRad = lat * DEG;
  const lstRad = lst * DEG;

  // Ascendant formula: atan2(-cos(LST), sin(eps)*tan(lat) + cos(eps)*sin(LST))
  const y = -Math.cos(lstRad);
  const x = Math.sin(epsRad) * Math.tan(latRad) + Math.cos(epsRad) * Math.sin(lstRad);
  const ascRad = Math.atan2(y, x);
  return mod360(ascRad * RAD);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PlanetPosition {
  planet: string;
  tropicalLon: number;
  siderealLon: number;
  retrograde: boolean;
}

/**
 * Compute all 9 Vedic planet positions (sidereal) for a given birth moment.
 * Returns tropical and sidereal longitudes + retrograde status.
 */
export function computeAllPlanets(dateStr: string, timeStr: string, tz: number): {
  positions: Record<string, PlanetPosition>;
  jd: number;
  utcDate: Date;
} {
  const utcDate = toUTCDate(dateStr, timeStr, tz);
  const jd = toJulianDayFromDate(utcDate);

  const positions: Record<string, PlanetPosition> = {};

  // Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn
  for (const [name, body] of Object.entries(BODY_MAP)) {
    const tropLon = name === "Moon"
      ? getMoonTropicalLongitude(utcDate)
      : getTropicalLongitude(body, utcDate);
    const sidLon = tropicalToSidereal(tropLon, jd);
    const retro = (name === "Sun" || name === "Moon")
      ? false
      : isRetrograde(body, utcDate);
    positions[name] = { planet: name, tropicalLon: tropLon, siderealLon: sidLon, retrograde: retro };
  }

  // Rahu (always retrograde in Vedic astrology)
  const rahuTrop = getRahuTropicalLongitude(utcDate);
  const rahuSid = tropicalToSidereal(rahuTrop, jd);
  positions["Rahu"] = { planet: "Rahu", tropicalLon: rahuTrop, siderealLon: rahuSid, retrograde: true };

  // Ketu = Rahu + 180°
  const ketuTrop = mod360(rahuTrop + 180);
  const ketuSid = mod360(rahuSid + 180);
  positions["Ketu"] = { planet: "Ketu", tropicalLon: ketuTrop, siderealLon: ketuSid, retrograde: true };

  return { positions, jd, utcDate };
}

/**
 * Compute the sidereal Ascendant (Lagna) longitude.
 */
export function computeLagna(dateStr: string, timeStr: string, tz: number, lat: number, lon: number): {
  tropicalLon: number;
  siderealLon: number;
  jd: number;
} {
  const utcDate = toUTCDate(dateStr, timeStr, tz);
  const jd = toJulianDayFromDate(utcDate);
  const tropAsc = computeAscendant(utcDate, lat, lon);
  const sidAsc = tropicalToSidereal(tropAsc, jd);
  return { tropicalLon: tropAsc, siderealLon: sidAsc, jd };
}

// ─── Utility functions (unchanged interface) ──────────────────────────────────

export function lonToSign(lon: number): { sign: string; signNum: number; degree: number } {
  const signNum = Math.floor(lon / 30) % 12;
  return { sign: ZODIAC[signNum], signNum, degree: lon % 30 };
}

export function getNakshatra(lon: number): { nakshatra: string; lord: string } {
  const idx = Math.floor(lon / (360 / 27)) % 27;
  return { nakshatra: NAKSHATRAS[idx], lord: NAK_LORDS[idx] };
}

export function houseFromSign(transitSignNum: number, lagnaSignNum: number): number {
  return ((transitSignNum - lagnaSignNum + 12) % 12) + 1;
}

// ─── Legacy-compatible wrappers (for transit calculations) ────────────────────

export function sunLongitude(jd: number): number {
  const date = new Date((jd - 2440587.5) * 86400000);
  const trop = getTropicalLongitude(Astro.Body.Sun, date);
  return tropicalToSidereal(trop, jd);
}

export function moonLongitude(jd: number): number {
  const date = new Date((jd - 2440587.5) * 86400000);
  const trop = getMoonTropicalLongitude(date);
  return tropicalToSidereal(trop, jd);
}

export function planetLongitude(name: string, jd: number): number {
  const body = BODY_MAP[name];
  if (!body) return 0;
  const date = new Date((jd - 2440587.5) * 86400000);
  const trop = getTropicalLongitude(body, date);
  return tropicalToSidereal(trop, jd);
}

export function rahuLongitude(jd: number): number {
  const date = new Date((jd - 2440587.5) * 86400000);
  const trop = getRahuTropicalLongitude(date);
  return tropicalToSidereal(trop, jd);
}