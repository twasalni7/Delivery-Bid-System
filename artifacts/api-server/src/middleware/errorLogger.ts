import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

export const errorLogger: ErrorRequestHandler = (err, req, _res, next) => {
  logger.error(
    {
      err,
      method: req.method,
      path: req.path,
    },
    "Request failed",
  );
  next(err);
};
