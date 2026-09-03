import { Moon, Sun, Star, ChevronDown } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";

// Each sign has 7 statements — financial astrology insights
const signStatements: Record<string, string[]> = {
  Aries:       ["Bold moves bring big returns", "Charge ahead with confidence today", "Energy favors quick financial action", "Patience sharpens your next move", "New ventures spark unexpected profit", "Risk-taking pays off this cycle", "Momentum builds for wealth growth"],
  Taurus:      ["Steady growth favors your wealth", "Long-term assets gain strength now", "Stability attracts solid opportunities", "Anchor investments for future gains", "Material security improves today", "Luxury spending needs careful review", "Patient strategies yield best results"],
  Gemini:      ["Diversify for maximum gains today", "Communication opens money doors", "Dual income streams look promising", "Quick thinking fuels smart trades", "Networking leads to golden chances", "Adaptability is your financial edge", "Information gives you profit power"],
  Cancer:      ["Secure assets protect your future", "Home investments shine this cycle", "Emotional clarity boosts money moves", "Family wealth grows with attention", "Savings strategy needs a refresh", "Nurture passive income streams now", "Security-first approach wins today"],
  Leo:         ["Confidence attracts golden chances", "Leadership brings financial rewards", "Creative ventures show profit potential", "Generosity returns tenfold today", "Spotlight favors your money moves", "Bold vision unlocks hidden value", "Royal energy magnetizes abundance"],
  Virgo:       ["Precision planning multiplies profit", "Details reveal overlooked wealth paths", "Analytical edge sharpens investments", "Organization unlocks trapped capital", "Health and wealth align today", "Practical steps build real fortune", "Efficiency cuts costs and grows gains"],
  Libra:       ["Balance risk and reward wisely", "Partnerships bring profitable harmony", "Fair deals create lasting wealth", "Aesthetic investments gain value now", "Diplomatic approach seals the deal", "Equilibrium favors portfolio growth", "Collaboration multiplies your returns"],
  Scorpio:     ["Deep insight reveals hidden gains", "Transformation energy boosts finances", "Research uncovers rare opportunities", "Power moves secure wealth today", "Intensity drives profitable outcomes", "Strategic depth defeats market noise", "Regeneration cycle favors new starts"],
  Sagittarius: ["Expand horizons for new wealth", "Global outlook opens profit doors", "Optimism attracts abundance today", "Adventure investments show promise", "Knowledge is your currency now", "Big-picture thinking rewards patience", "Exploration reveals untapped markets"],
  Capricorn:   ["Discipline builds lasting fortune", "Structure strengthens financial plans", "Authority positions bring more income", "Legacy investments gain momentum now", "Hard work compounds into wealth", "Traditional strategies outperform today", "Ambition aligns with opportunity now"],
  Aquarius:    ["Innovation opens fresh income streams", "Unconventional assets show potential", "Technology investments gain traction", "Community wealth ideas take shape", "Future-forward thinking pays today", "Disruption creates profit windows", "Original ideas attract funding now"],
  Pisces:      ["Intuition guides smart investments", "Creative flows unlock hidden value", "Spiritual clarity sharpens decisions", "Imagination fuels unconventional gains", "Compassion-driven ventures prosper now", "Flow state reveals the right path", "Dreams align with financial reality"],
};

const signs = [
  { icon: "star",  label: "Aries" },
  { icon: "star",  label: "Taurus" },
  { icon: "star",  label: "Gemini" },
  { icon: "star",  label: "Cancer" },
  { icon: "sun",   label: "Leo" },
  { icon: "star",  label: "Virgo" },
  { icon: "star",  label: "Libra" },
  { icon: "moon",  label: "Scorpio" },
  { icon: "star",  label: "Sagittarius" },
  { icon: "star",  label: "Capricorn" },
  { icon: "star",  label: "Aquarius" },
  { icon: "moon",  label: "Pisces" },
];

const ItemIcon = ({ type, className = "w-3 h-3 shrink-0" }: { type: string; className?: string }) => {
  if (type === "moon") return <Moon className={className} style={{ color: "#F2C572" }} />;
  if (type === "sun")  return <Sun  className={className} style={{ color: "#F2C572" }} />;
  return                      <Star className={className} style={{ color: "#F2C572" }} />;
};

export const AstroTicker = () => {
  const [selectedSign, setSelectedSign] = useState(signs[0].label);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedSignData = signs.find((s) => s.label === selectedSign)!;

  // Build ticker items from the selected sign's 7 statements
  const tickerItems = useMemo(() => {
    const statements = signStatements[selectedSign];
    return statements.map((statement, i) => ({
      icon: selectedSignData.icon,
      label: selectedSign,
      sub: statement,
      key: i,
    }));
  }, [selectedSign, selectedSignData.icon]);

  // Triple for seamless CSS loop
  const items = [...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <div
      // Clarity hints:
      //  - `data-clarity-mask` blanks the ticker's content in Clarity's
      //    heatmap screenshot without hiding it from click tracking. Without
      //    this the tripled marquee items (3× 7 = 21) lay out unstyled inside
      //    Clarity's iframe reconstruction and fill the frame, pushing the
      //    real Hero off-screen. See ANALYTICS.md for the diagnosis.
      //  - `data-clarity-region` names the region so Clarity segments it
      //    cleanly in the dashboard.
      data-clarity-mask="true"
      data-clarity-region="astro-ticker"
      className={`fixed top-0 inset-x-0 flex items-stretch ${dropdownOpen ? "z-[60]" : "z-40"}`}
      // NOTE: do not add `overflow: hidden` here. The sign-selector dropdown
      // renders `position: absolute` at `top-full`, i.e. below this 40px
      // band — clipping the wrapper hides the dropdown on both mobile and
      // desktop. Clarity heatmap protection is already handled by
      // `data-clarity-mask` above (region is blanked in the screenshot
      // regardless of any inner layout), and the marquee's own inner
      // `overflow-hidden` wrapper (see "relative flex-1 overflow-hidden"
      // below) clips the tripled strip in real browsers. Belt-and-braces
      // overflow here is not worth breaking the dropdown.
      style={{ height: "40px" }}
    >
      {/* Red band — inset from the left on mobile so the navbar logo pill sits
          beside it in the same 40px row (the page background shows through the
          gap). Full-bleed from md+, identical to the original bar. */}
      <div
        className="flex flex-1 items-stretch ml-[112px] md:ml-0"
        style={{
          background: "#a22c1c",
          borderBottom: "1px solid rgba(0,0,0,0.15)",
        }}
      >
      {/* Left section: Combined select + sign */}
      <div
        ref={dropdownRef}
        className="relative flex items-center shrink-0 px-3 md:px-4 gap-2"
        style={{ borderRight: "1px solid rgba(255,255,255,0.15)" }}
      >
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#F2C572" }}
          aria-label="Select zodiac sign"
          aria-expanded={dropdownOpen}
        >
          <ItemIcon type={selectedSignData.icon} className="w-3.5 h-3.5 shrink-0" />
          <span className="font-bold" style={{ color: "#FFDFA3" }}>
            {selectedSign}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div
            className="absolute left-0 top-full mt-0 py-1 rounded-b-lg shadow-lg overflow-y-auto"
            style={{
              background: "#a22c1c",
              border: "1px solid rgba(255,255,255,0.12)",
              borderTop: "none",
              maxHeight: "320px",
              width: "170px",
              zIndex: 50,
            }}
          >
            {signs.map((sign) => (
              <button
                key={sign.label}
                onClick={() => {
                  setSelectedSign(sign.label);
                  setDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                style={{
                  color: sign.label === selectedSign ? "#F2C572" : "#ffffff",
                  fontWeight: sign.label === selectedSign ? 600 : 400,
                }}
              >
                <ItemIcon type={sign.icon} />
                {sign.label}
                {sign.label === selectedSign && (
                  <span className="ml-auto text-xs" style={{ color: "#F2C572" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right section: Scrolling ticker */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          <div
            key={selectedSign}
            // `flex-nowrap` guarantees the 21 tripled items stay on a single
            // row even when the parent's flex context is not fully honoured
            // (Clarity's iframe, print stylesheets, forced-colors mode).
            className="flex flex-nowrap items-center gap-0 animate-ticker-scroll"
            style={{
              willChange: "transform",
              backfaceVisibility: "hidden",
            }}
          >
            {items.map((item, i) => (
              <div key={i} className="flex items-center shrink-0">
                <div className="flex items-center gap-2 px-5 whitespace-nowrap">
                  <ItemIcon type={item.icon} />
                  <span className="text-xs" style={{ color: "#ffffff" }}>
                    {item.sub}
                  </span>
                </div>
                <span className="text-xs select-none" style={{ color: "rgba(255,255,255,0.4)" }}>
                  ✦
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
          style={{ background: "linear-gradient(to left, #a22c1c 30%, transparent)" }}
        />
      </div>
      </div>
    </div>
  );
};
