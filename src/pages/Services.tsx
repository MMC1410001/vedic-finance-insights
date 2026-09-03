import { Star, Brain, TrendingUp, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import analytics from "@/lib/analytics";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { legalColors } from "@/components/legal/legal-theme";

const Services = () => {
  const navigate = useNavigate();

  return (
    <LegalPageLayout title="Our Services" subtitle="Vedic astrology meets modern finance">
        <div className="space-y-8">
          {/* Service Cards */}
          <ServiceCard
            icon={<Star className="w-5 h-5" style={{ color: legalColors.accent }} />}
            title="Financial Kundali Report"
            description="A comprehensive Vedic astrology-based financial report that reveals your money personality, wealth indicators, and planetary influences on your finances. Get insights into your earning potential, spending patterns, and wealth accumulation cycles."
          />

          <ServiceCard
            icon={<Brain className="w-5 h-5" style={{ color: "#0F9B8D" }} />}
            title="AI Astrologer Chat"
            description="Chat with our AI-powered Vedic astrologer for personalized financial guidance. Ask questions about your chart, upcoming planetary transits, and how cosmic events may influence your financial decisions."
          />

          <ServiceCard
            icon={
              <TrendingUp className="w-5 h-5" style={{ color: "#2A0E4A" }} />
            }
            title="Year-Ahead Forecast"
            description="Detailed month-by-month financial forecast for the year ahead based on planetary transits through your birth chart. Identify favorable periods for investments, business decisions, and wealth growth."
          />

          <ServiceCard
            icon={<Shield className="w-5 h-5" style={{ color: "#B8860B" }} />}
            title="Wealth Protection Insights"
            description="Understand potential financial challenges indicated in your chart and receive guidance on protective measures. Learn about astrological remedies and favorable timing to safeguard your wealth."
          />
        </div>

        {/* Pricing note */}
        <div
          className="mt-12 p-6 rounded-2xl text-center"
          style={{
            background: legalColors.cardBg,
            border: legalColors.cardBorder,
            boxShadow: legalColors.cardShadow,
          }}
        >
          <p
            className="text-lg font-semibold mb-2"
            style={{
              color: legalColors.accent,
              fontFamily: "'Playfair Display', serif",
            }}
          >
            Get Started for Just ₹99
          </p>
          <p className="text-sm" style={{ color: legalColors.body }}>
            One-time payment unlocks your complete Financial Kundali report
            with year-ahead forecasts and AI chat access.
          </p>
          <button
            onClick={() => {
              analytics({ 'gtm.text': 'FooterServices_GenerateMyKundli' });
              navigate("/auth?intent=kundali");
            }}
            className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, #F2C572, #FFDFA3)",
              color: "#2A0E4A",
              boxShadow: "0 10px 30px rgba(242,197,114,0.3)",
            }}
          >
            Generate My Kundali
          </button>
        </div>
    </LegalPageLayout>
  );
};

/* Reusable service card */
const ServiceCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div
    className="p-6 rounded-2xl transition-transform hover:-translate-y-1"
    style={{
      background: legalColors.cardBg,
      border: legalColors.cardBorder,
      boxShadow: legalColors.cardShadow,
    }}
  >
    <div className="flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: "rgba(162,44,28,0.08)",
          border: "1px solid rgba(162,44,28,0.18)",
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          className="text-base font-semibold mb-2"
          style={{ color: legalColors.ink }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: legalColors.body }}>
          {description}
        </p>
      </div>
    </div>
  </div>
);

export default Services;
