# Splash Screen — Vedic Animated Intro

A full-screen animated splash overlay that plays on first load. Uses a 3-phase animation (logo → text reveal → exit fade) with a canvas-based particle background and Lottie horoscope animation.

There are two variants:
1. **VedicSplashScreen** (light/golden) — used on the landing page
2. **SplashScreen** (dark/cosmic) — used on the onboarding/auth flow

---

## How It's Used

The splash renders as a fixed overlay on top of the actual page content. When it finishes, it's removed — no route change needed:

```tsx
// src/pages/Index.tsx
import VedicSplashScreen from "./VedicSplashScreen";
import Landing from "./Landing";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleFinish = useCallback(() => setShowSplash(false), []);

  return (
    <>
      <Landing />
      {showSplash && <VedicSplashScreen onFinish={handleFinish} />}
    </>
  );
};
```

---

## Animation Timeline

| Phase | Starts At | Duration | What Happens |
|-------|-----------|----------|--------------|
| `logo` | 0ms | 800ms | Logo appears with pulsing gold glow |
| `text` | 800ms | 1600ms | Brand name slides up, tagline fades in |
| `exit` | 2400ms | 700ms | Entire overlay fades out (opacity 0) |
| `onFinish` | 3100ms | — | Callback fires, overlay unmounts |

Total duration: ~3.1 seconds

---

## Dependencies

```
react (useState, useEffect, useRef)
@lottiefiles/dotlottie-react (DotLottieReact) — for horoscope geometry
Custom font: RuntimeRegular-m2Odx.otf (loaded dynamically)
Logo asset: vedicfinance-logo.png
Lottie asset: horoscope.lottie
AnimatedVedicBackground component (canvas particle system)
```

---

## VedicSplashScreen (Light Theme) — Full Code

```tsx
import { useEffect, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import AnimatedVedicBackground from "@/components/ui/animated-vedic-background";
import uniqueFont from "@/assets/fonts/runtime-font/RuntimeRegular-m2Odx.otf?url";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.png";
import horoscopeLottie from "@/assets/horoscope.lottie";

const VedicSplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [phase, setPhase] = useState<"logo" | "text" | "exit">("logo");

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@font-face {
      font-family: 'Unique';
      src: url('${uniqueFont}') format('opentype');
    }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 800);
    const t2 = setTimeout(() => setPhase("exit"), 2400);
    const t3 = setTimeout(onFinish, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center
        transition-opacity duration-700 ease-out
        ${phase === "exit" ? "opacity-0" : "opacity-100"}`}
    >
      {/* Animated particle background */}
      <div className="absolute inset-0">
        <AnimatedVedicBackground />
      </div>

      {/* Warm overlay */}
      <div className="absolute inset-0"
        style={{ background: "rgba(255, 252, 245, 0.15)" }} />

      {/* Rotating horoscope Lottie (subtle, 10% opacity) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ animation: "vedic-spin 60s linear infinite" }}
      >
        <div style={{ width: "70vmin", height: "70vmin", opacity: 0.1 }}>
          <DotLottieReact
            src={horoscopeLottie}
            loop autoplay
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Logo with pulsing gold glow */}
        <div
          className={`transition-all duration-700 ${
            phase === "logo" ? "scale-100 opacity-100" : "scale-110 opacity-100"
          }`}
          style={{
            filter: "drop-shadow(0 0 24px rgba(184, 134, 11, 0.45))",
            animation: "vedic-pulse-glow 2s ease-in-out infinite",
          }}
        >
          <img src={vedicfinanceLogo} alt="VedicFinance"
            className="h-20 w-20 object-contain" />
        </div>

        {/* Brand name slide-up reveal */}
        <div className="overflow-hidden">
          <h1
            className={`text-4xl md:text-5xl tracking-tight transition-all duration-700 ${
              phase === "logo"
                ? "translate-y-full opacity-0"
                : "translate-y-0 opacity-100"
            }`}
            style={{ fontFamily: "'Unique', sans-serif" }}
          >
            <span style={{ color: "#B8860B" }}>Astro</span>
            <span style={{ color: "#2C1810" }}>Fin</span>
          </h1>
        </div>

        {/* Tagline fade-in */}
        <p
          className={`text-sm tracking-widest uppercase transition-all duration-500 delay-300 ${
            phase === "text"
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2"
          }`}
          style={{ color: "rgba(80, 50, 20, 0.75)" }}
        >
          Stars guide your wealth
        </p>
      </div>

      <style>{`
        @keyframes vedic-pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 24px rgba(184, 134, 11, 0.45)); }
          50% { filter: drop-shadow(0 0 36px rgba(184, 134, 11, 0.65)); }
        }
        @keyframes vedic-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VedicSplashScreen;
```


---

## AnimatedVedicBackground — Canvas Particle System

The background behind the splash uses a Canvas 2D particle system with floating gold dots and a pulsing radial glow:

```tsx
import { useEffect, useRef } from "react";

const AnimatedVedicBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: {
      x: number; y: number; r: number;
      speed: number; opacity: number; drift: number;
    }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    // Create 40 floating gold particles
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.5 + 1,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.4 + 0.15,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }

    let time = 0;
    const draw = () => {
      time += 0.016;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      ctx.clearRect(0, 0, width, height);

      // Pulsing radial gold glow
      const pulse = Math.sin(time * 0.5) * 0.03 + 0.12;
      const grad = ctx.createRadialGradient(
        width * 0.5, height * 0.45, 0,
        width * 0.5, height * 0.45, width * 0.6
      );
      grad.addColorStop(0, `rgba(212, 160, 18, ${pulse})`);
      grad.addColorStop(0.5, `rgba(184, 134, 11, ${pulse * 0.4})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Floating particles
      for (const p of particles) {
        p.y -= p.speed;
        p.x += p.drift + Math.sin(time + p.y * 0.01) * 0.15;
        if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const flicker = Math.sin(time * 2 + p.x * 0.02) * 0.15 + 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(184, 134, 11, ${p.opacity * flicker})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden"
      style={{ background: "#FFFCF5" }}>
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #FFFDF7 0%, #FFF9EC 40%, #FFF5E0 100%)" }} />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export default AnimatedVedicBackground;
```

---

## Dark Theme Variant (SplashScreen)

The dark/cosmic variant uses:
- `AnimatedShaderBackground` instead of `AnimatedVedicBackground`
- Dark purple overlay: `rgba(42, 14, 74, 0.35)`
- Gold accent: `#F2C572` (for "Astro")
- Light purple text: `#F5E9FF` (for "Fin")
- Tagline color: `#D6C6F5`
- Glow: `rgba(242, 197, 114, 0.5)`

```tsx
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";

// Same phase logic, but with dark theme colors:
<span style={{ color: '#F2C572' }}>Astro</span>
<span style={{ color: '#F5E9FF' }}>Fin</span>
// Tagline:
style={{ color: '#D6C6F5' }}
```

---

## Key Customization Points

| Property | Vedic (Light) | Cosmic (Dark) |
|----------|---------------|---------------|
| Background | `#FFFCF5` cream + gold particles | Shader/WebGL purple |
| Overlay | `rgba(255,252,245, 0.15)` | `rgba(42,14,74, 0.35)` |
| Logo glow | `rgba(184,134,11, 0.45)` gold | `rgba(242,197,114, 0.5)` gold |
| "Astro" color | `#B8860B` | `#F2C572` |
| "Fin" color | `#2C1810` dark brown | `#F5E9FF` light purple |
| Tagline color | `rgba(80,50,20, 0.75)` | `#D6C6F5` |
| Lottie animation | Yes (horoscope.lottie) | No |
| Canvas particles | Yes (gold, floating up) | No (uses shader) |

---

## Timing Customization

```tsx
// Adjust these timeouts to change splash duration:
const t1 = setTimeout(() => setPhase("text"), 800);   // Logo → Text delay
const t2 = setTimeout(() => setPhase("exit"), 2400);  // Start fade-out
const t3 = setTimeout(onFinish, 3100);                // Remove from DOM
```

---

## Simplification for Reuse

If you don't want the Lottie/canvas dependencies, a minimal splash can be:

```tsx
const SimpleSplash = ({ onFinish }: { onFinish: () => void }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2500);
    const t2 = setTimeout(onFinish, 3200);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center
      transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#FFFCF5" }}>
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="" className="h-20 w-20" />
        <h1 className="text-4xl font-bold">
          <span style={{ color: "#B8860B" }}>Brand</span>
          <span style={{ color: "#2C1810" }}>Name</span>
        </h1>
        <p className="text-sm uppercase tracking-widest"
          style={{ color: "rgba(80,50,20,0.7)" }}>
          Your tagline here
        </p>
      </div>
    </div>
  );
};
```
