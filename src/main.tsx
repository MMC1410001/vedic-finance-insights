import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import analytics from "./lib/analytics";
import { campaignParams, captureAttribution } from "./lib/utm";
import "./index.css";

// Before render, at module scope, deliberately — not in an App effect.
//   1. App's trackVisit("visit") must already find the stored campaign.
//   2. It rewrites the URL, so it has to run before <BrowserRouter> reads it.
//   3. No sign-in call site forwards ?utm_* into OAuth's redirectTo, so the
//      params have to be banked before any component can start that redirect.
//   4. Module scope runs once; a StrictMode effect runs twice.
captureAttribution();

// Tell GTM which campaign this load came from. Only for a tagged arrival — an
// untagged one has nothing to say, and pushing an empty object would make every
// direct visit look like a campaign event with blank dimensions.
// Needs a Custom Event trigger in GTM-K8SZDDSJ; nothing fires until that exists.
const landingCampaign = campaignParams();
if (landingCampaign) analytics(landingCampaign, "Campaign_Landing");

createRoot(document.getElementById("root")!).render(<App />);
