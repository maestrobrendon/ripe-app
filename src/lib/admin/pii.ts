/*
 * Customer contact details are masked everywhere in the admin by default.
 * Seeing them in full is a deliberate, logged "reveal" (customers.reveal_pii,
 * with step-up), so a support role can help someone without bulk-reading
 * everyone's phone numbers. Pure; safe for client components.
 */

/** "ada.obi@gmail.com" → "a•••i@gmail.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const shown = local.length <= 2 ? `${local[0]}•••` : `${local[0]}•••${local[local.length - 1]}`;
  return `${shown}${email.slice(at)}`;
}

/** "+2348031234567" → "•••• 4567" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  return digits.length < 4 ? "••••" : `•••• ${digits.slice(-4)}`;
}

/** An address shows its last part (the area) only: "12 Admiralty Way, Lekki" → "•••, Lekki" */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return "—";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? `•••, ${parts[parts.length - 1]}` : "•••";
}
