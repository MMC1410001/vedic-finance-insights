import LegalPageLayout, { LegalBody } from "@/components/legal/LegalPageLayout";
import { legalHeadingStyle, legalLinkStyle } from "@/components/legal/legal-theme";

const Terms = () => {
  return (
    <LegalPageLayout title="Terms & Conditions" subtitle="Last updated: June 15, 2026">
      <LegalBody>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using the VedicFinance platform ("Service"), you acknowledge that you have
              read, understood, and agree to be bound by these Terms &amp; Conditions. If you do not
              agree with any part of these terms, you must not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              2. Description of Service
            </h2>
            <p>
              VedicFinance provides Vedic astrology-based financial awareness insights, including but not
              limited to Financial Kundali reports, AI-powered astrological consultations, and
              personalized wealth cycle forecasts. Our Service is intended for educational and
              entertainment purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              3. User Accounts
            </h2>
            <p className="mb-3">
              To access certain features, you must create an account by providing accurate birth
              details and personal information. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete birth information for report generation</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              4. Payment Terms
            </h2>
            <p>
              Paid features are available upon one-time payment as displayed at the time of purchase.
              All payments are processed securely through our payment partners. By making a payment,
              you agree to the pricing and payment terms presented during checkout.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              5. Intellectual Property
            </h2>
            <p>
              All content on the VedicFinance platform, including text, graphics, logos, reports, and
              software, is the property of [YOUR COMPANY] and is protected by
              intellectual property laws. You may not reproduce, distribute, or create derivative
              works without our express written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              6. Limitation of Liability
            </h2>
            <p>
              VedicFinance and [YOUR COMPANY] shall not be liable for any financial
              decisions made based on the astrological insights provided. Our Service does not
              constitute financial advice, and users should consult qualified financial advisors
              before making investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              7. Governing Law
            </h2>
            <p>
              These terms shall be governed by and construed in accordance with the laws of India.
              Any disputes arising from the use of our Service shall be subject to the exclusive
              jurisdiction of the courts in Mumbai, Maharashtra.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              8. Contact Us
            </h2>
            <p>
              For any questions regarding these Terms &amp; Conditions, please reach out to us at{" "}
              <a
                href="mailto:support@vedicfinance.ai"
                className="underline hover:opacity-70 transition-opacity"
                style={legalLinkStyle}
              >
                support@vedicfinance.ai
              </a>
            </p>
          </section>
      </LegalBody>
    </LegalPageLayout>
  );
};

export default Terms;
