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
// dashboard before it will actually deliver. getfyby.com is the verified
// sending domain (DKIM/SPF/DMARC configured in Resend + Porkbun DNS).
const FROM_ADDRESS = "Fyby <gifts@getfyby.com>";

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

// Merch Booth: sent by the Stripe webhook once a merch order is recorded.
export async function sendMerchOrderEmail({
  to,
  productTitle,
  artistName,
  variantLabel,
  quantity,
}: {
  to: string;
  productTitle: string;
  artistName: string;
  variantLabel: string;
  quantity: number;
}): Promise<SendResult> {
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16121a;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Your order is in</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        Thanks for supporting <strong>${escapeHtml(artistName)}</strong>. Your
        <strong>${escapeHtml(productTitle)}</strong> (${escapeHtml(variantLabel)}, qty ${quantity})
        is being printed just for you.
      </p>
      <p style="font-size: 15px; line-height: 1.5;">
        Printing usually takes a few business days. We'll email you a tracking link as soon as it ships.
      </p>
    </div>
  `;
  return send(to, `Your ${artistName} merch order is in`, html);
}

// Merch Booth: sent when Printful reports the package shipped.
export async function sendMerchShippedEmail({
  to,
  productTitle,
  trackingUrl,
  carrier,
}: {
  to: string;
  productTitle: string;
  trackingUrl: string | null;
  carrier: string | null;
}): Promise<SendResult> {
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16121a;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Your merch shipped</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        <strong>${escapeHtml(productTitle)}</strong> is on its way${carrier ? ` with ${escapeHtml(carrier)}` : ""}.
      </p>
      ${
        trackingUrl
          ? `<p style="margin: 28px 0;"><a href="${escapeHtml(trackingUrl)}" style="display: inline-block; background: #C9A227; color: #16121a; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Track your package</a></p>`
          : ""
      }
    </div>
  `;
  return send(to, "Your Fyby merch is on its way", html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// New-release email to an artist's mailing list (app/actions/upload.ts).
// Sent through Resend's batch endpoint, 100 emails per request, each with
// the fan's own unsubscribe link. Never throws.
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

export async function sendNewReleaseEmails({
  fans,
  artistName,
  trackTitle,
  coverUrl,
  songUrl,
  siteUrl,
  isPreorder,
}: {
  fans: { email: string; unsubscribeToken: string }[];
  artistName: string;
  trackTitle: string;
  coverUrl: string | null;
  songUrl: string;
  siteUrl: string;
  isPreorder: boolean;
}): Promise<{ sent: number; failed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set — skipped new-release emails.");
    return { sent: 0, failed: fans.length };
  }

  const subject = isPreorder
    ? `${artistName} has a new song coming — pre-order "${trackTitle}"`
    : `New from ${artistName}: "${trackTitle}"`;

  function html(unsubscribeUrl: string) {
    return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16121a;">
      ${coverUrl ? `<img src="${coverUrl}" alt="" width="240" height="240" style="border-radius: 10px; display: block; margin: 0 auto 20px;" />` : ""}
      <h1 style="font-size: 20px; margin-bottom: 8px; text-align: center;">${escapeHtml(trackTitle)}</h1>
      <p style="font-size: 15px; line-height: 1.5; text-align: center;">
        ${isPreorder ? "A new song is on the way from" : "A new song just dropped from"}
        <strong>${escapeHtml(artistName)}</strong>.
        ${isPreorder ? "Pre-order it now and it's yours on release day." : "Hear a snippet and grab it on Fyby."}
      </p>
      <p style="margin: 28px 0; text-align: center;">
        <a href="${songUrl}" style="display: inline-block; background: #C9A227; color: #16121a; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          ${isPreorder ? "Pre-order the song" : "Listen now"}
        </a>
      </p>
      <p style="font-size: 12px; color: #888; text-align: center;">
        You're getting this because you joined ${escapeHtml(artistName)}'s mailing list on Fyby.<br />
        <a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe</a>
      </p>
    </div>`;
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < fans.length; i += 100) {
    const chunk = fans.slice(i, i + 100);
    const payload = chunk.map((fan) => {
      const unsubscribeUrl = `${siteUrl}/unsubscribe/${fan.unsubscribeToken}`;
      return {
        from: `${artistName.replace(/[<>"]/g, "")} via Fyby <music@getfyby.com>`,
        to: fan.email,
        subject,
        html: html(unsubscribeUrl),
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      };
    });
    try {
      const res = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) sent += chunk.length;
      else {
        failed += chunk.length;
        console.error("[email] Resend batch error:", res.status, await res.text());
      }
    } catch (err: any) {
      failed += chunk.length;
      console.error("[email] Resend batch failed:", err.message);
    }
  }
  return { sent, failed };
}

// Fyby Vendors: tells the vendor they made a sale (lib/vendorOrders.ts).
export async function sendVendorOrderEmail({
  to,
  productTitle,
  quantity,
  payoutCents,
  isService,
  buyerEmail,
  portalUrl,
}: {
  to: string;
  productTitle: string;
  quantity: number;
  payoutCents: number;
  isService: boolean;
  buyerEmail: string | null;
  portalUrl: string;
}): Promise<SendResult> {
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16121a;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">You have a new ${isService ? "booking" : "order"} 🎉</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        ${quantity > 1 ? `${quantity} × ` : ""}<strong>${escapeHtml(productTitle)}</strong> was just purchased on Fyby.
        You earn <strong>$${(payoutCents / 100).toFixed(2)}</strong>, paid to your connected Stripe account.
      </p>
      <p style="font-size: 15px; line-height: 1.5;">
        ${
          isService
            ? `Reach out to your customer${buyerEmail ? ` at ${escapeHtml(buyerEmail)}` : ""} to schedule.`
            : "The shipping address is in your Vendor portal. Mark it fulfilled once it ships."
        }
      </p>
      <p style="margin: 28px 0;">
        <a href="${portalUrl}" style="display: inline-block; background: #C9A227; color: #16121a; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Open your Vendor portal
        </a>
      </p>
    </div>
  `;
  return send(to, `New Fyby ${isService ? "booking" : "order"}: ${productTitle}`, html);
}

// Fyby Vendors: sent once the Vendor Pro plan is paid and the vendor goes
// live (app/api/webhooks/stripe-subscriptions/route.ts). Confirms the
// account is set up and lists anything still left to do.
export async function sendVendorLiveEmail({
  to,
  businessName,
  portalUrl,
  pageUrl,
  stripeConnected,
  profileDone,
  hasListings,
}: {
  to: string;
  businessName: string;
  portalUrl: string;
  pageUrl: string;
  stripeConnected: boolean;
  profileDone: boolean;
  hasListings: boolean;
}): Promise<SendResult> {
  const item = (done: boolean, text: string) =>
    `<li style="margin: 6px 0;">${done ? "✅" : "⬜"} ${text}</li>`;
  const allDone = stripeConnected && profileDone && hasListings;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16121a;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Your Fyby vendor account is set up 🎉</h1>
      <p style="font-size: 15px; line-height: 1.5;">
        Welcome, <strong>${escapeHtml(businessName || "vendor")}</strong>! Your Vendor Pro plan is active, so your page
        is live on Fyby Vendors and on the Fyby advertising page.
      </p>
      <p style="font-size: 15px; line-height: 1.5; margin-bottom: 4px;"><strong>Your checklist</strong></p>
      <ul style="font-size: 15px; line-height: 1.4; padding-left: 4px; list-style: none; margin-top: 0;">
        ${item(true, "Vendor Pro plan active")}
        ${item(stripeConnected, "Connect Stripe so you get paid")}
        ${item(profileDone, "Fill in your profile: what you do, your city and your website link")}
        ${item(hasListings, "Add your first product or service with photos")}
      </ul>
      <p style="font-size: 15px; line-height: 1.5;">
        ${
          allDone
            ? "You're all set. Customers can find you and buy from you now."
            : "Finish the unchecked steps in your Vendor portal so customers can buy from you."
        }
        Sales tax and shipping are charged to the customer at checkout.
      </p>
      <p style="margin: 28px 0;">
        <a href="${portalUrl}" style="display: inline-block; background: #C9A227; color: #16121a; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Open your Vendor portal
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">
        Log in at getfyby.com with the email and password you signed up with; you'll land in your Vendor portal.
        Your public page: <a href="${pageUrl}" style="color: #555;">${pageUrl}</a>
      </p>
    </div>
  `;
  return send(to, "Your Fyby vendor account is set up", html);
}
