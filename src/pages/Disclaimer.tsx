import LegalPageLayout, { LegalBody } from "@/components/legal/LegalPageLayout";
import { legalHeadingStyle } from "@/components/legal/legal-theme";

const Disclaimer = () => {
  return (
    <LegalPageLayout title="Disclaimer" subtitle="Last updated: June 15, 2026">
      <LegalBody>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              1. For Educational &amp; Entertainment Purposes Only
            </h2>
            <p>
              VedicFinance provides astrological insights based on Vedic astrology principles for
              educational and entertainment purposes only. The information on this platform should
              not be construed as professional financial advice, investment recommendations, or
              trading signals.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              2. Not Financial Advice
            </h2>
            <p>
              Nothing on this platform constitutes financial advice. VedicFinance does not recommend
              buying, selling, or holding any financial instruments. Always consult a SEBI-registered
              financial advisor or qualified professional before making any investment decisions. Past
              astrological patterns do not guarantee future financial outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              3. Accuracy of Information
            </h2>
            <p>
              While we strive to provide accurate astrological calculations based on your birth
              details, we cannot guarantee the absolute accuracy or completeness of any astrological
              interpretation. Astrological insights are subjective and should be considered as one of
              many perspectives.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              4. No Liability
            </h2>
            <p>
              [YOUR COMPANY] and VedicFinance shall not be held liable for any financial
              losses, damages, or adverse outcomes resulting from decisions made based on the
              astrological insights provided on this platform. Users assume full responsibility for
              their financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              5. AI-Generated Content
            </h2>
            <p>
              Our AI Astrologer feature uses artificial intelligence to generate responses. While
              trained on Vedic astrology principles, AI-generated content may contain
              inaccuracies and should not be relied upon as the sole basis for any decision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              6. Third-Party Links
            </h2>
            <p>
              Our platform may contain links to third-party websites. We are not responsible for the
              content, accuracy, or practices of any third-party sites. Visiting external links is at
              your own risk.
            </p>
          </section>
      </LegalBody>
    </LegalPageLayout>
  );
};

export default Disclaimer;
