/** Returns true when running on an Android device. */
function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/**
 * Normalize a mobile number to the international format used by WhatsApp (e.g. "966xxxxxxxxx").
 * Accepts local Saudi format "05xxxxxxxxx", international "966xxxxxxxxx" (12 digits: country
 * code 966 + 9-digit number), or "+966xxxxxxxxx".
 */
export function toWhatsAppNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  // 966 (3) + 9-digit local number = 12 digits total
  if (digits.startsWith("966") && digits.length >= 12) return digits;
  if (digits.startsWith("05") && digits.length === 10) return "966" + digits.slice(1);
  if (digits.startsWith("5") && digits.length === 9) return "966" + digits;
  return digits;
}

/**
 * Build the best WhatsApp URL for the current platform.
 * On Android: returns an intent URL that opens WhatsApp Business (com.whatsapp.w4b) if
 * installed, with an automatic fallback to wa.me (regular WhatsApp) if not installed.
 * On all other platforms: returns a direct wa.me URL.
 *
 * @param phone - phone number in any recognized Saudi format (local or international)
 * @param message - optional pre-filled message text
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const wa = toWhatsAppNumber(phone);
  const encodedMsg = message ? encodeURIComponent(message) : "";
  const waFallback = message
    ? `https://wa.me/${wa}?text=${encodedMsg}`
    : `https://wa.me/${wa}`;

  if (isAndroid()) {
    const intentPath = message ? `send?phone=${wa}&text=${encodedMsg}` : `send?phone=${wa}`;
    return (
      `intent://${intentPath}` +
      `#Intent;package=com.whatsapp.w4b;scheme=whatsapp;` +
      `S.browser_fallback_url=${encodeURIComponent(waFallback)};end`
    );
  }

  return waFallback;
}

/**
 * Open WhatsApp (Business preferred on Android, regular WhatsApp elsewhere).
 * Triggered directly from user interaction so popup blockers will not interfere.
 */
export function openWhatsApp(phone: string, message?: string): void {
  const url = buildWhatsAppUrl(phone, message);
  // On Android the intent URL must replace the current location so the system can
  // dispatch it to the installed app; on all other platforms open a new tab.
  if (isAndroid()) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
