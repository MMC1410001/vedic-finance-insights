# Footer — 4-Column Gold Gradient Footer

A full-width footer with gold gradient background, 4-column grid layout, brand info, legal links, company links, and social/contact info.

---

## Preview Behavior

- Full-width gold gradient background
- Decorative white gradient border line at top
- 4-column responsive grid (1 col mobile → 2 col tablet → 4 col desktop)
- Brand column with logo + description
- Legal links column
- Company links column
- Social/Contact column (Instagram + Phone)
- Bottom bar with copyright + Sanskrit quote

---

## Dependencies

```
lucide-react (Phone, Instagram)
react-router-dom (Link)
Logo image asset (vedicfinance-logo.png)
```

---

## Full Component Code

```tsx
import { Phone, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.png";

export const Footer = () => (
  <footer className="py-12 pb-6"
    style={{
      borderTop: "none",
      background: "linear-gradient(135deg, #8B6914 0%, #D4A012 50%, #8B6914 100%)",
    }}>
    {/* Top golden border */}
    <div className="h-[2px] mb-10 mx-4"
      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), rgba(255,255,255,0.6), rgba(255,255,255,0.4), transparent)" }} />

    <div className="container max-w-6xl mx-auto px-4">
      {/* 4-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

        {/* Brand / About */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <img src={vedicfinanceLogo} alt="VedicFinance"
              className="h-7 w-7"
              style={{ filter: "brightness(10) drop-shadow(0 0 4px rgba(255,255,255,0.3))" }} />
            <span className="text-base font-bold"
              style={{ color: "#fff", fontFamily: "'Playfair Display', serif" }}>
              VedicFinance
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
            VedicFinance is a Vedic astrology-based financial awareness platform by{" "}
            <strong style={{ color: "#fff" }}>[YOUR COMPANY]</strong>.
            We decode your birth chart to reveal your money personality, wealth cycles,
            and year-ahead financial forecast — written in the stars.
          </p>
        </div>

        {/* Legal Links */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#fff" }}>Legal</p>
          <Link to="/terms" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>Terms &amp; Conditions</Link>
          <Link to="/privacy" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>Privacy Policy</Link>
          <Link to="/disclaimer" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>Disclaimer</Link>
          <Link to="/refund-policy" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>Refund &amp; Cancellation Policy</Link>
        </div>

        {/* Quick Links */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#fff" }}>Company</p>
          <Link to="/services" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>Services</Link>
          <Link to="/home#how" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>How It Works</Link>
          <Link to="/home#faq" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>FAQ</Link>
          <Link to="/ai-chat" className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>AI Astrologer</Link>
        </div>

        {/* Contact / Social */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#fff" }}>Find Us On</p>
          <a href="https://www.instagram.com/vedicfinance.ai"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
              <Instagram className="w-3.5 h-3.5 text-white" />
            </div>
            @vedicfinance.ai
          </a>
          <a href="tel:+917977425013"
            className="flex items-center gap-2.5 text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.8)" }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <Phone className="w-3.5 h-3.5" style={{ color: "#fff" }} />
            </div>
            +91 79774 25013
          </a>
        </div>
      </div>

      {/* Divider + bottom */}
      <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
          © 2026 [YOUR COMPANY]. All rights reserved.
        </p>
        <p className="text-xs font-medium"
          style={{ color: "#fff", fontFamily: "serif", fontStyle: "italic" }}>
          सर्वे भवन्तु सुखिनः — May all be prosperous and happy ✦
        </p>
      </div>
    </div>
  </footer>
);
```

---

## Key Styling

| Element | Style |
|---------|-------|
| Background | Gold gradient `#8B6914 → #D4A012 → #8B6914` |
| Top border line | White gradient `rgba(255,255,255,0.4-0.6)` |
| Link color | `rgba(255,255,255,0.8)` → white on hover |
| Column header | `#fff`, 11px, uppercase, tracking-widest |
| Brand name font | Playfair Display |
| Description text | `rgba(255,255,255,0.85)` |
| Instagram icon bg | Instagram gradient (orange → pink → purple) |
| Phone icon bg | Semi-transparent white |
| Bottom divider | `rgba(255,255,255,0.2)` |
| Copyright | `rgba(255,255,255,0.7)` |

---

## Customization

1. Replace logo image and brand name
2. Update legal/company links to your routes
3. Replace social media handles and phone number
4. Change copyright text and Sanskrit quote to your tagline
5. The gold gradient background can be changed to match your brand
6. Grid can be adjusted (remove columns or add more)
