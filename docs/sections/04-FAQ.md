# FAQ Section — Animated Accordion

An elegant FAQ accordion with animated open/close transitions, decorative celestial background (CelestialOrrery), and gold-themed styling.

---

## Preview Behavior

- Vertical list of 5 FAQ items
- Click to expand/collapse (only one open at a time)
- Animated height + opacity transition
- Plus/Minus icon rotates on toggle
- Decorative celestial orrery animation in background
- Gold gradient divider above section

---

## Dependencies

```
framer-motion (AnimatePresence, motion)
lucide-react (Plus, Minus)
Custom: CelestialOrrery component (decorative background — can be omitted)
```

---

## CelestialOrrery (Optional Background)

A purely decorative animated background with orbiting planets and glyphs. Styles are in CSS. You can remove this entirely for a simpler implementation.

```tsx
export const CelestialOrrery = () => {
  return (
    <div className="celestial-orrery-wrapper absolute inset-0 overflow-hidden pointer-events-none">
      <div className="glyph-field">
        <div className="glyph-container glyph-1">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
          <div className="glyph-part part-3"></div>
        </div>
        <div className="glyph-container glyph-2">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
        </div>
        <div className="glyph-container glyph-3">
          <div className="glyph-part part-1"></div>
          <div className="glyph-part part-2"></div>
          <div className="glyph-part part-3"></div>
        </div>
      </div>
      <div className="orrery-field">
        <div className="orbit orbit-1"><div className="planet"></div></div>
        <div className="orbit orbit-2"><div className="planet"></div></div>
        <div className="orbit orbit-3"><div className="planet"></div></div>
        <div className="orbit orbit-4"><div className="planet"></div></div>
      </div>
    </div>
  );
};
```


---

## FAQ Data Structure

```tsx
const faqs = [
  {
    q: "What exactly is a Financial Kundali?",
    a: "It's a personalised report that maps your Vedic birth chart through a financial lens — highlighting your best months to invest, periods to stay cautious, and the money behaviour patterns unique to your chart.",
  },
  {
    q: "Do I need to share any financial data?",
    a: "No. We never ask for bank details, holdings, or income. Just your birth date, time, and place — that's all we need to generate your report.",
  },
  {
    q: "How is this different from regular astrology apps?",
    a: "Generic astrology apps cover love, career, or daily horoscopes. The Financial Kundali is built exclusively for financial decision-making — timing, risk, and money behaviour.",
  },
  {
    q: "I don't know astrology. Can I still use this?",
    a: "Absolutely. The report is written in plain language with clear, actionable insights — no jargon, no spreadsheets required.",
  },
  {
    q: "Is this a subscription?",
    a: "No. You pay ₹99 once and get lifetime access to your Financial Kundali report. No recurring charges, ever.",
  },
];
```

---

## Full Component Code

```tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { CelestialOrrery } from "@/components/ui/celestial-orrery";

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="relative py-24 md:py-36 overflow-hidden">
      {/* Background */}
      <CelestialOrrery />
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: "radial-gradient(ellipse at center, rgba(255,251,242,0.75) 0%, transparent 70%)",
        }}
      />

      {/* Divider */}
      <div className="h-px mx-8 mb-16 relative z-10"
        style={{ background: "linear-gradient(90deg, transparent, rgba(184,134,11,0.3), rgba(184,134,11,0.6), rgba(184,134,11,0.3), transparent)" }}
      />

      <div className="container max-w-5xl relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="text-xs font-bold tracking-[0.3em] uppercase" style={{ color: "#A67C2C" }}>
            FAQ
          </span>
          <h2
            className="mt-3 text-3xl md:text-5xl font-bold leading-tight"
            style={{ color: "#2C1810", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.5px" }}
          >
            Got questions about the{" "}
            <span style={{
              background: "linear-gradient(135deg, #B8860B, #D4A012)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Financial Kundali?
            </span>
          </h2>
          <p className="mt-4 text-base max-w-lg mx-auto leading-relaxed" style={{ color: "#503214" }}>
            Everything you need to know before you unlock your financial blueprint.
          </p>
        </motion.div>

        {/* Accordion items */}
        <div className="space-y-4">
          {faqs.map((f, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: "easeOut" }}
              >
                <div
                  className="rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    background: isOpen ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.95)",
                    border: isOpen
                      ? "1px solid rgba(184,134,11,0.4)"
                      : "1px solid rgba(184,134,11,0.15)",
                    transition: "background 0.3s ease, border 0.3s ease",
                    boxShadow: isOpen
                      ? "0 8px 32px rgba(139,105,20,0.1)"
                      : "0 2px 8px rgba(139,105,20,0.04)",
                  }}
                  onClick={() => toggle(i)}
                >
                  {/* Trigger row */}
                  <div className="flex items-center justify-between px-8 py-6 md:py-7 gap-4">
                    <span
                      className="text-base md:text-lg font-semibold leading-snug select-none"
                      style={{
                        color: isOpen ? "#8B6914" : "#2C1810",
                        fontFamily: "'Playfair Display', serif",
                        transition: "color 0.3s ease",
                      }}
                    >
                      {f.q}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: isOpen ? "rgba(184,134,11,0.1)" : "rgba(184,134,11,0.05)",
                        border: isOpen
                          ? "1px solid rgba(184,134,11,0.3)"
                          : "1px solid rgba(184,134,11,0.15)",
                        transition: "background 0.3s ease, border 0.3s ease",
                      }}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isOpen ? (
                          <motion.span key="minus" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                            <Minus className="w-3.5 h-3.5" style={{ color: "#8B6914" }} />
                          </motion.span>
                        ) : (
                          <motion.span key="plus" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                            <Plus className="w-3.5 h-3.5" style={{ color: "#503214" }} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Animated answer */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="px-8 pb-6">
                          <p className="text-sm md:text-base leading-relaxed" style={{ color: "#503214", lineHeight: 1.7 }}>
                            {f.a}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
```

---

## Key Styling

| Element | Style |
|---------|-------|
| Section padding | `py-24 md:py-36` |
| Card background | White `rgba(255,255,255,0.95)` |
| Card border (closed) | `rgba(184,134,11,0.15)` |
| Card border (open) | `rgba(184,134,11,0.4)` |
| Question font | Playfair Display, `#2C1810` (closed), `#8B6914` (open) |
| Answer font | Inter, `#503214` |
| Icon button | Circular, gold border, Plus/Minus |
| Animation | Height 0→auto, opacity 0→1, 0.38s ease |

---

## Customization

1. Replace `faqs` array with your own Q&A pairs
2. Remove `<CelestialOrrery />` if you don't want the animated background
3. The gold divider line can be removed or adjusted
4. Section header text/gradient can be changed to match your brand
