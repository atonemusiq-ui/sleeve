"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";

// Links a gift purchase (app/api/webhooks/stripe/route.ts's is_gift branch)
// to whichever account is logged in when this runs — called from the
// "Claim your track" button on app/gift/[token]/page.tsx, after the visitor
// has either logged in or just finished signing up (both redirect back to
// that same page with `next`).
//
// Deliberately keyed on the token alone, not a match against
// gift_recipient_email: the token is itself an unguessable, one-time
// credential (like the /reset-password or /contributor-onboard links this
// app already uses that same way), so whoever holds the link and is logged
// in when they open it is treated as the intended recipient — covers both
// "recipient already had an account and just logged in" and "recipient
// signed up with a different email than the one the gift was sent to"
// without extra friction. Uses the service-role client since there's no
// purchases UPDATE policy for RLS to allow this (same reasoning as
// app/actions/auth.ts's claim-by-email-on-signup).
export async function claimGift(formData: FormData) {
  const token = formData.get("token") as string;
  if (!token) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/gift/${token}`)}`);
  }

  const admin = createServiceRoleClient();

  const { data: purchase, error } = await admin
    .from("purchases")
    .select("id, fan_id, gift_claimed_at")
    .eq("gift_claim_token", token)
    .maybeSingle();

  if (error || !purchase) {
    redirect(`/gift/${token}?error=${encodeURIComponent("That gift link isn't valid.")}`);
  }

  // Already claimed by someone (possibly this same account, if they clicked
  // twice) — just send them on to their library rather than erroring.
  if ((purchase as any).fan_id) {
    redirect("/library");
  }

  const { error: claimError } = await admin
    .from("purchases")
    .update({ fan_id: user.id, gift_claimed_at: new Date().toISOString() })
    .eq("id", (purchase as any).id)
    .is("fan_id", null);

  if (claimError) {
    console.error("[claimGift] failed to claim gift purchase", {
      purchaseId: (purchase as any).id,
      userId: user.id,
      message: claimError.message,
    });
    redirect(`/gift/${token}?error=${encodeURIComponent("Couldn't claim that gift — try again.")}`);
  }

  redirect("/library");
}
