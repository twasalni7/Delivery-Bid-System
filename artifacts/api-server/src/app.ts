import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
// Vercel Speed Insights - uncomment the line below if serving HTML pages
// import { speedInsightsMiddleware } from "./lib/speed-insights";

const app = express();

// إعداد Middleware بسيط مع تحديد الأنواع كـ any لتجنب أخطاء التدقيق
app.use((req: any, res: any, next: any) => {
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel Speed Insights - uncomment if serving HTML pages
// app.use(speedInsightsMiddleware);

app.set("trust proxy", 1);

const PgSession = connectPgSimple(session);
const SESSION_SECRET = process.env["SESSION_SECRET"] || "dev-secret";
const isProduction = process.env["NODE_ENV"] === "production";

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
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api", router);

export default app;
