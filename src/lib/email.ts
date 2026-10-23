import "server-only";

// Transactional email via Resend's HTTP API. No SDK dependency, so the only
// thing that needs installing is an API key. RESEND_API_KEY is read from the
// environment and used server-side only; it is never sent to the browser.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function replyTo(): Promise<string> {
  try {
    const { getSiteSettings } = await import("@/lib/site-settings");
    return (await getSiteSettings()).support.email;
  } catch {
    return "hello@getbasket.ng";
  }
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "BasketNG <no-reply@getbasket.ng>";

  if (!apiKey) {
    // No provider configured. Locally, print the message so flows like the
    // password reset stay testable without an inbox. Never in production:
    // the body can hold a live reset link, and logs are not a safe place.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email] RESEND_API_KEY not set. Would have sent to ${to}:\n${text}`);
    } else {
      console.error(JSON.stringify({ scope: "email", error: "RESEND_API_KEY not set", subject }));
    }
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Replies reach a person (the support address), never the no-reply sender.
      body: JSON.stringify({ from, to, subject, html, text, reply_to: await replyTo() }),
    });
    if (!res.ok) {
      // Status only: Resend's error body can echo the recipient back.
      console.error(JSON.stringify({ scope: "email", error: "send failed", status: res.status, subject }));
      return false;
    }
    return true;
  } catch (err) {
    console.error(JSON.stringify({ scope: "email", error: "send threw", detail: err instanceof Error ? err.message : String(err), subject }));
    return false;
  }
}

/**
 * Sent when someone tries to sign up with an address that already has an
 * account. The sign-up page says nothing specific (no account enumeration);
 * the real owner hears about it here instead.
 */
export async function sendSignupAttemptEmail(to: string, origin: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Someone tried to create a Basket account with your email",
    text: `Someone just tried to create a new Basket account with this email address. You already have one.\n\nSign in: ${origin}/login\nForgot your password? ${origin}/forgot-password\n\nIf this wasn't you, you can ignore this email. Your account hasn't changed.`,
    html: `
      <p>Someone just tried to create a new Basket account with this email address. You already have one.</p>
      <p><a href="${origin}/login">Sign in</a> or <a href="${origin}/forgot-password">reset your password</a>.</p>
      <p>If this wasn't you, you can ignore this email. Your account hasn't changed.</p>
    `,
  });
}

/** To the old address, after an account's email or phone changes. */
export async function sendContactChangedEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Your Basket contact details were changed",
    text: "The email address or phone number on your Basket account was just changed, and your other devices were signed out. If this was you, there's nothing to do. If it wasn't, reply to this email straight away so we can lock the account.",
    html: `
      <p>The email address or phone number on your Basket account was just changed, and your other devices were signed out.</p>
      <p>If this was you, there's nothing to do. If it wasn't, reply to this email straight away so we can lock the account.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Reset your Basket password",
    text: `We got a request to reset your Basket password. Use this link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <p>We got a request to reset your Basket password.</p>
      <p><a href="${resetUrl}">Reset your password</a> (link expires in 30 minutes)</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
