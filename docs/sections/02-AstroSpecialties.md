# AstroSpecialties — Moving Language & Specialties Marquee Strip

A two-row infinite scrolling marquee section. Row 1 scrolls specialties (left), Row 2 scrolls languages (right). Creates a dynamic, trust-building visual.

---

## Preview Behavior

- Two rows of auto-scrolling text
- Row 1: Specialties scrolling left (40s duration)
- Row 2: Languages scrolling right (40s duration)
- Gold borders top/bottom
- Divider dots `✦` between items
- Warm background overlay

---

## Dependencies

```
framer-motion
```

---

## Full Component Code

```tsx
import { motion } from "framer-motion";

const specialties = [
  "When to Invest", "Peak Earning Years", "Hidden Wealth Windows", "Risk-Free Periods",
  "Career vs Business", "Ideal Loan Timing", "Property Buy Signals", "Gold Accumulation Cycles",
  "Startup Launch Timing", "Foreign Income Potential", "Salary Growth Phases", "Debt Closure Windows",
  "Side Income Triggers", "Financial Blind Spots", "Wealth Retention Zones", "Smart Exit Timing",
];

const languages = [
  { text: "हिन्दी",   script: true  },
  { text: "English",  script: false },
  { text: "தமிழ்",   script: true  },
  { text: "తెలుగు",  script: true  },
  { text: "বাংলা",   script: true  },
  { text: "मराठी",   script: true  },
  { text: "ಕನ್ನಡ",  script: true  },
  { text: "ਪੰਜਾਬੀ", script: true  },
  { text: "اردو",    script: true  },
  { text: "ગુજરાતી", script: true  },
  { text: "മലയാളം", script: true  },
  { text: "ଓଡ଼ିଆ",  script: true  },
];

// Triplicate for infinite scroll
const row1 = [...specialties, ...specialties, ...specialties];
const row2 = [...languages,   ...languages,   ...languages  ];

const Dot = () => (
  <span className="mx-3 text-xs select-none" style={{ color: "rgba(184,134,11,0.5)" }}>✦</span>
);

export const AstroSpecialties = () => (
  <section className="relative py-16 overflow-hidden"
    style={{ borderTop: "1px solid rgba(184,134,11,0.15)", borderBottom: "1px solid rgba(184,134,11,0.15)" }}
  >
    {/* Subtle warm bg */}
    <div className="absolute inset-0 pointer-events-none"
      style={{ background: "rgba(255,251,242,0.5)" }}
    />

    <div className="relative z-10">
      {/* Label */}
      <p className="text-center text-xs font-bold tracking-[0.3em] uppercase mb-8"
        style={{ color: "#A67C2C" }}>
        12 Languages · 16+ Specialties
      </p>

      {/* Row 1 — Specialties, scrolls left */}
      <div className="overflow-hidden mb-5">
        <motion.div
          className="flex items-center"
          animate={{ x: ["0%", "-33.33%"] }}
          transition={{ duration: 40, ease: "linear", repeat: Infinity }}
        >
          {row1.map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <span
                className="text-lg md:text-xl font-bold whitespace-nowrap"
                style={{ color: "#2C1810", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.3px" }}
              >
                {item}
              </span>
              <Dot />
            </div>
          ))}
        </motion.div>
      </div>

      {/* Row 2 — Languages, scrolls right */}
      <div className="overflow-hidden">
        <motion.div
          className="flex items-center"
          animate={{ x: ["-33.33%", "0%"] }}
          transition={{ duration: 40, ease: "linear", repeat: Infinity }}
        >
          {row2.map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <span
                className="whitespace-nowrap"
                style={{
                  fontSize: item.script ? "1.25rem" : "1.15rem",
                  fontWeight: item.script ? 600 : 700,
                  color: item.script ? "#8B6914" : "#2C1810",
                  letterSpacing: item.script ? "0.02em" : "0.06em",
                }}
              >
                {item.text}
              </span>
              <Dot />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);
```

---

## Customization Notes

| Property | Current Value | Purpose |
|----------|--------------|---------|
| `specialties` | Array of 16 items | Row 1 text items |
| `languages` | Array of 12 language objects | Row 2 items with script flag |
| `duration` | 40s per row | Scroll speed |
| Row 1 direction | Left (`0%` → `-33.33%`) | First row scrolls left |
| Row 2 direction | Right (`-33.33%` → `0%`) | Second row scrolls right |
| Font | Playfair Display (specialties), default (languages) | Typography |
| Colors | `#2C1810` dark, `#8B6914` gold for scripts | Text colors |
| Borders | `rgba(184,134,11,0.15)` top & bottom | Section separators |

---

## How to Adapt

1. Replace `specialties` array with your own feature/service keywords
2. Replace `languages` array with your own items (set `script: true` for non-Latin scripts to get gold coloring)
3. Adjust `duration` for scroll speed (higher = slower)
4. The section label text ("12 Languages · 16+ Specialties") should match your data
