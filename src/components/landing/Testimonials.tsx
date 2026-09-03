import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { CircularTestimonials } from "@/components/ui/circular-testimonials";
import { useMediaQuery } from "@/hooks/use-mobile";

// Import local testimonial images
import abhishekImg from "@/assets/testimonial-images/abhishek-shukla.webp";
import amitavImg from "@/assets/testimonial-images/amitav.webp";
import harshaImg from "@/assets/testimonial-images/harsha-gupta.webp";
import shobhaImg from "@/assets/testimonial-images/shoba-patil.webp";

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

// ─── REVIEW CARDS (Right side strips) ──────────────────────────────────────
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
    text: "The AI astrologer chat is brilliant: I asked specific questions about my 11th house and got detailed, personalised answers instantly.",
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
    className="shrink-0 rounded-xl p-4 my-1.5"
    style={{
      background: "#ffffff",
      border: "1px solid rgba(0,0,0,0.08)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      width: "100%",
    }}
  >
    <div className="flex items-center gap-2.5 mb-1.5">
      <img
        src={r.img}
        alt={r.name}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        style={{ border: "2px solid rgba(242, 197, 114, 0.5)" }}
      loading="lazy" decoding="async" />
      <div className="min-w-0">
        <p
          className="text-xs font-semibold leading-tight truncate"
          style={{
            color: "#1A0A2E",
            fontFamily: "'Playfair Display', serif",
          }}
        >
          {r.name}
        </p>
        <p
          className="text-[10px] mt-0.5 truncate"
          style={{ color: "#6B5C7A" }}
        >
          {r.location}
        </p>
      </div>
    </div>
    <Stars count={r.stars} />
    <p
      className="mt-1.5 text-xs leading-relaxed line-clamp-3"
      style={{ color: "#4A3F5C" }}
    >
      &ldquo;{r.text}&rdquo;
    </p>
  </div>
);

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────
export const Testimonials = () => {
  // Tailwind's `lg`, matching the `hidden lg:flex` / `lg:hidden` classes below.
  // These four marquees run on `repeat: Infinity`, and framer-motion keeps its
  // frame loop going for a `display: none` subtree — so two of the four were
  // always animating invisibly. Gating `animate` (rather than the markup) stops
  // the loop without changing a single element's position.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return (
    <section
      id="testimonials"
      // Clarity hints — mirrors AstroTicker / AstroSpecialties. Four
      // Framer-Motion marquees live inside this section:
      //   • 2 vertical columns on desktop (col1Reviews / col2Reviews)
      //   • 2 horizontal rows on mobile (same data, `lg:hidden` fallback)
      // Each row is triplicated (4 reviews × 3), so if Clarity's iframe
      // reconstruction doesn't apply `overflow-hidden` — which is exactly
      // what happened on `/home` with AstroTicker — the 12 vertical cards
      // (~2160px of intrinsic height) could dominate the heatmap. Masking
      // the whole section removes that risk in one attribute; click
      // tracking on the CTAs above/below is untouched. See ANALYTICS.md →
      // "Heatmap rendering — the marquee gotcha".
      data-clarity-mask="true"
      data-clarity-region="testimonials"
      className="relative overflow-hidden lg:min-h-[650px]"
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(242,197,114,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center lg:items-stretch">
        {/* Section header — centered above both columns */}
        <div className="w-full text-center mb-8 lg:mb-8 pt-14 md:pt-20 lg:pt-20">
          <h2
            className="text-2xl md:text-4xl font-bold mt-3"
            style={{
              color: "#1A0A2E",
              fontFamily: "'Playfair Display', serif",
              letterSpacing: "-0.5px",
            }}
          >
            What our{" "}
            <span style={{ color: "#a22c1c" }}>Users</span> say
          </h2>
        </div>

        <div className="w-full flex flex-col lg:flex-row items-center lg:items-stretch">
        {/* ═══ LEFT SIDE — Carousel (takes ~60% on desktop) ═══ */}
        <div className="w-full lg:w-[58%] flex flex-col justify-center">

          {/* Testimonials carousel */}
          <div className="relative flex items-center justify-center lg:justify-start px-4 sm:px-6 lg:px-0">
            <div className="relative z-10 w-full" style={{ maxWidth: "1200px" }}>
              <CircularTestimonials
                testimonials={testimonials}
                autoplay={true}
                colors={{
                  name: "#1A0A2E",
                  designation: "#4B1D73",
                  testimony: "#4A3F5C",
                  arrowBackground: "rgba(0,0,0,0.06)",
                  arrowForeground: "#C8860A",
                  arrowHoverBackground: "#F2C572",
                }}
                fontSizes={{
                  name: "18px",
                  designation: "12px",
                  quote: "14px",
                }}
                fontFamilies={{
                  name: "'Playfair Display', serif",
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT SIDE — Vertical scrolling strips (desktop only, ~42%) ═══ */}
        <div className="hidden lg:flex w-[42%] max-h-[70vh] items-stretch gap-3 pl-6 py-8 overflow-hidden self-center">
          {/* Column 1 — scrolls up */}
          <div
            className="flex-1 relative overflow-hidden rounded-2xl"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            <motion.div
              // `flex-nowrap` on vertical marquees keeps the column single-
              // stack even if Clarity's iframe flex context is incomplete.
              className="flex flex-col flex-nowrap px-1"
              animate={isDesktop ? { y: ["0%", "-33.33%"] } : undefined}
              transition={{ duration: 55, ease: "linear", repeat: Infinity }}
            >
              {col1Reviews.map((r, i) => (
                <VerticalCard key={`c1-${i}`} r={r} />
              ))}
            </motion.div>
          </div>

          {/* Column 2 — scrolls down */}
          <div
            className="flex-1 relative overflow-hidden rounded-2xl"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            <motion.div
              // See column 1 for the `flex-nowrap` rationale.
              className="flex flex-col flex-nowrap px-1"
              animate={isDesktop ? { y: ["-33.33%", "0%"] } : undefined}
              transition={{ duration: 55, ease: "linear", repeat: Infinity }}
            >
              {col2Reviews.map((r, i) => (
                <VerticalCard key={`c2-${i}`} r={r} />
              ))}
            </motion.div>
          </div>
        </div>
        </div>
      </div>

      {/* ═══ MOBILE FALLBACK — horizontal strips below carousel ═══ */}
      <div className="lg:hidden relative pt-4 pb-10 overflow-hidden">
        {/* Row 1 — scrolls left */}
        <div className="overflow-hidden mb-3">
          <motion.div
            // `flex-nowrap` on horizontal marquees — same guard as the
            // desktop columns above, keeps the tripled row on one line.
            className="flex flex-nowrap items-stretch"
            animate={!isDesktop ? { x: ["0%", "-33.33%"] } : undefined}
            transition={{ duration: 11, ease: "linear", repeat: Infinity }}
          >
            {col1Reviews.map((r, i) => (
              <div
                key={`m1-${i}`}
                className="shrink-0 w-48 md:w-64 rounded-xl md:rounded-xl p-3 md:p-4 mx-1.5 md:mx-2"
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div className="flex items-center gap-2 md:gap-2.5 mb-1.5 md:mb-2">
                  <img
                    src={r.img}
                    alt={r.name}
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid rgba(242, 197, 114, 0.5)" }}
                  loading="lazy" decoding="async" />
                  <div className="min-w-0">
                    <p
                      className="text-[11px] md:text-xs font-semibold leading-tight truncate"
                      style={{
                        color: "#1A0A2E",
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      className="text-[9px] md:text-[10px] mt-0.5 truncate"
                      style={{ color: "#6B5C7A" }}
                    >
                      {r.location}
                    </p>
                  </div>
                </div>
                <Stars count={r.stars} />
                <p
                  className="mt-1.5 md:mt-2 text-[11px] md:text-xs leading-relaxed line-clamp-3"
                  style={{ color: "#4A3F5C" }}
                >
                  &ldquo;{r.text}&rdquo;
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Row 2 — scrolls right */}
        <div className="overflow-hidden">
          <motion.div
            // See row 1 for the `flex-nowrap` rationale.
            className="flex flex-nowrap items-stretch"
            animate={!isDesktop ? { x: ["-33.33%", "0%"] } : undefined}
            transition={{ duration: 11, ease: "linear", repeat: Infinity }}
          >
            {col2Reviews.map((r, i) => (
              <div
                key={`m2-${i}`}
                className="shrink-0 w-48 md:w-64 rounded-xl md:rounded-xl p-3 md:p-4 mx-1.5 md:mx-2"
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div className="flex items-center gap-2 md:gap-2.5 mb-1.5 md:mb-2">
                  <img
                    src={r.img}
                    alt={r.name}
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid rgba(242, 197, 114, 0.5)" }}
                  loading="lazy" decoding="async" />
                  <div className="min-w-0">
                    <p
                      className="text-[11px] md:text-xs font-semibold leading-tight truncate"
                      style={{
                        color: "#1A0A2E",
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      className="text-[9px] md:text-[10px] mt-0.5 truncate"
                      style={{ color: "#6B5C7A" }}
                    >
                      {r.location}
                    </p>
                  </div>
                </div>
                <Stars count={r.stars} />
                <p
                  className="mt-1.5 md:mt-2 text-[11px] md:text-xs leading-relaxed line-clamp-3"
                  style={{ color: "#4A3F5C" }}
                >
                  &ldquo;{r.text}&rdquo;
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
