import LegalPageLayout, { LegalBody } from "@/components/legal/LegalPageLayout";
import { legalHeadingStyle, legalLinkStyle } from "@/components/legal/legal-theme";

const RefundPolicy = () => {
  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      subtitle="Last updated: June 15, 2026"
    >
      <LegalBody>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              1. Digital Service Nature
            </h2>
            <p>
              VedicFinance provides digital astrological reports and AI-powered
              consultations. Once a Financial Kundali report is generated and
              delivered, the service is considered fully rendered as the
              computational and astrological analysis has been completed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              2. Refund Eligibility
            </h2>
            <p className="mb-3">
              Refunds may be considered in the following cases:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Payment was charged but no report was generated due to a
                technical error
              </li>
              <li>Duplicate payment was processed</li>
              <li>
                Service was significantly different from what was described at
                the time of purchase
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              3. Non-Refundable Cases
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Report was successfully generated and delivered to your account
              </li>
              <li>
                Dissatisfaction with astrological predictions or interpretations
              </li>
              <li>Incorrect birth details provided by the user</li>
              <li>Request made after 7 days of purchase</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              4. How to Request a Refund
            </h2>
            <p className="mb-3">To request a refund:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Email us at{" "}
                <a
                  href="mailto:support@vedicfinance.ai"
                  className="underline hover:opacity-70 transition-opacity"
                  style={legalLinkStyle}
                >
                  support@vedicfinance.ai
                </a>{" "}
                with your transaction details
              </li>
              <li>Include your registered email and payment receipt</li>
              <li>Describe the issue clearly</li>
            </ul>
            <p className="mt-3">
              We will review your request within 5-7 business days and respond
              with our decision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              5. Cancellation
            </h2>
            <p>
              VedicFinance currently operates on a one-time payment model. There are
              no recurring subscriptions to cancel. If we introduce subscription
              plans in the future, cancellation terms will be updated
              accordingly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              6. Processing Time
            </h2>
            <p>
              Approved refunds will be processed within 7-10 business days. The
              amount will be credited back to the original payment method used
              during the transaction.
            </p>
          </section>
      </LegalBody>
    </LegalPageLayout>
  );
};

export default RefundPolicy;
