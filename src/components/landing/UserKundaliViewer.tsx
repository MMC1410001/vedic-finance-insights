/**
 * UserKundaliViewer — Embeds the authenticated user's actual /kundali page
 * in a scrollable iframe, shown on the landing page hero when logged in.
 * Replaces SampleKundaliViewer for paid users.
 */

import { useRef, useState } from "react";

const ViewerSpinner = () => (
  <div className="flex items-center justify-center h-full">
    <div
      className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: "rgba(184,134,11,0.45)", borderTopColor: "transparent" }}
    />
  </div>
);

export function UserKundaliViewer() {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div
      className="relative rounded-2xl overflow-hidden w-full"
      style={{
        background: "#ffffff",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        height: "clamp(320px, 55vw, 420px)",
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-10">
          <ViewerSpinner />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/kundali?embed=true"
        title="Your Financial Kundali"
        className="w-full h-full border-0"
        style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s ease" }}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
