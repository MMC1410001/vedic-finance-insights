---
name: vedicfinance-ui-theming
description: Use for any UI work — building or editing components, styling, Tailwind classes, colors, fonts, animations, charts, shaders, landing sections, or the /kundali page themes. Triggers on "component", "styling", "CSS", "Tailwind", "theme", "dark mode", "light mode", "vedic theme", "cosmic theme", "animation", "Framer Motion", "chart", "Recharts", "shader", "landing page", "hero", "card", "layout", "responsive".
---

# VedicFinance — UI & theming

Design authority is `.kiro/steering/design-guidelines.md` and `.kiro/steering/theme-rules.md`. They are binding project rules, not suggestions. `docs/sections/` documents individual landing sections.

## Hard rule: the Cosmic (dark) theme is frozen

`/kundali` has two themes — **Cosmic** (dark, original) and **Vedic** (white/gold). From `theme-rules.md`:

1. **Never change styles, colors, or behavior of the Cosmic theme.** It must stay exactly as it was before the theme system existed.
2. All Vedic/light overrides scope under the `.vedic-theme` class in `src/index.css` (the block starts around line 673 of ~1711 on `af-prod`). Nothing outside that selector.
3. `.vedic-theme` is applied to the page wrapper only when `theme === "vedic"` — it is never present in dark mode.
4. Cards in `src/components/financial-kundali/` use **hardcoded inline styles** for the dark theme. Do not modify them. Vedic overrides them with `!important` from the `.vedic-theme` block.
5. In `src/lib/kundali-theme-context.tsx`, edits to `vedicColors` must never touch `cosmicColors`. The two objects share a `ThemeColors` shape (`pageBg`, `sidebarBg`, `accent`, `cardBg`, …).
6. After any Vedic change, verify no rule leaked outside `.vedic-theme`.

Related files: theme context `src/lib/kundali-theme-context.tsx`, switcher `src/components/kundali/KundaliThemeSwitcher.tsx`, sidebar `src/components/kundali/KundaliSidebar.tsx`.

The `.vedic-theme` block is dense with hard-won exceptions — preserved gradient text, semantic Recharts fills, "dark islands", preserved Tailwind color utilities. Read the neighboring comments before adding a rule; a broad new selector will flatten a semantic color someone deliberately protected.

## Design tokens

From `design-guidelines.md`:

| Role | Value |
|---|---|
| Deep purple / royal violet / soft magenta | `#2A0E4A` · `#4B1D73` · `#A14EBF` |
| Gold / soft gold | `#F2C572` · `#FFDFA3` |
| Cosmic pink / lavender | `#E06BAA` · `#C8A2FF` |
| Emerald teal / deep teal / muted green | `#2FBF9F` · `#1C8C7A` · `#4FD1C5` |
| Headings | Playfair Display (alt: Cormorant Garamond), `#F5E9FF`, letter-spacing −0.5px |
| Body | Inter (alt: DM Sans), `#D6C6F5` / `#A89BC8`, line-height 1.5–1.7 |
| Cards | `rgba(255,255,255,0.04)` bg, `rgba(255,255,255,0.08)` border, `blur(12px)`, radius 16–20px |
| CTA | `linear-gradient(135deg, #F2C572, #FFDFA3)`, text `#2A0E4A`, shadow `0 10px 30px rgba(242,197,114,0.4)` |
| Motion | card hover `translateY(-4px)`, 0.3s ease, slow floats, gold shimmer |

Fonts actually loaded in `src/index.css`: Cinzel Decorative, Plus Jakarta Sans, Playfair Display, Inter, plus a local `Magical Horison` face.

## Use the existing Tailwind extensions

Defined in `tailwind.config.ts` — reach for these before writing arbitrary values:

- Colors: `gold` (`--gold: 43 92% 58%`), and the signal ramp `signal-positive`, `signal-neutral`, `signal-caution`, each with a `-soft` variant. The signal colors map onto the engines' `"favorable" | "neutral" | "challenging"` vocabulary — use them for anything conveying a verdict.
- Fonts: `font-sans` (Inter) and `font-display` (Space Grotesk).
- Animations: `ticker-scroll`, `float-slow`, `twinkle`, `pulse-glow`, `fade-up`, plus the shadcn accordion pair.
- Utility classes in `src/index.css` under `@layer utilities` — e.g. `ring-gold-glow`.

## Where components go

| Directory | Contents |
|---|---|
| `src/components/ui/` (63) | Generated shadcn/Radix primitives — regenerate, don't hand-edit. Exceptions: `liquid-metal-button.tsx` / `liquid-metal-input.tsx` use `@paper-design/shaders`, and the Three.js shader backgrounds — these are hand-written. |
| `src/components/landing/` (16) | Marketing page: `Hero`, `AstroTicker`, `Pricing`, `FAQ`, `Testimonials`, `Starfield`, … documented in `docs/sections/`. |
| `src/components/financial-kundali/` (17) | Premium `/kundali` cards. **Inline dark styles are frozen.** |
| `src/components/vedicfinance/` (19) | Dashboard/report widgets: `ScoreGrid`, `InsightRadar`, `NatalChartVisual`, `BirthDetailsForm`, `LocationSearch`, … |
| `src/components/kundali/`, `payment/`, `intro/`, `legacy-kundali/` | Feature-scoped. |

Put new feature components in the matching feature directory, not in `ui/`.

## Routing & performance

`src/App.tsx` loads only `Index` and `Landing` eagerly — everything else is `React.lazy` inside a `<Suspense fallback={null}>`. **Add new routes lazily.** The same applies to Three.js / shader backgrounds: lazy-load them so WebGL never blocks first paint.

Charts are Recharts. Motion is Framer Motion. Icons are lucide-react plus react-icons.

Branch note: the root-route opening animation differs by branch — `af-prod` uses `src/pages/SplashScreen.tsx`, while `intro-trial-preet` replaces it with `src/components/intro/` (`VedicFinanceIntro.tsx`, `IntroWheel.tsx`, `intro-motion.ts`). Check which exists before editing.

## Layout conventions

Asymmetric balance — text left, visual right — with generous negative space. Soft gold/pink/purple glows, subtle star particles, semi-3D dreamy style, never photorealistic. Shadows: `0 20px 60px rgba(0,0,0,0.4)` primary, `0 0 40px rgba(242,197,114,0.3)` glow.
