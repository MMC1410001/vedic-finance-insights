/**
 * FocusRail — 3D perspective carousel with spring physics.
 * Auto-plays, supports drag/swipe, keyboard nav, and click-to-navigate.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

export interface FocusRailItem {
  id: string | number;
  title: string;
  description?: string;
  imageSrc?: string;
  meta?: string;
  icon?: React.ReactNode;
  /** Override the default "Know your" label above the title */
  label?: string;
}

interface FocusRailProps {
  items: FocusRailItem[];
  initialIndex?: number;
  loop?: boolean;
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  infoPosition?: "top" | "bottom";
  compactHeader?: boolean;
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function FocusRail({
  items,
  initialIndex = 0,
  loop = true,
  autoPlay = false,
  interval = 3000,
  className = "",
  infoPosition = "bottom",
  compactHeader = false,
}: FocusRailProps) {
  const [active, setActive] = useState(initialIndex);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);

  const count = items.length;

  // Detect mobile for tighter card spacing
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const goTo = useCallback(
    (idx: number) => {
      setActive(loop ? mod(idx, count) : Math.max(0, Math.min(idx, count - 1)));
    },
    [loop, count]
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay || isHovered) return;
    const id = setInterval(next, interval);
    return () => clearInterval(id);
  }, [autoPlay, interval, next, isHovered]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  // Drag end
  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = info.offset.x + info.velocity.x * 0.3;
    if (swipe < -50) next();
    else if (swipe > 50) prev();
  };

  // Get offset from active (wrapping for loop)
  function getOffset(idx: number) {
    let offset = idx - active;
    if (loop) {
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
    }
    return offset;
  }

  const infoBlock = (
    <div className="mt-5 text-center max-w-md">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] block mb-1" style={{ color: "#a22c1c" }}>
        {items[active]?.label ?? "Know about your"}
      </span>
      <h4
        className="text-lg md:text-xl font-bold"
        style={{ color: "#a22c1c", fontFamily: "'Playfair Display', serif" }}
      >
        {items[active]?.title}
      </h4>
    </div>
  );

  /* Compact header: title left, nav controls right — single row */
  const compactHeaderBlock = (
    <div className="w-full flex items-center justify-between gap-4 mt-1 mb-6 sm:mb-0 px-2">
      <div className="flex-1 min-w-0">
        <h4
          className="text-sm sm:text-lg font-bold italic truncate"
          style={{ color: "#a22c1c", fontFamily: "'Playfair Display', serif" }}
        >
          {items[active]?.title}
        </h4>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Active item info — top position */}
      {infoPosition === "top" && !compactHeader && <div className="mb-5">{infoBlock}</div>}

      {/* 3D carousel area */}
      <motion.div
        className="relative w-full flex items-center justify-center h-[200px] sm:h-[270px]"
        style={{ perspective: "1200px" }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: "grabbing" }}
      >
        {items.map((item, idx) => {
          const offset = getOffset(idx);
          const absOffset = Math.abs(offset);

          // Only render cards within range
          if (absOffset > 1) return null;

          const xShift = offset * (isMobile ? 110 : 160);
          const zShift = -absOffset * 120;
          const rotateY = offset * -15;
          const scale = 1 - absOffset * 0.18;
          const blur = absOffset * 5;
          const brightness = 1 - absOffset * 0.25;
          const zIndex = 20 - absOffset * 5;

          return (
            <motion.div
              key={item.id}
              className="absolute cursor-pointer"
              animate={{
                x: xShift,
                z: zShift,
                rotateY,
                scale,
                filter: `blur(${blur}px) brightness(${brightness})`,
                opacity: absOffset > 1 ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30, mass: 1 }}
              style={{ zIndex, transformStyle: "preserve-3d" }}
              onClick={() => offset !== 0 && goTo(idx)}
            >
              <div
                className="w-[150px] sm:w-[180px] md:w-[200px] rounded-2xl overflow-hidden border-t border-white/20 shadow-2xl"
                style={{
                  aspectRatio: "4/5",
                  background: "#000000",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {item.imageSrc ? (
                  <img
                    src={item.imageSrc}
                    alt={item.title}
                    className="w-full h-full object-contain rounded-2xl"
                    draggable={false}
                  loading="lazy" decoding="async" />
                ) : (
                  /* Placeholder card when no image */
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-5 py-6">
                    {/* Decorative glow */}
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(242,197,114,0.1)",
                        border: "1px solid rgba(242,197,114,0.2)",
                        boxShadow: "0 0 30px rgba(242,197,114,0.15)",
                      }}
                    >
                      {item.icon || (
                        <span className="text-2xl" style={{ color: "#F2C572" }}>✦</span>
                      )}
                    </div>
                    {item.meta && (
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "#2FBF9F" }}
                      >
                        {item.meta}
                      </span>
                    )}
                    <span
                      className="text-sm font-bold text-center leading-snug"
                      style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}
                    >
                      {item.title}
                    </span>
                    {item.description && (
                      <span
                        className="text-[11px] text-center leading-relaxed"
                        style={{ color: "#A89BC8" }}
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                )}
                {/* Lighting overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Navigation controls — hidden when using compactHeader */}
      {!compactHeader && null}

      {/* Compact header — below carousel */}
      {compactHeader && compactHeaderBlock}

      {/* Active item info — bottom position */}
      {infoPosition === "bottom" && !compactHeader && infoBlock}
    </div>
  );
}
