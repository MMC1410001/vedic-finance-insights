import LegalPageLayout, { LegalBody } from "@/components/legal/LegalPageLayout";
import {
  legalColors,
  legalHeadingStyle,
  legalLinkStyle,
} from "@/components/legal/legal-theme";

const Privacy = () => {
  return (
    <LegalPageLayout title="Privacy Policy" subtitle="Last updated: August 26, 2026">
      <LegalBody>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              1. Information We Collect
            </h2>
            <p className="mb-3">
              We collect information you provide directly when using VedicFinance:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong style={{ color: legalColors.ink }}>Personal Information:</strong> Name, email
                address, phone number
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Birth Details:</strong> Date of birth, time of
                birth, place of birth (required for Kundali generation)
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Payment Information:</strong> Transaction
                details (processed securely via third-party payment gateways)
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Usage Data:</strong> Pages visited, features
                used, device information
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Technical Data:</strong> IP address, browser
                and device type, and referring page. This is recorded automatically for every visit,
                including visits made without an account, and is retained for 180 days before deletion.
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Interaction Data:</strong> Which pages you
                open and in what order, which buttons and links you click, the position of a click on
                the page, and how long a visit lasts. We record this ourselves, in our own database,
                rather than only through third-party analytics. It is tied to a temporary browser
                session identifier &mdash; not to your name or email unless you are signed in.
                Interaction records are kept for 180 days, and click positions for 30 days, before
                deletion.
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Approximate Location:</strong> We
                derive an approximate city and region from your IP address, using
                ipinfo.io as a processor, falling back to ipwho.is if that lookup fails.
                Your address is sent to whichever of them answers, and the result is
                cached so the same address is not looked up repeatedly. Where neither can
                be reached we fall back to the country your network already reports to us,
                which involves no third party at all. The
                result is approximate by nature &mdash; mobile networks route many people
                through one exchange, so it often indicates a regional hub rather than
                where you are. We do not use it to identify you.
              </li>
              <li>
                <strong style={{ color: legalColors.ink }}>Campaign Data:</strong> If you reach us
                from a marketing link, we record the campaign parameters carried in that link &mdash;
                which platform it was shared on, what kind of placement it was, and the name of the
                campaign. These describe the advert or message, never you. Where a link contains
                anything resembling personal information, that value is discarded rather than stored.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To generate personalized Financial Kundali reports</li>
              <li>To provide AI-powered astrological insights</li>
              <li>To process payments and manage your account</li>
              <li>To send important service updates and notifications</li>
              <li>To improve our platform and user experience</li>
              <li>
                To keep the service secure and available &mdash; we use IP address and device
                information to detect abuse, prevent fraud, limit automated requests, and investigate
                support issues
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              3. Data Storage &amp; Security
            </h2>
            <p>
              Your data is stored securely using industry-standard encryption and security measures.
              We use Supabase for database management with row-level security policies, and
              ipinfo.io — or ipwho.is, should the first be unavailable — to turn an IP
              address into an approximate city. Birth details
              and Kundali reports are encrypted at rest, and are never sent to either. We do not sell or share your personal data
              with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              4. Third-Party Services
            </h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Payment processing (for secure transactions)</li>
              <li>Analytics (to improve our platform)</li>
              <li>AI language models (for astrological chat insights)</li>
            </ul>
            <p className="mt-3">
              Each third-party service has its own privacy policy governing the use of your
              information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              5. Your Rights
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Access and view your personal data</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of marketing communications</li>
              <li>Export your Kundali reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              6. Cookies
            </h2>
            <p>
              We use essential cookies to maintain your session and preferences. We do not use
              tracking cookies for advertising purposes. You can manage cookie preferences through
              your browser settings.
            </p>
            <p className="mt-3">
              Our own analytics do not use cookies at all. They rely on a session identifier held in
              your browser&rsquo;s session storage, which is discarded when you close the tab, plus a
              randomly generated device identifier and the campaign parameters of the link you first
              arrived through, held in your browser&rsquo;s local storage so that a visit continued on
              a later day is still counted once rather than twice. Neither contains your name, your
              email, nor any identifier shared with another website. We also use Google Analytics and
              Microsoft Clarity, which set their own cookies and are covered by their respective
              privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={legalHeadingStyle}>
              7. Contact Us
            </h2>
            <p>
              For privacy-related queries or data requests, contact us at{" "}
              <a
                href="mailto:privacy@vedicfinance.ai"
                className="underline hover:opacity-70 transition-opacity"
                style={legalLinkStyle}
              >
                privacy@vedicfinance.ai
              </a>
            </p>
          </section>
      </LegalBody>
    </LegalPageLayout>
  );
};

export default Privacy;
