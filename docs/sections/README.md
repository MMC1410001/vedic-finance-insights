# Landing Page Sections — Reusable Component Docs

This folder documents the key landing page sections from the VedicFinance project for reuse in other projects.

---

## Sections Documented

| # | Section | File | Description |
|---|---------|------|-------------|
| 1 | **AstroTicker** | [01-AstroTicker.md](./01-AstroTicker.md) | Fixed top marquee strip with live data scrolling horizontally |
| 2 | **AstroSpecialties** | [02-AstroSpecialties.md](./02-AstroSpecialties.md) | Two-row marquee: specialties (left) + languages (right) |
| 3 | **Hero** | [03-Hero.md](./03-Hero.md) | 3-column hero with animated headline, birth form, locked cards, video reel |
| 4 | **FAQ** | [04-FAQ.md](./04-FAQ.md) | Animated accordion with gold styling and celestial background |
| 5 | **Testimonials** | [05-Testimonials.md](./05-Testimonials.md) | Two-row auto-scrolling testimonial cards |
| 6 | **Footer** | [06-Footer.md](./06-Footer.md) | 4-column gold gradient footer with links and social |
| 7 | **Footer Links** | [07-Footer-Links.md](./07-Footer-Links.md) | Route map, page templates, and anchor link behavior |
| 8 | **Splash Screen** | [08-SplashScreen.md](./08-SplashScreen.md) | Animated intro splash with particle background and phase animation |

---

## Tech Stack

All sections use:

- **React** (TypeScript)
- **Tailwind CSS** (utility classes)
- **Framer Motion** (animations and marquee scrolling)
- **Lucide React** (icons)

Some sections additionally use:
- **Recharts** (Hero insight charts)
- **react-hook-form + zod** (Hero birth form validation)
- **react-router-dom** (Footer links)

---

## Page Composition Order

```tsx
<AstroTicker />        {/* Fixed top bar */}
<Navbar />             {/* Not documented — standard nav */}
<main>
  <Hero />
  <AstroSpecialties /> {/* Language + specialties marquee */}
  <HowItWorks />       {/* Not documented */}
  <Testimonials />
  <WhyVedicFinance />      {/* Not documented */}
  <FAQ />
</main>
<Footer />
```

---

## Design System Quick Reference

| Token | Value | Usage |
|-------|-------|-------|
| Primary Gold | `#B8860B` | CTAs, accents, stars |
| Dark Gold | `#8B6914` | Headers, gradients |
| Light Gold | `#D4A012` | Gradient endpoint |
| Dark Brown | `#2C1810` | Heading text |
| Medium Brown | `#503214` | Body text |
| Light Brown | `#7A5A30` | Secondary text |
| Accent Gold Label | `#A67C2C` | Section labels |
| Background | `#FFFDF7` → `#FFF9EC` | Page gradient |
| Card Background | `rgba(255,255,255,0.95)` | Glass cards |
| Card Border | `rgba(184,134,11,0.15-0.2)` | Subtle gold border |
| Heading Font | `'Playfair Display', serif` | All headings |
| Body Font | `Inter, sans-serif` | All body text |

---

## Infinite Scroll Pattern (Used in Ticker, Specialties, Testimonials)

The same technique is used across all marquee components:

```tsx
// 1. Triplicate the data
const items = [...data, ...data, ...data];

// 2. Animate x from 0% to -33.33% (scrolls left)
<motion.div
  animate={{ x: ["0%", "-33.33%"] }}
  transition={{ duration: 40, ease: "linear", repeat: Infinity }}
>
  {items.map(...)}
</motion.div>

// For reverse direction (scrolls right):
animate={{ x: ["-33.33%", "0%"] }}
```

This creates a seamless loop because 33.33% of tripled content = one full set of original data.
