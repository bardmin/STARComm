import express, { type Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing"; // Required for Express integration
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { registerRoutes } from "./routes";
import { initializeFirebaseAdmin } from "./firebase"; // Import Firebase Admin initializer
import { setupVite, serveStatic, log } from "./vite";

const SENTRY_DSN_SERVER = process.env.SENTRY_SERVER_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0";

const app = express();

// Initialize Sentry for server-side
if (SENTRY_DSN_SERVER !== "https://examplePublicKey@o0.ingest.sentry.io/0") {
  Sentry.init({
    dsn: SENTRY_DSN_SERVER,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions
  });
  console.log("Sentry initialized for server-side.");
  // RequestHandler creates a separate execution context, so that all
  // transactions/spans/breadcrumbs are isolated across requests
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
} else {
  console.warn("Sentry server DSN not found or is placeholder. Sentry not initialized for server-side.");
}

// Security Headers with Helmet
// Use default Helmet configurations, which are generally good.
// Content-Security-Policy may require specific configuration based on app needs,
// so it's often configured separately or Helmet's default is used if suitable.
app.use(helmet());
console.log("Helmet security headers enabled.");

// CORS Configuration
const clientUrl = process.env.VITE_CLIENT_URL || 'http://localhost:5173'; // Default to common Vite dev port
const corsOptions = {
  origin: [clientUrl, 'https://replit.com'], // Allow Replit and configured client URL
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));
console.log(`CORS configured for origins: ${clientUrl}, https://replit.com`);


// Rate Limiting - apply before other middleware if possible, especially before route handlers
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `windowMs`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { message: "Too many requests from this IP, please try again after 15 minutes." },
  // Apply to all routes starting with /api
  // keyGenerator: (req) => req.ip, // Default, but explicit
});
app.use("/api", apiLimiter);

// Specific limiter for login - example
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per window
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes." },
  // This would ideally be applied directly to the login route in routes.ts if more granular control is needed
  // For now, if login is /api/auth/login, it will be covered by apiLimiter, then this adds further restriction
  // However, express-rate-limit applies the *first* matching limiter.
  // To make this effective, it should be applied specifically to the login route *before* the general /api limiter,
  // or the general /api limiter should exclude the login route.
  // For simplicity in this task, applying it here means it might not be as effective as intended if /api/auth/login is hit.
  // A better approach is to apply specific limiters in the routes file or before the general one.
  // I will apply it to /api/auth/login specifically for demonstration, assuming it's defined in routes.ts
});
// app.use("/api/auth/login", loginLimiter); // This will be handled in routes.ts for better placement


app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Custom logging middleware (remains)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Log API calls, but not Sentry tunnel if you use it
    if (path.startsWith("/api") && path !== '/api/sentry-tunnel') {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});


(async () => {
  // Initialize Firebase Admin SDK early in the startup sequence
  await initializeFirebaseAdmin();

  const server = await registerRoutes(app);

  // Sentry error handler must be before any other error middleware and after all controllers
  if (SENTRY_DSN_SERVER !== "https://examplePublicKey@o0.ingest.sentry.io/0") {
    app.use(Sentry.Handlers.errorHandler());
  }

  // Optional: A general error handler (keep it after Sentry's if you have both)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    // Sentry will capture this error if it hasn't been already by Sentry.Handlers.errorHandler
    // or if it's a manually thrown error that Sentry.Handlers.errorHandler doesn't catch.
    Sentry.captureException(err);
    res.status(status).json({ message });
    // It's important not to re-throw the error here if Sentry's error handler is also in use,
    // to avoid double reporting or issues with response sending.
    // If Sentry.Handlers.errorHandler is used, it might handle the response itself for Sentry events.
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
