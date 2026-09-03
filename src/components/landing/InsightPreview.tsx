/**
 * InsightPreview — "A Glimpse of your Financial Kundali" section.
 *
 * Two-column layout:
 *   Left:  "Unlock All Insights" heading + 3D FocusRail carousel
 *   Right: "Get 2 Free Insights" + locked preview cards (Earnings + Buy Timing)
 *
 * Separated by a vertical gold divider on desktop.
 */

import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SurpriseWealthLockedCard, BestInvestmentLockedCard } from "./LockedCards";
import { UnlockedSurpriseWealthCard, UnlockedBestInvestmentCard } from "./UnlockedCards";
import { FocusRail, type FocusRailItem } from "./FocusRail";
import { useAuth } from "@/lib/auth-context";
import { useReportStore } from "@/lib/report-store";
import analytics from "@/lib/analytics";

import imgIncomeGrowth from "@/assets/insights-images/your-income-growth.webp";
import imgDashaRisk from "@/assets/insights-images/dasha-risk-meter.webp";
import imgHeroBook from "@/assets/hero-book.webp";
import imgSurpriseWealth from "@/assets/insights-images/surprise-wealth-gains.webp";

/* ─── Carousel Data ─── */
const carouselItems: FocusRailItem[] = [
  {
    id: 1,
    title: "Financial Risks",
    imageSrc: imgDashaRisk,
  },
  {
    id: 2,
    title: "Surprise Wealth Gains",
    imageSrc: imgSurpriseWealth,
  },
  {
    id: 3,
    title: "Income Growth",
    imageSrc: imgIncomeGrowth,
  },
  {
    id: 4,
    title: "Vedic Scriptures",
    imageSrc: imgHeroBook,
    label: "Based on",
  },
];

/**
 * The two preview insights, rendered in both placements — beside the sample
 * kundali and again beneath it. Deliberately one component rather than copied
 * JSX: the locked/unlocked switch has to stay identical in both spots.
 *
 * `layout="stack"` for the narrow right-hand column, `"row"` for the full-width
 * area under the viewer, where two cards side by side read better than a tall
 * stack.
 */
const InsightCardPair = ({
  showUnlocked,
  layout,
}: {
  showUnlocked: boolean;
  layout: "stack" | "row";
}) => (
  <div
    className={
      layout === "row"
        ? "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start"
        : "flex flex-col gap-3 sm:gap-4 items-stretch"
    }
  >
    {showUnlocked ? (
      <>
        <div className="min-w-0"><UnlockedSurpriseWealthCard /></div>
        <div className="min-w-0"><UnlockedBestInvestmentCard /></div>
      </>
    ) : (
      <>
        <div className="min-w-0"><SurpriseWealthLockedCard /></div>
        <div className="min-w-0"><BestInvestmentLockedCard /></div>
      </>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   Main Export
   ═══════════════════════════════════════════════════════════ */

export const InsightPreview = ({ onUnlock, paid = false }: { onUnlock: () => void; paid?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const hasRealData = useReportStore((s) => s.hasRealData);
  const isGuest = sessionStorage.getItem("guestMode") === "true";
  const isLoggedIn = !!user || isGuest;

  // Show unlocked cards when user is logged in AND has report data
  const showUnlocked = isLoggedIn && hasRealData;

  return (
    <section
      id="insights"
      className="relative py-16 md:py-24 overflow-hidden"
      style={{
        background: "#ffffff",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="container max-w-7xl mx-auto px-6 md:px-8">
        {/* ─── Section Header ─── */}
        <div className="text-center mb-12 md:mb-16">
          <h2
            className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "-0.5px" }}
          >
            <span style={{ color: "#1A0A2E" }}>What Will You Get in Your </span>
            <span
              className="italic"
              style={{
                color: "#a22c1c",
                paddingBottom: "0.15em",
                paddingRight: "0.2em",
                display: "inline-block",
              }}
            >
              Financial Kundali?
            </span>
          </h2>
        </div>

        {/* ─── Two-Column Layout: Sample Kundali | Insight Cards ─── */}
        <div className="flex flex-col lg:flex-row items-start max-w-7xl mx-auto gap-8 lg:gap-12">
          {/* Column 1 — Carousel (~65%) */}
          <div className="w-full lg:w-[65%] flex flex-col items-center">
            <h3
              className="text-sm font-semibold uppercase tracking-[0.12em] mb-5 text-center"
              style={{ color: "#B8860B" }}
            >
              What You'll Discover
            </h3>
            <FocusRail
              items={carouselItems}
              autoPlay
              loop
              interval={3000}
              infoPosition="top"
            />
          </div>

          {/* Column 2 — Insight Cards stacked + CTA (~35%) */}
          <div className="w-full lg:w-[35%] flex flex-col px-2 lg:pt-0">
            <h3
              className="text-sm font-semibold uppercase tracking-[0.12em] mb-5 text-center"
              style={{ color: "#B8860B" }}
            >
              {showUnlocked ? "Your Insights" : "Get Yours Now"}
            </h3>

            {/* Insight cards stacked vertically */}
            <InsightCardPair showUnlocked={showUnlocked} layout="stack" />

            {/* CTA Button — matches Hero CTA */}
            <div className="mt-5">
              <button
                onClick={() => {
                  if (paid) {
                    analytics({ 'gtm.text': 'Viewyourfinancialkundali_2' });
                    onUnlock();
                  } else {
                    analytics({ 'gtm.text': 'VedicFinance_Unlockyourkundali_2' });
                    navigate("/auth");
                  }
                }}
                className="group w-full min-h-14 px-5 py-3 rounded-2xl text-sm sm:text-base font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                  color: "#2A0E4A",
                  boxShadow: "0 10px 30px rgba(242,197,114,0.4)",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {paid ? (
                  <>
                    View Your Financial Kundli
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                ) : (
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
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
