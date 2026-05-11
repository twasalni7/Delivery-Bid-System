import { type RequestHandler } from "express";

/**
 * Security headers middleware
 *
 * Adds Content Security Policy and other security headers to prevent:
 * - XSS attacks via inline scripts
 * - Clickjacking
 * - MIME type sniffing
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  // Content Security Policy - prevents inline scripts and unsafe content
  // img-src 'self' data: blob: - allows images from same origin, data URLs, and blob URLs
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "img-src 'self' data: blob: https:; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS filter in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
};
