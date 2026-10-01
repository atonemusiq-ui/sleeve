import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isUuid } from "@/lib/uuid";
import { RADIO_EXCLUDED_GENRES, isRadioEnabled } from "@/lib/radio";
import { fetchRadioEligibleTracks, homeStationFor, stationsFor } from "@/lib/radioCatalog";
import TuneInButton from "./TuneInButton";

// The shareable "my song is playing on Fyby Radio" link (Phase 10). Artists
// copy it from their catalog (TrackList.tsx) and post it anywhere; a fan who
// opens it taps Tune in and hears that exact song first, then the rest of
// its station. Shows a "coming soon" version until the radio is switched on.

export const dynamic = "force-dynamic";

async function loadTrack(trackId: string) {
  if (!isUuid(trackId)) return null;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("tracks")
    .select("id, title, cover_url, genre, radio_opt_in, frozen, artist_id, artists!inner ( id, is_active, profiles ( display_name ) )")
    .eq("id", trackId)
    .maybeSingle();
  if (!data) return null;
  const artist: any = Array.isArray(data.artists) ? data.artists[0] : data.artists;
  const profile = artist ? (Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles) : null;
  if (!data.radio_opt_in || data.frozen || !artist?.is_active || RADIO_EXCLUDED_GENRES.includes(data.genre ?? "")) {
    return null;
  }
  return {
    id: data.id as string,
    title: data.title as string,
    coverUrl: data.cover_url as string | null,
    artistId: artist.id as string,
    artistName: (profile?.display_name as string) ?? "Unknown artist",
  };
}

export async function generateMetadata({ params }: { params: { trackId: string } }): Promise<Metadata> {
  const track = await loadTrack(params.trackId);
  if (!track) return { title: "Fyby Radio" };
  const title = `${track.title} by ${track.artistName} · on Fyby Radio`;
  const description = "Listen free on Fyby Radio, the radio station where every song has a Buy button.";
  return {
    title,
    description,
    openGraph: { title, description, images: track.coverUrl ? [track.coverUrl] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RadioTrackPage({ params }: { params: { trackId: string } }) {
  const track = await loadTrack(params.trackId);
  if (!track) notFound();

  let stationSlug: string | null = null;
  let isPremiere = false;
  if (isRadioEnabled()) {
    const eligible = await fetchRadioEligibleTracks();
    const row = eligible.find((t) => t.id === track.id);
    if (row) {
      stationSlug = homeStationFor(row, stationsFor(eligible))?.slug ?? null;
      isPremiere = Boolean(row.premiereEndsAt);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold mb-6">
        {isPremiere ? "Premiering on Fyby Radio" : "Now on Fyby Radio"}
      </p>
      <div className="w-64 h-64 mx-auto rounded-xl overflow-hidden bg-paper/10 border border-gold/30 shadow-2xl">
        {track.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">📻</div>
        )}
      </div>
      <h1 className="font-display text-3xl mt-8 leading-tight">{track.title}</h1>
      <Link href={`/artists/${track.artistId}`} className="text-paper/60 hover:text-gold">
        {track.artistName}
      </Link>

      <div className="mt-8">
        {stationSlug ? (
          <TuneInButton stationSlug={stationSlug} trackId={track.id} />
        ) : (
          <p className="font-mono text-sm text-paper/60">
            Fyby Radio is launching soon. This song will be on the air.
          </p>
        )}
      </div>

      <p className="text-paper/50 text-sm mt-10">
        The radio station where every song has a Buy button. Hear it, buy it, and the artist keeps the money.
      </p>
      <Link href={`/artists/${track.artistId}`} className="inline-block mt-4 font-mono text-xs text-gold">
        See more from {track.artistName} →
      </Link>
    </main>
  );
}
