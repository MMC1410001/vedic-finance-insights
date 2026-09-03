# Hero Section — 3-Column Interactive Layout

A complex hero section with animated headline rotation, a birth form (middle column), locked preview cards (left), a video reel card (right), and a state machine that transitions from locked → unlocked insights after form submission.

---

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Animated Rotating Headline                         │
├──────────────┬───────────────────────┬──────┬───────────────────────┤
│  Left Column │    Middle Column      │ gap  │   Right Column        │
│  (2 Cards)   │    (Form/Preview)     │      │   (Video Reel)        │
│              │                       │      │                       │
│  - Earnings  │  - Birth Form (locked)│      │   Phone-frame video   │
│  - Buy Time  │  - Kundali Preview    │      │   with play button    │
│              │    (unlocked)         │      │                       │
├──────────────┴───────────────────────┴──────┴───────────────────────┤
│                     Social Proof Row                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## State Machine

```
locked → (form submit) → paid (shows unlocked insight cards)
                       → authenticated (shows ₹99 CTA preview)
```

---

## Dependencies

```
framer-motion
lucide-react (ShieldCheck, TrendingUp, Briefcase)
recharts (AreaChart, Area, XAxis, YAxis, ResponsiveContainer)
react-hook-form + zod (for HeroBirthForm)
```

---

## Sub-Components

The Hero is composed of these sub-components:

### 1. HeroBirthForm
- Compact birth details form with "New Here?" / "Already a User?" tabs
- Fields: Full Name, Birth Date (DD/MM/YYYY), Birth Time (HH:MM AM/PM), Birth Place (with location search)
- On submit: calls `onFormSubmit` callback
- CTA button: Gold gradient with Google icon

### 2. HeroLockedCards
- Two blurred/locked preview cards showing:
  - "Earnings Strength" — SVG line chart
  - "Best Time to Buy Assets" — Property/Gold/Vehicle list
- Lock icon overlay with blur effect
- Layout variants: `vertical`, `horizontal`, `earnings-only`, `buytime-only`

### 3. HeroKundaliPreview
- Zodiac icon + sign name
- User's name + archetype
- Description text
- ₹99 pricing with 90% OFF badge
- "Unlock more insights" CTA button

### 4. HeroReelCard
- Phone-frame style video player (9:16 aspect ratio)
- Play/Pause toggle on click
- VedicFinance branding badge (bottom-left)
- View count badge (top-right: "2.4K+ users")

### 5. HeroUnlockedInsightCard
- Shows after form submission
- Zodiac icon, sign, name, archetype
- Pricing block (₹99 / ~~₹999~~ / 90% OFF)
- "Unlock more insights" CTA

### 6. SurpriseWealthCard (inline)
- Area chart using Recharts
- Shows "Surprise Wealth Gains" by age with probability %
- Labels at peak points

### 7. BusinessTimingCard (inline)
- Shows "Best Time to Start/Grow Business"
- Large date display
- Transit + period info
- Description paragraph

---

## Animated Headline

Titles rotate every 2 seconds with spring animation:

```tsx
const titles = [
  "When to buy gold?",
  "Financial independent age?",
  "Auspicious business dates",
  "Your best financial timing",
  "Is your money at risk?"
];
```

Uses Framer Motion with `type: "spring", stiffness: 50` for vertical slide transitions.

---

## Key Styling

| Element | Style |
|---------|-------|
| Background | Warm cream `#FFFDF7` to `#FFF9EC` gradient |
| Headline font | Playfair Display, serif |
| Headline color | `#2C1810` (dark brown) |
| Rotating text | Gold gradient `#8B6914 → #D4A012` with text-clip |
| Cards | White `rgba(255,255,255,0.95)`, gold border `rgba(184,134,11,0.18)` |
| CTA buttons | Gold gradient `#B8860B → #D4A012`, white text |
| Decorative blurs | Subtle gold radial gradients in background |

---

## Grid Layout (Desktop)

```css
grid-template-columns: 0.34fr 0.52fr 0.18fr 0.48fr;
```

- Column 1: Left cards (34%)
- Column 2: Form/Preview (52%)
- Column 3: Empty spacer (18%)
- Column 4: Video reel (48%)

---

## Social Proof Row

Below the 3 columns:
- Avatar stack (4 user photos)
- "2,400+ Kundalis generated"
- Divider
- Shield icon + "Verified by 100+ astrologers"

---

## Full Hero Component Code

Due to length, see the source file: `src/components/landing/Hero.tsx`

The Hero imports and uses these files:
- `src/components/landing/HeroBirthForm.tsx`
- `src/components/landing/HeroLockedCards.tsx`
- `src/components/landing/HeroReelCard.tsx`
- `src/components/landing/HeroKundaliPreview.tsx`
- `src/components/landing/HeroUnlockedInsightCard.tsx`
- `src/lib/hero-insights-engine.ts`

---

## Simplification for Reuse

For a simpler hero without the birth form state machine, you can:

1. Keep just the animated headline + one CTA button
2. Remove the 3-column grid and use a centered layout
3. Keep the social proof row as-is
4. Replace birth form with a simple email capture or CTA

The animated headline pattern alone is very reusable:

```tsx
const [titleNumber, setTitleNumber] = useState(0);
const titles = ["Your title 1", "Your title 2", "Your title 3"];

useEffect(() => {
  const t = setTimeout(() => setTitleNumber(n => (n === titles.length - 1 ? 0 : n + 1)), 2000);
  return () => clearTimeout(t);
}, [titleNumber, titles]);
```
