import "server-only";
import { SITE_NAME, appOrigin } from "@/lib/site";

/*
 * The one look every email has, customer or staff: the wordmark, a white
 * card with the site's black outline on the sky-wash band, a sticker tag for
 * what kind of email it is, one heading, short paragraphs, and at most one
 * black pill button. Built from tables and inline styles, because that's
 * what Gmail, Outlook and Apple Mail all agree on. Each email also gets a
 * plain-text twin from the same content.
 */

export type EmailTone = "mint" | "blue" | "sun" | "ember" | "lavender" | "violet";

export type EmailContent = {
  /** The one line that says what happened. */
  heading: string;
  /** Plain text; escaped, with any web address made a link. */
  paragraphs: string[];
  /** The preview line inboxes show after the subject. Defaults to the first paragraph. */
  preheader?: string;
  /** A small sticker above the heading: "Receipt", "Gift", "Security". */
  tag?: { label: string; tone?: EmailTone };
  /** Label and value pairs, for receipts and order details. */
  rows?: [label: string, value: string][];
  /** A one-time code, shown large to read and type. */
  code?: string;
  /** Someone's own words (a gift note), set apart. */
  quote?: string;
  button?: { href: string; label: string };
  /** Smaller print under the button: expiry, "if this wasn't you". */
  finePrint?: string[];
  /** How to get help; the default says to reply. */
  help?: string;
  /** Staff emails sign off as Basket Admin, not the shop. */
  staff?: boolean;
};

const TONES: Record<EmailTone, { bg: string; fg: string }> = {
  mint: { bg: "#55db9c", fg: "#000000" },
  blue: { bg: "#4da2ff", fg: "#000000" },
  sun: { bg: "#ffd731", fg: "#000000" },
  ember: { bg: "#fb4903", fg: "#000000" },
  lavender: { bg: "#e9ccff", fg: "#000000" },
  violet: { bg: "#5c4ade", fg: "#ffffff" },
};

const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
// The site's display face is Dr Kabel; mail clients can't load it, so headings
// fall back the same way the site does.
const DISPLAY_FONT = "'Arial Black', 'Arial Bold', Gadget, Arial, sans-serif";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Escapes, then turns web addresses into links. */
function richText(s: string): string {
  return esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:#000000;text-decoration:underline;word-break:break-all">${url}</a>`);
}

function paragraph(s: string, extra = ""): string {
  return `<p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:#000000;${extra}">${richText(s)}</p>`;
}

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const origin = appOrigin();
  const preheader = c.preheader ?? c.paragraphs[0] ?? c.heading;
  const tone = TONES[c.tag?.tone ?? "mint"];
  const help = c.help ?? (c.staff ? "Questions? Reply to this email." : "Questions? Just reply to this email and a person will answer.");
  const sender = c.staff ? "Basket Admin" : SITE_NAME;

  const tag = c.tag
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td style="background:${tone.bg};color:${tone.fg};border:1px solid #000000;border-radius:999px;padding:5px 12px;font-family:${BODY_FONT};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;line-height:1">${esc(c.tag.label)}</td></tr></table>`
    : "";

  const rows = c.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;border-top:1px solid #000000">${c.rows
        .map(
          ([label, value]) =>
            `<tr><td valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid #e9e9e9;font-family:${BODY_FONT};font-size:14px;line-height:1.4;color:#5c5c5c;white-space:nowrap">${esc(label)}</td><td valign="top" align="right" style="padding:12px 0;border-bottom:1px solid #e9e9e9;font-family:${BODY_FONT};font-size:15px;line-height:1.4;color:#000000;font-weight:600;word-break:break-word">${richText(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const code = c.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px"><tr><td align="center" style="background:#dceeff;border:1px solid #000000;border-radius:18px;padding:20px 12px;font-family:${DISPLAY_FONT};font-size:38px;font-weight:900;line-height:1;letter-spacing:0.18em;color:#000000">${esc(c.code)}</td></tr></table>`
    : "";

  const quote = c.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr><td style="background:#e9ccff;border:1px solid #000000;border-radius:18px;padding:16px 18px;font-family:${BODY_FONT};font-size:16px;line-height:1.5;color:#000000;font-style:italic">&ldquo;${esc(c.quote)}&rdquo;</td></tr></table>`
    : "";

  // A "bulletproof" button: a padded link inside a table cell, so it's a real
  // pill in every client, Outlook included.
  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px"><tr><td align="center" bgcolor="#000000" style="border-radius:999px"><a href="${esc(c.button.href)}" style="display:inline-block;padding:15px 28px;font-family:${BODY_FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px">${esc(c.button.label)}</a></td></tr></table>
      <p style="margin:12px 0 0;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:#5c5c5c">Button not working? Paste this into your browser:<br><a href="${esc(c.button.href)}" style="color:#5c5c5c;word-break:break-all">${esc(c.button.href)}</a></p>`
    : "";

  const finePrint = c.finePrint?.length
    ? `<div style="margin-top:22px;padding-top:18px;border-top:1px solid #e9e9e9">${c.finePrint.map((p) => paragraph(p, "font-size:13px;color:#5c5c5c;margin:0 0 8px")).join("")}</div>`
    : "";

  // Five sticker dots: the palette, as a sign-off.
  const dots = (["#4da2ff", "#55db9c", "#ffd731", "#fb4903", "#5c4ade"] as const)
    .map((col) => `<td style="padding:0 3px"><div style="width:10px;height:10px;border-radius:999px;background:${col};border:1px solid #000000;font-size:0;line-height:0">&nbsp;</div></td>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(c.heading)}</title>
<style>
  @media (max-width: 520px) {
    .card { padding: 26px 22px !important; border-radius: 20px !important; }
    .heading { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#dceeff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#dceeff">
  <tr><td align="center" style="padding:32px 14px 40px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px">
      <tr><td style="padding:0 6px 18px">
        <a href="${origin}" style="text-decoration:none"><img src="${origin}/email/wordmark.png" width="132" height="32" alt="${esc(SITE_NAME)}" style="display:block;border:0;outline:none;font-family:${DISPLAY_FONT};font-size:24px;color:#000000"></a>
      </td></tr>
      <tr><td class="card" style="background:#ffffff;border:1px solid #000000;border-radius:24px;padding:34px 32px">
        ${tag}
        <h1 class="heading" style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-size:28px;font-weight:900;line-height:1.15;letter-spacing:-0.01em;color:#000000">${esc(c.heading)}</h1>
        ${c.paragraphs.map((p) => paragraph(p)).join("")}
        ${code}
        ${quote}
        ${rows}
        ${button}
        ${finePrint}
      </td></tr>
      <tr><td style="padding:22px 6px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>${dots}</tr></table>
        <p style="margin:0 0 6px;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:#000000">${richText(help)}</p>
        <p style="margin:0;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:#5c5c5c">${esc(sender)} &middot; Fresh fruit and veg, delivered across Lagos &middot; <a href="${origin}" style="color:#5c5c5c">${esc(origin.replace(/^https?:\/\/(www\.)?/, ""))}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    c.heading,
    ...c.paragraphs,
    ...(c.code ? [`Your code: ${c.code}`] : []),
    ...(c.quote ? [`"${c.quote}"`] : []),
    ...(c.rows?.length ? [c.rows.map(([l, v]) => `${l}: ${v}`).join("\n")] : []),
    ...(c.button ? [`${c.button.label}: ${c.button.href}`] : []),
    ...(c.finePrint ?? []),
    help,
    `${sender} · ${origin}`,
  ].join("\n\n");

  return { html, text };
}
