/**
 * InsightInfoTooltip — A subtle "i" icon that shows a tooltip explaining
 * how a card's data is calculated. Theme-aware (Cosmic dark / Vedic light).
 * Uses a portal to render at body level — avoids all stacking/overflow issues.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { useKundaliTheme } from "@/lib/kundali-theme-context";

interface Props {
  explanation: string;
}

export default function InsightInfoTooltip({ explanation }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pointer type of the last press — decides whether the tooltip was opened by tap.
  const lastPointerTypeRef = useRef<string>("mouse");
  const openedByTapRef = useRef(false);

  const { theme } = useKundaliTheme();
  const isVedic = theme === "vedic";

  const TOOLTIP_W = 260;

  // Calculate position based on button's viewport coordinates
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // Determine if tooltip should go below or above
    const spaceBelow = window.innerHeight - rect.bottom;
    const goBelow = spaceBelow > 160;

    const top = goBelow ? rect.bottom + 8 : rect.top - 8;

    // Horizontal: try to center on button, clamp to viewport
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(12, Math.min(window.innerWidth - TOOLTIP_W - 12, left));

    setCoords({ top, left });
  }, []);

  const openTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const closeTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  // Hover must only apply to a real mouse. Touch devices emulate
  // mouseenter → focus → click on a single tap, which would open the
  // tooltip and then immediately toggle it shut again.
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    openedByTapRef.current = false;
    openTooltip();
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTooltip();
  };

  const handleTooltipPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleTooltipPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTooltip();
  };

  // Only keyboard focus should open it — tap-focus is handled by the click.
  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    let keyboard = false;
    try {
      keyboard = e.currentTarget.matches(":focus-visible");
    } catch {
      keyboard = false;
    }
    if (!keyboard) return;
    openedByTapRef.current = false;
    openTooltip();
  };

  const handleBlur = () => {
    // A tap-opened tooltip stays put; it closes via re-tap or outside tap,
    // so scrolling its body on touch doesn't dismiss it.
    if (openedByTapRef.current) return;
    closeTooltip();
  };

  // Toggle on tap/click
  const handleClick = () => {
    if (open) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setOpen(false);
    } else {
      openedByTapRef.current = lastPointerTypeRef.current !== "mouse";
      openTooltip();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Close when scrolling OUTSIDE the tooltip (e.g. page scroll).
  // Do NOT close when the scroll originates from inside the tooltip itself.
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return; // scroll is inside the tooltip — let it scroll freely
      }
      setOpen(false);
    };
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  // Tapping/clicking anywhere outside dismisses it — on touch there is no
  // mouseleave to fall back on.
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return; // let the button toggle
      if (tooltipRef.current?.contains(target)) return; // scrolling the tooltip
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setOpen(false);
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open]);

  // Determine if tooltip goes above or below for transform-origin
  const goBelow = coords
    ? coords.top > (buttonRef.current?.getBoundingClientRect().top ?? 0)
    : true;

  return (
    <span className="inline-flex">
      <button
        ref={buttonRef}
        onClick={handleClick}
        onPointerDown={(e) => { lastPointerTypeRef.current = e.pointerType; }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="p-1 rounded-full transition-all duration-200 hover:bg-white/[0.06]"
        style={{
          color: isVedic ? "rgba(139,105,20,0.5)" : "rgba(255,255,255,0.85)",
        }}
        aria-label="How is this calculated?"
        aria-expanded={open}
        type="button"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && coords && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          onPointerEnter={handleTooltipPointerEnter}
          onPointerLeave={handleTooltipPointerLeave}
          style={{
            position: "fixed",
            zIndex: 99999,
            top: goBelow ? `${coords.top}px` : "auto",
            bottom: goBelow ? "auto" : `${window.innerHeight - coords.top}px`,
            left: `${coords.left}px`,
            width: `${TOOLTIP_W}px`,
            maxWidth: "calc(100vw - 24px)",
            // Theme
            background: isVedic ? "#FFFDF7" : "#1A0E30",
            border: isVedic ? "1.5px solid rgba(184,134,11,0.3)" : "1.5px solid rgba(200,162,255,0.2)",
            borderRadius: "12px",
            padding: "12px 14px",
            boxShadow: isVedic
              ? "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(139,105,20,0.08)"
              : "0 12px 40px rgba(0,0,0,0.7), 0 0 20px rgba(139,92,246,0.1)",
            // Animation
            animation: "tooltipFadeIn 0.15s ease-out",
          }}
        >
          <p
            style={{
              fontSize: "9px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "6px",
              fontWeight: 600,
              color: isVedic ? "rgba(139,105,20,0.7)" : "rgba(242,197,114,0.7)",
            }}
          >
            How is this calculated?
          </p>
          <p
            style={{
              fontSize: "11px",
              lineHeight: 1.55,
              color: isVedic ? "rgba(44,24,16,0.82)" : "rgba(214,198,245,0.88)",
              maxHeight: "120px",
              overflowY: "auto",
            }}
          >
            {explanation}
          </p>
        </div>,
        document.body,
      )}
    </span>
  );
}
