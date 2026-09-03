# Footer Links — Route Map & Page Templates

This doc captures the actual routes and page content that the footer links point to, so you can replicate them in another project.

---

## Footer Link Map

| Link Text | Route | Page Component | Status |
|-----------|-------|----------------|--------|
| Terms & Conditions | `/terms` | `src/pages/Terms.tsx` | ✅ Working |
| Privacy Policy | `/privacy` | `src/pages/Privacy.tsx` | ✅ Working |
| Disclaimer | `/disclaimer` | `src/pages/Disclaimer.tsx` | ✅ Working |
| Refund & Cancellation Policy | `/refund-policy` | `src/pages/RefundPolicy.tsx` | ✅ Working |
| Services | `/services` | `src/pages/Services.tsx` | ✅ Working |
| How It Works | `/home#how` | Scrolls to `#how` section on Landing | ✅ Anchor link |
| FAQ | `/home#faq` | Scrolls to `#faq` section on Landing | ✅ Anchor link |
| AI Astrologer | `/ai-chat` | `src/pages/AIChatPage.tsx` | ✅ Working |

---

## Router Setup (App.tsx)

All footer link pages are lazy-loaded:

```tsx
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const Services = lazy(() => import("./pages/Services"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));

// In Routes:
<Route path="/terms" element={<Terms />} />
<Route path="/privacy" element={<Privacy />} />
<Route path="/disclaimer" element={<Disclaimer />} />
<Route path="/services" element={<Services />} />
<Route path="/refund-policy" element={<RefundPolicy />} />
```

---

## Page Template Pattern

All legal/info pages follow the same template structure:

```tsx
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import vedicKundaliSquare from "@/assets/vedic-kundali-square.svg";

const PageName = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen"
      style={{ background: "linear-gradient(165deg, #FFFDF7 0%, #FFF9EC 50%, #FFFBF2 100%)" }}
    >
      {/* Repeating Vedic pattern background */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${vedicKundaliSquare})`,
          backgroundRepeat: "repeat",
          backgroundSize: "120px 120px",
          opacity: 0.25,
        }}
      />

      <div className="relative z-10 container max-w-3xl mx-auto px-4 py-12">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-8 text-sm transition-opacity hover:opacity-70"
          style={{ color: "#8B6914" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Title */}
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "#2C1810", fontFamily: "'Playfair Display', serif" }}
        >
          Page Title
        </h1>
        <p className="text-sm mb-10" style={{ color: "#7A5A30" }}>
          Last updated: June 15, 2026
        </p>

        {/* Content sections */}
        <div className="space-y-8 text-sm leading-relaxed" style={{ color: "#503214" }}>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "#8B6914" }}>
              1. Section Heading
            </h2>
            <p>Section content goes here...</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "#8B6914" }}>
              2. Another Section
            </h2>
            <p>More content...</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PageName;
```

---

## Key Styling for Legal Pages

| Element | Style |
|---------|-------|
| Background | Warm cream gradient `#FFFDF7 → #FFF9EC → #FFFBF2` |
| Pattern overlay | Vedic SVG repeating at 120px, 25% opacity |
| Container | `max-w-3xl`, centered, `px-4 py-12` |
| Back button | Gold `#8B6914`, ArrowLeft icon |
| Title font | Playfair Display, `#2C1810` |
| Date text | `#7A5A30`, smaller size |
| Section heading | `#8B6914` gold, `text-lg font-semibold` |
| Body text | `#503214`, `text-sm`, `leading-relaxed` |
| Bold/emphasis | `#2C1810` dark brown |
| Lists | `list-disc pl-5 space-y-2` |

---

## Social Links in Footer

| Platform | URL | Icon |
|----------|-----|------|
| Instagram | `https://www.instagram.com/vedicfinance.ai` | Instagram icon with gradient bg |
| Phone | `tel:+917977425013` (display: +91 79774 25013) | Phone icon with transparent bg |

---

## Anchor Link Behavior

For "How It Works" (`/home#how`) and "FAQ" (`/home#faq`), these navigate to the landing page and auto-scroll to the section with matching `id`:

```tsx
// In Landing page, sections have these ids:
<section id="how" ...>  {/* HowItWorks component */}
<section id="faq" ...>  {/* FAQ component */}
```

If you're already on the landing page, you may want to add smooth scroll handling:

```tsx
// In Landing or a useEffect:
useEffect(() => {
  const hash = window.location.hash;
  if (hash) {
    const el = document.querySelector(hash);
    el?.scrollIntoView({ behavior: "smooth" });
  }
}, []);
```
