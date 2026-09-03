import { liquidMetalFragmentShader, ShaderMount } from "@paper-design/shaders";
import { Search } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { StarButton } from "./star-button";

interface LiquidMetalInputProps {
  placeholder?: string;
  onSubmit?: (value: string) => void;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function LiquidMetalInput({
  placeholder = "Ask the Vedic Trading Calculator...",
  onSubmit,
  ctaLabel = "Chat with AI Astrologer",
  onCtaClick,
}: LiquidMetalInputProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState("");
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const shaderRef = useRef<HTMLDivElement>(null);
  const shaderMount = useRef<any>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const height = 52;

  // Measure actual rendered width
  const measure = useCallback(() => {
    if (outerRef.current) {
      const w = Math.round(outerRef.current.getBoundingClientRect().width);
      if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
    }
  }, [measuredWidth]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (outerRef.current) ro.observe(outerRef.current);
    // Also measure after a short delay for layout settle
    const t = setTimeout(measure, 100);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [measure]);

  // Init shader — only after we have a real width
  useEffect(() => {
    if (measuredWidth === 0) return;

    const styleId = "shader-canvas-style-input";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .shader-container-input canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 100px !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Small delay so the DOM element has the correct pixel size
    const timer = setTimeout(() => {
      try {
        if (shaderRef.current) {
          if (shaderMount.current?.destroy) shaderMount.current.destroy();
          shaderMount.current = new ShaderMount(
            shaderRef.current,
            liquidMetalFragmentShader,
            { u_repetition: 4, u_softness: 0.5, u_shiftRed: 0.3, u_shiftBlue: 0.3, u_distortion: 0, u_contour: 0, u_angle: 45, u_scale: 8, u_shape: 1, u_offsetX: 0.1, u_offsetY: -0.1 },
            undefined,
            0.6,
          );
        }
      } catch (error) {
        console.error("[LiquidMetalInput] Failed to load shader:", error);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (shaderMount.current?.destroy) {
        shaderMount.current.destroy();
        shaderMount.current = null;
      }
    };
  }, [measuredWidth]);

  const handleMouseEnter = () => { setIsHovered(true); shaderMount.current?.setSpeed?.(1); };
  const handleMouseLeave = () => { setIsHovered(false); shaderMount.current?.setSpeed?.(0.6); };
  const handleFocus = () => { setIsFocused(true); shaderMount.current?.setSpeed?.(1.2); };
  const handleBlur = () => { setIsFocused(false); shaderMount.current?.setSpeed?.(0.6); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onSubmit?.(value.trim());
    }
  };

  // Use measured width for all layers, fallback to 100%
  const w = measuredWidth || 520;

  return (
    <div
      ref={outerRef}
      className="relative"
      style={{ width: "100%", maxWidth: 520, height }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {measuredWidth > 0 && (
        <div style={{ perspective: "1000px", perspectiveOrigin: "50% 50%" }}>
          <div style={{ position: "relative", width: `${w}px`, height: `${height}px`, transformStyle: "preserve-3d" }}>

            {/* Input + CTA layer — on top */}
            <div style={{
              position: "absolute", top: 0, left: 0, width: `${w}px`, height: `${height}px`,
              display: "flex", alignItems: "center", gap: "8px", padding: "0 5px 0 16px",
              transformStyle: "preserve-3d", transform: "translateZ(20px)", zIndex: 30,
            }}>
              <Search size={14} style={{ color: "#555", flexShrink: 0, filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }} />
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent border-none outline-none"
                style={{
                  fontSize: "13px",
                  color: "#999",
                  fontWeight: 400,
                  textShadow: "0px 1px 2px rgba(0,0,0,0.5)",
                  caretColor: "#666",
                }}
              />
              {/* Purple CTA inside */}
              <div className="shrink-0">
                <StarButton
                  lightColor="#a5b4fc"
                  className="!h-[40px] !text-[12px] !px-4"
                  onClick={() => {
                    if (value.trim()) {
                      onSubmit?.(value.trim());
                    } else {
                      onCtaClick?.();
                    }
                  }}
                >
                  {ctaLabel}
                </StarButton>
              </div>
            </div>

            {/* Inner dark pill */}
            <div style={{
              position: "absolute", top: 0, left: 0, width: `${w}px`, height: `${height}px`,
              transformStyle: "preserve-3d", transform: "translateZ(10px)", zIndex: 20,
            }}>
              <div style={{
                width: `${w - 6}px`, height: `${height - 6}px`, margin: "3px",
                borderRadius: "100px",
                background: "linear-gradient(180deg, #202020 0%, #000000 100%)",
                boxShadow: isFocused ? "inset 0px 2px 4px rgba(0,0,0,0.4), inset 0px 1px 2px rgba(0,0,0,0.3)" : "none",
                transition: "box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>

            {/* Shader layer — metallic border */}
            <div style={{
              position: "absolute", top: 0, left: 0, width: `${w}px`, height: `${height}px`,
              transformStyle: "preserve-3d", transform: "translateZ(0px)", zIndex: 10,
            }}>
              <div style={{
                height: `${height}px`, width: `${w}px`, borderRadius: "100px",
                boxShadow: isFocused || isHovered
                  ? "0px 0px 0px 1px rgba(0,0,0,0.4), 0px 12px 6px 0px rgba(0,0,0,0.05), 0px 8px 5px 0px rgba(0,0,0,0.1), 0px 4px 4px 0px rgba(0,0,0,0.15), 0px 1px 2px 0px rgba(0,0,0,0.2)"
                  : "0px 0px 0px 1px rgba(0,0,0,0.3), 0px 36px 14px 0px rgba(0,0,0,0.02), 0px 20px 12px 0px rgba(0,0,0,0.08), 0px 9px 9px 0px rgba(0,0,0,0.12), 0px 2px 5px 0px rgba(0,0,0,0.15)",
                transition: "box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "rgb(0 0 0 / 0)",
              }}>
                {/* Key forces full remount when width changes */}
                <div
                  key={`shader-${w}`}
                  ref={shaderRef}
                  className="shader-container-input"
                  style={{
                    borderRadius: "100px", overflow: "hidden", position: "relative",
                    width: `${w}px`, maxWidth: `${w}px`, height: `${height}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
