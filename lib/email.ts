// Transactional email via Resend (resend.com). Used for exactly one thing
// right now: the "claim your gift" email sent when someone buys a track as
// a gift for a friend's email address (see the `is_gift` branch in
// app/api/webhooks/stripe/route.ts).
//
// RESEND_API_KEY is not set in every environment yet. Rather than make the
// whole webhook fail (and risk Stripe retrying a purchase that already
// recorded fine) whenever it's missing, every function here degrades to a
// loud console.error and returns { sent: false } instead of throwing. The
// purchase and its claim link/token are always saved regardless — a missing
// API key only means the recipient has to be told about their gift some
// other way (the buyer can still copy the claim link themselves from the
// success page) until the key is added.
//
// No SDK dependency: this repo has no package-manager access from this
// session to add and lock @resend/node, so this calls Resend's plain HTTPS
// API (api.resend.com/emails) directly with fetch, which every Next.js
// server runtime already has.

type SendResult = { sent: true } | { sent: false; reason: string };

const RESEND_API_URL = "https://api.resend.com/emails";

// Resend requires the from address's domain to be verified in the Resend
// dashboard before it will actually deliver. Until that's done, sends will
// fail with a clear error from Resend's API, logged below — swap this for
// a verified domain once one exists.
const FROM_ADDRESS = "Fyby <gifts@fyby.app>";

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error(
      `[email] RESEND_API_KEY is not set — skipped sending "${subject}" to ${to}. ` +
        "Add RESEND_API_KEY in the environment to enable outgoing email."
    );
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend API error sending "${subject}" to ${to}:`, res.status, body);
      return { sent: false, reason: `Resend API responded ${res.status}` };
    }

    return { sent: true };
  } catch (err: any) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

// The one email this file sends today. `claimUrl` is the fully-qualified
// /gift/[token] link (see app/gift/[token]/page.tsx) the recipient uses to
// create an account (or log in) and have the track linked to it.
export async function sendGiftClaimEmail({
  to,
  trackTitle,
  artistName,
  buyerNote,
  claimUrl,
}: {
  to: string;
  trackTitle: string;
  artistName: string;
  buyerNote?: string | null;
  claimUrl: string;
}): Promise<SendResult> {
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16121a;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">You've been sent a song 🎁</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        Someone just bought <strong>${escapeHtml(trackTitle)}</strong> by
        <strong>${escapeHtml(artistName)}</strong> on Fyby and sent it to you.
      </p>
      ${
        buyerNote
          ? `<p style="font-size: 15px; line-height: 1.5; padding: 12px; background: #f4f1ea; border-radius: 8px;">"${escapeHtml(
              buyerNote
            )}"</p>`
          : ""
      }
      <p style="font-size: 15px; line-height: 1.5;">
        Claim it below — takes a minute to create a free account (or log in if you already have
        one), and the track is yours to keep and stream anytime.
      </p>
      <p style="margin: 28px 0;">
        <a
          href="${claimUrl}"
          style="display: inline-block; background: #C9A227; color: #16121a; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;"
        >
          Claim your track
        </a>
      </p>
      <p style="font-size: 12px; color: #888;">
        If the button doesn't work, copy this link: ${claimUrl}
      </p>
    </div>
  `;

  return send(to, `${artistName} sent you a song on Fyby`, html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
