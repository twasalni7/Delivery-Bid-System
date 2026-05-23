/**
 * Converts Arabic/Hindi numerals to English numerals
 * Ensures all numbers are displayed in English digits (0-9)
 */
export function toEnglishDigits(str: string | number): string {
  const arabicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };

  return String(str).replace(/[٠-٩]/g, (digit) => arabicMap[digit] || digit);
}

export function formatTime12h(time: string | null | undefined): string {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr ?? "0", 10);
  const minute = minuteStr ?? "00";
  const period = hour < 12 ? "ص" : "م";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const paddedHour = String(displayHour).padStart(2, "0");
  // Ensure English digits
  return toEnglishDigits(`${paddedHour}:${minute} ${period}`);
}

export const SHIFT_LABELS = ["الوردية الأولى", "الوردية الثانية", "الوردية الثالثة", "الوردية الرابعة"];

/** Converts a raw ShiftEntry list into the API-ready shifts array with labels. */
export function buildShiftsPayload(
  shifts: { goTime: string; returnTime: string }[]
): { label: string; goTime: string; returnTime?: string }[] {
  return shifts
    .filter((s) => s.goTime)
    .map((s, i) => ({
      label: SHIFT_LABELS[i] ?? `الوردية ${i + 1}`,
      goTime: s.goTime,
      returnTime: s.returnTime || undefined,
    }));
}


export function formatTime12hLong(time: string | null | undefined): string {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr ?? "0", 10);
  const minute = minuteStr ?? "00";
  const period = hour < 12 ? "صباحاً" : "مساءً";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const paddedHour = String(displayHour).padStart(2, "0");
  // Ensure English digits
  return toEnglishDigits(`${paddedHour}:${minute} ${period}`);
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${toEnglishDigits(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${toEnglishDigits(hours)} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${toEnglishDigits(days)} يوم`;
  // Use 'en' locale to get English digits in date
  return toEnglishDigits(date.toLocaleDateString("en-US"));
}
