import type { RequestHandler } from "express";

const CONFIRM_HEADER = "x-hard-delete-confirmation";
const CONFIRM_VALUE = "I_UNDERSTAND_DATA_DELETION";

const isProduction = process.env["NODE_ENV"] === "production";

/**
 * Production safety guard for destructive hard-delete endpoints.
 * In production, hard delete is blocked unless explicitly enabled AND confirmed.
 */
export const requireHardDeleteApproval: RequestHandler = (req, res, next) => {
  if (!isProduction) {
    next();
    return;
  }

  const hardDeleteEnabled = process.env["ENABLE_PRODUCTION_HARD_DELETE"] === "true";
  if (!hardDeleteEnabled) {
    res.status(403).json({
      error:
        "الحذف النهائي معطّل في بيئة الإنتاج. استخدم تعطيل/أرشفة السجل أو فعّل ENABLE_PRODUCTION_HARD_DELETE=true مؤقتاً.",
    });
    return;
  }

  const confirmation = req.header(CONFIRM_HEADER);
  if (confirmation !== CONFIRM_VALUE) {
    res.status(400).json({
      error: `تأكيد الحذف النهائي مطلوب عبر الهيدر ${CONFIRM_HEADER}.`,
      requiredValue: CONFIRM_VALUE,
    });
    return;
  }

  next();
};
