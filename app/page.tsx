import { createClient } from "@/lib/supabase/server";
import { startCheckout, startAlbumCheckout } from "@/app/actions/checkout";
import { tracksNeedingCoverCredit } from "@/lib/coverCompliance";
import Link from "next/link";
import StorefrontGrid from "./StorefrontGrid";
import HeroSection from "./HeroSection";
import HowItWorks from "./HowItWorks";
import TrustFooter from "./TrustFooter";

export default async function StorefrontPage() {
  const supabase = createClient();

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, created_at, cover_url, preview_url, genre, custom_tag, ai_disclosure, artists ( id, bio, user_id, profiles ( display_name ) )"
    )
    .order("created_at", { ascending: false });

  const normalizedTracks = (tracks ?? []).map((track: any) => ({
    ...track,
    artists: Array.isArray(track.artists)
      ? {
          ...track.artists[0],
          profiles: Array.isArray(track.artists[0]?.profiles)
            ? track.artists[0].profiles[0] ?? null
            : track.artists[0]?.profiles ?? null,
        }
      : track.artists,
  }));

  // Albums are publicly readable (see supabase/schema.sql), so every track
  // that belongs to one can offer a "Buy full album" option alongside its
  // own "Buy this song" — built as a track_id -> album lookup so
  // StorefrontGrid doesn't need to know anything about the albums table
  // itself. A track only ever belongs to one album in practice, so the
  // first match wins if that ever isn't true.
  const { data: albumTrackRows } = await supabase
    .from("album_tracks")
    .select("track_id, albums ( id, title, price_cents )");

  const albumByTrackId: Record<string, { id: string; title: string; price_cents: number }> = {};
  for (const row of albumTrackRows ?? []) {
    const album = row.albums as any;
    if (album && !albumByTrackId[row.track_id]) {
      albumByTrackId[row.track_id] = { id: album.id, title: album.title, price_cents: album.price_cents };
    }
  }
  const albumTrackCounts: Record<string, number> = {};
  for (const row of albumTrackRows ?? []) {
    const album = row.albums as any;
    if (album) albumTrackCounts[album.id] = (albumTrackCounts[album.id] ?? 0) + 1;
  }

  // Cover songs (see lib/coverCompliance.ts) can't be sold until the artist
  // has credited the original songwriter/producer as a contributor — this
  // never exposes who the contributor is, just which tracks are blocked.
  const blockedTrackIds = Array.from(
    await tracksNeedingCoverCredit(normalizedTracks.map((t) => ({ id: t.id, genre: t.genre })))
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">Fyby</h1>
        <nav className="font-mono text-sm">
          {user ? (
            <div className="flex gap-4">
              <Link href="/library" className="hover:text-gold">
                My Music
              </Link>
              {role === "artist" && (
                <Link href="/dashboard" className="hover:text-gold">
                  Dashboard
                </Link>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              <Link href="/login" className="hover:text-gold">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-gold">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* Hero, "How it works", and the trust footer are the marketing case
          for signing up — shown only to logged-out visitors. Logged-in
          users (fans and artists alike) go straight to browsing below. */}
      {!user && <HeroSection />}

      <p className="text-paper/40 font-mono text-xs mb-10 max-w-xl">
        Artists disclose it themselves when a track involves AI-generated vocals, instrumentation,
        or production — look for the "AI-Assisted"/"Fully AI-Generated" label on those tracks, or
        browse the AI Music row below.
      </p>

      <div className="ticket-divider mb-10" />

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>
      )}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">No tracks published yet.</p>
      )}

      {!error && tracks && tracks.length > 0 && (
        <StorefrontGrid
          tracks={normalizedTracks}
          startCheckout={startCheckout}
          startAlbumCheckout={startAlbumCheckout}
          isLoggedIn={Boolean(user)}
          albumByTrackId={albumByTrackId}
          albumTrackCounts={albumTrackCounts}
          blockedTrackIds={blockedTrackIds}
        />
      )}

      {!user && (
        <>
          <HowItWorks />
          <TrustFooter />
        </>
      )}
    </main>
  );
}
