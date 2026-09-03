import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { trackVisit } from "@/lib/visitor-tracking";
import { RouteTracker } from "@/components/RouteTracker";
import ProtectedRoute from "./components/ProtectedRoute";
import PaidRoute from "./components/PaidRoute";
import AdminRoute from "./components/AdminRoute";
import FloatingAstrologerChat from "./components/FloatingAstrologerChat";

// Eagerly loaded — landing page must be fast
import Index from "./pages/Index";
import Landing from "./pages/Landing";

// Lazy loaded — only fetched when the user navigates to these routes
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Payment = lazy(() => import("./pages/Payment"));
const HomeNew = lazy(() => import("./pages/HomeNew"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const BoostWealth = lazy(() => import("./pages/BoostWealth"));
const UpcomingFeatures = lazy(() => import("./pages/UpcomingFeatures"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Services = lazy(() => import("./pages/Services"));
const FinancialKundali = lazy(() => import("./pages/FinancialKundali"));
const KundaliAuthPage = lazy(() => import("./pages/KundaliAuthPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const Profile = lazy(() => import("./pages/Profile"));
const SharedKundali = lazy(() => import("./pages/SharedKundali"));
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const App = () => {
  // One row per page load, recording the IP the request arrives from. The ref
  // guard keeps StrictMode's double-invoke in dev from writing two rows.
  const visitTracked = useRef(false);
  useEffect(() => {
    if (visitTracked.current) return;
    visitTracked.current = true;
    trackVisit("visit");
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Inside the router because it reads useLocation(); renders nothing. */}
        <RouteTracker />
        <AuthProvider>
          <Suspense fallback={null}>
          <Routes>
            {/* Splash → Home */}
            <Route path="/" element={<Index />} />

            {/* Home — alias so /home still works (navbar, bookmarks, etc.) */}
            <Route path="/home" element={<Landing />} />
            <Route path="/app" element={<Navigate to="/" replace />} />

            {/* Auth — sign in + birth details */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Payment — requires auth + onboarding (birth details filled) */}
            {/* Unguarded on purpose: anonymous visitors must be able to see the
                ₹99 offer. Payment itself still requires an account — the Pay
                button starts Google sign-in when there is no session. */}
            <Route path="/payment" element={<Payment />} />

            {/* Dashboard — post-payment kundli dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><HomeNew /></ProtectedRoute>} />

            {/* Kundali — accessible without auth (birth details collected on entry) */}
            <Route path="/kundali" element={<FinancialKundali />} />

            {/* Kundali Auth — Google sign-in page for locked kundali features */}
            <Route path="/kundali-auth" element={<KundaliAuthPage />} />

            {/* Coming Soon — generic placeholder page */}
            <Route path="/coming-soon" element={<ComingSoon />} />

            {/* Boost Your Wealth — remedies coming soon */}
            <Route path="/boost-wealth" element={<BoostWealth />} />

            {/* Upcoming Features — Life Path, Legacy & Awareness preview */}
            <Route path="/upcoming-features" element={<ProtectedRoute><UpcomingFeatures /></ProtectedRoute>} />

            {/* Feature routes (protected) */}
            <Route
              path="/business-timing"
              element={
                <ProtectedRoute>
                  <ComingSoon />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vedic-trading"
              element={
                <ProtectedRoute>
                  <ComingSoon />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ComingSoon />
                </ProtectedRoute>
              }
            />

            {/* AI Astrologer — requires payment */}
            <Route path="/ai-chat" element={<PaidRoute><AIChatPage /></PaidRoute>} />

            {/* Profile — user info + kundali history */}
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Shared Kundali — public view via slug */}
            <Route path="/shared/:slug" element={<SharedKundali />} />

            {/* Admin Panel */}
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

            {/* Legal & Info Pages */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/services" element={<Services />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <FloatingAstrologerChat />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
