/**
 * Daily Trading Muhurta Engine
 * Computes genuine Vedic signals for a trader's daily briefing.
 *
 * Signals used:
 *  1. Tara Chakra  — natal Moon nakshatra vs today's Moon nakshatra (9-fold relationship)
 *  2. Vara (weekday lord) — alignment with Mahadasha/Antardasha lord
 *  3. Hora at market open — planetary hour ruling the first trading hour
 *  4. Moon Paksha — waxing (favorable) vs waning (caution)
 *  5. Gandanta check — Moon at water/fire sign junction (inauspicious)
 *  6. Rahu Kaal — inauspicious ~90-min window per weekday
 *  7. Transit house check — Jupiter/Saturn over natal 5th/2nd/11th house
 */

import * as Astro from "astronomy-engine";

// ─── helpers ─────────────────────────────────────────────────────────────────

function mod360(x: number) {
  return ((x % 360) + 360) % 360;
}

function toJD(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function getMoonSidLon(date: Date): number {
  const sph = Astro.EclipticGeoMoon(date);
  const lon = mod360(sph.lon);
  const jd = toJD(date);
  const T = (jd - 2451545.0) / 36525;
  const ay = 23.8531 + (50.2878 / 3600) * T * 100;
  return mod360(lon - ay);
}

function getSunSidLon(date: Date): number {
  const vec = Astro.GeoVector(Astro.Body.Sun, date, true);
  const ecl = Astro.Ecliptic(vec);
  const lon = mod360(ecl.elon);
  const jd = toJD(date);
  const T = (jd - 2451545.0) / 36525;
  const ay = 23.8531 + (50.2878 / 3600) * T * 100;
  return mod360(lon - ay);
}

// ─── Nakshatra ────────────────────────────────────────────────────────────────

const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha","Shatabhisha",
  "Purva Bhadrapada","Uttara Bhadrapada","Revati",
];

function getNakshatraIndex(sidLon: number): number {
  return Math.floor(sidLon / (360 / 27)) % 27;
}

// ─── 1. Tara Chakra ───────────────────────────────────────────────────────────
// The 9 Taras (counted from natal Moon nakshatra to today's Moon nakshatra)

export type TaraName =
  | "Janma" | "Sampat" | "Vipat" | "Kshema" | "Pratyak"
  | "Sadhana" | "Naidhana" | "Mitra" | "Parama Mitra";

export interface TaraResult {
  name: TaraName;
  meaning: string;
  verdict: "favorable" | "neutral" | "avoid";
  score: number; // 0–100
}

const TARA_DATA: Record<TaraName, { meaning: string; verdict: TaraResult["verdict"]; score: number }> = {
  "Janma":        { meaning: "Self: sensitive day, avoid new positions", verdict: "neutral", score: 40 },
  "Sampat":       { meaning: "Wealth: excellent for initiating trades",  verdict: "favorable", score: 90 },
  "Vipat":        { meaning: "Danger: high risk, reduce exposure",       verdict: "avoid",    score: 10 },
  "Kshema":       { meaning: "Comfort: hold positions, no new entries",  verdict: "neutral",  score: 55 },
  "Pratyak":      { meaning: "Obstacle: avoid major decisions",          verdict: "avoid",    score: 20 },
  "Sadhana":      { meaning: "Achievement, strong entry window",         verdict: "favorable", score: 85 },
  "Naidhana":     { meaning: "Death: most inauspicious, sit out",        verdict: "avoid",    score: 5  },
  "Mitra":        { meaning: "Friend: good for moderate trades",         verdict: "favorable", score: 75 },
  "Parama Mitra": { meaning: "Best Friend: best day for bold moves",     verdict: "favorable", score: 95 },
};

export function computeTara(natalMoonNakIdx: number, todayMoonNakIdx: number): TaraResult {
  const diff = ((todayMoonNakIdx - natalMoonNakIdx) % 27 + 27) % 27;
  const taraIdx = diff % 9;
  const names: TaraName[] = [
    "Janma","Sampat","Vipat","Kshema","Pratyak","Sadhana","Naidhana","Mitra","Parama Mitra",
  ];
  const name = names[taraIdx];
  return { name, ...TARA_DATA[name] };
}

// ─── 2. Vara (weekday lord) ───────────────────────────────────────────────────

const VARA_LORDS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
// JS getDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat

export function getVaraLord(date: Date): string {
  return VARA_LORDS[date.getDay()];
}

// ─── 3. Hora (planetary hour) ─────────────────────────────────────────────────
// Hora sequence starting from the day lord, each hora = 1 hour

const HORA_SEQUENCE: Record<string, string[]> = {
  Sun:     ["Sun","Venus","Mercury","Moon","Saturn","Jupiter","Mars"],
  Moon:    ["Moon","Saturn","Jupiter","Mars","Sun","Venus","Mercury"],
  Mars:    ["Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter"],
  Mercury: ["Mercury","Moon","Saturn","Jupiter","Mars","Sun","Venus"],
  Jupiter: ["Jupiter","Mars","Sun","Venus","Mercury","Moon","Saturn"],
  Venus:   ["Venus","Mercury","Moon","Saturn","Jupiter","Mars","Sun"],
  Saturn:  ["Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon"],
};

const HORA_QUALITY: Record<string, { label: string; verdict: "favorable" | "neutral" | "caution"; score: number }> = {
  Jupiter: { label: "Jupiter Hora",  verdict: "favorable", score: 90 },
  Venus:   { label: "Venus Hora",    verdict: "favorable", score: 85 },
  Mercury: { label: "Mercury Hora",  verdict: "favorable", score: 75 },
  Moon:    { label: "Moon Hora",     verdict: "neutral",   score: 55 },
  Sun:     { label: "Sun Hora",      verdict: "neutral",   score: 50 },
  Mars:    { label: "Mars Hora",     verdict: "caution",   score: 35 },
  Saturn:  { label: "Saturn Hora",   verdict: "caution",   score: 25 },
  Rahu:    { label: "Rahu Hora",     verdict: "caution",   score: 15 },
};

export interface HoraResult {
  planet: string;
  label: string;
  verdict: "favorable" | "neutral" | "caution";
  score: number;
  currentHora: string; // e.g. "9:00 AM – 10:00 AM"
}

export function computeHora(date: Date): HoraResult {
  const varaLord = getVaraLord(date);
  const seq = HORA_SEQUENCE[varaLord] ?? HORA_SEQUENCE["Sun"];
  const hourOfDay = date.getHours(); // 0–23
  const horaIdx = hourOfDay % 7;
  const planet = seq[horaIdx];
  const q = HORA_QUALITY[planet] ?? HORA_QUALITY["Sun"];

  const horaStart = new Date(date);
  horaStart.setMinutes(0, 0, 0);
  const horaEnd = new Date(horaStart.getTime() + 3600000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  return {
    planet,
    label: q.label,
    verdict: q.verdict,
    score: q.score,
    currentHora: `${fmt(horaStart)} – ${fmt(horaEnd)}`,
  };
}

// Market open hora (9:15 AM IST)
export function computeMarketOpenHora(date: Date): HoraResult {
  const marketOpen = new Date(date);
  marketOpen.setHours(9, 15, 0, 0);
  return computeHora(marketOpen);
}

// ─── 4. Moon Paksha ───────────────────────────────────────────────────────────

export interface PakshaResult {
  paksha: "Shukla" | "Krishna";
  tithi: number; // 1–30
  label: string;
  verdict: "favorable" | "neutral" | "caution";
  score: number;
  note: string;
}

export function computePaksha(date: Date): PakshaResult {
  const moonLon = getMoonSidLon(date);
  const sunLon = getSunSidLon(date);
  let diff = mod360(moonLon - sunLon);
  const tithi = Math.floor(diff / 12) + 1; // 1–30
  const paksha: "Shukla" | "Krishna" = tithi <= 15 ? "Shukla" : "Krishna";

  const isAmavasya = tithi === 30 || tithi === 1;
  const isPurnima = tithi === 15 || tithi === 16;

  let verdict: PakshaResult["verdict"] = paksha === "Shukla" ? "favorable" : "caution";
  let score = paksha === "Shukla" ? 70 : 40;
  let note = paksha === "Shukla"
    ? "Waxing Moon: energy building, favorable for new positions"
    : "Waning Moon: energy receding, prefer closing or holding";

  if (isAmavasya) {
    verdict = "caution"; score = 15;
    note = "Amavasya (New Moon): high volatility, avoid new trades";
  } else if (isPurnima) {
    verdict = "caution"; score = 30;
    note = "Purnima (Full Moon): peak emotional volatility, trade with caution";
  }

  const tithiNames = [
    "Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami",
    "Shashthi","Saptami","Ashtami","Navami","Dashami",
    "Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Purnima",
    "Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami",
    "Shashthi","Saptami","Ashtami","Navami","Dashami",
    "Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Amavasya",
  ];

  return {
    paksha,
    tithi,
    label: `${paksha} Paksha · ${tithiNames[(tithi - 1) % 30]}`,
    verdict,
    score,
    note,
  };
}

// ─── 5. Gandanta check ────────────────────────────────────────────────────────
// Gandanta = Moon within 0°48' of water/fire sign junctions
// Junctions (sidereal): Cancer/Leo (120°), Scorpio/Sagittarius (240°), Pisces/Aries (0°/360°)

export interface GandantaResult {
  isGandanta: boolean;
  note: string;
}

export function checkGandanta(date: Date): GandantaResult {
  const moonLon = getMoonSidLon(date);
  const junctions = [0, 120, 240, 360];
  const orb = 0.8; // degrees
  for (const j of junctions) {
    const dist = Math.min(Math.abs(moonLon - j), Math.abs(moonLon - j + 360), Math.abs(moonLon - j - 360));
    if (dist <= orb) {
      return {
        isGandanta: true,
        note: `Moon is at Gandanta junction (${moonLon.toFixed(1)}°): highly inauspicious for financial decisions`,
      };
    }
  }
  return { isGandanta: false, note: "Moon is clear of Gandanta junctions" };
}

// ─── 6. Rahu Kaal ─────────────────────────────────────────────────────────────
// Each weekday has a fixed Rahu Kaal slot (1.5 hr window out of 12 daylight hours)
// Slots are fractions of the 6 AM–6 PM window (12 hrs = 8 slots of 1.5 hr each)

const RAHU_KAAL_SLOT: Record<number, number> = {
  0: 8,  // Sunday    — slot 8 (3:00–4:30 PM)
  1: 2,  // Monday    — slot 2 (7:30–9:00 AM)
  2: 7,  // Tuesday   — slot 7 (3:00–4:30 PM) — actually slot 7
  3: 5,  // Wednesday — slot 5 (12:00–1:30 PM)
  4: 6,  // Thursday  — slot 6 (1:30–3:00 PM)
  5: 4,  // Friday    — slot 4 (10:30 AM–12:00 PM)
  6: 3,  // Saturday  — slot 3 (9:00–10:30 AM)
};

export interface RahuKaalResult {
  start: Date;
  end: Date;
  isActive: boolean;
  label: string;
  note: string;
}

export function computeRahuKaal(date: Date): RahuKaalResult {
  const day = date.getDay();
  const slot = RAHU_KAAL_SLOT[day];
  // Daylight window: 6 AM to 6 PM = 12 hrs, 8 slots of 90 min each
  const slotMinutes = 90;
  const dayStart = new Date(date);
  dayStart.setHours(6, 0, 0, 0);
  const start = new Date(dayStart.getTime() + (slot - 1) * slotMinutes * 60000);
  const end = new Date(start.getTime() + slotMinutes * 60000);

  const now = date;
  const isActive = now >= start && now < end;

  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  return {
    start,
    end,
    isActive,
    label: `${fmt(start)} – ${fmt(end)}`,
    note: isActive
      ? "Rahu Kaal is ACTIVE now: avoid initiating new trades"
      : `Rahu Kaal today: ${fmt(start)} – ${fmt(end)}. Avoid new entries during this window`,
  };
}

// ─── 7. Transit house check ───────────────────────────────────────────────────

export interface TransitSignal {
  planet: string;
  transitHouse: number;
  significance: string;
  verdict: "favorable" | "neutral" | "caution";
  score: number;
}

export function computeTransitSignals(transits: Array<{ planet: string; natal_house: number; impact: string }>): TransitSignal[] {
  const keyPlanets = ["Jupiter", "Saturn", "Rahu", "Ketu"];
  return transits
    .filter(t => keyPlanets.includes(t.planet))
    .map(t => {
      const house = t.natal_house;
      let significance = "";
      let verdict: TransitSignal["verdict"] = "neutral";
      let score = 50;

      if (t.planet === "Jupiter") {
        if ([2, 5, 9, 11].includes(house)) {
          significance = `Jupiter in house ${house}: wealth & gains activated`;
          verdict = "favorable"; score = 85;
        } else if ([6, 8, 12].includes(house)) {
          significance = `Jupiter in house ${house}: expansion blocked, caution`;
          verdict = "caution"; score = 30;
        } else {
          significance = `Jupiter in house ${house}: moderate support`;
          verdict = "neutral"; score = 55;
        }
      } else if (t.planet === "Saturn") {
        if ([3, 6, 11].includes(house)) {
          significance = `Saturn in house ${house}: disciplined gains possible`;
          verdict = "favorable"; score = 65;
        } else if ([1, 4, 7, 8, 10].includes(house)) {
          significance = `Saturn in house ${house}: pressure & delays, reduce risk`;
          verdict = "caution"; score = 25;
        } else {
          significance = `Saturn in house ${house}: neutral transit`;
          verdict = "neutral"; score = 50;
        }
      } else if (t.planet === "Rahu") {
        if ([3, 6, 10, 11].includes(house)) {
          significance = `Rahu in house ${house}: unconventional gains possible`;
          verdict = "neutral"; score = 55;
        } else {
          significance = `Rahu in house ${house}: unpredictable energy, caution`;
          verdict = "caution"; score = 30;
        }
      } else if (t.planet === "Ketu") {
        if ([3, 6, 12].includes(house)) {
          significance = `Ketu in house ${house}: detachment from losses`;
          verdict = "neutral"; score = 50;
        } else {
          significance = `Ketu in house ${house}: sudden reversals possible`;
          verdict = "caution"; score = 25;
        }
      }

      return { planet: t.planet, transitHouse: house, significance, verdict, score };
    });
}

// ─── Master output ────────────────────────────────────────────────────────────

export interface DailyTradingBriefingData {
  date: Date;
  overallScore: number;          // 0–100
  verdict: "Trade Confidently" | "Trade Cautiously" | "Sit Out Today";
  verdictColor: string;
  tara: TaraResult;
  vara: { lord: string; isAligned: boolean; note: string };
  hora: HoraResult;
  marketOpenHora: HoraResult;
  paksha: PakshaResult;
  gandanta: GandantaResult;
  rahuKaal: RahuKaalResult;
  transitSignals: TransitSignal[];
  natalMoonNakshatra: string;
  todayMoonNakshatra: string;
}

export function computeDailyBriefing(
  natalMoonSidLon: number,
  mahadashaLord: string,
  antardashaLord: string,
  transits: Array<{ planet: string; natal_house: number; impact: string }>,
  now: Date = new Date()
): DailyTradingBriefingData {
  const natalMoonNakIdx = getNakshatraIndex(natalMoonSidLon);
  const todayMoonSidLon = getMoonSidLon(now);
  const todayMoonNakIdx = getNakshatraIndex(todayMoonSidLon);

  const tara = computeTara(natalMoonNakIdx, todayMoonNakIdx);
  const varaLord = getVaraLord(now);
  const isVaraAligned = varaLord === mahadashaLord || varaLord === antardashaLord;
  const vara = {
    lord: varaLord,
    isAligned: isVaraAligned,
    note: isVaraAligned
      ? `${varaLord} rules today: aligns with your active dasha lord`
      : `${varaLord} rules today: not your dasha lord`,
  };

  const hora = computeHora(now);
  const marketOpenHora = computeMarketOpenHora(now);
  const paksha = computePaksha(now);
  const gandanta = checkGandanta(now);
  const rahuKaal = computeRahuKaal(now);
  const transitSignals = computeTransitSignals(transits);

  // ── Score aggregation ──
  // Weights: Tara 30%, Paksha 15%, MarketOpenHora 20%, Vara 10%, Transits 15%, Gandanta/RahuKaal penalties 10%
  let score = 0;
  score += tara.score * 0.30;
  score += paksha.score * 0.15;
  score += marketOpenHora.score * 0.20;
  score += (isVaraAligned ? 80 : 40) * 0.10;

  const avgTransitScore = transitSignals.length > 0
    ? transitSignals.reduce((s, t) => s + t.score, 0) / transitSignals.length
    : 50;
  score += avgTransitScore * 0.15;

  // Penalties
  if (gandanta.isGandanta) score -= 20;
  if (rahuKaal.isActive) score -= 15;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: DailyTradingBriefingData["verdict"] =
    score >= 65 ? "Trade Confidently" :
    score >= 40 ? "Trade Cautiously" :
    "Sit Out Today";

  const verdictColor =
    verdict === "Trade Confidently" ? "#34d399" :
    verdict === "Trade Cautiously" ? "#fbbf24" :
    "#f87171";

  return {
    date: now,
    overallScore: score,
    verdict,
    verdictColor,
    tara,
    vara,
    hora,
    marketOpenHora,
    paksha,
    gandanta,
    rahuKaal,
    transitSignals,
    natalMoonNakshatra: NAKSHATRAS[natalMoonNakIdx],
    todayMoonNakshatra: NAKSHATRAS[todayMoonNakIdx],
  };
}
