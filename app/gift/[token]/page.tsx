import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { claimGift } from "@/app/actions/giftClaim";
import Link from "next/link";

// Landing page for a gift-purchase claim link (the email lib/email.ts sends,
// via app/api/webhooks/stripe/route.ts's is_gift branch). Shows what track
// was gifted and, depending on whether the visitor is logged in yet, either
// a one-click "Claim your track" (posts to app/actions/giftClaim.ts) or
// login/signup buttons that bounce back here afterward.
export default async function GiftClaimPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  const admin = createServiceRoleClient();

  const { data: purchase } = await admin
    .from("purchases")
    .select(
      "id, fan_id, gift_claimed_at, gift_recipient_email, tracks ( title, cover_url, artists ( profiles ( display_name ) ) )"
    )
    .eq("gift_claim_token", params.token)
    .maybeSingle();

  if (!purchase) {
    return (
      <main className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-gold mb-4">Hmm.</h1>
        <p className="text-paper/70 mb-10">That gift link isn&apos;t valid — double check it, or ask whoever sent it for a fresh copy.</p>
        <Link href="/" className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
          Back to Fyby
        </Link>
      </main>
    );
  }

  const track = (purchase as any).tracks;
  const trackTitle = track?.title ?? "a track";
  const artistName = track?.artists?.profiles?.display_name ?? "an artist";
  const alreadyClaimed = Boolean((purchase as any).fan_id);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextParam = encodeURIComponent(`/gift/${params.token}`);
  const recipientEmail = (purchase as any).gift_recipient_email ?? "";

  return (
    <main className="max-w-lg mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">You&apos;ve been sent a song 🎁</h1>
      <p className="text-paper/70 mb-10">
        <span className="font-display text-xl text-paper">{trackTitle}</span>
        <br />
        by {artistName}
      </p>

      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      {alreadyClaimed ? (
        <>
          <p className="text-paper/70 mb-10">This gift has already been claimed.</p>
          <Link
            href="/library"
            className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90 inline-block"
          >
            Go to My Music
          </Link>
        </>
      ) : user ? (
        <form action={claimGift}>
          <input type="hidden" name="token" value={params.token} />
          <button
            type="submit"
            className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
          >
            Claim your track
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3 items-center">
          <p className="text-paper/70 mb-2">Create a free account (takes a minute) or log in to claim it.</p>
          <Link
            href={`/signup?email=${encodeURIComponent(recipientEmail)}&next=${nextParam}`}
            className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90 w-full max-w-xs"
          >
            Create free account
          </Link>
          <Link
            href={`/login?next=${nextParam}`}
            className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10 w-full max-w-xs"
          >
            I already have an account
          </Link>
        </div>
      )}
    </main>
  );
}
