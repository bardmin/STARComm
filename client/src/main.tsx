import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

// Initialize Sentry for client-side error logging and performance monitoring
const SENTRY_DSN = import.meta.env.VITE_SENTRY_CLIENT_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0";

if (SENTRY_DSN !== "https://examplePublicKey@o0.ingest.sentry.io/0") {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      new BrowserTracing(),
      // Add Replay integration if needed later: new Sentry.Replay()
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
    // Session Replay
    replaysSessionSampleRate: 0.1, // This percentage of sessions will be recorded
    replaysOnErrorSampleRate: 1.0, // If an error happens while a session is being recorded, send it
  });
  console.log("Sentry initialized for client-side.");
} else {
  console.warn("Sentry client DSN not found or is placeholder. Sentry not initialized for client-side.");
}

createRoot(document.getElementById("root")!).render(<App />);