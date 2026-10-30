/*
 * Every kind of email in the shared layout, with made-up details, for
 * checking the design. Writes them to a folder as .html files, and with
 * --send <address> also emails each one there through Resend.
 *
 *   npx tsx --conditions=react-server prisma/scripts/email-samples.ts <out-dir> [--send you@example.com]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderEmail, type EmailContent } from "@/lib/email-layout";

const origin = process.env.APP_ORIGIN ?? "https://www.getbasket.ng";

const SAMPLES: Record<string, { subject: string; content: EmailContent }> = {
  "order-confirmed": {
    subject: "Order #A1B2C3D4 confirmed",
    content: {
      tag: { label: "Order confirmed", tone: "mint" },
      heading: "Thanks, Ada. Your basket is in.",
      paragraphs: ["Pineapple × 1, Ugu × 2, Tomatoes × 1, Carrots × 1, Bananas × 1, and more"],
      rows: [["Arriving", "Saturday 7 November"], ["To", "12 Admiralty Way, Lekki Phase 1 (Lekki)"], ["Total", "₦18,450"], ["Order", "#A1B2C3D4"]],
      button: { href: `${origin}/orders`, label: "Track your order" },
    },
  },
  receipt: {
    subject: "Payment received: ₦18,450",
    content: {
      tag: { label: "Receipt", tone: "mint" },
      heading: "₦18,450 received. Thank you.",
      paragraphs: ["This is your receipt for order #A1B2C3D4."],
      rows: [["Amount", "₦18,450"], ["For", "order #A1B2C3D4"], ["Paid by", "Card (Paystack)"], ["Reference", "BSK-PAY-E1EEDA487F9A"]],
      button: { href: `${origin}/orders`, label: "See your order" },
    },
  },
  "verify-email": {
    subject: "482913 is your BasketNG code",
    content: {
      tag: { label: "One quick step", tone: "blue" },
      heading: "Ada, here's your code",
      paragraphs: ["Type it into BasketNG to confirm this is your email, so your receipts and basket reminders reach you."],
      code: "482913",
      button: { href: `${origin}/verify-email`, label: "Or confirm with one tap" },
      finePrint: ["The code works for 30 minutes, the button for 48 hours.", "If you didn't sign up for BasketNG, ignore this email. Never share this code with anyone."],
    },
  },
  gift: {
    subject: "Tunde sent you a basket",
    content: {
      tag: { label: "A gift for you", tone: "lavender" },
      heading: "Ada, Tunde sent you a basket",
      paragraphs: ["₦25,000 of fresh fruit and veg from BasketNG, on them."],
      quote: "Happy birthday! Eat well this week.",
      button: { href: `${origin}/gift`, label: "Open your gift" },
      finePrint: ["Open it, pick what you'd like, and we'll bring it to your door in Lagos."],
    },
  },
  reminder: {
    subject: "Weekly basket is ready for Saturday 7 November",
    content: {
      tag: { label: "Your basket", tone: "mint" },
      heading: "Weekly basket is ready for Saturday 7 November",
      paragraphs: [
        "Hi Ada, Weekly basket is ready for Saturday 7 November: Pineapple, Ugu, Tomatoes, Carrots and 3 more, about ₦18,450. Confirm and pay by Thursday 6pm. Change or skip it if you need to.",
        "Nothing is ever charged automatically. A week you don't confirm simply doesn't go out.",
      ],
      button: { href: `${origin}/checkout`, label: "Confirm and pay" },
    },
  },
  "password-reset": {
    subject: "Reset your Basket password",
    content: {
      tag: { label: "Security", tone: "sun" },
      heading: "Reset your password",
      paragraphs: ["We got a request to reset your Basket password. Tap below to choose a new one."],
      button: { href: `${origin}/reset-password`, label: "Choose a new password" },
      finePrint: ["The link works for 30 minutes.", "If you didn't ask for this, you can ignore this email. Your password stays the same."],
    },
  },
  "admin-alert": {
    subject: "[Basket Admin] A staff sign-in was reset",
    content: {
      staff: true,
      tag: { label: "Admin alert", tone: "ember" },
      heading: "A staff sign-in was reset",
      paragraphs: ["Brendon reset the sign-in for Kemi (kemi@example.com). They'll set up a new passkey from a fresh link."],
      button: { href: "https://admin.getbasket.ng/audit", label: "Review the audit log" },
    },
  },
};

async function main() {
  const [outDir, flag, to] = process.argv.slice(2);
  if (!outDir) throw new Error("Usage: email-samples.ts <out-dir> [--send address]");
  await mkdir(outDir, { recursive: true });
  for (const [name, { subject, content }] of Object.entries(SAMPLES)) {
    const { html, text } = renderEmail(content);
    await writeFile(join(outDir, `${name}.html`), html);
    if (flag === "--send" && to) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || "BasketNG <no-reply@getbasket.ng>", to, subject: `[Test] ${subject}`, html, text }),
      });
      console.log(name, res.status);
    } else console.log(name, "written");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
