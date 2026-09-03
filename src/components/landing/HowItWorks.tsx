import { CalendarClock, Sparkles, FileBarChart2 } from "lucide-react";

const steps = [
  { icon: CalendarClock, title: "Enter your chart details", desc: "Date, time, and place of birth. Takes under a minute." },
  { icon: Sparkles, title: "Vedic calculations", desc: "Your birth chart is processed through precise Vedic astrological computations." },
  { icon: FileBarChart2, title: "Get your kundali", desc: "Your Vedic chart is analysed through a proprietary financial intelligence layer and delivered to you." },
];


export const HowItWorks = () => (
  <section id="how" className="py-16 md:py-32 relative" >
    <div className="container">
      <div className="max-w-2xl mx-auto text-center">
        <span className="text-xs font-medium text-gold tracking-widest uppercase">How It Works</span>
        <h2 className="font-display text-2xl md:text-5xl font-bold mt-2 md:mt-3" style={{ color: "#1A0A2E" }}>Your Financial Kundali in <span style={{ color: "#a22c1c" }}>3 steps</span>.</h2>
      </div>

      <div className="mt-10 md:mt-16 grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6 relative">
        <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        {steps.map((s, i) => (
          <div key={s.title} className="relative text-center px-1">
            <div className="relative inline-flex">
              <div className="w-12 h-12 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto ring-1 ring-gold/30" style={{ background: "rgba(242,197,114,0.08)", boxShadow: "0 0 0 4px rgba(242,197,114,0.12)" }}>
                <s.icon className="w-5 h-5 md:w-9 md:h-9 text-gold" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 md:w-7 md:h-7 rounded-full bg-gradient-gold text-primary-foreground text-[9px] md:text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <h3 className="font-display font-semibold text-[11px] sm:text-sm md:text-lg mt-2 md:mt-6 leading-tight" style={{ color: "#a22c1c" }}>{s.title}</h3>
            <p className="hidden sm:block text-xs md:text-sm mt-1 md:mt-2 max-w-xs mx-auto" style={{ color: "#6B5C7A" }}>{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Step descriptions shown below on mobile since they're hidden inline */}
      <div className="mt-6 flex flex-col gap-3 sm:hidden">
        {steps.map((s, i) => (
          <div key={`desc-${i}`} className="flex items-start gap-3 px-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-gradient-gold text-primary-foreground text-[9px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-xs leading-relaxed" style={{ color: "#6B5C7A" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
