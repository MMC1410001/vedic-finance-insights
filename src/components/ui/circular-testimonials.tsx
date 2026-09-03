import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

interface Testimonial {
  quote: string;
  name: string;
  designation: string;
  src: string;
}

interface Colors {
  name?: string;
  designation?: string;
  testimony?: string;
  arrowBackground?: string;
  arrowForeground?: string;
  arrowHoverBackground?: string;
}

interface FontSizes {
  name?: string;
  designation?: string;
  quote?: string;
}

interface FontFamilies {
  name?: string;
}

interface CircularTestimonialsProps {
  testimonials: Testimonial[];
  autoplay?: boolean;
  colors?: Colors;
  fontSizes?: FontSizes;
  fontFamilies?: FontFamilies;
}

function calculateGap(width: number) {
  const minWidth = 1024;
  const maxWidth = 1456;
  const minGap = 60;
  const maxGap = 86;

  if (width <= minWidth) return minGap;
  if (width >= maxWidth)
    return Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
  return (
    minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth))
  );
}

export const CircularTestimonials = ({
  testimonials,
  autoplay = true,
  colors = {},
  fontSizes = {},
  fontFamilies = {},
}: CircularTestimonialsProps) => {
  // Color & font config
  const colorName = colors.name ?? "#000";
  const colorDesignation = colors.designation ?? "#6b7280";
  const colorTestimony = colors.testimony ?? "#4b5563";
  const colorArrowBg = colors.arrowBackground ?? "#141414";
  const colorArrowFg = colors.arrowForeground ?? "#f1f1f7";
  const colorArrowHoverBg = colors.arrowHoverBackground ?? "#00a6fb";

  const fontSizeName = fontSizes.name ?? "1.5rem";
  const fontSizeDesignation = fontSizes.designation ?? "0.925rem";
  const fontSizeQuote = fontSizes.quote ?? "1.125rem";

  const fontFamilyName = fontFamilies.name ?? "inherit";

  // State
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const testimonialsLength = useMemo(
    () => testimonials.length,
    [testimonials]
  );
  const activeTestimonial = useMemo(
    () => testimonials[activeIndex],
    [activeIndex, testimonials]
  );

  // Responsive gap calculation
  useEffect(() => {
    function handleResize() {
      if (imageContainerRef.current) {
        setContainerWidth(imageContainerRef.current.offsetWidth);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Autoplay
  useEffect(() => {
    if (autoplay) {
      autoplayIntervalRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % testimonialsLength);
      }, 5000);
    }
    return () => {
      if (autoplayIntervalRef.current)
        clearInterval(autoplayIntervalRef.current);
    };
  }, [autoplay, testimonialsLength]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, testimonialsLength]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonialsLength);
    if (autoplayIntervalRef.current)
      clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  const handlePrev = useCallback(() => {
    setActiveIndex(
      (prev) => (prev - 1 + testimonialsLength) % testimonialsLength
    );
    if (autoplayIntervalRef.current)
      clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  // Compute transforms for each image (always show 3: left, center, right)
  function getImageStyle(index: number): React.CSSProperties {
    const gap = calculateGap(containerWidth);
    const maxStickUp = gap * 0.8;

    const isActive = index === activeIndex;
    const isLeft =
      (activeIndex - 1 + testimonialsLength) % testimonialsLength === index;
    const isRight = (activeIndex + 1) % testimonialsLength === index;

    if (isActive) {
      return {
        zIndex: 3,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(0px) translateY(0px) scale(1) rotateY(0deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isLeft) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isRight) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    // Hide all other images
    return {
      zIndex: 1,
      opacity: 0,
      pointerEvents: "none",
      transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
    };
  }

  // Framer Motion variants for quote
  const quoteVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="w-full max-w-[50rem] p-4 sm:p-6">
      <div className="grid gap-8 sm:gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
        {/* Images */}
        <div
          className="relative w-full h-52 sm:h-72 mx-auto max-w-[200px] sm:max-w-xs md:max-w-none"
          style={{ perspective: "1000px" }}
          ref={imageContainerRef}
        >
          {testimonials.map((testimonial, index) => {
            const isEmoji = testimonial.src.length <= 2;
            return isEmoji ? (
              <div
                key={`emoji-${index}`}
                className="absolute w-full h-full rounded-3xl flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
                  ...getImageStyle(index),
                }}
                data-index={index}
              >
                <span style={{ fontSize: "8rem", lineHeight: 1 }}>{testimonial.src}</span>
              </div>
            ) : (
              <div
                key={testimonial.src}
                className="absolute w-full h-full rounded-3xl"
                style={{ ...getImageStyle(index) }}
                data-index={index}
              >
                {/* Gold ring decoration */}
                <div
                  className="absolute -inset-2 rounded-[1.5rem]"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #F2C572, #FFDFA3, #C8A45D, #F2C572)",
                    opacity: 0.6,
                    filter: "blur(1px)",
                  }}
                />
                <img
                  src={testimonial.src}
                  alt={testimonial.name}
                  className="relative w-full h-full object-cover rounded-3xl"
                  style={{
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
                    border: "4px solid rgba(242, 197, 114, 0.4)",
                  }}
                loading="lazy" decoding="async" />
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={quoteVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {/* Name row with arrows on mobile */}
              <div className="flex items-center justify-between md:block">
                <div>
                  <h3
                    className="font-bold mb-1"
                    style={{
                      color: colorName,
                      fontSize: fontSizeName,
                      fontFamily: fontFamilyName,
                    }}
                  >
                    {activeTestimonial.name}
                  </h3>
                  <p
                    className="mb-4"
                    style={{
                      color: colorDesignation,
                      fontSize: fontSizeDesignation,
                    }}
                  >
                    {activeTestimonial.designation}
                  </p>
                </div>
                {/* Arrows visible only on mobile, beside the name */}
                <div className="flex gap-3 md:hidden mb-4">
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none"
                    onClick={handlePrev}
                    style={{
                      backgroundColor: hoverPrev ? colorArrowHoverBg : colorArrowBg,
                      transition: "background-color 0.3s",
                    }}
                    onMouseEnter={() => setHoverPrev(true)}
                    onMouseLeave={() => setHoverPrev(false)}
                    aria-label="Previous testimonial"
                  >
                    <FaArrowLeft size={20} color={colorArrowFg} />
                  </button>
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none"
                    onClick={handleNext}
                    style={{
                      backgroundColor: hoverNext ? colorArrowHoverBg : colorArrowBg,
                      transition: "background-color 0.3s",
                    }}
                    onMouseEnter={() => setHoverNext(true)}
                    onMouseLeave={() => setHoverNext(false)}
                    aria-label="Next testimonial"
                  >
                    <FaArrowRight size={20} color={colorArrowFg} />
                  </button>
                </div>
              </div>
              <motion.p
                className="leading-6 md:leading-7"
                style={{ color: colorTestimony, fontSize: fontSizeQuote }}
              >
                {activeTestimonial.quote.split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{
                      filter: "blur(10px)",
                      opacity: 0,
                      y: 5,
                    }}
                    animate={{
                      filter: "blur(0px)",
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      duration: 0.22,
                      ease: "easeInOut",
                      delay: 0.025 * i,
                    }}
                    style={{ display: "inline-block" }}
                  >
                    {word}&nbsp;
                  </motion.span>
                ))}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          {/* Arrows visible only on desktop, at the bottom */}
          <div className="hidden md:flex gap-4 pt-10 md:pt-6">
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none"
              onClick={handlePrev}
              style={{
                backgroundColor: hoverPrev ? colorArrowHoverBg : colorArrowBg,
                transition: "background-color 0.3s",
              }}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              aria-label="Previous testimonial"
            >
              <FaArrowLeft size={18} color={colorArrowFg} />
            </button>
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-none"
              onClick={handleNext}
              style={{
                backgroundColor: hoverNext ? colorArrowHoverBg : colorArrowBg,
                transition: "background-color 0.3s",
              }}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              aria-label="Next testimonial"
            >
              <FaArrowRight size={18} color={colorArrowFg} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularTestimonials;
