// Transactional email via Resend's HTTP API. No SDK dependency, so the only
// thing that needs installing is an API key. RESEND_API_KEY is read from the
// environment and used server-side only; it is never sent to the browser.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Ripe <no-reply@ripe.ng>";

  if (!apiKey) {
    // No provider configured (local dev). Log so the flow is still testable
    // without a real inbox, instead of silently doing nothing.
    console.warn(`[email] RESEND_API_KEY not set. Would have sent to ${to}:\n${text}`);
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[email] Resend send failed (${res.status}):`, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Resend send threw:", err);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Reset your Ripe password",
    text: `We got a request to reset your Ripe password. Use this link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <p>We got a request to reset your Ripe password.</p>
      <p><a href="${resetUrl}">Reset your password</a> (link expires in 30 minutes)</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
