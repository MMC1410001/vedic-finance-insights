import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { buildVedicChart, type VedicChart, type VedicPlanet, SIGN_LORDS } from "@/lib/vedic-calc";
import type { BirthInput } from "@/lib/vedic-calc";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

// ─── Geocoding helper ─────────────────────────────────────────────────────────
async function geocode(place: string): Promise<{ lat: number; lon: number; tz: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    const tz = Math.round(lon / 15 * 2) / 2;
    return { lat, lon, tz };
  } catch { return null; }
}

// ─── Chart cell geometry ──────────────────────────────────────────────────────
const CHART_CELLS: Record<number, { points: string; cx: number; cy: number }> = {
  1:  { points: "200,0 400,0 300,100",                cx: 300, cy: 50  },
  2:  { points: "400,0 400,200 300,100",              cx: 375, cy: 100 },
  3:  { points: "400,200 400,400 300,300",            cx: 375, cy: 300 },
  4:  { points: "200,400 400,400 300,300",            cx: 300, cy: 375 },
  5:  { points: "0,400 200,400 100,300",              cx: 100, cy: 375 },
  6:  { points: "0,200 0,400 100,300",                cx: 25,  cy: 300 },
  7:  { points: "0,0 0,200 100,100",                  cx: 25,  cy: 100 },
  8:  { points: "0,0 200,0 100,100",                  cx: 100, cy: 50  },
  9:  { points: "100,100 200,0 200,200",              cx: 165, cy: 110 },
  10: { points: "100,100 0,200 100,300 200,200",      cx: 90,  cy: 200 },
  11: { points: "200,200 100,300 200,400 300,300",    cx: 200, cy: 310 },
  12: { points: "200,0 300,100 200,200 100,100",      cx: 200, cy: 100 },
};

const PLANET_COLORS: Record<string, string> = {
  Su: "#f59e0b", Mo: "#a78bfa", Ma: "#ef4444", Me: "#10b981",
  Ju: "#f97316", Ve: "#ec4899", Sa: "#6366f1", Ra: "#64748b", Ke: "#78716c",
};

// ─── Kundali SVG ──────────────────────────────────────────────────────────────
function KundaliSVG({ chart, activeHouse, onHouseClick }: {
  chart: VedicChart; activeHouse: number; onHouseClick: (h: number) => void;
}) {
  const houseSign = (h: number) => chart.houses[h - 1]?.sign.slice(0, 3) ?? "";
  const housePlanets = (h: number) => chart.planets.filter(p => p.house === h);

  return (
    <svg viewBox="-2 -2 404 404" className="w-full max-w-[420px] mx-auto select-none">
      <rect x="0" y="0" width="400" height="400" fill="none"
        stroke="hsl(var(--primary)/0.25)" strokeWidth="1.5" rx="3" />
      <polygon points="200,0 400,200 200,400 0,200"
        fill="none" stroke="hsl(var(--primary)/0.15)" strokeWidth="1" />
      <line x1="0" y1="0" x2="200" y2="200" stroke="hsl(var(--primary)/0.1)" strokeWidth="1" />
      <line x1="400" y1="0" x2="200" y2="200" stroke="hsl(var(--primary)/0.1)" strokeWidth="1" />
      <line x1="0" y1="400" x2="200" y2="200" stroke="hsl(var(--primary)/0.1)" strokeWidth="1" />
      <line x1="400" y1="400" x2="200" y2="200" stroke="hsl(var(--primary)/0.1)" strokeWidth="1" />
      {Object.entries(CHART_CELLS).map(([hStr, cell]) => {
        const h = parseInt(hStr);
        const isActive = activeHouse === h;
        const planets = housePlanets(h);
        return (
          <g key={h} onClick={() => onHouseClick(h)} className="cursor-pointer">
            <polygon points={cell.points}
              fill={isActive ? "hsl(var(--primary)/0.18)" : h === 1 ? "hsl(var(--primary)/0.07)" : "transparent"}
              stroke={isActive ? "hsl(var(--primary)/0.5)" : "transparent"}
              strokeWidth={isActive ? 1.5 : 0} className="transition-all duration-200" />
            <text x={cell.cx} y={cell.cy - 10} textAnchor="middle" fontSize="8" fill="hsl(220,10%,40%)" fontWeight="500">{h}</text>
            <text x={cell.cx} y={cell.cy + 2} textAnchor="middle" fontSize="9"
              fill={isActive ? "hsl(var(--primary))" : "hsl(220,10%,55%)"} fontWeight={isActive ? "700" : "400"}>
              {houseSign(h)}
            </text>
            {planets.map((p, pi) => {
              const offset = (pi - (planets.length - 1) / 2) * 14;
              return (
                <text key={p.abbr} x={cell.cx + offset} y={cell.cy + 16}
                  textAnchor="middle" fontSize="10" fontWeight="700"
                  fill={p.isRetrograde ? "#f59e0b" : PLANET_COLORS[p.abbr] ?? "#a78bfa"}>
                  {p.abbr}{p.isRetrograde ? "ᴿ" : ""}
                </text>
              );
            })}
            {h === 1 && (
              <text x={cell.cx} y={cell.cy - 22} textAnchor="middle" fontSize="7" fill="hsl(var(--primary))" fontWeight="600">ASC</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Planet row ───────────────────────────────────────────────────────────────
function PlanetRow({ p }: { p: VedicPlanet }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <span className="w-7 text-center text-sm font-bold" style={{ color: PLANET_COLORS[p.abbr] ?? "#a78bfa" }}>{p.abbr}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{p.name}</p>
        <p className="text-[10px] text-muted-foreground">{p.nakshatra} ({p.nakshatraLord}) · Pada {p.pada}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-foreground">{p.sign} {p.degree.toFixed(1)}°</p>
        <p className="text-[10px] text-muted-foreground">H{p.house}{p.isRetrograde ? " · ᴿ" : ""}</p>
      </div>
    </div>
  );
}

// ─── Dasha panel ──────────────────────────────────────────────────────────────
function DashaPanel({ chart }: { chart: VedicChart }) {
  const d = chart.dasha;
  const fmt = (dt: Date) => dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const moon = chart.planets.find(p => p.abbr === "Mo")!;
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Current Mahadasha</p>
        <p className="text-lg font-bold text-primary">{d.mahadasha} Mahadasha</p>
        <p className="text-[11px] text-muted-foreground">{fmt(d.mahadasha_start)} → {fmt(d.mahadasha_end)}</p>
      </div>
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Current Antardasha</p>
        <p className="text-sm font-bold text-foreground">{d.antardasha} Antardasha</p>
        <p className="text-[11px] text-muted-foreground">{fmt(d.antardasha_start)} → {fmt(d.antardasha_end)}</p>
      </div>
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Moon Nakshatra</p>
        <p className="text-sm font-semibold text-foreground">{moon.nakshatra} · Pada {moon.pada}</p>
        <p className="text-[11px] text-muted-foreground">Lord: {moon.nakshatraLord} · {moon.sign} {moon.degree.toFixed(1)}°</p>
      </div>
    </div>
  );
}

// ─── House detail ─────────────────────────────────────────────────────────────
const HOUSE_MEANINGS: Record<number, { name: string; significations: string }> = {
  1:  { name: "Lagna – Self & Body",          significations: "Personality, health, physical appearance, overall life direction" },
  2:  { name: "Dhana – Wealth & Family",      significations: "Accumulated wealth, speech, family, food, early education" },
  3:  { name: "Sahaja – Courage & Siblings",  significations: "Siblings, short journeys, communication, courage, skills" },
  4:  { name: "Sukha – Home & Happiness",     significations: "Mother, home, property, vehicles, inner peace, education" },
  5:  { name: "Putra – Intellect & Children", significations: "Children, creativity, intelligence, past-life merit, speculation" },
  6:  { name: "Ripu – Enemies & Health",      significations: "Enemies, debts, diseases, service, daily work, litigation" },
  7:  { name: "Kalatra – Partnership",        significations: "Spouse, business partners, open enemies, foreign travel" },
  8:  { name: "Mrityu – Transformation",      significations: "Longevity, inheritance, occult, sudden events, research" },
  9:  { name: "Dharma – Fortune & Guru",      significations: "Luck, father, religion, higher learning, long journeys" },
  10: { name: "Karma – Career & Status",      significations: "Profession, reputation, authority, government, public life" },
  11: { name: "Labha – Gains & Desires",      significations: "Income, gains, elder siblings, social networks, aspirations" },
  12: { name: "Vyaya – Loss & Liberation",    significations: "Expenses, foreign lands, spirituality, isolation, moksha" },
};

function HouseDetail({ house, chart }: { house: number; chart: VedicChart }) {
  const houseData = chart.houses[house - 1];
  const planets = chart.planets.filter(p => p.house === house);
  const meaning = HOUSE_MEANINGS[house];
  const lord = SIGN_LORDS[houseData.sign];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">House {house}</p>
        <h3 className="text-base font-bold text-foreground">{meaning.name}</h3>
        <p className="text-[11px] text-muted-foreground mt-1">{meaning.significations}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sign</p>
          <p className="text-sm font-bold text-foreground">{houseData.sign}</p>
          <p className="text-[10px] text-muted-foreground">Lord: {lord}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Planets</p>
          <p className="text-sm font-bold text-foreground">{planets.length === 0 ? "Empty" : planets.map(p => p.abbr).join(", ")}</p>
          <p className="text-[10px] text-muted-foreground">{planets.length} planet{planets.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      {planets.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Planets in this house</p>
          {planets.map(p => <PlanetRow key={p.abbr} p={p} />)}
        </div>
      )}
    </div>
  );
}

// ─── Temp Kundali form (popup) ────────────────────────────────────────────────
interface FormState { date: string; time: string; place: string; lat: string; lon: string; tz: string; }

function KundaliDialog({ onGenerate, onClose }: {
  onGenerate: (f: FormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    date: "1990-01-01", time: "06:00", place: "Mumbai, India",
    lat: "19.0760", lon: "72.8777", tz: "5.5",
  });
  const [geocoding, setGeocoding] = useState(false);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleGeocode = async () => {
    if (!form.place) return;
    setGeocoding(true);
    const result = await geocode(form.place);
    if (result) setForm(f => ({ ...f, lat: result.lat.toFixed(4), lon: result.lon.toFixed(4), tz: result.tz.toString() }));
    setGeocoding(false);
  };

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30";
  const labelCls = "block text-[10px] uppercase tracking-widest text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass-card p-6 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Temporary</p>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Generate Kundali
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Date of Birth</label><input type="date" value={form.date} onChange={set("date")} max={new Date().toISOString().split("T")[0]} className={inputCls} /></div>
          <div><label className={labelCls}>Time of Birth</label><input type="time" value={form.time} onChange={set("time")} className={inputCls} /></div>
        </div>
        <div>
          <label className={labelCls}>Place of Birth</label>
          <div className="flex gap-2">
            <input value={form.place} onChange={set("place")} placeholder="City, Country" className={inputCls} />
            <button onClick={handleGeocode} disabled={geocoding}
              className="px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50 shrink-0">
              {geocoding ? "..." : "Locate"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={labelCls}>Latitude</label><input value={form.lat} onChange={set("lat")} className={inputCls} /></div>
          <div><label className={labelCls}>Longitude</label><input value={form.lon} onChange={set("lon")} className={inputCls} /></div>
          <div><label className={labelCls}>UTC Offset</label><input value={form.tz} onChange={set("tz")} className={inputCls} /></div>
        </div>
        <button onClick={() => onGenerate(form)}
          className="w-full py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" /> Generate Chart
        </button>
      </div>
    </div>
  );
}

// ─── Chart view (shared between onboarding chart and temp chart) ──────────────
function ChartView({ chart, label }: { chart: VedicChart; label?: string }) {
  const [activeHouse, setActiveHouse] = useState(1);
  const [activeTab, setActiveTab] = useState<"houses" | "planets" | "dasha">("houses");
  const TABS = [
    { id: "houses" as const, label: "Houses" },
    { id: "planets" as const, label: "Planets" },
    { id: "dasha" as const, label: "Dasha" },
  ];

  // Build radar data from planetary strengths
  const radarData = [
    { subject: "Wealth",  value: chart.planets.filter(p => [2,11].includes(p.house)).length * 20 + 40 },
    { subject: "Career",  value: chart.planets.filter(p => [10,6].includes(p.house)).length * 20 + 40 },
    { subject: "Assets",  value: chart.planets.filter(p => [4,12].includes(p.house)).length * 20 + 40 },
    { subject: "Income",  value: chart.planets.filter(p => [11,5].includes(p.house)).length * 20 + 40 },
    { subject: "Health",  value: chart.planets.filter(p => [1,6].includes(p.house)).length * 20 + 40 },
    { subject: "Growth",  value: chart.planets.filter(p => [9,5].includes(p.house)).length * 20 + 40 },
  ];

  return (
    <div className="space-y-4">
      {label && <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>}

      {/* Top row: spider map left, natal chart right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Spider / Radar map */}
        <div className="glass-card p-5 flex flex-col">
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Kundali Analysis</p>
            <p className="text-sm font-semibold tracking-tight">Personal Wealth Profile</p>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius={90}>
                <PolarGrid stroke="hsl(220,15%,18%)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(220,10%,50%)" }} />
                <Radar
                  dataKey="value"
                  stroke="hsl(43,72%,52%)"
                  fill="hsl(43,72%,52%)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  style={{ filter: "drop-shadow(0 0 6px hsl(43 72% 52% / 0.3))" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-2">
            {[
              { label: "Lagna", value: chart.ascendant.sign },
              { label: "Moon Sign", value: chart.planets.find(p => p.abbr === "Mo")?.sign ?? "—" },
              { label: "Sun Sign", value: chart.planets.find(p => p.abbr === "Su")?.sign ?? "—" },
            ].map(({ label: l, value }) => (
              <div key={l}>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{l}</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Natal chart */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">North Indian Chart</p>
            <span className="text-[10px] text-muted-foreground">Lahiri {chart.ayanamsa.toFixed(2)}°</span>
          </div>
          <KundaliSVG chart={chart} activeHouse={activeHouse} onHouseClick={setActiveHouse} />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Sun</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Moon</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Retrograde</span>
          </div>
        </div>
      </div>

      {/* Bottom: Detail tabs */}
      <div className="space-y-4">
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-white/[0.04] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.06]"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="glass-card p-5">
          {activeTab === "houses" && <HouseDetail house={activeHouse} chart={chart} />}
          {activeTab === "planets" && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">All Planetary Positions</p>
              {chart.planets.map(p => <PlanetRow key={p.abbr} p={p} />)}
            </div>
          )}
          {activeTab === "dasha" && <DashaPanel chart={chart} />}
        </div>
        {activeTab === "houses" && (
          <div className="grid grid-cols-6 gap-1.5">
            {chart.houses.map(h => (
              <button key={h.house} onClick={() => setActiveHouse(h.house)}
                className={`p-2 rounded-lg text-center transition-all ${
                  activeHouse === h.house
                    ? "bg-primary/15 border border-primary/30"
                    : "bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05]"
                }`}>
                <p className="text-[9px] text-muted-foreground">H{h.house}</p>
                <p className="text-[10px] font-semibold text-foreground">{h.sign.slice(0, 3)}</p>
                <p className="text-[8px] text-primary">
                  {chart.planets.filter(p => p.house === h.house).map(p => p.abbr).join(" ") || "·"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper: build chart from kundliRequest session data ─────────────────────
function buildChartFromSession(): VedicChart | null {
  try {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return null;
    const req = JSON.parse(raw);
    if (!req.birth_date || !req.birth_time) return null;
    const [year, month, day] = req.birth_date.split("-").map(Number);
    const [hour, minute] = req.birth_time.split(":").map(Number);
    const input: BirthInput = {
      year, month, day, hour, minute,
      tzOffset: parseFloat(req.timezone) || 0,
      lat: parseFloat(req.latitude) || 0,
      lon: parseFloat(req.longitude) || 0,
    };
    return buildVedicChart(input);
  } catch { return null; }
}

// ─── Main page ────────────────────────────────────────────────────────────────
const BirthChart = () => {
  const [onboardingChart] = useState<VedicChart | null>(() => buildChartFromSession());
  const [tempChart, setTempChart] = useState<VedicChart | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (form: FormState) => {
    setLoading(true);
    setError(null);
    try {
      const [year, month, day] = form.date.split("-").map(Number);
      const [hour, minute] = form.time.split(":").map(Number);
      const input: BirthInput = {
        year, month, day, hour, minute,
        tzOffset: parseFloat(form.tz) || 0,
        lat: parseFloat(form.lat) || 0,
        lon: parseFloat(form.lon) || 0,
      };
      await new Promise(r => setTimeout(r, 50));
      setTempChart(buildVedicChart(input));
      setShowDialog(false);
    } catch {
      setError("Could not calculate chart. Please check your inputs.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full p-4 md:p-6 space-y-5">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden h-32">
        <img
          src="https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=1200&q=80&fm=webp"
          alt="Night sky with stars"
          className="absolute inset-0 w-full h-full object-cover object-top"
        loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between h-full px-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Jyotish</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Vedic Natal Chart
            </h1>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Kundali
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Onboarding chart */}
      {onboardingChart ? (
        <ChartView chart={onboardingChart} />
      ) : (
        <div className="glass-card p-8 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-primary mx-auto opacity-50" />
          <p className="text-sm text-muted-foreground">No birth details found. Complete onboarding or use the Kundali button to generate a chart.</p>
        </div>
      )}

      {/* Temp chart (from dialog) */}
      {tempChart && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Temporary Chart</p>
            <button onClick={() => setTempChart(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
          <ChartView chart={tempChart} />
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <KundaliDialog
          onGenerate={handleGenerate}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
};

export default BirthChart;
