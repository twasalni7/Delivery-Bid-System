import { Router, Response } from "express";

/**
 * Middleware تضمن أن كل response JSON صحيح دائماً
 * يحل مشكلة: Unexpected end of JSON input
 */

export function jsonResponseMiddleware(req: any, res: Response, next: any) {
  // احفظ الـ original res.json
  const originalJson = res.json.bind(res);

  // استبدل بـ version آمنة
  res.json = function (data: any) {
    try {
      // تأكد من أن البيانات قابلة للـ JSON.stringify
      const jsonString = JSON.stringify(data);
      
      // أرسل الـ response بشكل صريح
      return res
        .type("application/json")
        .send(jsonString);
    } catch (err) {
      console.error("❌ JSON stringify failed:", err);
      
      // إذا فشل، أرسل رسالة خطأ بسيطة جداً
      return res
        .status(500)
        .type("application/json")
        .send(JSON.stringify({
          error: "Failed to process response",
          status: 500
        }));
    }
  };

  next();
}

/**
 * Middleware لمعالجة أخطاء 500 وتأكد من أنها JSON صحيحة
 */
export function errorHandlerMiddleware(
  err: any,
  req: any,
  res: Response,
  next: any
) {
  console.error("❌ Error:", err);

  const statusCode = err.status || 500;
  const message = err.message || "Internal Server Error";

  // تأكد من أن الـ error response JSON صحيح
  try {
    const errorResponse = JSON.stringify({
      error: message,
      status: statusCode,
      timestamp: new Date().toISOString()
    });

    res
      .status(statusCode)
      .type("application/json")
      .send(errorResponse);
  } catch (e) {
    // في حالة الطوارئ
    res
      .status(500)
      .type("application/json")
      .send('{"error":"Internal error"}');
  }
}
