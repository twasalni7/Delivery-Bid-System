import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { csrfProtection } from "./middleware/csrfProtection";

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

const CORS_ORIGIN = process.env["CORS_ORIGIN"];
const corsOrigin = CORS_ORIGIN
  ? CORS_ORIGIN.split(",").map((o) => o.trim())
  : isProduction
    ? false
    : true;

if (isProduction && !CORS_ORIGIN) {
  logger.warn(
    "CORS_ORIGIN env var is not set in production. All cross-origin requests will be rejected. " +
      "Set CORS_ORIGIN to your Vercel frontend URL (e.g. https://your-app.vercel.app).",
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
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة" },
});
app.use("/api/auth/login-client", authLimiter);
app.use("/api/auth/login-driver", authLimiter);
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

app.get("/", (_req, res) => {
  res.send("Server is running");
});

app.use("/api", router);

// Global error handler — returns JSON instead of the default HTML error page
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: any, res: any, _next: any) => {
  logger.error({ err }, "Unhandled server error");
  const status = (err as any).status ?? (err as any).statusCode ?? 500;
  res.status(status).json({
    error: err?.message ?? "Internal Server Error",
    ...(isProduction ? {} : { stack: err?.stack }),
  });
});

export default app;
