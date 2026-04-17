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
