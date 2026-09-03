/**
 * Palette for the static document pages (/terms, /privacy, /disclaimer,
 * /refund-policy, /services) and the standalone /boost-wealth and /coming-soon
 * screens.
 *
 * These pages deliberately use explicit hex values rather than the semantic
 * Tailwind tokens (`bg-background`, `text-foreground`, `bg-card`, …): every CSS
 * variable in index.css resolves to the dark app palette, so those classes would
 * render near-black here. The values below mirror the landing page
 * (Landing.tsx / Hero.tsx) so a footer link lands on a visually continuous page.
 */
export const legalColors = {
  /** Page background — same as Landing.tsx */
  pageBg: "#ffffff",
  /** Soft gold wash, matching the Testimonials/FAQ sections */
  wash:
    "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(242,197,114,0.08) 0%, transparent 70%)",
  /** Headings and emphasised inline text */
  ink: "#1A0A2E",
  /** Section headings, links and the Back control */
  accent: "#a22c1c",
  /** Body copy */
  body: "#4A3F5C",
  /** Timestamps and secondary copy */
  muted: "#6B5C7A",
  /** Card surface recipe, matching the landing cards */
  cardBg: "#ffffff",
  cardBorder: "1px solid rgba(0,0,0,0.08)",
  cardShadow: "0 2px 16px rgba(0,0,0,0.06)",
} as const;

/** Shared style for a section heading inside a document page. */
export const legalHeadingStyle = { color: legalColors.accent } as const;

/** Shared style for an inline link inside a document page. */
export const legalLinkStyle = { color: legalColors.accent } as const;
