import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import faqAsset from "@/assets/af-asset1.webp";

const faqs = [
  {
    q: "What exactly is a Financial Kundali?",
    a: "It's a personalised report that maps your Vedic birth chart through a financial lens. It highlights your best months to invest, periods to stay cautious, and the money behaviour patterns unique to your chart.",
  },
  {
    q: "Do I need to share any financial data?",
    a: "No. We never ask for bank details, holdings, or income. Just your birth date, time, and place. That's all we need to generate your report.",
  },
  {
    q: "How is this different from regular astrology apps?",
    a: "Generic astrology apps cover love, career, or daily horoscopes. The Financial Kundali is built exclusively for financial decision-making: timing, risk, and money behaviour.",
  },
  {
    q: "I don't know astrology. Can I still use this?",
    a: "Absolutely. The report is written in plain language with clear, actionable insights. No jargon, no spreadsheets required.",
  },
  {
    q: "Is this a subscription?",
    a: "No. You pay ₹99 once and get lifetime access to your Financial Kundali report. No recurring charges, ever.",
  },
];

export const FAQ = () => (
  <section id="faq" className="relative py-14 md:py-32 overflow-hidden">


    {/* Subtle radial overlay — lightened for white bg */}
    <div className="absolute inset-0 pointer-events-none z-[1]"
      style={{
        background: "radial-gradient(ellipse at center, rgba(242,197,114,0.06) 0%, transparent 70%)",
      }}
    />

    <div className="container max-w-6xl relative z-10">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16">
        {/* Left: FAQ content */}
        <div className="flex-1 w-full">
          <div className="text-center lg:text-left">
            <span className="text-xs font-medium text-gold tracking-widest uppercase">FAQ</span>
            <h2 className="font-display text-2xl md:text-5xl font-bold mt-3" style={{ color: "#1A0A2E" }}>Got questions about the <span style={{ color: "#a22c1c" }}>Financial Kundali</span>?</h2>
          </div>

          <Accordion type="single" collapsible className="mt-8 md:mt-12 space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-black/8 rounded-xl px-5 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.85)" }}>
                <AccordionTrigger className="text-left font-medium hover:no-underline" style={{ color: "#1A0A2E" }}>{f.q}</AccordionTrigger>
                <AccordionContent style={{ color: "#4A3F5C" }}>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Right: Asset image */}
        <div className="hidden lg:flex flex-shrink-0 w-[340px] xl:w-[400px] items-center justify-center">
          <img
            src={faqAsset}
            alt="Financial Kundali illustration"
            className="w-full h-auto object-contain drop-shadow-2xl"
          loading="lazy" decoding="async" />
        </div>
      </div>
    </div>
  </section>
);
