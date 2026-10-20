import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isUuid } from "@/lib/uuid";

// One-click unsubscribe from an artist's new-release emails (the link at
// the bottom of every email from lib/email.ts sendNewReleaseEmails). The
// token is per fan per artist, so it only ever affects that one list.
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: { token: string } }) {
  let artistName: string | null = null;
  let ok = false;

  if (isUuid(params.token)) {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("artist_fans")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", params.token)
      .select("artists ( profiles ( display_name ) )")
      .maybeSingle();
    if (data) {
      ok = true;
      const artist: any = Array.isArray((data as any).artists) ? (data as any).artists[0] : (data as any).artists;
      const profile = artist ? (Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles) : null;
      artistName = profile?.display_name?.trim() || null;
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">{ok ? "You're unsubscribed" : "Link not found"}</h1>
      <p className="text-paper/70 mb-10">
        {ok
          ? `You won't get any more emails from ${artistName ?? "this artist"}'s mailing list. You can join again anytime from their page.`
          : "This unsubscribe link isn't valid. If you keep getting emails you don't want, reply to one and we'll take you off."}
      </p>
      <Link href="/" className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
        Back to Fyby
      </Link>
    </main>
  );
}
