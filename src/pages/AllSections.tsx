import HomeNew from "./HomeNew";
import Dashboard from "./Dashboard";
import LuxuryAssets from "./LuxuryAssets";
import InvestmentTiming from "./InvestmentTiming";
import RiskShield from "./RiskShield";
import BirthChart from "./BirthChart";
import InvestmentBonds from "./InvestmentBonds";
import AstroChat from "./AstroChat";
import SectorFavorability from "./SectorFavorability";
import VedicFinance from "./VedicFinance";
import BusinessTiming from "./BusinessTiming";
import SectionBackground from "@/components/SectionBackground";
import { BackgroundPaths } from "@/components/ui/background-paths";

type BgVariant = "dashboard" | "markets" | "investments" | "risk" | "birthchart" | "bonds" | "chat" | "sectors";

const sections: { id: string; label: string; Component: React.FC; bg: BgVariant; showPaths?: boolean; showShader?: "cybernetic" | "interactive" | boolean; plain?: boolean }[] = [
  // ── New Home (redesign) ───────────────────────────────
  { id: "home", label: "Home", Component: HomeNew, bg: "dashboard", plain: true },
  // ── MVP Core ──────────────────────────────────────────
  { id: "vedicfinance", label: "Kundli", Component: VedicFinance, bg: "dashboard" },
  { id: "luxury-assets", label: "Luxury Assets", Component: LuxuryAssets, bg: "markets" },
  { id: "bonds", label: "Bonds", Component: InvestmentBonds, bg: "bonds", showShader: "interactive" },
  { id: "ai-chat", label: "AI Astrologer Chat", Component: AstroChat, bg: "chat" },
  // ── Secondary ─────────────────────────────────────────
  { id: "dashboard", label: "Dashboard", Component: Dashboard, bg: "dashboard", showPaths: true },
  { id: "investment-timing", label: "Investments", Component: InvestmentTiming, bg: "investments" },
  { id: "risk-shield", label: "Risk Shield", Component: RiskShield, bg: "risk", showShader: "cybernetic" },
  { id: "birth-chart", label: "Birth Chart", Component: BirthChart, bg: "birthchart", showPaths: true },
  { id: "sector-favorability", label: "Sectors", Component: SectorFavorability, bg: "sectors" },
  { id: "business-timing", label: "Business Timing", Component: BusinessTiming, bg: "markets" },
];

const AllSections = () => (
  <div className="space-y-0">
    {sections.map(({ id, Component, bg, showPaths, showShader, plain }) => (
      <section
        key={id}
        id={id}
        className="min-h-[80vh] md:min-h-screen border-b border-white/[0.04] last:border-b-0 relative"
      >
        {plain ? (
          <Component />
        ) : (
          <SectionBackground variant={bg} showShader={showShader}>
            {showPaths && <BackgroundPaths className="opacity-30" />}
            <Component />
          </SectionBackground>
        )}
      </section>
    ))}
  </div>
);

export default AllSections;
