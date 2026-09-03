/**
 * HeroShowcase — split-layout hero section placed ABOVE the original Hero.
 *
 * Left: headline, subtitle, CTAs, social proof & trust badges
 * Right: 2×2 grid of blurred insight preview cards
 *
 * Reuses existing elements from Hero.tsx and InsightPreview.tsx.
 */

import { ArrowRight, ShieldCheck, Lock, Building2, CircleDollarSign, Car, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Starfield } from "./Starfield";
import horoscopeLottie from "@/assets/horoscope.lottie";

/* ─── Horoscope Wheel (reused from Hero) ─── */
const HoroscopeWheel = () => {
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
      style={{ width: "100%", height: "100%", opacity: 0.12 }}
    />
  );
};

/* ─── Blurred Card (reused from InsightPreview) ─── */
const BlurredCard = ({
  header,
  children,
  className = "",
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`relative rounded-2xl overflow-hidden flex flex-col ${className}`}
    style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(16px)",
    }}
  >
    <div className="px-4 pt-4 pb-1.5 relative z-20">{header}</div>
    <div className="relative flex-1 min-h-0">
      <div
        className="px-4 pb-4 select-none"
        style={{ filter: "blur(3px)", pointerEvents: "none" }}
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(242,197,114,0.12)",
              border: "1px solid rgba(242,197,114,0.25)",
              boxShadow: "0 0 20px rgba(242,197,114,0.15)",
            }}
          >
            <Lock className="w-4 h-4" style={{ color: "#F2C572" }} />
          </div>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "rgba(242,197,114,0.8)" }}
          >
            Locked
          </span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Card Headers & Bodies (reused from InsightPreview) ─── */
function EarningsHeader() {
  return (
    <div>
      <h3
        className="text-sm font-bold leading-tight"
        style={{
          background: "linear-gradient(135deg, #F2C572 0%, #E8A84C 50%, #D4893A 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontFamily: "'Playfair Display', serif",
        }}
      >
        Earnings Strength
      </h3>
      <span className="text-[9px] mt-0.5 block" style={{ color: "rgba(214,198,245,0.5)" }}>
        12 Month Projection
      </span>
    </div>
  );
}

function EarningsBody() {
  const viewW = 600;
  const viewH = 160;
  const pts = [
    { x: 40, y: 120 }, { x: 110, y: 95 }, { x: 180, y: 70 },
    { x: 250, y: 52 }, { x: 320, y: 65 }, { x: 390, y: 42 },
    { x: 460, y: 60 }, { x: 530, y: 78 }, { x: 560, y: 85 },
  ];
  const pathD = `M ${pts[0].x} ${pts[0].y} C 75 108,95 100,${pts[1].x} ${pts[1].y} C 140 85,155 74,${pts[2].x} ${pts[2].y} C 210 60,230 50,${pts[3].x} ${pts[3].y} C 280 58,300 68,${pts[4].x} ${pts[4].y} C 345 62,370 40,${pts[5].x} ${pts[5].y} C 420 50,440 62,${pts[6].x} ${pts[6].y} C 490 68,510 76,${pts[7].x} ${pts[7].y} C 545 82,555 84,${pts[8].x} ${pts[8].y}`;
  const fillD = `${pathD} L 560 155 L 40 155 Z`;
  const months = ["FEB", "APR", "JUN", "AUG", "OCT"];

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full" fill="none">
      <defs>
        <linearGradient id="hs-ps" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E8B84C" />
          <stop offset="50%" stopColor="#F2C572" />
          <stop offset="100%" stopColor="#D4893A" />
        </linearGradient>
        <linearGradient id="hs-pf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(242,197,114,0.12)" />
          <stop offset="100%" stopColor="rgba(212,137,58,0)" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#hs-pf)" />
      <path d={pathD} stroke="url(#hs-ps)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={pts[5].x} cy={pts[5].y} r="5" fill="#F2C572" />
      {months.map((m, i) => (
        <text key={m} x={40 + (i / 4) * 520} y={viewH - 2} fill="rgba(168,155,200,0.4)" fontSize="11" fontFamily="'Space Grotesk', sans-serif" textAnchor="middle">{m}</text>
      ))}
    </svg>
  );
}

function ScamHeader() {
  return (
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4" style={{ color: "#F2C572" }} />
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#F2C572" }}>
        Scam &amp; Fraud Warning
      </h3>
    </div>
  );
}

function ScamBody() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-4 py-3"
      style={{ background: "rgba(242,197,114,0.06)", border: "1px solid rgba(242,197,114,0.15)" }}
    >
      <span className="text-2xl font-bold uppercase tracking-[0.04em] mb-1" style={{ color: "#F2C572" }}>
        Moderate
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] font-medium text-center" style={{ color: "rgba(242,197,114,0.6)" }}>
        Rahu in 7th House: stay cautious
      </span>
    </div>
  );
}

function BuyTimingHeader() {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(168,155,200,0.55)" }}>
      Best Time to Buy Assets
    </h3>
  );
}

function BuyTimingBody() {
  const assets = [
    { icon: Building2, label: "Property", status: "Auspicious", statusColor: "#34d399", score: 72 },
    { icon: CircleDollarSign, label: "Gold", status: "Delay", statusColor: "#d4a017", score: 41 },
    { icon: Car, label: "Vehicle", status: "Auspicious", statusColor: "#34d399", score: 65 },
  ];
  return (
    <div className="flex flex-col gap-3">
      {assets.map((a) => (
        <div key={a.label} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <a.icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: "rgba(168,155,200,0.5)" }} />
            </div>
            <span className="text-sm font-medium" style={{ color: "#D6C6F5" }}>{a.label}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold" style={{ color: a.statusColor }}>{a.status}</span>
            <span className="text-[10px]" style={{ color: "rgba(168,155,200,0.4)" }}>Score: {a.score}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MilestonesHeader() {
  return (
    <h3
      className="text-base font-bold leading-tight"
      style={{ color: "#F2C572", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.3px" }}
    >
      Wealth Milestones
    </h3>
  );
}

function MilestonesBody() {
  const milestones = [
    { label: "Current Phase", desc: "Jupiter Mahadasha, wealth accumulation active", isCurrent: true },
    { label: "2026–2028", desc: "Peak earning window, career growth surge", isCurrent: false },
    { label: "2029–2031", desc: "Asset consolidation: property & gold favorable", isCurrent: false },
    { label: "2032+", desc: "Legacy building, long-term wealth stability", isCurrent: false },
  ];
  return (
    <div className="relative flex flex-col gap-3 pl-5">
      <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: "rgba(242,197,114,0.18)" }} />
      {milestones.map((m, i) => (
        <div key={i} className="relative flex items-start gap-4">
          <div
            className="absolute -left-5 top-0.5 w-3 h-3 rounded-full shrink-0 z-10"
            style={{
              background: m.isCurrent ? "#F2C572" : "rgba(168,155,200,0.25)",
              border: m.isCurrent ? "2px solid rgba(242,197,114,0.4)" : "2px solid rgba(168,155,200,0.15)",
              boxShadow: m.isCurrent ? "0 0 10px rgba(242,197,114,0.4)" : "none",
            }}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: m.isCurrent ? "#F2C572" : "rgba(168,155,200,0.5)" }}>{m.label}</span>
            <span className="text-xs font-medium leading-snug" style={{ color: m.isCurrent ? "#F5E9FF" : "rgba(214,198,245,0.7)" }}>{m.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Export — Split-layout hero
   ═══════════════════════════════════════════════════════════ */

export const HeroShowcase = ({
  onPrimary,
  paid = false,
}: {
  onPrimary: () => void;
  paid?: boolean;
}) => {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["your financial future", "best investments", "cosmic insights", "wealth timing", "smart returns"],
    [],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
      {/* Background — same gradient, no extra bg since parent already has it */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* Soft gold glow orb */}
        <div
          className="absolute left-[30%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-25 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, rgba(242,197,114,0.4), rgba(75,29,115,0.3) 45%, transparent 70%)" }}
        />
        {/* Horoscope wheel — positioned behind left content */}
        <div
          className="absolute left-[25%] top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: "min(90vw, 700px)", height: "min(90vw, 700px)" }}
        >
          <HoroscopeWheel />
        </div>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(245,233,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,233,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>
      <Starfield count={35} />

      <div className="container relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* ─── Left Column: Text Content ─── */}
          <div className="animate-fade-up">
            {/* Headline */}
            <h1
              className="text-[2.2rem] leading-[1.08] sm:text-4xl md:text-5xl lg:text-[3.4rem] font-bold"
              style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.5px" }}
            >
              Glimpse of your
              <br />
              <span className="relative flex w-full overflow-hidden md:pb-3 md:pt-1 h-[1.2em]">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-bold italic"
                    style={{
                      color: "#a22c1c",
                      fontFamily: "'Playfair Display', serif",
                    }}
                    initial={{ opacity: 0, y: "-100%" }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? { y: 0, opacity: 1 }
                        : { y: titleNumber > index ? "-150%" : "150%", opacity: 0 }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="mt-5 text-base md:text-lg max-w-lg leading-relaxed"
              style={{ color: "#D6C6F5", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              These are real features from your{" "}
              <em className="not-italic font-medium" style={{ color: "#F5E9FF" }}>Financial Kundali</em>:{" "}
              unlock to see your personalized data.
            </p>

            {/* Pricing card + CTA */}
            <div className="mt-8 max-w-md">
              {/* Price banner */}
              <div
                className="rounded-2xl px-5 py-4"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <div className="text-[11px] font-medium" style={{ color: "rgba(214,198,245,0.55)" }}>
                  Total today
                </div>
                <div className="flex items-baseline gap-2.5 mt-1.5">
                  <span
                    className="text-3xl font-bold leading-none"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    ₹99
                  </span>
                  <span className="text-sm line-through" style={{ color: "rgba(168,155,200,0.45)" }}>
                    ₹999
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: "rgba(242,197,114,0.15)",
                      border: "1px solid rgba(242,197,114,0.3)",
                      color: "#F2C572",
                    }}
                  >
                    90% OFF
                  </span>
                </div>
              </div>

              {/* Full-width gold CTA */}
              <button
                onClick={onPrimary}
                className="group w-full h-14 mt-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                  color: "#2A0E4A",
                  boxShadow: "0 10px 30px rgba(242,197,114,0.4)",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                View Your Financial Kundli
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* ─── Right Column: 2×2 Blurred Preview Cards ─── */}
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="grid grid-cols-2 gap-3">
              <BlurredCard header={<EarningsHeader />}>
                <EarningsBody />
              </BlurredCard>

              <BlurredCard header={<ScamHeader />}>
                <ScamBody />
              </BlurredCard>

              <BlurredCard header={<BuyTimingHeader />}>
                <BuyTimingBody />
              </BlurredCard>

              <BlurredCard header={<MilestonesHeader />}>
                <MilestonesBody />
              </BlurredCard>
            </div>

            {/* Trust badges below cards */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" style={{ color: "#A89BC8" }}>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#2FBF9F" }} /> Birth data stays private
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#2FBF9F" }} /> Verified by{" "}
                <span className="font-semibold" style={{ color: "#F5E9FF" }}>100+</span> astrologers
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
