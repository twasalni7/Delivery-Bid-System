import { Request, Response, NextFunction } from "express";

export function requireAuth(role?: "client" | "driver" | "admin") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session.user ?? req.tokenUser;
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
      return;
    }
    if (role && user.role !== role) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }
    next();
  };
}
