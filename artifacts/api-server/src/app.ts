import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";

const app = express();

// إعداد Middleware بسيط مع تحديد الأنواع كـ any لتجنب أخطاء التدقيق
app.use((req: any, res: any, next: any) => {
  next();
});

const isProduction = process.env["NODE_ENV"] === "production";

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

const PgSession = connectPgSimple(session);
const SESSION_SECRET = process.env["SESSION_SECRET"] || "dev-secret";

app.use(
  session({
    store: new PgSession({
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: SESSION_SECRET,
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

export default app;
