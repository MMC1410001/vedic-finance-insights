# Glimpse of Financial Kundali — Standalone Implementation Guide

> This document describes a single section ("A Glimpse of your Financial Kundali") that can be implemented independently in any React + TailwindCSS project. Submit this to an LLM with your project context and it should be able to build it.

---

## Overview

This is a marketing/teaser section that showcases locked preview cards of a "Financial Kundali" product. The section has:

1. **A heading** — "A glimpse of your Financial Kundali" with social proof stats
2. **A two-column layout** split by a vertical divider:
   - **Left column**: A 3D auto-playing image carousel (FocusRail) showing insight card previews
   - **Right column**: Two blurred/locked preview cards (Earnings Strength chart + Best Time to Buy Assets list) — the right side of this column is intentionally **empty space** (no form)
3. **Dark, premium aesthetic** with gold (#C8A45D) accents on a deep teal/dark background

---

## Tech Stack Required

- **React** (with hooks)
- **TailwindCSS** (utility-first styling)
- **Framer Motion** (`framer-motion`) — for carousel animations & drag/swipe
- **Lucide React** (`lucide-react`) — for icons (ShieldCheck, Star, Lock, Building2, CircleDollarSign, Car, ChevronLeft, ChevronRight)

---

## Color Palette Used in This Section

| Token | Value | Usage |
|-------|-------|-------|
| Section Background | `radial-gradient(circle at 50% 30%, #0F2A2E 0%, #081418 100%)` | Section background |
| Gold Primary | `#C8A45D` | Headings, accents, lock icons, stars |
| Gold Light | `#FDD589` | Secondary gold highlights |
| White | `#FFFFFF` | Primary text |
| Muted Cream | `rgba(233,219,197,0.7)` | Subtitle/secondary text |
| Gold Divider | `rgba(200,164,93,0.3)` | Dividers and borders |
| Card Background | `rgba(255,255,255,0.95)` | Locked card backgrounds |
| Card Border | `rgba(184,134,11,0.18)` | Card border |
| Dark Gold | `#B8860B` | Lock icons, input accents |
| Gradient Gold | `linear-gradient(135deg, #8B6914, #D4A012)` | Chart stroke gradient |
| Green (Auspicious) | `#16a34a` | Status indicators |
| Text Dark | `#2C1810` | Dark text on light cards |
| Muted Brown | `#8B7355` | Subdued labels |

---

## Fonts

- **Headings**: `'JainiPurva', 'Playfair Display', serif` — letter-spacing: -0.5px
- **Body/UI**: `'Inter', sans-serif`

Make sure to load JainiPurva (Google Fonts) or fall back to Playfair Display.

---

## Section Structure (Top to Bottom)

### 1. Section Container

```
<section>
  - Background: radial-gradient(circle at 50% 30%, #0F2A2E 0%, #081418 100%)
  - Padding: py-14 md:py-20
  - Overflow: hidden
</section>
```

### 2. Header Area (Centered)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│     "A glimpse of your Financial Kundali"                          │
│     (heading: white + gold italic for "Financial Kundali")         │
│                                                                    │
│     [Avatar Stack] 2,400+ Kundalis generated │ Verified by 100+   │
│     astrologers │ 5 star on Product Hunt ★★★★★                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Heading implementation:**
- Font: JainiPurva/Playfair Display, serif
- Size: text-3xl md:text-4xl lg:text-[2.75rem]
- "A glimpse of your " — color: #FFFFFF
- "Financial Kundali" — color: #C8A45D, italic, font-normal

**Social proof row** (flex, centered, gap-4 sm:gap-6):
- **Avatar stack**: 4 colored circles (w-7 h-7 rounded-full, ring-2 ring-[#081418]), colors: `#C8A45D`, `#FDD589`, `#0F2A2E`, `#3E000E`. Followed by "2,400+ Kundalis generated" text.
- **Divider**: w-px h-5, background: rgba(200,164,93,0.3) (hidden on mobile)
- **Verified badge**: ShieldCheck icon (w-4 h-4, color: #C8A45D) + "Verified by 100+ astrologers"
- **Divider**: same as above
- **Product Hunt**: "5 star on Product Hunt" + 5 filled Star icons (w-4 h-4, fill: #C8A45D, color: #C8A45D)

---

### 3. Main Two-Column Layout

```
┌─────────────────────┬───┬──────────────────────────────────────────┐
│                     │   │                                          │
│   LEFT COLUMN       │ | │   RIGHT COLUMN                           │
│   (45% width)       │ | │   (55% width)                            │
│                     │ | │                                          │
│  "🔓 Unlock All     │ | │  "✨ Get 2 Free Insights"                │
│   Insights"         │ | │                                          │
│                     │ | │  ┌──────────────┐  ┌─────────────────┐   │
│  ┌───────────────┐  │ | │  │ Earnings     │  │                 │   │
│  │ 3D Carousel   │  │ | │  │ Strength     │  │  EMPTY SPACE    │   │
│  │ of insight    │  │ | │  │ (blurred)    │  │  (no form)      │   │
│  │ images        │  │ | │  ├──────────────┤  │                 │   │
│  │ (auto-play)   │  │ | │  │ Buy Timing   │  │                 │   │
│  │               │  │ | │  │ (blurred)    │  │                 │   │
│  └───────────────┘  │ | │  └──────────────┘  └─────────────────┘   │
│                     │   │                                          │
└─────────────────────┴───┴──────────────────────────────────────────┘
```

- Container: `flex flex-col lg:flex-row items-start max-w-6xl mx-auto gap-8 lg:gap-0`
- Left: `flex: 0 0 45%`
- Right: `flex: 0 0 55%`
- Vertical divider between them (desktop only): a `w-px` div with `background: linear-gradient(to bottom, transparent, rgba(200,164,93,0.4), transparent)`
- Horizontal divider on mobile: `h-px` with `background: linear-gradient(to right, transparent, rgba(200,164,93,0.4), transparent)`

---

## Component 1: FocusRail (3D Carousel)

This is the left column. It's a 3D perspective carousel that auto-plays, responds to drag/swipe, and uses spring physics.

### Props

```typescript
interface FocusRailItem {
  id: string | number;
  title: string;
  description?: string;
  imageSrc: string;   // path to card image
  href?: string;
  meta?: string;      // category label above title
}

interface FocusRailProps {
  items: FocusRailItem[];
  initialIndex?: number;    // default: 0
  loop?: boolean;           // default: true
  autoPlay?: boolean;       // default: false
  interval?: number;        // autoplay interval ms, default: 4000
  className?: string;
  transparentBg?: boolean;  // removes dark card background when true
}
```

### Carousel Data (5 items)

```typescript
const carouselItems = [
  {
    id: 1,
    title: "Your Income Growth",
    description: "Know your peak earning periods based on planetary transits.",
    meta: "Financial Insight",
    imageSrc: "/path/to/your-income-growth.png",
  },
  {
    id: 2,
    title: "Luxury Item Timings",
    description: "Discover auspicious windows for gold, property, and stocks.",
    meta: "Investment Timing",
    imageSrc: "/path/to/luxury-item-timings.png",
  },
  {
    id: 3,
    title: "Dasha Risk Meter",
    description: "Your decade-wise wealth accumulation roadmap.",
    meta: "Long-term Planning",
    imageSrc: "/path/to/dasha-risk-meter.png",
  },
  {
    id: 4,
    title: "Risk & Protection",
    description: "Identify financial vulnerabilities and protection periods.",
    meta: "Risk Analysis",
    imageSrc: "/path/to/risk-card.png",
  },
  {
    id: 5,
    title: "Surprise Wealth Gains",
    description: "Find unexpected wealth windows aligned to your chart.",
    meta: "Wealth Timing",
    imageSrc: "/path/to/surprise-wealth-gains.png",
  },
];
```

### Carousel Behavior

- **3D perspective**: Container has `perspective: 1200px`
- **5 visible cards** at indices [-2, -1, 0, 1, 2] relative to active
- **Active card (center)**: scale 1, full opacity, no blur, z-index 20
- **Adjacent cards**: offset by 320px on X axis, pushed back on Z (-180px per distance), scaled to 0.85, rotated -20deg × offset on Y, blurred (6px per distance), brightness reduced to 0.5
- **Spring animation**: stiffness: 300, damping: 30, mass: 1
- **Auto-play**: advances every 3000ms, pauses on hover
- **Interaction**: drag/swipe (framer-motion drag="x"), mouse wheel, keyboard arrows, click on adjacent cards to navigate
- **Navigation controls** below the rail: pill-shaped container with prev/next buttons + "X / N" counter
- **Info display** below the rail: shows activeItem.meta (emerald-400 text), title (white, text-3xl/4xl bold), description (neutral-400)

### Carousel Card Styling

Each card:
- Size: `w-[260px] md:w-[300px]`, aspect ratio 3:4
- Rounded: `rounded-2xl`
- Border: `border-t border-white/20`
- Shadow: `shadow-2xl`
- Content: full-bleed image (`object-cover rounded-2xl`) or placeholder
- Lighting overlays: `bg-gradient-to-b from-white/10 to-transparent` + `bg-black/10 mix-blend-multiply`

### Usage in this section

```jsx
<FocusRail
  items={carouselItems}
  autoPlay={true}
  loop={true}
  interval={3000}
  className="h-full bg-transparent"
  transparentBg={true}
/>
```

Container: `height: 420px`, centered with flexbox.

---

## Component 2: Locked Preview Cards (Right Column — Left Half)

The right column has a `grid grid-cols-1 md:grid-cols-2 gap-6 w-full` layout. Only the **left cell** has content (the locked cards). The **right cell is intentionally empty** (no form, just empty space).

### Sub-header

Above the grid:
```
"✨ Get 2 Free Insights"
- Font: Inter, sans-serif
- Size: text-lg md:text-xl, font-bold
- Color: #C8A45D
- Centered
```

### The Two Locked Cards (stacked vertically, gap-3)

Both cards share this structure:

```
┌─────────────────────────────────────────┐
│ [Header — always visible]               │
├─────────────────────────────────────────┤
│                                         │
│   [Body content — blurred, filter:      │
│    blur(3px), pointerEvents: none]      │
│                                         │
│         🔒 Lock Overlay                 │
│         "Locked" text                   │
│                                         │
└─────────────────────────────────────────┘
```

**Card container style:**
```css
background: rgba(255, 255, 255, 0.95);
border: 1px solid rgba(184, 134, 11, 0.18);
border-radius: 16px; /* rounded-2xl */
overflow: hidden;
display: flex;
flex-direction: column;
```

**Lock overlay:**
- Centered absolutely over the body area
- Circle: w-10 h-10, rounded-full, background: rgba(184,134,11,0.10), border: 1px solid rgba(184,134,11,0.25)
- Lock icon: w-4 h-4, color: #B8860B (Lucide `Lock`)
- Label: "Locked", text-[9px], font-semibold, uppercase, tracking-[0.14em], color: rgba(184,134,11,0.7)

---

#### Card A: Earnings Strength

**Header (px-4 pt-3 pb-1.5):**
- Title: "Earnings Strength"
  - Font: Playfair Display, serif
  - text-sm, font-bold
  - Background-clip text gradient: `linear-gradient(135deg, #8B6914, #D4A012)`
- Subtitle: "12 Month Projection"
  - text-[10px], color: #8B7355

**Body (blurred):**
- An SVG line chart (viewBox: 0 0 280 100)
- 8 data points forming an upward-trending line with a dip
- Stroke: gradient from #8B6914 to #D4A012, strokeWidth: 2.5
- Fill beneath the line: gradient from rgba(184,134,11,0.15) to transparent
- Highlight dot on peak: circle r=4, fill #D4A012
- Points: `[{x:20,y:75}, {x:55,y:60}, {x:90,y:45}, {x:130,y:35}, {x:165,y:50}, {x:200,y:30}, {x:235,y:42}, {x:260,y:55}]`

---

#### Card B: Best Time to Buy Assets

**Header (px-4 pt-3 pb-1.5):**
- Title: "Best Time to Buy Assets"
  - text-[11px], font-semibold, uppercase, tracking-[0.12em], color: #8B7355

**Body (blurred, flex flex-col gap-2.5):**
Three rows, each with:
- Icon container: w-7 h-7, rounded-lg, background: rgba(184,134,11,0.06), border: 1px solid rgba(184,134,11,0.12)
- Icon: Lucide icon (Building2, CircleDollarSign, Car), w-3.5 h-3.5, color: #8B7355
- Label: text-sm, font-medium, color: #2C1810
- Status: text-xs, font-bold, color varies
- Score: text-[10px], color: #8B7355

| Asset | Icon | Status | Status Color | Score |
|-------|------|--------|--------------|-------|
| Property | Building2 | Auspicious | #16a34a | 72 |
| Gold | CircleDollarSign | Delay | #B8860B | 41 |
| Vehicle | Car | Auspicious | #16a34a | 65 |

---

## Right Column — Right Half (Empty Space)

**Important:** The original design has a birth details form here. In your implementation, leave this space **empty**. The grid cell exists but has no content. This maintains the visual balance — the locked cards sit on the left half of the right column, and the right half is just negative space.

If you want, you can optionally add a subtle decorative element here (a faint radial gradient glow or a few floating dots), but no functional content.

---

## Responsive Behavior

| Breakpoint | Layout |
|-----------|--------|
| Mobile (<1024px) | Single column, stacked: Left carousel on top, divider, right section below |
| Desktop (lg: ≥1024px) | Side by side with vertical gold divider |
| Within right section on mobile | Single column (cards stack, no empty space) |
| Within right section on desktop | 2-column grid (cards left, empty space right) |

---

## Animation Notes

- **FocusRail carousel**: Uses framer-motion spring animations for all transitions. Cards smoothly slide, scale, rotate, and blur based on their distance from center.
- **Autoplay**: 3-second interval, pauses on mouse hover.
- **Drag**: framer-motion drag="x" with elastic constraints and swipe power detection.
- **Section entrance**: Can use `animate-fade-up` (a simple translateY + opacity keyframe) on the section content.

---

## Complete Implementation Checklist

1. [ ] Install dependencies: `framer-motion`, `lucide-react`
2. [ ] Set up TailwindCSS with custom fonts (JainiPurva/Playfair Display + Inter)
3. [ ] Create the `FocusRail` component (3D carousel with spring physics)
4. [ ] Create the `LockedCard` base component (header + blurred body + lock overlay)
5. [ ] Create `EarningsCard` with SVG line chart
6. [ ] Create `BuyTimeCard` with asset list
7. [ ] Create the section header with social proof row
8. [ ] Compose the two-column layout with vertical divider
9. [ ] Place carousel in left column (45%)
10. [ ] Place locked cards in right column left-half, leave right-half empty
11. [ ] Add responsive breakpoints (stack on mobile)
12. [ ] Add 5 placeholder images for the carousel (or use actual financial insight card images)
13. [ ] Wire up the `onUnlock` callback prop for future CTA integration

---

## Minimal File Structure

```
src/
├── components/
│   ├── GlimpseFinancialKundali.tsx    // Main section component
│   ├── FocusRail.tsx                  // 3D carousel
│   └── LockedCards.tsx                // EarningsCard + BuyTimeCard
├── assets/
│   └── insights-images/
│       ├── your-income-growth.png
│       ├── luxury-item-timings.png
│       ├── dasha-risk-meter.png
│       ├── risk-card.png
│       └── surprise-wealth-gains.png
└── ...
```

---

## Quick-Start Pseudocode (Main Component)

```tsx
export const GlimpseFinancialKundali = ({ onUnlock }: { onUnlock?: () => void }) => {
  return (
    <section style={{ background: "radial-gradient(circle at 50% 30%, #0F2A2E 0%, #081418 100%)" }}
             className="relative py-14 md:py-20 overflow-hidden">
      <div className="container">
        {/* Header */}
        <div className="mb-10 md:mb-14 text-center">
          <h2>A glimpse of your <span style={{ color: "#C8A45D" }}>Financial Kundali</span></h2>
          <SocialProofRow />
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row items-start max-w-6xl mx-auto gap-8 lg:gap-0">
          {/* Left — Carousel */}
          <div style={{ flex: "0 0 45%" }}>
            <h3>🔓 Unlock All Insights</h3>
            <FocusRail items={carouselItems} autoPlay loop interval={3000} transparentBg />
          </div>

          {/* Vertical Divider */}
          <VerticalDivider />

          {/* Right — Locked Cards + Empty Space */}
          <div style={{ flex: "0 0 55%" }}>
            <h3 style={{ color: "#C8A45D" }}>✨ Get 2 Free Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div className="flex flex-col gap-3">
                <EarningsCard />
                <BuyTimeCard />
              </div>
              {/* Right cell — intentionally empty (no form) */}
              <div />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
```

---

## Notes for the LLM Implementing This

- The FocusRail is the most complex part. Prioritize getting the spring animation values right (stiffness: 300, damping: 30) and the 3D transforms (perspective: 1200, rotateY, translateZ).
- The locked cards are purely decorative — the blur and lock overlay prevent users from reading the content. The data is hardcoded/dummy.
- The section is self-contained with no external API calls.
- All colors are inline styles (not Tailwind classes) for precise control of custom values.
- The empty right-half where the form used to be should just be an empty `<div />` in the grid. This gives the locked cards breathing room and maintains visual balance.

