import { Phone, Instagram } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import analytics from "@/lib/analytics";
import { useChatAccess } from "@/hooks/useChatAccess";

export const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openChat } = useChatAccess();

  const handleHashLink = (hash: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === "/home" || location.pathname === "/") {
      // Already on home — just scroll
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      // Navigate to home then scroll after mount
      navigate(`/home#${hash}`);
    }
  };

  return (
  <footer
    className="py-12 pb-6"
    style={{
      borderTop: "1px solid rgba(0,0,0,0.08)",
      background: "#a22c1c",
    }}
  >
    {/* Top decorative border */}
    <div
      className="h-[2px] mb-10 mx-4"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), rgba(255,255,255,0.4), rgba(255,255,255,0.2), transparent)",
      }}
    />

    <div className="container max-w-6xl mx-auto px-4">
      {/* 4-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
        {/* Brand / About */}
        <div className="flex flex-col gap-4">
          <Link to="/home" className="flex items-center gap-2">
            <span className="flex items-baseline select-none">
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.25rem", color: "#F2C572", letterSpacing: "-0.5px" }}>Astro</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "1.25rem", color: "#ffffff" }}>Fin</span>
            </span>
          </Link>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            VedicFinance is a Vedic astrology-based financial awareness platform by{" "}
            <strong style={{ color: "#ffffff" }}>
              [YOUR COMPANY]
            </strong>
            . We decode your birth chart to reveal your money personality, wealth
            cycles, and year-ahead financial forecast: written in the stars.
          </p>
        </div>

        {/* Legal Links */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#F2C572" }}
          >
            Legal
          </p>
          <Link
            to="/terms"
            onClick={() => analytics({ 'gtm.text': 'Footer_Terms&Conditions' })}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Terms &amp; Conditions
          </Link>
          <Link
            to="/privacy"
            onClick={() => analytics({ 'gtm.text': 'Footer_PrivacyPolicy' })}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Privacy Policy
          </Link>
          <Link
            to="/disclaimer"
            onClick={() => analytics({ 'gtm.text': 'Footer_Disclaimer' })}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Disclaimer
          </Link>
          <Link
            to="/refund-policy"
            onClick={() => analytics({ 'gtm.text': 'Footer_RefundPolicy' })}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Refund &amp; Cancellation Policy
          </Link>
        </div>

        {/* Company Links */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#F2C572" }}
          >
            Company
          </p>
          <Link
            to="/services"
            onClick={() => analytics({ 'gtm.text': 'Footer_Services' })}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Services
          </Link>
          <a
            href="/home#how"
            onClick={(e) => {
              analytics({ 'gtm.text': 'Footer_HowItWorks' });
              handleHashLink("how")(e);
            }}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            How It Works
          </a>
          <a
            href="/home#faq"
            onClick={(e) => {
              analytics({ 'gtm.text': 'Footer_FAQ' });
              handleHashLink("faq")(e);
            }}
            className="text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            FAQ
          </a>
          {/* Not a bare <Link to="/ai-chat"> — that let anonymous visitors get
              silently bounced to /home by the route guard. */}
          <button
            onClick={() => {
              analytics({ 'gtm.text': 'Footer_AIAstrologer' });
              openChat();
            }}
            className="text-sm text-left transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            AI Astrologer
          </button>
        </div>

        {/* Contact / Social */}
        <div className="flex flex-col gap-3">
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#F2C572" }}
          >
            Find Us On
          </p>
          <a
            href="https://www.instagram.com/vedicfinance.ai"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => analytics({ 'gtm.text': 'Footer_Instagram' })}
            className="flex items-center gap-2.5 text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              }}
            >
              <Instagram className="w-3.5 h-3.5 text-white" />
            </div>
            @vedicfinance.ai
          </a>
          <a
            href="tel:+917977425013"
            onClick={() => analytics({ 'gtm.text': 'Footer_Phone' })}
            className="flex items-center gap-2.5 text-sm transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Phone className="w-3.5 h-3.5" style={{ color: "#F2C572" }} />
            </div>
            +91 79774 25013
          </a>
        </div>
      </div>

      {/* Divider + bottom */}
      <div
        className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
      >
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          © 2026 [YOUR COMPANY]. All rights reserved.
        </p>
        <p
          className="text-xs font-medium"
          style={{
            color: "#F2C572",
            fontFamily: "serif",
            fontStyle: "italic",
          }}
        >
          सर्वे भवन्तु सुखिनः May all be prosperous and happy ✦
        </p>
      </div>
    </div>
  </footer>
  );
};
