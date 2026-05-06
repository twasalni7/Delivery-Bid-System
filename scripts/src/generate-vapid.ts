/**
 * generate-vapid.ts
 *
 * Generates a fresh VAPID key pair for Web Push using Node's built-in
 * crypto module (no external dependencies required).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run generate-vapid
 *
 * Output: ready-to-paste .env lines for VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 *
 * Keys follow the format expected by the `web-push` npm package:
 *   - Public key  : uncompressed EC point (65 bytes) encoded as URL-safe base64
 *   - Private key : raw 32-byte scalar encoded as URL-safe base64
 */
import { createECDH } from "node:crypto";

const curve = createECDH("prime256v1");
curve.generateKeys();

/** Encode a Buffer as URL-safe base64 (no padding). */
function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

const vapidPublicKey  = toBase64Url(curve.getPublicKey());
const vapidPrivateKey = toBase64Url(curve.getPrivateKey());

console.log("# ── VAPID Keys ─────────────────────────────────────────────────");
console.log("# Add these to your .env file (keep the private key secret!)");
console.log("#");
console.log(`VAPID_PUBLIC_KEY=${vapidPublicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidPrivateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@twasalni.app");
console.log("#");
console.log("# Also copy VAPID_PUBLIC_KEY to your frontend .env as:");
console.log(`# VITE_VAPID_PUBLIC_KEY=${vapidPublicKey}`);
