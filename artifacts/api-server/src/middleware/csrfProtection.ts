import { Request, Response, NextFunction } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF protection via Origin-header validation.
 *
 * For mutating requests (POST/PUT/PATCH/DELETE) this middleware checks that
 * the Origin (or Referer) header, when present, matches one of the configured
 * CORS_ORIGIN values. Requests without an Origin/Referer header are allowed
 * (server-to-server or same-origin scenarios).
 *
 * This guards against cross-site request forgery when sameSite=none cookies
 * are used for cross-origin credential sharing.
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const isProduction = process.env["NODE_ENV"] === "production";
  if (!isProduction) {
    next();
    return;
  }

  const KNOWN_ORIGINS = ["https://sharq.it.com", "https://www.sharq.it.com"];
  const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "";
  const envOrigins = CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  const allowedOrigins = [...new Set([...KNOWN_ORIGINS, ...envOrigins])];

  const originHeader = req.headers["origin"] as string | undefined;
  const refererHeader = req.headers["referer"] as string | undefined;

  // No Origin/Referer = server-to-server or same-origin; allow
  if (!originHeader && !refererHeader) {
    next();
    return;
  }

  let requestOrigin = originHeader;
  if (!requestOrigin && refererHeader) {
    try {
      requestOrigin = new URL(refererHeader).origin;
    } catch {
      // Malformed Referer — treat as unknown and block
      requestOrigin = "";
    }
  }

  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    res.status(403).json({ error: "طلب غير مصرح به" });
    return;
  }

  next();
}
