import { createClient } from "@/lib/supabase/server";
import { createTrackCheckoutSession } from "@/lib/checkoutSession";
import { NextResponse } from "next/server";

// The embed widget (app/embed/[trackId]/page.tsx) is designed to sit inside
// an <iframe> on someone else's site. Its Buy control is a plain
// <a target="_top"> pointed at this route rather than a <form
// action={startCheckout}> — a server action's redirect() is intercepted and
// replayed by Next's client-side router, and that JS-driven navigation
// ignores target="_top", so a Buy click would load Stripe checkout squished
// inside the widget instead of breaking out to the top-level page. A plain
// anchor click with target="_top" is a native browser navigation, which DOES
// escape a cross-origin iframe. This route exists so that top-level
// navigation has a real HTTP redirect to land on — Stripe's checkout page,
// or back to the widget with an error.
export async function GET(req: Request, { params }: { params: { trackId: string } }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const widgetUrl = `${siteUrl}/embed/${params.trackId}`;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Lands at the top level (not inside the iframe, since this whole
    // navigation already broke out), so a normal full-page login works fine.
    // `next` sends them back to the widget page itself — not straight back
    // through this route — since the widget still has its own Buy link they
    // can click once they're signed in.
    return NextResponse.redirect(
      `${siteUrl}/login?message=${encodeURIComponent(
        "Log in or sign up to buy this track."
      )}&next=${encodeURIComponent(`/embed/${params.trackId}`)}`
    );
  }

  const result = await createTrackCheckoutSession(params.trackId, user.id);

  if ("error" in result) {
    return NextResponse.redirect(
      `${widgetUrl}?error=${encodeURIComponent(result.error)}`
    );
  }

  return NextResponse.redirect(result.url);
}
