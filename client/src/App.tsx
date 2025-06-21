import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { auth as firebaseClientAuth } from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { authManager } from "./lib/auth";
import { GlobalStateUpdater } from "./components/layout/global-state-updater"; // Import new component
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null); // Track Firebase user for GlobalStateUpdater

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User is signed in to Firebase.
        // authManager.setAuth will map FirebaseUser to our app's User type and set isAuthenticated.
        // It no longer stores a custom JWT for session management.
        // The detailed profile will be loaded by the Firestore listener on the profile page or a global listener.
        authManager.setAuth(firebaseUser);
        setCurrentUser(firebaseUser); // Update local state for Firebase user
        console.log("Firebase onAuthStateChanged: User signed in.", firebaseUser?.uid);
      } else {
        if (authManager.getAuthState().isAuthenticated) {
            console.log("Firebase onAuthStateChanged: User signed out. Clearing local auth state.");
            authManager.logout();
        } else {
            console.log("Firebase onAuthStateChanged: No user, and local auth state is already clear.");
        }
        setCurrentUser(null); // Clear local Firebase user state
      }
      if (!authInitialized) {
        setAuthInitialized(true);
      }
    });

    return () => unsubscribe();
  }, [authInitialized]);

  if (!authInitialized) {
    // Optional: Show a loading spinner or splash screen while checking auth state
    return <div>Loading authentication state...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {currentUser && <GlobalStateUpdater />} {/* Render GlobalStateUpdater when user is authenticated */}
        <Router />
        <Toaster />
        {showTestButton && <SentryTestButton />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
