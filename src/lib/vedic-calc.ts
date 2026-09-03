/**
 * Real Vedic (Jyotish) natal chart calculator
 * Powered by astronomy-engine for high-precision planetary longitudes (sub-arcminute).
 * Applies Lahiri ayanamsa (Chitrapaksha) to convert tropical → sidereal.
 *
 * Planets computed: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu
 * Ascendant (Lagna) computed from birth time + latitude/longitude.
 */
import * as Astro from "astronomy-engine";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function mod360(x: number) {
  return ((x % 360) + 360) % 360;
}

/** Julian Day Number from calendar date + UT hours */
export function toJulianDay(year: number, month: number, day: number, utHours: number): number {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + utHours / 24 + B - 1524.5;
}

function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

// ─── Lahiri Ayanamsa (Chitrapaksha) ───────────────────────────────────────────
export function ayanamsa(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const ayanamsaJ2000 = 23.8531;
  const precessionPerYear = 50.2878 / 3600;
  return ayanamsaJ2000 + precessionPerYear * T * 100;
}

export function lahiriAyanamsa(jd: number): number {
  return ayanamsa(jd);
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

function getTropicalLon(body: Astro.Body, date: Date): number {
  const vec = Astro.GeoVector(body, date, true);
  const ecl = Astro.Ecliptic(vec);
  return mod360(ecl.elon);
}

function getMoonTropicalLon(date: Date): number {
  const sph = Astro.EclipticGeoMoon(date);
  return mod360(sph.lon);
}

function checkRetrograde(body: Astro.Body, date: Date): boolean {
  const dayMs = 86400000;
  const before = new Date(date.getTime() - dayMs);
  const after = new Date(date.getTime() + dayMs);
  const lonBefore = getTropicalLon(body, before);
  const lonAfter = getTropicalLon(body, after);
  let diff = lonAfter - lonBefore;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

function getRahuTropicalLon(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return mod360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000);
}

// Legacy wrappers for backward compatibility
export function sunLongitude(jd: number): number {
  const date = jdToDate(jd);
  return getTropicalLon(Astro.Body.Sun, date);
}
export function moonLongitude(jd: number): number {
  const date = jdToDate(jd);
  return getMoonTropicalLon(date);
}
export function marsLongitude(jd: number): number { return getTropicalLon(Astro.Body.Mars, jdToDate(jd)); }
export function mercuryLongitude(jd: number): number { return getTropicalLon(Astro.Body.Mercury, jdToDate(jd)); }
export function jupiterLongitude(jd: number): number { return getTropicalLon(Astro.Body.Jupiter, jdToDate(jd)); }
export function venusLongitude(jd: number): number { return getTropicalLon(Astro.Body.Venus, jdToDate(jd)); }
export function saturnLongitude(jd: number): number { return getTropicalLon(Astro.Body.Saturn, jdToDate(jd)); }
export function rahuLongitude(jd: number): number { return getRahuTropicalLon(jd); }

// ─── Ascendant (Lagna) ────────────────────────────────────────────────────────
export function ascendantLongitude(jd: number, lat: number, lon: number): number {
  const date = jdToDate(jd);
  const gast = Astro.SiderealTime(date);
  const lst = mod360(gast * 15 + lon);
  const T = (jd - 2451545.0) / 36525;
  const eps = (23.4392911 - 0.0130042 * T) * DEG;
  const latRad = lat * DEG;
  const lstRad = lst * DEG;
  const y = -Math.cos(lstRad);
  const x = Math.sin(eps) * Math.tan(latRad) + Math.cos(eps) * Math.sin(lstRad);
  let asc = Math.atan2(y, x) * RAD;
  if (asc < 0) asc += 360;
  return asc;
}

// ─── Nakshatra ────────────────────────────────────────────────────────────────
const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha","Shatabhisha",
  "Purva Bhadrapada","Uttara Bhadrapada","Revati"
];
const NAKSHATRA_LORDS = [
  "Ketu","Venus","Sun","Moon","Mars","Rahu",
  "Jupiter","Saturn","Mercury","Ketu","Venus","Sun",
  "Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  "Ketu","Venus","Sun","Moon","Mars","Rahu",
  "Jupiter","Saturn","Mercury"
];

export function getNakshatra(sidLon: number): { name: string; lord: string; pada: number } {
  const idx = Math.floor(sidLon / (360 / 27));
  const pada = Math.floor((sidLon % (360 / 27)) / (360 / 108)) + 1;
  return { name: NAKSHATRAS[idx % 27], lord: NAKSHATRA_LORDS[idx % 27], pada };
}

// ─── Zodiac ───────────────────────────────────────────────────────────────────
export const ZODIAC_SIGNS = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];
export const SIGN_LORDS: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter"
};

export function signFromLon(lon: number): { sign: string; signNum: number; degree: number } {
  const signNum = Math.floor(lon / 30);
  return { sign: ZODIAC_SIGNS[signNum % 12], signNum: signNum % 12, degree: lon % 30 };
}

// ─── Vimshottari Dasha ────────────────────────────────────────────────────────
const DASHA_SEQUENCE = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];

export interface DashaResult {
  mahadasha: string;
  mahadasha_start: Date;
  mahadasha_end: Date;
  antardasha: string;
  antardasha_start: Date;
  antardasha_end: Date;
  next_mahadasha: string;
  next_mahadasha_start: Date;
}

export function computeDasha(moonSidLon: number, birthDate: Date): DashaResult {
  const nak = getNakshatra(moonSidLon);
  const lordIdx = DASHA_SEQUENCE.indexOf(nak.lord);
  const nakSpan = 360 / 27;
  const posInNak = moonSidLon % nakSpan;
  const elapsed = posInNak / nakSpan;

  const dashas: { lord: string; start: Date; end: Date }[] = [];
  let cursor = new Date(birthDate);
  const firstYears = DASHA_YEARS[lordIdx] * (1 - elapsed);
  const firstEnd = new Date(cursor.getTime() + firstYears * 365.25 * 86400000);
  dashas.push({ lord: DASHA_SEQUENCE[lordIdx], start: cursor, end: firstEnd });
  cursor = firstEnd;

  for (let i = 1; i <= 9; i++) {
    const idx = (lordIdx + i) % 9;
    const end = new Date(cursor.getTime() + DASHA_YEARS[idx] * 365.25 * 86400000);
    dashas.push({ lord: DASHA_SEQUENCE[idx], start: cursor, end });
    cursor = end;
  }

  const now = new Date();
  const currentMaha = dashas.find(d => d.start <= now && d.end > now) || dashas[0];
  const mahaIdx = dashas.indexOf(currentMaha);
  const nextMaha = dashas[mahaIdx + 1] || dashas[0];

  const mahaLordIdx = DASHA_SEQUENCE.indexOf(currentMaha.lord);
  const mahaDuration = currentMaha.end.getTime() - currentMaha.start.getTime();
  const antardashas: { lord: string; start: Date; end: Date }[] = [];
  let aCursor = currentMaha.start;
  for (let i = 0; i < 9; i++) {
    const idx = (mahaLordIdx + i) % 9;
    const dur = mahaDuration * (DASHA_YEARS[idx] / 120);
    const aEnd = new Date(aCursor.getTime() + dur);
    antardashas.push({ lord: DASHA_SEQUENCE[idx], start: aCursor, end: aEnd });
    aCursor = aEnd;
  }
  const currentAntar = antardashas.find(a => a.start <= now && a.end > now) || antardashas[0];

  return {
    mahadasha: currentMaha.lord, mahadasha_start: currentMaha.start, mahadasha_end: currentMaha.end,
    antardasha: currentAntar.lord, antardasha_start: currentAntar.start, antardasha_end: currentAntar.end,
    next_mahadasha: nextMaha.lord, next_mahadasha_start: nextMaha.start,
  };
}

// ─── Main chart builder ───────────────────────────────────────────────────────
export interface VedicPlanet {
  abbr: string; name: string; tropicalLon: number; siderealLon: number;
  sign: string; signNum: number; degree: number; house: number;
  isRetrograde: boolean; nakshatra: string; nakshatraLord: string; pada: number;
}

export interface VedicChart {
  jd: number; ayanamsa: number;
  ascendant: { siderealLon: number; sign: string; signNum: number; degree: number };
  planets: VedicPlanet[];
  houses: { house: number; sign: string; signNum: number; cusp: number }[];
  dasha: DashaResult;
}

export interface BirthInput {
  year: number; month: number; day: number;
  hour: number; minute: number; tzOffset: number;
  lat: number; lon: number;
}

export function buildVedicChart(input: BirthInput): VedicChart {
  const utHours = input.hour + input.minute / 60 - input.tzOffset;
  const jd = toJulianDay(input.year, input.month, input.day, utHours);
  const ay = ayanamsa(jd);
  const utcDate = jdToDate(jd);

  const tropAsc = ascendantLongitude(jd, input.lat, input.lon);
  const sidAsc = mod360(tropAsc - ay);
  const ascInfo = signFromLon(sidAsc);

  const houses = Array.from({ length: 12 }, (_, i) => {
    const signNum = (ascInfo.signNum + i) % 12;
    return { house: i + 1, sign: ZODIAC_SIGNS[signNum], signNum, cusp: signNum * 30 };
  });

  const planetDefs: { abbr: string; name: string; body: Astro.Body | null; canRetro: boolean }[] = [
    { abbr: "Su", name: "Sun",     body: Astro.Body.Sun,     canRetro: false },
    { abbr: "Mo", name: "Moon",    body: Astro.Body.Moon,    canRetro: false },
    { abbr: "Ma", name: "Mars",    body: Astro.Body.Mars,    canRetro: true  },
    { abbr: "Me", name: "Mercury", body: Astro.Body.Mercury, canRetro: true  },
    { abbr: "Ju", name: "Jupiter", body: Astro.Body.Jupiter, canRetro: true  },
    { abbr: "Ve", name: "Venus",   body: Astro.Body.Venus,   canRetro: true  },
    { abbr: "Sa", name: "Saturn",  body: Astro.Body.Saturn,  canRetro: true  },
  ];

  const planets: VedicPlanet[] = planetDefs.map(({ abbr, name, body, canRetro }) => {
    const tropLon = name === "Moon" ? getMoonTropicalLon(utcDate) : getTropicalLon(body!, utcDate);
    const sidLon = mod360(tropLon - ay);
    const info = signFromLon(sidLon);
    const nak = getNakshatra(sidLon);
    const retro = canRetro && checkRetrograde(body!, utcDate);
    const house = ((info.signNum - ascInfo.signNum + 12) % 12) + 1;
    return {
      abbr, name, tropicalLon: tropLon, siderealLon: sidLon,
      sign: info.sign, signNum: info.signNum, degree: parseFloat(info.degree.toFixed(2)),
      house, isRetrograde: retro, nakshatra: nak.name, nakshatraLord: nak.lord, pada: nak.pada,
    };
  });

  // Rahu
  const rahuTrop = getRahuTropicalLon(jd);
  const rahuSid = mod360(rahuTrop - ay);
  const rahuInfo = signFromLon(rahuSid);
  const rahuNak = getNakshatra(rahuSid);
  planets.push({
    abbr: "Ra", name: "Rahu", tropicalLon: rahuTrop, siderealLon: rahuSid,
    sign: rahuInfo.sign, signNum: rahuInfo.signNum, degree: parseFloat(rahuInfo.degree.toFixed(2)),
    house: ((rahuInfo.signNum - ascInfo.signNum + 12) % 12) + 1,
    isRetrograde: true, nakshatra: rahuNak.name, nakshatraLord: rahuNak.lord, pada: rahuNak.pada,
  });

  // Ketu
  const ketuSid = mod360(rahuSid + 180);
  const ketuInfo = signFromLon(ketuSid);
  const ketuNak = getNakshatra(ketuSid);
  planets.push({
    abbr: "Ke", name: "Ketu", tropicalLon: mod360(rahuTrop + 180), siderealLon: ketuSid,
    sign: ketuInfo.sign, signNum: ketuInfo.signNum, degree: parseFloat(ketuInfo.degree.toFixed(2)),
    house: ((ketuInfo.signNum - ascInfo.signNum + 12) % 12) + 1,
    isRetrograde: true, nakshatra: ketuNak.name, nakshatraLord: ketuNak.lord, pada: ketuNak.pada,
  });

  const moon = planets.find(p => p.abbr === "Mo")!;
  const dasha = computeDasha(moon.siderealLon, new Date(input.year, input.month - 1, input.day));

  return { jd, ayanamsa: parseFloat(ay.toFixed(4)), ascendant: { siderealLon: sidAsc, sign: ascInfo.sign, signNum: ascInfo.signNum, degree: parseFloat(ascInfo.degree.toFixed(2)) }, planets, houses, dasha };
}