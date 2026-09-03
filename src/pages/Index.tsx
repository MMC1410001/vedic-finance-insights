import { useState, useCallback, useEffect } from "react";
import SplashScreen from "./SplashScreen";
import Landing from "./Landing";

/** Session-scoped flag: the splash is a first-impression, not a per-visit animation. */
const SPLASH_SEEN_KEY = "hasSeenSplash";

/**
 * Root route — renders Landing immediately with the splash overlay on top.
 * When the splash animation finishes, the overlay is removed.
 * No route change happens, so there's zero flicker.
 *
 * The splash plays once per browser session. `/` mounts this component while
 * `/home` mounts Landing bare, so every `navigate("/")` — the kundali sidebar
 * logo, the legal pages' `navigate(-1)` — used to remount and replay it.
 */
const Index = () => {
  const [showSplash, setShowSplash] = useState(
    () => sessionStorage.getItem(SPLASH_SEEN_KEY) !== "true"
  );

  // Marked seen as soon as it starts, so navigating away mid-animation still
  // counts — otherwise a quick exit would let it replay on the way back.
  useEffect(() => {
    if (showSplash) sessionStorage.setItem(SPLASH_SEEN_KEY, "true");
  }, [showSplash]);

  const handleFinish = useCallback(() => {
    sessionStorage.setItem(SPLASH_SEEN_KEY, "true");
    setShowSplash(false);
  }, []);

  return (
    <>
      <Landing />
      {showSplash && <SplashScreen onFinish={handleFinish} />}
    </>
  );
};

export default Index;
