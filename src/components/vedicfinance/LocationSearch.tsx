import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  /** Fired only when a suggestion is picked — this is what supplies coordinates. */
  onChange: (place: string, lat: number, lon: number, tz: number) => void;
  /**
   * Fired on every keystroke with the raw text. Without this the typed value
   * never reaches the form, so submitting without clicking a suggestion failed
   * silently with an empty birth_place (AF-091).
   */
  onTextChange?: (text: string) => void;
  /** True once a suggestion has been selected — drives the confirmed state. */
  selected?: boolean;
}

// Estimate UTC offset from longitude (rough but good enough for historical birth data)
function estimateTimezone(lat: number, lon: number): number {
  // For India specifically (most users), return 5.5
  if (lat >= 6 && lat <= 37 && lon >= 68 && lon <= 98) return 5.5;
  // For Nepal
  if (lat >= 26 && lat <= 31 && lon >= 80 && lon <= 89) return 5.75;
  // General estimate: 1 hour per 15 degrees of longitude
  return Math.round((lon / 15) * 2) / 2;
}

export default function LocationSearch({ value, onChange, onTextChange, selected }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the field in step with the form when it is pre-filled or restored
  // (initialValues, back-navigation). Without this the input only ever shows
  // the value it was first mounted with.
  useEffect(() => {
    setQuery((current) => (value && value !== current ? value : current));
  }, [value]);

  const search = useCallback(async (q: string) => {
    // Nominatim is case-insensitive; normalise whitespace so a stray space or
    // a pasted value with double spaces still returns matches.
    const normalized = q.trim().replace(/\s+/g, " ");
    if (normalized.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalized)}&limit=5&addressdetails=0`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: LocationResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    // Propagate the raw text immediately. The form needs to know what was
    // typed even before a suggestion is picked, so it can show a targeted
    // "select from the dropdown" message instead of "Birth place is required".
    onTextChange?.(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (r: LocationResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const tz = estimateTimezone(lat, lon);
    setQuery(r.display_name);
    setOpen(false);
    setResults([]);
    onChange(r.display_name, lat, lon, tz);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#a22c1c' }} />
        <Input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search your birth place"
          className="pl-9 pr-9 h-12 rounded-xl border"
          style={{
            background: '#f6f4f2',
            borderColor: selected ? 'rgba(47,191,159,0.5)' : 'rgba(26, 10, 46, 0.12)',
            color: '#1A0A2E',
          }}
          autoComplete="off"
          aria-describedby="birth-place-hint"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : selected ? (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#2FBF9F' }} />
        ) : null}
      </div>

      {/* Hidden visually but kept for screen readers: the input's
          aria-describedby targets it, and the coordinates only arrive when a
          suggestion is actually clicked (AF-091). Sighted users get the same
          signal from the tick that appears once a place is selected. */}
      {!selected && (
        <p id="birth-place-hint" className="sr-only">
          Start typing, then pick your birth place from the list.
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border shadow-2xl overflow-hidden max-h-56 overflow-y-auto" style={{ background: '#ffffff', borderColor: 'rgba(26, 10, 46, 0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-[#f6f4f2] transition-colors text-sm"
              >
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#a22c1c' }} />
                <span style={{ color: '#1A0A2E' }} className="leading-snug line-clamp-2">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
