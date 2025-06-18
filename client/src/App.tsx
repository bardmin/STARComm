import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react"; // Added useState for loading state
import * as Sentry from "@sentry/react"; // Ensure Sentry is imported
import { auth as firebaseClientAuth } from "./firebase"; // Firebase client auth instance
import { onAuthStateChanged } from "firebase/auth";
import { authManager, establishServerSession } from "./lib/auth";
// import { initGA } from "./lib/analytics";
// import { useAnalytics } from "./hooks/use-analytics";

// Pages
import Home from "@/pages/home";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Services from "@/pages/services/services";
import ServiceDetails from "@/pages/services/service-details";
import Booking from "@/pages/booking/booking";
import Wallet from "@/pages/wallet/wallet";
import Community from "@/pages/community/community";
import ProjectDetails from "@/pages/community/project-details";
import CauseDetails from "@/pages/community/cause-details";
import Messages from "@/pages/messages/messages";
import Profile from "@/pages/profile/profile";
import Admin from "@/pages/admin/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/services" component={Services} />
      <Route path="/services/:id" component={ServiceDetails} />
      <Route path="/booking/:serviceId" component={Booking} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/community" component={Community} />
      <Route path="/projects/:id" component={ProjectDetails} />
      <Route path="/causes/:id" component={CauseDetails} />
      <Route path="/messages" component={Messages} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SentryTestButton() {
  const handleTestError = () => {
    try {
      throw new Error("Sentry Client Test Error - " + new Date().toISOString());
    } catch (error) {
      Sentry.captureException(error);
      console.error("Sentry Client Test Error sent.");
    }
  };

  return (
    <button
      onClick={handleTestError}
      style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        zIndex: 1000,
        padding: '8px',
        backgroundColor: 'red',
        color: 'white'
      }}
    >
      Test Sentry Client Error
    </button>
  );
}

function App() {
  const SENTRY_DSN = process.env.VITE_SENTRY_CLIENT_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0";
  const showTestButton = SENTRY_DSN !== "https://examplePublicKey@o0.ingest.sentry.io/0";
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in to Firebase. Check if we have a custom server session.
        if (!authManager.getAuthState().isAuthenticated) {
          console.log("Firebase user detected, but no custom server session. Attempting to establish one.");
          try {
            const idToken = await firebaseUser.getIdToken();
            await establishServerSession(idToken);
            console.log("Server session established via onAuthStateChanged.");
          } catch (error) {
            console.error("Failed to establish server session via onAuthStateChanged:", error);
            // If session establishment fails, ensure Firebase user is also signed out
            // to prevent inconsistent states, or handle appropriately.
            await firebaseClientAuth.signOut();
            authManager.logout(); // Clears local custom token too
          }
        } else {
          console.log("Firebase user detected, and custom server session already exists.");
          // Optionally, verify if the Firebase UID matches the one in authManager.getAuthState().user.id
          // and handle discrepancies if necessary (e.g., by logging out the custom session).
          if (authManager.getAuthState().user?.id !== firebaseUser.uid) {
            console.warn("Mismatch between Firebase UID and custom session UID. Logging out custom session.");
            // This specific scenario (Firebase user A, custom session user B) is complex.
            // For now, prioritize Firebase state: if a Firebase user is active,
            // and it's different from our custom session, clear our custom session and try to establish new one.
            await authManager.logout(); // Logs out from firebase too + clears local
            // Re-trigger session establishment if UIDs don't match
            try {
                const idToken = await firebaseUser.getIdToken();
                await establishServerSession(idToken);
            } catch (error) {
                console.error("Re-establishing session failed after UID mismatch:", error);
                // if this fails, Firebase state is leading, local state is cleared.
            }
          }
        }
      } else {
        // User is signed out from Firebase. Ensure our custom session is also cleared.
        if (authManager.getAuthState().isAuthenticated) {
          console.log("Firebase user signed out, clearing custom server session.");
          authManager.logout(); // This will also call firebaseClientAuth.signOut() again, but it's safe.
        }
      }
      if (!authInitialized) {
        setAuthInitialized(true); // Mark auth as initialized after first check
      }
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, [authInitialized]); // Rerun if authInitialized changes, though primary trigger is onAuthStateChanged

  if (!authInitialized) {
    // Optional: Show a loading spinner or splash screen while checking auth state
    return <div>Loading authentication state...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
        {showTestButton && <SentryTestButton />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
