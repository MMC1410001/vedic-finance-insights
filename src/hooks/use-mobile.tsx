import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Subscribe to a media query.
 *
 * Exists so components can avoid *mounting* the branch they are not showing,
 * rather than mounting both and hiding one with CSS. That distinction matters
 * for anything JS-driven: `display: none` pauses CSS animations, but it does
 * not stop a framer-motion frame loop or a Lottie canvas player, so a hidden
 * duplicate keeps burning frames for the whole session.
 *
 * The initial value is read synchronously in a lazy initialiser rather than
 * defaulting to false, so the FIRST paint is already correct. Starting at false
 * meant every consumer rendered its desktop branch for one frame and then swapped
 * — visible on the landing hero, where the horoscope wheel painted at 900x900 and
 * jumped to 500x500 on a phone. The CSS-class version it replaced had no such
 * flash, so the JS version has to earn its place.
 *
 * Safe because this is a client-only SPA: index.html is an empty shell and both
 * deploy targets rewrite every route to it, so there is no SSR pass and no
 * hydration mismatch to guard against. Falls back to false where matchMedia is
 * unavailable (jsdom without a stub, very old browsers).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  React.useEffect(() => {
    // Guarded to match the initialiser above. Without it the fallback there is a
    // lie: the hook would return false for one frame and then throw in the effect.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
