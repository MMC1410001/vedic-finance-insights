# Testimonials Section — Complete Implementation Guide

## Overview

This document provides the exact code to replicate the **"Wisdom From Our Institutional Partners"** testimonials section in an independent React + TypeScript project. The section has:

1. **Left Side** — A circular image carousel with 3D perspective rotation, gold ring decorations, animated quote text, and navigation arrows.
2. **Right Side (Desktop)** — Two vertically auto-scrolling columns of review cards with fade edges.
3. **Mobile Fallback** — Two horizontally auto-scrolling rows of review cards.

---

## Tech Stack & Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^0.462.0",
    "react-icons": "^5.6.0",
    "tailwindcss": "^3.x"
  }
}
```

Install:
```bash
npm install framer-motion lucide-react react-icons
```

---

## Font Setup

Download `JainiPurva-Regular.ttf` from Google Fonts and place it in your `public/` folder.

Add this to your global CSS (e.g., `src/index.css`):

```css
@font-face {
  font-family: 'JainiPurva';
  src: url('/JainiPurva-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
```

---

## File Structure

```
src/
├── assets/
│   └── testimonial-images/
│       ├── abhishek-shukla.png
│       ├── amitav.png
│       ├── harsha-gupta.png
│       └── shoba-patil.png
├── components/
│   ├── ui/
│   │   └── CircularTestimonials.tsx    ← Reusable carousel component
│   └── landing/
│       └── Testimonials.tsx            ← Main section component
public/
└── JainiPurva-Regular.ttf
```

---

## Color Palette Used

| Purpose | Color |
|---------|-------|
| Section Background | `#F7F2EA` |
| Card Border | `#E9DBC5` |
| Heading Text | `#3E000E` |
| Body Text | `#261816` |
| Sub-text / Location | `#544243` |
| Accent Label (gold) | `#C8A45D` |
| Star Rating | `#F2C572` |
| Gold Ring Gradient | `#F2C572 → #FFDFA3 → #C8A45D → #F2C572` |
| Arrow Default BG | `rgba(233,219,197,0.3)` |
| Arrow Hover BG | `#3E000E` |
| Arrow Foreground | `#3E000E` |

---

## Step 1: Create `src/components/ui/CircularTestimonials.tsx`

This is the reusable carousel component with 3D image rotation, word-by-word blur animation, and navigation arrows.

```tsx
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

interface Testimonial {
  quote: string;
  name: string;
  designation: string;
  src: string;
}

interface Colors {
  name?: string;
  designation?: string;
  testimony?: string;
  arrowBackground?: string;
  arrowForeground?: string;
  arrowHoverBackground?: string;
}

interface FontSizes {
  name?: string;
  designation?: string;
  quote?: string;
}

interface FontFamilies {
  name?: string;
}

interface CircularTestimonialsProps {
  testimonials: Testimonial[];
  autoplay?: boolean;
  colors?: Colors;
  fontSizes?: FontSizes;
  fontFamilies?: FontFamilies;
}

function calculateGap(width: number) {
  const minWidth = 1024;
  const maxWidth = 1456;
  const minGap = 60;
  const maxGap = 86;

  if (width <= minWidth) return minGap;
  if (width >= maxWidth)
    return Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
  return (
    minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth))
  );
}

export const CircularTestimonials = ({
  testimonials,
  autoplay = true,
  colors = {},
  fontSizes = {},
  fontFamilies = {},
}: CircularTestimonialsProps) => {
  // Color & font config
  const colorName = colors.name ?? "#000";
  const colorDesignation = colors.designation ?? "#6b7280";
  const colorTestimony = colors.testimony ?? "#4b5563";
  const colorArrowBg = colors.arrowBackground ?? "#141414";
  const colorArrowFg = colors.arrowForeground ?? "#f1f1f7";
  const colorArrowHoverBg = colors.arrowHoverBackground ?? "#00a6fb";

  const fontSizeName = fontSizes.name ?? "1.5rem";
  const fontSizeDesignation = fontSizes.designation ?? "0.925rem";
  const fontSizeQuote = fontSizes.quote ?? "1.125rem";

  const fontFamilyName = fontFamilies.name ?? "inherit";

  // State
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const testimonialsLength = useMemo(
    () => testimonials.length,
    [testimonials]
  );
  const activeTestimonial = useMemo(
    () => testimonials[activeIndex],
    [activeIndex, testimonials]
  );

  // Responsive gap calculation
  useEffect(() => {
    function handleResize() {
      if (imageContainerRef.current) {
        setContainerWidth(imageContainerRef.current.offsetWidth);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Autoplay
  useEffect(() => {
    if (autoplay) {
      autoplayIntervalRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % testimonialsLength);
      }, 5000);
    }
    return () => {
      if (autoplayIntervalRef.current)
        clearInterval(autoplayIntervalRef.current);
    };
  }, [autoplay, testimonialsLength]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, testimonialsLength]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonialsLength);
    if (autoplayIntervalRef.current)
      clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  const handlePrev = useCallback(() => {
    setActiveIndex(
      (prev) => (prev - 1 + testimonialsLength) % testimonialsLength
    );
    if (autoplayIntervalRef.current)
      clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  // Compute transforms for each image (always show 3: left, center, right)
  function getImageStyle(index: number): React.CSSProperties {
    const gap = calculateGap(containerWidth);
    const maxStickUp = gap * 0.8;

    const isActive = index === activeIndex;
    const isLeft =
      (activeIndex - 1 + testimonialsLength) % testimonialsLength === index;
    const isRight = (activeIndex + 1) % testimonialsLength === index;

    if (isActive) {
      return {
        zIndex: 3,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(0px) translateY(0px) scale(1) rotateY(0deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isLeft) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isRight) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    // Hide all other images
    return {
      zIndex: 1,
      opacity: 0,
      pointerEvents: "none",
      transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
    };
  }

  // Framer Motion variants for quote
  const quoteVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="w-full max-w-[56rem] p-8">
      <div className="grid gap-20 md:grid-cols-2">
        {/* Images */}
        <div
          className="relative w-full h-96"
          style={{ perspective: "1000px" }}
          ref={imageContainerRef}
        >
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.src}
              className="absolute w-full h-full rounded-3xl"
              style={{ ...getImageStyle(index) }}
              data-index={index}
            >
              {/* Gold ring decoration */}
              <div
                className="absolute -inset-3 rounded-[2rem]"
                style={{
                  background:
                    "conic-gradient(from 0deg, #F2C572, #FFDFA3, #C8A45D, #F2C572)",
                  opacity: 0.6,
                  filter: "blur(1px)",
                }}
              />
              <img
                src={testimonial.src}
                alt={testimonial.name}
                className="relative w-full h-full object-cover rounded-3xl"
                style={{
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
                  border: "4px solid rgba(242, 197, 114, 0.4)",
                }}
              />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={quoteVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h3
                className="font-bold mb-1"
                style={{
                  color: colorName,
                  fontSize: fontSizeName,
                  fontFamily: fontFamilyName,
                }}
              >
                {activeTestimonial.name}
              </h3>
              <p
                className="mb-8"
                style={{
                  color: colorDesignation,
                  fontSize: fontSizeDesignation,
                }}
              >
                {activeTestimonial.designation}
              </p>
              <motion.p
                className="leading-7"
                style={{ color: colorTestimony, fontSize: fontSizeQuote }}
              >
                {activeTestimonial.quote.split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ filter: "blur(10px)", opacity: 0, y: 5 }}
                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      ease: "easeInOut",
                      delay: 0.025 * i,
                    }}
                    style={{ display: "inline-block" }}
                  >
                    {word}&nbsp;
                  </motion.span>
                ))}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-6 pt-12 md:pt-0">
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border-none"
              onClick={handlePrev}
              style={{
                backgroundColor: hoverPrev
                  ? colorArrowHoverBg
                  : colorArrowBg,
                transition: "background-color 0.3s",
              }}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              aria-label="Previous testimonial"
            >
              <FaArrowLeft size={28} color={colorArrowFg} />
            </button>
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border-none"
              onClick={handleNext}
              style={{
                backgroundColor: hoverNext
                  ? colorArrowHoverBg
                  : colorArrowBg,
                transition: "background-color 0.3s",
              }}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              aria-label="Next testimonial"
            >
              <FaArrowRight size={28} color={colorArrowFg} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularTestimonials;
```

---

## Step 2: Create `src/components/landing/Testimonials.tsx`

This is the main section component that combines the carousel with vertical/horizontal scrolling review strips.

```tsx
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { CircularTestimonials } from "@/components/ui/CircularTestimonials";

// Import your local testimonial images
import abhishekImg from "@/assets/testimonial-images/abhishek-shukla.png";
import amitavImg from "@/assets/testimonial-images/amitav.png";
import harshaImg from "@/assets/testimonial-images/harsha-gupta.png";
import shobhaImg from "@/assets/testimonial-images/shoba-patil.png";

// ─── CAROUSEL TESTIMONIALS (Left side — with photos) ───────────────────────
const testimonials = [
  {
    quote:
      "VedicFinance gave me a different way to look at my finances. The predictions about market trends and investment periods were surprisingly useful. I now check the insights before making major financial decisions.",
    name: "Abhishek Shukla",
    designation: "Entrepreneur & Real Estate Investor",
    src: abhishekImg,
  },
  {
    quote:
      "I was not sure about astrology before, but this website gave me helpful advice about my career. The predictions were simple and easy to understand. I am happy with the experience.",
    name: "Amitav Hira",
    designation: "Part Time Trader & Job",
    src: amitavImg,
  },
  {
    quote:
      "I was looking for guidance on managing my investments, and VedicFinance exceeded my expectations. The financial forecasts were clear, practical, and helped me stay focused on my long-term goals.",
    name: "Harsha Gupta",
    designation: "Portfolio Manager",
    src: harshaImg,
  },
  {
    quote:
      "The investment and wealth insights provided by VedicFinance have been very helpful. The reports are simple, detailed, and easy to follow. I feel more confident about my financial planning than ever before.",
    name: "Shobha Patil",
    designation: "Housewife & Trader",
    src: shobhaImg,
  },
];

// ─── REVIEW CARDS (Right side strips — with Unsplash avatars) ──────────────
const reviews = [
  {
    name: "Priya Sharma",
    location: "Mumbai, India",
    stars: 5,
    text: "VedicFinance completely changed how I approach my investments. The planetary transit insights helped me time my portfolio moves with surprising accuracy.",
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Arjun Mehta",
    location: "Delhi, India",
    stars: 5,
    text: "The Kundali-based financial report was eye-opening. It identified my risk tolerance and ideal sectors with remarkable precision.",
    img: "https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Kavitha Reddy",
    location: "Bengaluru, India",
    stars: 5,
    text: "As a business owner, timing is everything. VedicFinance's business timing tool helped me pick the perfect launch window for my new venture.",
    img: "https://images.unsplash.com/photo-1614644147798-f8c0fc9da7f6?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Rohan Kapoor",
    location: "Pune, India",
    stars: 5,
    text: "I was skeptical at first, but the sector radar predictions have been consistently on point. Unlike anything else on the market.",
    img: "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Sneha Iyer",
    location: "Chennai, India",
    stars: 5,
    text: "The monthly forecast was so accurate I started planning my SIP investments around it. My returns have genuinely improved this year.",
    img: "https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Vikram Nair",
    location: "Hyderabad, India",
    stars: 5,
    text: "Never thought I'd trust astrology for finance but VedicFinance makes so much sense. The wealth score and dasha timeline are incredibly useful.",
    img: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Ananya Bose",
    location: "Kolkata, India",
    stars: 5,
    text: "The AI astrologer chat is brilliant — I asked specific questions about my 11th house and got detailed, personalised answers instantly.",
    img: "https://images.unsplash.com/photo-1595956553066-fe24a8c33395?w=80&h=80&fit=crop&crop=face",
  },
  {
    name: "Rajesh Patel",
    location: "Ahmedabad, India",
    stars: 5,
    text: "Paid ₹99 and got a report worth thousands. The money archetype section alone made me rethink my entire approach to saving and risk.",
    img: "https://images.unsplash.com/photo-1604072366595-e75dc92d6bdc?w=80&h=80&fit=crop&crop=face",
  },
];

// Split reviews into two columns — triplicated for seamless infinite scroll
const col1Reviews = [
  ...reviews.slice(0, 4),
  ...reviews.slice(0, 4),
  ...reviews.slice(0, 4),
];
const col2Reviews = [
  ...reviews.slice(4),
  ...reviews.slice(4),
  ...reviews.slice(4),
];

// ─── STAR RATING COMPONENT ─────────────────────────────────────────────────
const Stars = ({ count }: { count: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: count }).map((_, i) => (
      <Star
        key={i}
        className="w-3 h-3 fill-current"
        style={{ color: "#F2C572" }}
      />
    ))}
  </div>
);

// ─── VERTICAL CARD (used in desktop right-side strips) ─────────────────────
const VerticalCard = ({ r }: { r: (typeof reviews)[0] }) => (
  <div
    className="shrink-0 rounded-2xl p-5 my-2"
    style={{
      background: "#F7F2EA",
      border: "1px solid #E9DBC5",
      width: "100%",
    }}
  >
    <div className="flex items-center gap-3 mb-2">
      <img
        src={r.img}
        alt={r.name}
        className="w-9 h-9 rounded-full object-cover shrink-0"
        style={{ border: "2px solid #E9DBC5" }}
      />
      <div className="min-w-0">
        <p
          className="text-sm font-semibold leading-tight truncate"
          style={{
            color: "#3E000E",
            fontFamily: "'JainiPurva', 'Playfair Display', serif",
          }}
        >
          {r.name}
        </p>
        <p
          className="text-[11px] mt-0.5 truncate"
          style={{ color: "#544243" }}
        >
          {r.location}
        </p>
      </div>
    </div>
    <Stars count={r.stars} />
    <p
      className="mt-2 text-sm leading-relaxed line-clamp-3"
      style={{ color: "#261816" }}
    >
      "{r.text}"
    </p>
  </div>
);

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────
export const Testimonials = () => {
  return (
    <section
      id="testimonials"
      className="relative overflow-hidden lg:h-screen lg:max-h-[900px] lg:min-h-[700px]"
      style={{ background: "#F7F2EA" }}
    >
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center lg:items-stretch">
        {/* ═══ LEFT SIDE — Carousel (takes ~60% on desktop) ═══ */}
        <div className="w-full lg:w-[58%] flex flex-col justify-center pt-20 md:pt-28 lg:pt-0">
          {/* Section header */}
          <div className="max-w-2xl text-center lg:text-left mb-10 lg:mb-8">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "#C8A45D", letterSpacing: "0.05em" }}
            >
              Private Circle Feedback
            </span>
            <h2
              className="text-3xl md:text-5xl font-bold mt-3"
              style={{
                color: "#3E000E",
                fontFamily: "'JainiPurva', 'Playfair Display', serif",
              }}
            >
              Wisdom From Our Institutional Partners
            </h2>
          </div>

          {/* Testimonials carousel */}
          <div className="relative flex items-center justify-center lg:justify-start">
            <div className="relative z-10 w-full" style={{ maxWidth: "1200px" }}>
              <CircularTestimonials
                testimonials={testimonials}
                autoplay={true}
                colors={{
                  name: "#3E000E",
                  designation: "#C8A45D",
                  testimony: "#261816",
                  arrowBackground: "rgba(233,219,197,0.3)",
                  arrowForeground: "#3E000E",
                  arrowHoverBackground: "#3E000E",
                }}
                fontSizes={{
                  name: "28px",
                  designation: "16px",
                  quote: "18px",
                }}
                fontFamilies={{
                  name: "'JainiPurva', 'Playfair Display', serif",
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT SIDE — Vertical scrolling strips (desktop only, ~42%) ═══ */}
        <div className="hidden lg:flex w-[42%] max-h-[70vh] items-stretch gap-3 pl-6 py-8 overflow-hidden self-center">
          {/* Column 1 — scrolls up */}
          <div className="flex-1 relative overflow-hidden rounded-2xl">
            {/* Top fade */}
            <div
              className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, #F7F2EA 0%, transparent 100%)",
              }}
            />
            {/* Bottom fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-20 z-10 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, #F7F2EA 0%, transparent 100%)",
              }}
            />
            <motion.div
              className="flex flex-col px-1"
              animate={{ y: ["0%", "-33.33%"] }}
              transition={{ duration: 35, ease: "linear", repeat: Infinity }}
            >
              {col1Reviews.map((r, i) => (
                <VerticalCard key={`c1-${i}`} r={r} />
              ))}
            </motion.div>
          </div>

          {/* Column 2 — scrolls down */}
          <div className="flex-1 relative overflow-hidden rounded-2xl">
            {/* Top fade */}
            <div
              className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, #F7F2EA 0%, transparent 100%)",
              }}
            />
            {/* Bottom fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-20 z-10 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, #F7F2EA 0%, transparent 100%)",
              }}
            />
            <motion.div
              className="flex flex-col px-1"
              animate={{ y: ["-33.33%", "0%"] }}
              transition={{ duration: 35, ease: "linear", repeat: Infinity }}
            >
              {col2Reviews.map((r, i) => (
                <VerticalCard key={`c2-${i}`} r={r} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE FALLBACK — horizontal strips below carousel ═══ */}
      <div className="lg:hidden relative pt-8 pb-12 overflow-hidden">
        {/* Row 1 — scrolls left */}
        <div className="overflow-hidden mb-4">
          <motion.div
            className="flex items-stretch"
            animate={{ x: ["0%", "-33.33%"] }}
            transition={{ duration: 45, ease: "linear", repeat: Infinity }}
          >
            {col1Reviews.map((r, i) => (
              <div
                key={`m1-${i}`}
                className="shrink-0 w-72 md:w-80 rounded-2xl p-6 mx-2"
                style={{
                  background: "#F7F2EA",
                  border: "1px solid #E9DBC5",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={r.img}
                    alt={r.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid #E9DBC5" }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold leading-tight truncate"
                      style={{
                        color: "#3E000E",
                        fontFamily:
                          "'JainiPurva', 'Playfair Display', serif",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      className="text-[11px] mt-0.5 truncate"
                      style={{ color: "#544243" }}
                    >
                      {r.location}
                    </p>
                  </div>
                </div>
                <Stars count={r.stars} />
                <p
                  className="mt-3 text-sm leading-relaxed line-clamp-4"
                  style={{ color: "#261816" }}
                >
                  "{r.text}"
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Row 2 — scrolls right */}
        <div className="overflow-hidden">
          <motion.div
            className="flex items-stretch"
            animate={{ x: ["-33.33%", "0%"] }}
            transition={{ duration: 45, ease: "linear", repeat: Infinity }}
          >
            {col2Reviews.map((r, i) => (
              <div
                key={`m2-${i}`}
                className="shrink-0 w-72 md:w-80 rounded-2xl p-6 mx-2"
                style={{
                  background: "#F7F2EA",
                  border: "1px solid #E9DBC5",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={r.img}
                    alt={r.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid #E9DBC5" }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold leading-tight truncate"
                      style={{
                        color: "#3E000E",
                        fontFamily:
                          "'JainiPurva', 'Playfair Display', serif",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      className="text-[11px] mt-0.5 truncate"
                      style={{ color: "#544243" }}
                    >
                      {r.location}
                    </p>
                  </div>
                </div>
                <Stars count={r.stars} />
                <p
                  className="mt-3 text-sm leading-relaxed line-clamp-4"
                  style={{ color: "#261816" }}
                >
                  "{r.text}"
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
```

---

## Step 3: Tailwind CSS Configuration

Make sure your `tailwind.config.ts` includes the `line-clamp` utility (built into Tailwind v3.3+). No extra plugin needed.

Required Tailwind utilities used:
- `line-clamp-3`, `line-clamp-4` — truncate text
- `shrink-0` — prevent flex shrink
- `truncate` — single-line text overflow
- `backdrop-filter`, `blur` (via inline styles)
- Standard flex, grid, positioning utilities

---

## Step 4: Path Alias Setup

The code uses `@/` as a path alias for `src/`. Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

And in `vite.config.ts`:

```ts
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

---

## Step 5: Usage

In your page or layout:

```tsx
import { Testimonials } from "@/components/landing/Testimonials";

function LandingPage() {
  return (
    <main>
      {/* ...other sections... */}
      <Testimonials />
      {/* ...other sections... */}
    </main>
  );
}
```

---

## Step 6: Image Assets

### Carousel Images (Local)
You need 4 PNG images placed in `src/assets/testimonial-images/`:

| File Name | Person |
|-----------|--------|
| `abhishek-shukla.png` | Abhishek Shukla |
| `amitav.png` | Amitav Hira |
| `harsha-gupta.png` | Harsha Gupta |
| `shoba-patil.png` | Shobha Patil |

These should be portrait-oriented photos (ideally 400x500px or similar aspect ratio).

### Review Card Avatars (Unsplash URLs)
The review strip cards use remote Unsplash URLs for avatars. These are 80x80 face-cropped images. Here are the exact URLs:

| Person | URL |
|--------|-----|
| Priya Sharma | `https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face` |
| Arjun Mehta | `https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=80&h=80&fit=crop&crop=face` |
| Kavitha Reddy | `https://images.unsplash.com/photo-1614644147798-f8c0fc9da7f6?w=80&h=80&fit=crop&crop=face` |
| Rohan Kapoor | `https://images.unsplash.com/photo-1618641986557-1ecd230959aa?w=80&h=80&fit=crop&crop=face` |
| Sneha Iyer | `https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=80&h=80&fit=crop&crop=face` |
| Vikram Nair | `https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=80&h=80&fit=crop&crop=face` |
| Ananya Bose | `https://images.unsplash.com/photo-1595956553066-fe24a8c33395?w=80&h=80&fit=crop&crop=face` |
| Rajesh Patel | `https://images.unsplash.com/photo-1604072366595-e75dc92d6bdc?w=80&h=80&fit=crop&crop=face` |

---

## Key Animations Explained

### 1. Circular Image Carousel (3D Perspective)
- Uses CSS `perspective: 1000px` on the container
- Active image: centered, full scale, no rotation
- Left image: `translateX(-gap) translateY(-stickUp) scale(0.85) rotateY(15deg)`
- Right image: `translateX(+gap) translateY(-stickUp) scale(0.85) rotateY(-15deg)`
- Transition: `cubic-bezier(.4,2,.3,1)` for a bouncy feel
- Gold ring: `conic-gradient` behind the image

### 2. Word-by-Word Blur Text Animation
- Each word is a `<motion.span>` with staggered delay (0.025s per word)
- Starts blurred (`blur(10px)`) and translates in from below
- Creates a "typing/revealing" effect

### 3. Vertical Strips (Desktop)
- Column 1 scrolls up: `animate={{ y: ["0%", "-33.33%"] }}`
- Column 2 scrolls down: `animate={{ y: ["-33.33%", "0%"] }}`
- Duration: 35 seconds, linear, infinite
- Content is triplicated (`reviews × 3`) for seamless loop
- Top/bottom fade overlays use linear gradients

### 4. Horizontal Strips (Mobile)
- Row 1 scrolls left: `animate={{ x: ["0%", "-33.33%"] }}`
- Row 2 scrolls right: `animate={{ x: ["-33.33%", "0%"] }}`
- Duration: 45 seconds, linear, infinite

### 5. Autoplay
- Carousel auto-advances every 5000ms
- Clicking arrows clears the autoplay interval

---

## Layout Breakdown

```
┌─────────────────────────────────────────────────────────────┐
│ Section: background #F7F2EA, full-height on desktop         │
│                                                             │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │  LEFT (58%)              │  │  RIGHT (42%)           │  │
│  │                          │  │                        │  │
│  │  "Private Circle..."     │  │  ┌──────┐  ┌──────┐   │  │
│  │  "Wisdom From Our..."    │  │  │Col 1 │  │Col 2 │   │  │
│  │                          │  │  │  ↑   │  │  ↓   │   │  │
│  │  ┌─────────────────────┐│  │  │cards │  │cards │   │  │
│  │  │ CircularTestimonials ││  │  │scroll│  │scroll│   │  │
│  │  │  [img] [img] [img]  ││  │  │ up   │  │ down │   │  │
│  │  │                     ││  │  │      │  │      │   │  │
│  │  │  Name               ││  │  └──────┘  └──────┘   │  │
│  │  │  Designation        ││  │                        │  │
│  │  │  Quote text...      ││  │  (desktop only)        │  │
│  │  │                     ││  │                        │  │
│  │  │  [←]  [→]           ││  │                        │  │
│  │  └─────────────────────┘│  │                        │  │
│  └──────────────────────────┘  └────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ MOBILE: horizontal scrolling rows (lg:hidden)       │   │
│  │ Row 1 → scrolls left                               │   │
│  │ Row 2 ← scrolls right                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start Checklist

1. [ ] Install dependencies: `npm install framer-motion lucide-react react-icons`
2. [ ] Add `JainiPurva-Regular.ttf` to `public/` and register `@font-face` in CSS
3. [ ] Set up `@/` path alias in `tsconfig.json` + `vite.config.ts`
4. [ ] Place 4 testimonial portrait images in `src/assets/testimonial-images/`
5. [ ] Create `src/components/ui/CircularTestimonials.tsx` (Step 1)
6. [ ] Create `src/components/landing/Testimonials.tsx` (Step 2)
7. [ ] Import and use `<Testimonials />` in your page
8. [ ] Ensure Tailwind CSS is configured with default utilities

---

## Notes

- The section is fully responsive — carousel + vertical strips on desktop, carousel + horizontal strips on mobile.
- All animations run via Framer Motion with no external animation libraries.
- The gold conic-gradient ring is purely CSS, no SVG or canvas.
- Review card content is triplicated (×3) so the scroll loop appears infinite without jumps.
- The `-33.33%` animation value matches exactly 1/3 of the content (since it's tripled).

X