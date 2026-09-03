import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logout } from "@/app/actions/auth";
import { connectStripeAccount } from "@/app/actions/stripe-connect";
import { redirect } from "next/navigation";
import Link from "next/link";
import UploadForm from "./UploadForm";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "artist") {
    redirect("/");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("id, stripe_account_id")
    .eq("user_id", user.id)
    .single();

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("id, title, price_cents, created_at, audio_path, audio_url, cover_url")
    .eq("artist_id", artist?.id)
    .order("created_at", { ascending: false });

  // Audio lives in the private "track-audio" bucket now, so the artist's own
  // dashboard needs a signed URL to play it back — ownership was already
  // verified above (tracks scoped to this artist's own artist_id), so it's
  // safe to mint these with the service-role client rather than relying on
  // a separate storage RLS round trip.
  const supabaseAdmin = createServiceRoleClient();
  const tracksWithPlayUrls = await Promise.all(
    (tracks ?? []).map(async (track) => {
      if (track.audio_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("track-audio")
          .createSignedUrl(track.audio_path, SIGNED_URL_TTL_SECONDS);
        return { ...track, playUrl: signed?.signedUrl ?? null };
      }
      return { ...track, playUrl: track.audio_url ?? null };
    })
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="font-display text-3xl text-gold">Artist Studio</h1>
          <p className="font-mono text-sm text-paper/60 mt-1">{profile.display_name}</p>
        </div>
        <div className="flex items-center gap-4 font-mono text-sm">
          {artist?.id && (
            <Link href={`/artists/${artist.id}`} className="hover:text-gold">
              View public profile
            </Link>
          )}
          <Link href="/" className="hover:text-gold">
            View storefront
          </Link>
          <form action={logout}>
            <button className="hover:text-rust">Log out</button>
          </form>
        </div>
      </header>

      <div className="ticket-divider mb-10" />

      <div className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 mb-10 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg">Payouts</h2>
          <p className="font-mono text-xs text-paper/60 mt-1">
            {artist?.stripe_account_id
              ? "Bank account connected via Stripe."
              : "Connect a bank account to get paid when your tracks sell."}
          </p>
        </div>
        <form action={connectStripeAccount}>
          <button
            type="submit"
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
          >
            {artist?.stripe_account_id ? "Update payout info" : "Connect bank account"}
          </button>
        </form>
      </div>

      {artist?.id && <UploadForm artistId={artist.id} />}

      <h2 className="font-display text-xl mb-4">Your catalog</h2>

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing published yet. Use the form above to publish your first track.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {tracksWithPlayUrls.map((track) => (
          <div
            key={track.id}
            className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex flex-col gap-3"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-paper/10 flex-shrink-0 overflow-hidden">
                {track.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-paper/30 text-xs">
                    ♪
                  </div>
                )}
              </div>
              <span className="font-display text-lg flex-1">{track.title}</span>
              <span className="font-mono text-forest">${(track.price_cents / 100).toFixed(2)}</span>
            </div>
            {track.playUrl && <audio controls src={track.playUrl} className="w-full h-10" />}
          </div>
        ))}
      </div>
    </main>
  );
}
