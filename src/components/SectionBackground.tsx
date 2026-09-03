import { ReactNode, lazy, Suspense } from "react";

const CyberneticGridShader = lazy(() => import("@/components/ui/cybernetic-grid-shader"));
const InteractiveShader = lazy(() => import("@/components/ui/interactive-shader"));

interface SectionBackgroundProps {
  variant: "dashboard" | "markets" | "investments" | "risk" | "birthchart" | "bonds" | "chat" | "sectors";
  children: ReactNode;
  showShader?: "cybernetic" | "interactive" | boolean;
}

const bgConfigs: Record<SectionBackgroundProps["variant"], {
  image?: string;
  gradient: string;
  overlay?: string;
}> = {
  dashboard: {
    image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1511&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 30% 50%, hsl(var(--primary) / 0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, hsl(var(--secondary) / 0.06) 0%, transparent 55%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.75), hsl(var(--background) / 0.85) 50%, hsl(var(--background) / 0.95))",
  },
  markets: {
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=1632&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 50% 40%, hsl(43 72% 30% / 0.12) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, hsl(var(--secondary) / 0.05) 0%, transparent 50%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.8), hsl(var(--background) / 0.9) 60%, hsl(var(--background) / 0.95))",
  },
  investments: {
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1472&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 60% 30%, hsl(170 75% 30% / 0.1) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, hsl(43 72% 25% / 0.08) 0%, transparent 50%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.8), hsl(var(--background) / 0.88) 50%, hsl(var(--background) / 0.95))",
  },
  risk: {
    image: "https://images.unsplash.com/photo-1608178398319-48f814d0750c?q=80&w=1479&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 20% 50%, hsl(200 80% 30% / 0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 40%, hsl(15 80% 35% / 0.08) 0%, transparent 55%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.75), hsl(var(--background) / 0.85) 50%, hsl(var(--background) / 0.95))",
  },
  birthchart: {
    image: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1513&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 50% 30%, hsl(var(--secondary) / 0.1) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, hsl(var(--primary) / 0.06) 0%, transparent 50%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.82), hsl(var(--background) / 0.9) 50%, hsl(var(--background) / 0.96))",
  },
  bonds: {
    image: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1471&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 40% 40%, hsl(245 58% 30% / 0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 60%, hsl(43 72% 30% / 0.07) 0%, transparent 50%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.8), hsl(var(--background) / 0.88) 50%, hsl(var(--background) / 0.95))",
  },
  chat: {
    gradient: "radial-gradient(ellipse at 30% 40%, hsl(var(--secondary) / 0.08) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, hsl(var(--primary) / 0.05) 0%, transparent 50%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.9), hsl(var(--background) / 0.95))",
  },
  sectors: {
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1470&auto=format&fit=crop",
    gradient: "radial-gradient(ellipse at 40% 30%, hsl(43 72% 25% / 0.1) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, hsl(239 84% 20% / 0.08) 0%, transparent 50%)",
    overlay: "linear-gradient(to bottom, hsl(var(--background) / 0.8), hsl(var(--background) / 0.88) 50%, hsl(var(--background) / 0.95))",
  },
};

const SectionBackground = ({ variant, children, showShader }: SectionBackgroundProps) => {
  const config = bgConfigs[variant];

  return (
    <div className="relative overflow-hidden">
      {/* Shader background */}
      {(showShader === true || showShader === "cybernetic") && (
        <div className="absolute inset-0 z-0 opacity-30">
          <Suspense fallback={null}>
            <CyberneticGridShader />
          </Suspense>
        </div>
      )}
      {showShader === "interactive" && (
        <div className="absolute inset-0 z-0 opacity-25">
          <Suspense fallback={null}>
            <InteractiveShader hue={245} speed={0.3} intensity={0.8} complexity={6} />
          </Suspense>
        </div>
      )}

      {/* Background image */}
      {config.image && !showShader && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('${config.image}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.15,
          }}
        />
      )}

      {/* Overlay to darken */}
      {config.overlay && (
        <div className="absolute inset-0 z-[1]" style={{ background: config.overlay }} />
      )}

      {/* Gradient accents */}
      <div className="absolute inset-0 z-[2]" style={{ background: config.gradient }} />

      {/* Content */}
      <div className="relative z-[3]">{children}</div>
    </div>
  );
};

export default SectionBackground;
