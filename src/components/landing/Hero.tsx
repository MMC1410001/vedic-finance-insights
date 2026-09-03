import { ArrowRight, ShieldCheck, Calendar, Clock } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CelestialOrrery } from "@/components/ui/celestial-orrery";
import { useIsMobile } from "@/hooks/use-mobile";
import { SampleKundaliViewer } from "./SampleKundaliViewer";
import { UserKundaliViewer } from "./UserKundaliViewer";
import BirthDetailsForm from "@/components/vedicfinance/BirthDetailsForm";
import horoscopeLottie from "@/assets/horoscope.lottie";
import scrollDownLottie from "@/assets/scroll-down.lottie";

import avatarAbhishek from "@/assets/testimonial-images/abhishek-shukla-avatar.webp";
import avatarAmitav from "@/assets/testimonial-images/amitav-avatar.webp";
import avatarHarsha from "@/assets/testimonial-images/harsha-gupta-avatar.webp";
import avatarShobha from "@/assets/testimonial-images/shoba-patil-avatar.webp";
import analytics from "@/lib/analytics";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import { useReportStore } from "@/lib/report-store";
import { ZODIAC_IMAGES } from "@/lib/zodiac-images";

/** Renders the horoscope lottie on a canvas using the vanilla dotlottie-web API (avoids the dual-React hook issue in dotlottie-react). */
const HoroscopeWheel = ({ opacity = 0.06 }: { opacity?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let instance: any;
    let cancelled = false;

    import("@lottiefiles/dotlottie-web").then(({ DotLottie }) => {
      if (cancelled || !canvasRef.current) return;
      instance = new DotLottie({
        canvas: canvasRef.current,
        src: horoscopeLottie,
        loop: true,
        autoplay: true,
      });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", opacity }}
    />
  );
};

/** Animated scroll-down arrow using the scroll-down lottie. */
const ScrollDownArrow = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let instance: any;
    let cancelled = false;

    import("@lottiefiles/dotlottie-web").then(({ DotLottie }) => {
      if (cancelled || !canvasRef.current) return;
      instance = new DotLottie({
        canvas: canvasRef.current,
        src: scrollDownLottie,
        loop: true,
        autoplay: true,
      });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, []);

  return (
    <div style={{ width: 56, height: 56, position: "relative", overflow: "hidden" }}>
      {/* SVG filter to recolor to #a22c1c */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="recolor-red" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.635
                      0 0 0 0 0.173
                      0 0 0 0 0.110
                      0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", filter: "url(#recolor-red)" }}
      />
    </div>
  );
};

const PENDING_BIRTH_KEY = "pendingBirthData";

/** Helper to read moon sign from sessionStorage/localStorage (same logic as Navbar). */
function getMoonSign(): { sign: string; signNum: number } | null {
  try {
    const raw = sessionStorage.getItem("kundliReport");
    if (raw) {
      const report = JSON.parse(raw);
      const moon = report?.d1_chart?.planets?.find((p: any) => p.planet === "Moon");
      if (moon?.sign && moon?.sign_num !== undefined) {
        return { sign: moon.sign, signNum: moon.sign_num };
      }
    }
  } catch { /* ignore */ }
  try {
    const stored = localStorage.getItem("moonSign");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.sign && parsed?.signNum !== undefined) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

/** Helper to read birth details from sessionStorage. */
function getBirthDetails(): { date: string; time: string; place: string } | null {
  try {
    const raw = sessionStorage.getItem("kundliRequest");
    if (raw) {
      const req = JSON.parse(raw);
      return {
        date: req.birth_date || "",
        time: req.birth_time || "",
        place: req.birth_place || "",
      };
    }
  } catch { /* ignore */ }
  return null;
}

/** Formats a date string like "2003-12-08" → "8 December 2003" */
function formatBirthDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/** Formats time "05:05" → "05:05 (IST)" */
function formatBirthTime(timeStr: string): string {
  if (!timeStr) return "";
  return `${timeStr} (IST)`;
}

/** Logged-in horoscope info card shown in place of the birth form. */
const LoggedInKundaliCard = () => {
  const navigate = useNavigate();
  const userName = useReportStore((s) => s.userName);
  const insights = useReportStore((s) => s.insights);
  const personalSummary = useReportStore((s) => s.personalSummary);

  const [moonSign, setMoonSign] = useState(getMoonSign);
  const [birthDetails, setBirthDetails] = useState(getBirthDetails);

  // Re-read when report becomes available
  const refresh = useCallback(() => {
    setMoonSign(getMoonSign());
    setBirthDetails(getBirthDetails());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("kundliReportReady", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("kundliReportReady", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const archetypeName = insights?.archetype?.name || "";
  const displayName = userName || "You";

  return (
    <div
      className="w-full rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center border-0 sm:border-[1.5px]"
      style={{
        background: "transparent",
        borderColor: "#F2C572",
      }}
    >
      {/* Zodiac badge — centered at top */}
      {moonSign && (
        <div className="flex flex-col items-center mb-4">
          <img
            src={ZODIAC_IMAGES[moonSign.signNum]}
            alt={moonSign.sign}
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
          decoding="async" fetchpriority="high" />
          <span
            className="mt-2 text-xs sm:text-sm font-bold tracking-widest uppercase"
            style={{ color: "#4B1D73", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {moonSign.sign}
          </span>
        </div>
      )}

      {/* Archetype label */}
      {archetypeName && (
        <p className="text-xs sm:text-sm font-medium mb-1" style={{ color: "#6B5C7A", fontFamily: "'Space Grotesk', sans-serif" }}>
          "{archetypeName}"
        </p>
      )}

      {/* Title — gold gradient, Playfair Display */}
      <h3
        className="text-2xl sm:text-3xl font-bold leading-tight mb-3"
        style={{
          fontFamily: "'Playfair Display', serif",
          background: "linear-gradient(135deg, #8B6914 0%, #B8860B 30%, #D4A012 55%, #B8860B 80%, #8B6914 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {displayName}'s Financial Kundali
      </h3>

      {/* Summary text */}
      {personalSummary && (
        <p
          className="text-xs sm:text-sm leading-relaxed max-w-sm mx-auto mb-6"
          style={{ color: "#6B5C7A", fontFamily: "'Inter', sans-serif" }}
        >
          {personalSummary}
        </p>
      )}

      {/* Birth details — structured row with labels */}
      {birthDetails && (
        <div className="flex items-start justify-center gap-6 sm:gap-8 w-full mb-6">
          {birthDetails.date && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(184,134,11,0.06)" }}>
                <Calendar className="w-4 h-4" style={{ color: "#8B6914" }} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "rgba(61,43,31,0.5)" }}>Birth Date</span>
                <span className="text-[11px] sm:text-xs font-bold" style={{ color: "rgba(61,43,31,0.85)" }}>{formatBirthDate(birthDetails.date)}</span>
              </div>
            </div>
          )}
          {birthDetails.time && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "rgba(184,134,11,0.06)" }}>
                <Clock className="w-4 h-4" style={{ color: "#8B6914" }} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "rgba(61,43,31,0.5)" }}>Birth Time</span>
                <span className="text-[11px] sm:text-xs font-bold" style={{ color: "rgba(61,43,31,0.85)" }}>{formatBirthTime(birthDetails.time)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={() => {
          analytics({ 'gtm.text': 'Viewyourfinancialkundali_1' });
          navigate("/kundali");
        }}
        className="group w-full h-12 sm:h-13 rounded-full text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:brightness-105 hover:shadow-lg cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #F2C572 0%, #FFDFA3 100%)",
          color: "#2A0E4A",
          boxShadow: "0 6px 20px rgba(242,197,114,0.3)",
        }}
      >
        View Your Financial Kundali
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
};

const CYCLING_TITLES = ["Finances", "Investments", "Income"];

/**
 * The rotating word in the headline.
 *
 * Its own component, and memoized, because the 2s tick that drives it used to
 * live in Hero. Hero has no memoized children, so every tick re-rendered the
 * whole hero subtree — the birth-details form, both Lottie players, the PDF
 * viewer — forever, starting while the splash was still covering the screen.
 * Keeping the state down here means the tick re-renders three spans.
 */
const CyclingWord = memo(() => {
  const [titleNumber, setTitleNumber] = useState(0);

  useEffect(() => {
    const id = setTimeout(
      () => setTitleNumber((n) => (n + 1) % CYCLING_TITLES.length),
      2000,
    );
    return () => clearTimeout(id);
  }, [titleNumber]);

  return (
    <span
      className="relative inline-flex h-[2.5rem] sm:h-[2.8rem] md:h-[3.5rem] lg:h-[2.8rem] xl:h-[3.2rem] ml-2 sm:ml-3 translate-y-1"
      style={{ clipPath: "inset(-10px -20px)" }}
    >
      {CYCLING_TITLES.map((title, index) => (
        <motion.span
          key={index}
          className="absolute inset-0 flex items-center justify-start font-bold whitespace-nowrap"
          style={{
            color: "#0F9B8D",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
          initial={{ opacity: 0, y: "-100%" }}
          transition={{ type: "spring", stiffness: 50 }}
          animate={
            titleNumber === index
              ? {
                  y: 0,
                  opacity: 1,
                }
              : {
                  y: titleNumber > index ? "-150%" : "150%",
                  opacity: 0,
                }
          }
        >
          {title}
        </motion.span>
      ))}
      {/* Invisible spacer to size the container to the longest word — only on lg+ to prevent layout shift on desktop; on mobile we let it shrink so the line centers naturally */}
      <span className="invisible font-bold hidden lg:inline" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Investments</span>
      <span className="invisible font-bold lg:hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{CYCLING_TITLES[titleNumber]}</span>
    </span>
  );
});
CyclingWord.displayName = "CyclingWord";

export const Hero = ({ onPrimary, paid = false }: { onPrimary: () => void; paid?: boolean }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const formRef = useRef<HTMLDivElement>(null);

  /** Mobile-only CTA above the form — the form is too far down to be the first
      thing a visitor sees, so this scrolls them to it. */
  const scrollToForm = () => {
    analytics({ 'gtm.text': 'VedicFinance_Hero_ScrollToForm_Mobile' });
    const el = formRef.current;
    if (!el) return;
    // Deliberately not scrollIntoView: this section is overflow-hidden and its
    // decorative layers overflow the box, which makes it a scroll container.
    // scrollIntoView scrolls every scrollable ancestor, so it also shifted the
    // section's own scrollTop — and overflow:hidden can never be scrolled back
    // by the user, leaving the hero permanently stuck below its headline.
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88);
    window.scrollTo({ top, behavior: "smooth" });
  };

  /** Shared by the mobile CTA and the form's own submit button so the copy
      cannot drift between the two. */
  const ctaLabel = (
    <span className="flex items-center gap-1.5 sm:gap-2 leading-snug">
      <span>Unlock your Financial Kundali for</span>
      <span
        className="font-bold relative inline-block after:content-[''] after:absolute after:left-[-10%] after:right-[-10%] after:top-1/2 after:h-[2px] after:rounded-full after:bg-[#C0392B] after:-translate-y-1/2 after:-rotate-12"
        style={{ color: "#2A0E4A" }}
      >
        ₹99
      </span>
      <span className="font-bold" style={{ color: "#059669" }}>FREE</span>
    </span>
  );

  /**
   * lg is where the mobile-only promoted CTA (`lg:hidden`) disappears and the
   * form's submit button becomes the hero's first CTA.
   */
  const isDesktopCta = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  const handleFormSubmit = (data: ReportRequest) => {
    // Mobile keeps its original semantics — this tag fires on a completed
    // submit, not on the press. Desktop fires it from the button's onClick
    // instead (see onSubmitClick below), so don't double-count there.
    if (!isDesktopCta()) {
      analytics({ 'gtm.text': 'VedicFinance_Unlockyourkundali_1' });
    }
    // Store as kundliRequest so the /kundali page picks it up directly
    sessionStorage.setItem("kundliRequest", JSON.stringify(data));
    sessionStorage.setItem(PENDING_BIRTH_KEY, JSON.stringify(data));
    navigate("/kundali");
  };

  return (
    <section
      className="relative pt-[64px] pb-12 md:pt-[200px] md:pb-28 overflow-hidden px-6 md:px-8"
    >
      {/* Horoscope wheel background. Position and size differ between
          breakpoints, so both come from the same media query as the player. */}
      <div
        className="absolute pointer-events-none z-0"
        style={{
          bottom: isMobile ? "-20%" : "-45%",
          left: isMobile ? "-40%" : "-25%",
          width: isMobile ? "500px" : "900px",
          height: isMobile ? "500px" : "900px",
        }}
      >
        {/* One player, sized by media query. There used to be two of these —
            `block md:hidden` and `hidden md:block` — and both mounted. A Lottie
            canvas is a JS render loop, so `display: none` does not stop it: the
            900x900 desktop instance kept animating on phones, and the 500x500
            mobile one kept animating on desktops, for the whole session. */}
        <HoroscopeWheel opacity={isMobile ? 0.045 : 0.04} />
      </div>

      {/* CelestialOrrery — top-right background, mobile only (hidden on lg where it shows in the right column) */}
      <div
        className="absolute pointer-events-none z-0 lg:hidden"
        style={{
          top: "0",
          right: "-30%",
          width: "420px",
          height: "420px",
          opacity: 0.45,
        }}
      >
        <CelestialOrrery />
      </div>

      {/* px-0 on mobile: the section already provides px-6 gutters, and the
          container's own 2rem on top of that left the hero content only ~278px
          wide on a 390px screen. Restored to 2rem from md+. */}
      <div className="container relative px-0 md:px-8">
        {/* ─── 60/40 Split: Hero Content (left) | Carousel (right) ─── */}
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          {/* Left column — 45% — Hero text + CTAs */}
          <div className="w-full lg:w-[45%] text-center lg:text-left animate-fade-up flex flex-col lg:pl-12 xl:pl-16 overflow-visible">
            {/* Headline — Space Grotesk with animated word cycling */}
            <h1
              // Fluid below sm: the animated word cycles, and "Investments" at a
              // fixed 2rem overflows every viewport under ~450px. The ceiling is
              // 2rem, reached exactly where 2rem starts fitting.
              className="text-[clamp(1.25rem,calc(8vw_-_4px),2rem)] leading-[1.1] sm:text-4xl md:text-5xl lg:text-[2.4rem] xl:text-[2.8rem] font-bold order-1"
              style={{ color: "#1A0A2E", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.5px" }}
            >
              {/* Line 1: "Improve your [Finances]" — single line, same font size */}
              <span className="flex flex-nowrap items-end justify-center lg:justify-start">
                <span className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Improve&nbsp;your</span>
                <CyclingWord />
              </span>
              {/* Line 2: "based on vedic astrology" — smaller text */}
              <span className="block text-center lg:text-left text-[clamp(0.95rem,calc(6vw_-_3px),1.5rem)] sm:text-2xl md:text-3xl lg:text-[2rem] xl:text-3xl font-bold not-italic mt-1 sm:mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>based on <span style={{ color: "#a22c1c", fontFamily: "'Space Grotesk', sans-serif", fontWeight: "bold" }}>vedic astrology</span></span>
            </h1>


            {/* Sub-headline — sits directly above the form on mobile (order-6),
                so it is deliberately darker/bolder than body copy to separate
                the CTA above it from the fields below. */}
            {!paid && (
            <p
              className="mt-10 text-base md:text-xl lg:text-lg xl:text-xl font-semibold lg:font-normal max-w-2xl mx-auto lg:mx-0 leading-relaxed text-center lg:text-left order-6 lg:hidden"
              style={{ color: "#1A0A2E", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Get your personalized financial insights in form of <span className="font-bold" style={{ color: "#a22c1c" }}>Financial Kundali</span>
            </p>
            )}

            {/* Sample Kundali — shown inline on mobile (order-2), hidden on desktop (shows in right column). Hidden when logged in since insight card replaces it. */}
            {!paid && (
              <div className="w-full flex flex-col items-center overflow-hidden mt-6 lg:mt-0 lg:hidden order-2">
                <div className="w-full max-w-[95%] rounded-2xl" style={{ height: "220px", overflow: "hidden" }}>
                  <SampleKundaliViewer />
                </div>
              </div>
            )}

            {/* Mobile CTA — scrolls down to the form (order-4), which sits below
                the sub-headline. The form keeps its own submit button. */}
            {!paid && (
              <div className="w-full max-w-md mx-auto mt-6 order-4 lg:hidden">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="w-full min-h-[60px] px-4 sm:px-6 py-3 rounded-2xl text-[13px] sm:text-[15px] font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.98]"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                    color: "#2A0E4A",
                    boxShadow: "0 10px 30px rgba(242,197,114,0.4)",
                  }}
                >
                  {ctaLabel}
                </button>
              </div>
            )}

            {/* Red rule separating the CTA from the form block (order-5) */}
            {!paid && (
              <div className="w-24 h-[3px] rounded-full mx-auto mt-10 order-5 lg:hidden" style={{ background: "#a22c1c" }} />
            )}

            {/* Birth details form or horoscope info card when logged in */}
            <div ref={formRef} className="mt-5 md:mt-6 w-full max-w-md mx-auto lg:mx-0 order-7 hero-birth-form">
              {paid ? (
                <LoggedInKundaliCard />
              ) : (
                <BirthDetailsForm
                  onSubmit={handleFormSubmit}
                  loading={false}
                  compact
                  submitContent={ctaLabel}
                  // Desktop only: there the tag must count every press,
                  // including ones an invalid form rejects. Mobile is left on
                  // its original submit-time fire in handleFormSubmit.
                  onSubmitClick={() => {
                    if (isDesktopCta()) {
                      analytics({ 'gtm.text': 'VedicFinance_Unlockyourkundali_1' });
                    }
                  }}
                />
              )}

              {/* "Already a user? Sign in" link — shown only when not logged in */}
              {!paid && (
                <p className="mt-3 text-center text-xs sm:text-sm" style={{ color: "#6B5C7A", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Already a user?{" "}
                  <button
                    onClick={() => navigate("/kundali-auth")}
                    className="font-semibold underline underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ color: "#4B1D73" }}
                  >
                    Sign in
                  </button>
                </p>
              )}

              {/* Social proof — desktop only, below CTA */}
              <div className="hidden lg:flex mt-6 flex-row items-center justify-start gap-4 text-sm">
                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  <div className="flex -space-x-2">
                    {[avatarAbhishek, avatarAmitav, avatarHarsha, avatarShobha].map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                      decoding="async" fetchpriority="high" />
                    ))}
                  </div>
                  <span style={{ color: "#6B5C7A" }}>
                    <span className="font-semibold" style={{ color: "#1A0A2E" }}>2,400+</span> Kundalis generated
                  </span>
                </div>
                <div className="w-px h-4 shrink-0" style={{ background: "rgba(0,0,0,0.12)" }} />
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#2FBF9F" }} />
                  <span style={{ color: "#6B5C7A" }}>
                    Verified by <span className="font-semibold" style={{ color: "#1A0A2E" }}>100+</span> astrologers
                  </span>
                </div>
              </div>

            </div>

            {/* Social proof row — mobile, sits between the sample kundali and the CTA */}
            <div className="mt-6 flex flex-col items-center lg:items-start order-3 lg:hidden">
              <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-5 text-[10px] sm:text-sm">
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <div className="flex -space-x-2">
                    {[avatarAbhishek, avatarAmitav, avatarHarsha, avatarShobha].map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-5 h-5 sm:w-7 sm:h-7 rounded-full ring-2 ring-white object-cover"
                      decoding="async" fetchpriority="high" />
                    ))}
                  </div>
                  <span style={{ color: "#6B5C7A" }}>
                    <span className="font-semibold" style={{ color: "#1A0A2E" }}>2,400+</span> Kundalis generated
                  </span>
                </div>
                <div className="w-px h-4 shrink-0" style={{ background: "rgba(0,0,0,0.12)" }} />
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#2FBF9F" }} />
                  <span style={{ color: "#6B5C7A" }}>
                    Verified by <span className="font-semibold" style={{ color: "#1A0A2E" }}>100+</span> astrologers
                  </span>
                </div>
              </div>
            </div>

            {/* Animated scroll-down arrow — stays at the bottom of the hero */}
            <div className="mt-8 flex justify-center order-8 lg:hidden">
              <ScrollDownArrow />
            </div>


          </div>

          {/* Right column — 55% — Sample Kundali (desktop only) */}
          <div className="hidden lg:flex w-full lg:w-[55%] flex-col items-center relative">
            {/* Celestial orrery background — larger than the viewer */}
            <div className="absolute inset-0 -inset-x-16 -inset-y-20 scale-[1.35] pointer-events-none z-0 opacity-60">
              <CelestialOrrery />
            </div>
            {/* The viewer fills this box, so the height lives here — see the
                note in SampleKundaliViewer. */}
            <div
              className="relative z-[1] w-full rounded-2xl"
              style={{ height: "clamp(320px, 55vw, 420px)", overflow: "hidden" }}
            >
              {paid ? <UserKundaliViewer /> : <SampleKundaliViewer />}
            </div>
            {/* Subtitle — desktop only, below sample kundali */}
            <p
              className="relative z-[1] mt-6 text-lg xl:text-xl max-w-md leading-relaxed text-center"
              style={{ color: "#6B5C7A", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Get your personalized financial insights in form of <span style={{ color: "#a22c1c" }}>Financial Kundali</span>
            </p>

          </div>
        </div>


      </div>

    </section>
  );
};
