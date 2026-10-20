import { headers } from "next/headers";

// The address the visitor is actually using (https://www.getfyby.com,
// https://getfyby.com, a preview deploy...), for links that send them away
// and back: Stripe checkout success/cancel pages, Stripe Connect onboarding,
// password-reset emails.
//
// These used to come only from NEXT_PUBLIC_SITE_URL. When that pointed at a
// different domain than the one the visitor was logged in on (an old
// vercel.app address, or getfyby.com vs www.getfyby.com), they came back
// from Stripe to a domain where they had no login cookies, landed on the
// log-in page, and couldn't get back to where they were.
//
// Only Fyby's own hosts are trusted from the request; anything else falls
// back to NEXT_PUBLIC_SITE_URL so a forged Host header can't redirect a
// payment flow somewhere else.
const TRUSTED_HOST = /^(?:www\.)?getfyby\.com$|^fyby[a-z0-9-]*\.vercel\.app$|^localhost(?::\d+)?$/i;

export function siteOrigin(): string {
  const fallback = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  try {
    const h = headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
    if (!host || !TRUSTED_HOST.test(host)) return fallback;
    const proto = host.startsWith("localhost") ? h.get("x-forwarded-proto") ?? "http" : "https";
    return `${proto}://${host}`;
  } catch {
    // Called outside a request (e.g. from a webhook helper): use the setting.
    return fallback;
  }
}
