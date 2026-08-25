import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import UploadForm from "./UploadForm";

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
    // fans don't have a dashboard yet — send them to the storefront
    redirect("/");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("id, title, price_cents, created_at, audio_url, cover_url")
    .eq("artist_id", artist?.id)
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="font-display text-3xl text-gold">Artist Studio</h1>
          <p className="font-mono text-sm text-paper/60 mt-1">{profile.display_name}</p>
        </div>
        <div className="flex items-center gap-4 font-mono text-sm">
          <Link href="/" className="hover:text-gold">
            View storefront
          </Link>
          <form action={logout}>
            <button className="hover:text-rust">Log out</button>
          </form>
        </div>
      </header>

      <div className="ticket-divider mb-10" />

      {artist?.id && <UploadForm artistId={artist.id} />}

      <h2 className="font-display text-xl mb-4">Your catalog</h2>

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing published yet. Use the form above to publish your first track.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {tracks?.map((track) => (
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
            {track.audio_url && (
              <audio controls src={track.audio_url} className="w-full h-10" />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
