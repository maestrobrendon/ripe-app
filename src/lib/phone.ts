/*
 * Phone numbers, the way Nigerians type them: "0803 123 4567", "803-123-4567",
 * "2348031234567" or "+234 803 123 4567" are one number. We store it once, as
 * +234XXXXXXXXXX, so sign-in, riders and WhatsApp links all agree. Client-safe.
 */

/** +2348031234567 for any way of writing a Nigerian mobile; other numbers as +digits; null if it isn't a number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hadPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (!hadPlus && digits.length === 10 && /^[789]/.test(digits)) return `+234${digits}`;
  return `+${digits}`;
}

/** Every stored form an older account might have used for the same number, for sign-in lookups. */
export function phoneVariants(raw: string): string[] {
  const n = normalizePhone(raw);
  if (!n) return [];
  const out = new Set([n, n.slice(1)]);
  if (n.startsWith("+234")) out.add(`0${n.slice(4)}`);
  out.add(raw.replace(/[^\d+]/g, ""));
  return [...out].filter(Boolean);
}

/** 0803 123 4567 for display; anything else as stored. */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return "";
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(stored);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : stored;
}

/** wa.me wants digits only, with the country code. */
export function waNumber(stored: string): string {
  return (normalizePhone(stored) ?? stored).replace(/\D/g, "");
}
