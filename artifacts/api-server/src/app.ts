import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { csrfProtection } from "./middleware/csrfProtection";
import { resolveTokenUser } from "./middleware/resolveTokenUser";

const app = express();

const isProduction = process.env["NODE_ENV"] === "production";

// ─── SESSION_SECRET validation ─────────────────────────────────────────────
const SESSION_SECRET = process.env["SESSION_SECRET"];
if (!SESSION_SECRET) {
  logger.warn(
    "SESSION_SECRET is not set. Using insecure default — set it before deploying to production."
  );
}
const resolvedSessionSecret = SESSION_SECRET || "dev-secret-do-not-use-in-production";

// Known allowed frontend origins (always permitted regardless of env config)
const KNOWN_ORIGINS = ["https://sharq.it.com", "https://www.sharq.it.com"];

const CORS_ORIGIN = process.env["CORS_ORIGIN"];
const envOrigins = CORS_ORIGIN
  ? CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const allAllowedOrigins = [...new Set([...KNOWN_ORIGINS, ...envOrigins])];

const corsOrigin = isProduction
  ? allAllowedOrigins
  : true;

if (isProduction && envOrigins.length === 0) {
  logger.warn(
    "CORS_ORIGIN env var is not set. Using built-in allowed origins: " +
      KNOWN_ORIGINS.join(", "),
  );
}

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

// ─── CSRF protection ───────────────────────────────────────────────────────
app.use(csrfProtection);

// ─── Rate limiting for auth endpoints ─────────────────────────────────────
// Increased limits to accommodate multiple users from same network/IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased from 5 to 50 to allow multiple simultaneous logins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة" },
});

// Very lenient rate limiter for driver login (1000 requests per 15 minutes)
// This protects against DoS while allowing many simultaneous driver logins
const driverAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Very high limit to effectively allow unlimited access
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة" },
});

app.use("/api/auth/login-client", authLimiter);
app.use("/api/auth/login-driver", driverAuthLimiter);
app.use("/api/auth/login-admin", authLimiter);
app.use("/api/auth/register-client", authLimiter);

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: resolvedSessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(resolveTokenUser);

app.get("/", (_req, res) => {
  res.send("Server is running");
});

app.use("/api", router);

// Global error handler — returns JSON instead of the default HTML error page
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err }, "Unhandled server error");
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { status?: number; statusCode?: number }).statusCode
    ?? 500;
  res.status(status).json({
    error: (err as Error)?.message ?? "Internal Server Error",
    ...(isProduction ? {} : { stack: (err as Error)?.stack }),
  });
};
app.use(globalErrorHandler);

export default app;
