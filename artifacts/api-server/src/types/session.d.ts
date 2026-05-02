import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      role: "client" | "driver" | "admin";
      name: string;
    };
  }
}

// Extend the Express Request type with a property for token-based auth.
// resolveTokenUser sets this without touching the session, preventing
// unnecessary DB writes to user_sessions on every token-authenticated request.
declare global {
  namespace Express {
    interface Request {
      tokenUser?: {
        id: number;
        role: "client" | "driver" | "admin";
        name: string;
      };
    }
  }
}
