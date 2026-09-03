# AstroTicker — Fixed Top Marquee Strip

A fixed-position, auto-scrolling ticker bar at the very top of the page. Displays live astrology/financial data items in an infinite horizontal loop.

---

## Preview Behavior

- Fixed to `top: 0`, full width, `z-index: 60`
- Height: `40px`
- Gold gradient background
- Items scroll infinitely left-to-right using Framer Motion
- Each item shows: icon + label + subtitle + trend arrow
- Right edge has a fade-out gradient

---

## Dependencies

```
framer-motion
lucide-react (Moon, Sun, Star, TrendingUp, TrendingDown, Minus)
```

---

## Full Component Code

```tsx
import { motion } from "framer-motion";
import { Moon, Sun, Star, TrendingUp, TrendingDown, Minus } from "lucide-react";

const tickerItems = [
  { icon: "moon",     label: "Moon in Scorpio",          sub: "Intense financial intuition",       trend: "up"   },
  { icon: "planet",   label: "Jupiter → Gemini",          sub: "Expand communication investments",  trend: "up"   },
  { icon: "sun",      label: "Sun in Gemini",             sub: "Mercury rules wealth today",        trend: "neutral" },
  { icon: "planet",   label: "Saturn Retrograde",         sub: "Review long-term commitments",      trend: "down" },
  { icon: "moon",     label: "Moon Waxing Gibbous",       sub: "Accumulation phase active",         trend: "up"   },
  { icon: "planet",   label: "Venus in Taurus",           sub: "Strong for gold & luxury assets",   trend: "up"   },
  { icon: "planet",   label: "Mercury Direct",            sub: "Clear for contracts & payments",    trend: "up"   },
  { icon: "planet",   label: "Rahu in Pisces",            sub: "Foreign & speculative exposure",    trend: "neutral" },
  { icon: "moon",     label: "Pushya Nakshatra",          sub: "Auspicious for wealth creation",    trend: "up"   },
  { icon: "planet",   label: "Mars in Leo",               sub: "Aggressive growth energy",          trend: "up"   },
  { icon: "planet",   label: "Ketu in Virgo",             sub: "Detach from micro-management",      trend: "neutral" },
  { icon: "sun",      label: "Gemini Season",             sub: "Diversify your portfolio",          trend: "neutral" },
];

// Triple for seamless loop
const items = [...tickerItems, ...tickerItems, ...tickerItems];

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "up")   return <TrendingUp  className="w-3 h-3" style={{ color: "#E8F5E9" }} />;
  if (trend === "down") return <TrendingDown className="w-3 h-3" style={{ color: "#FFCDD2" }} />;
  return <Minus className="w-3 h-3" style={{ color: "rgba(255,253,240,0.5)" }} />;
};

const ItemIcon = ({ type }: { type: string }) => {
  if (type === "moon")   return <Moon   className="w-3 h-3 shrink-0" style={{ color: "#FFFDE8" }} />;
  if (type === "sun")    return <Sun    className="w-3 h-3 shrink-0" style={{ color: "#FFFDE8" }} />;
  return                        <Star   className="w-3 h-3 shrink-0" style={{ color: "#FFFDE8" }} />;
};

export const AstroTicker = () => (
  <div
    className="fixed top-0 inset-x-0 z-[60] overflow-hidden"
    style={{
      height: "40px",
      background: "linear-gradient(135deg, #8B6914 0%, #D4A012 50%, #8B6914 100%)",
      borderBottom: "1px solid rgba(42,14,74,0.12)",
    }}
  >
    {/* Scrolling content */}
    <div className="absolute inset-0 flex items-center" style={{ paddingLeft: "16px" }}>
      <motion.div
        className="flex items-center gap-0"
        animate={{ x: ["0%", "-33.33%"] }}
        transition={{ duration: 55, ease: "linear", repeat: Infinity }}
      >
        {items.map((item, i) => (
          <div key={i} className="flex items-center shrink-0">
            {/* Item */}
            <div className="flex items-center gap-2 px-5 whitespace-nowrap">
              <ItemIcon type={item.icon} />
              <span
                className="text-sm font-bold"
                style={{ color: "#FFFDE8" }}
              >
                {item.label}
              </span>
              <span
                className="text-xs"
                style={{ color: "rgba(255,253,232,0.8)" }}
              >
                — {item.sub}
              </span>
              <TrendIcon trend={item.trend} />
            </div>
            {/* Divider dot */}
            <span
              className="text-xs select-none"
              style={{ color: "rgba(255,253,232,0.5)" }}
            >
              ✦
            </span>
          </div>
        ))}
      </motion.div>
    </div>

    {/* Right fade */}
    <div
      className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none z-10"
      style={{ background: "linear-gradient(to left, #8B6914 40%, transparent)" }}
    />
  </div>
);
```

---

## Customization Notes

| Property | Current Value | Purpose |
|----------|--------------|---------|
| `height` | 40px | Strip height |
| `background` | Gold gradient `#8B6914 → #D4A012 → #8B6914` | Background color |
| `duration` | 55s | Scroll speed (higher = slower) |
| `tickerItems` | Astrology data array | Replace with your own data |
| Icon colors | `#FFFDE8` (cream) | Light text on gold bg |
| Trend colors | Green `#E8F5E9`, Red `#FFCDD2` | Up/down indicators |

---

## How the Infinite Scroll Works

1. The `tickerItems` array is tripled (`[...items, ...items, ...items]`)
2. Framer Motion animates `x` from `0%` to `-33.33%` (one-third of total width)
3. Since the content is tripled, when it reaches -33.33% it looks identical to the start
4. `repeat: Infinity` makes it loop seamlessly
