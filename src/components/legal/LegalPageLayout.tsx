import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { legalColors } from "./legal-theme";

interface LegalPageLayoutProps {
  title: string;
  /** Rendered under the title, e.g. "Last updated: June 15, 2026" */
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for the static document pages (/terms, /privacy, /disclaimer,
 * /refund-policy, /services) — white background, Back control, title block.
 * Colours come from `legal-theme.ts`; see the note there on why these pages
 * avoid the semantic Tailwind tokens.
 */
const LegalPageLayout = ({ title, subtitle, children }: LegalPageLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen" style={{ background: legalColors.pageBg }}>
      {/* Subtle wash — decorative only */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ backgroundImage: legalColors.wash }}
      />

      <div className="relative z-10 container max-w-3xl mx-auto px-4 py-12">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-8 text-sm transition-opacity hover:opacity-70"
          style={{ color: legalColors.accent }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Title */}
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: legalColors.ink, fontFamily: "'Playfair Display', serif" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mb-10" style={{ color: legalColors.muted }}>
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
};

/** Wrapper for the body of a document page — sets the shared copy colour. */
export const LegalBody = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-8 text-sm leading-relaxed" style={{ color: legalColors.body }}>
    {children}
  </div>
);

export default LegalPageLayout;
