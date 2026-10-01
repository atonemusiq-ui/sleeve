// Server-only loader for Fyby TV (lib/fybyTv.ts). Uses the service-role
// client, so it must never be imported into a client component.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseVideoEmbedUrl } from "@/lib/videoEmbed";
import { isTvCategory, type TvVideo } from "@/lib/fybyTv";

// Everything the homepage player can show right now: published Fyby videos,
// plus artist premieres that are scheduled (countdown) or running. A
// premiere drops off the player once its window ends. Links that no longer
// parse as YouTube/Vimeo are skipped rather than shown broken.
export async function fetchFybyTvVideos(): Promise<TvVideo[]> {
  const admin = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("fyby_tv_videos")
    .select(
      "id, category, title, description, video_url, starts_at, ends_at, track_id, artist_id, sort_order, created_at, tracks ( price_cents, frozen ), artists ( is_active, profiles ( display_name ) )"
    )
    .eq("published", true)
    .or(`ends_at.is.null,ends_at.gt."${nowIso}"`)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];

  return ((data ?? []) as any[])
    .filter((row) => isTvCategory(row.category) && parseVideoEmbedUrl(row.video_url))
    .filter((row) => {
      const artist = Array.isArray(row.artists) ? row.artists[0] : row.artists;
      return !row.artist_id || artist?.is_active !== false;
    })
    .map((row) => {
      const artist = Array.isArray(row.artists) ? row.artists[0] : row.artists;
      const profile = artist ? (Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles) : null;
      const track = Array.isArray(row.tracks) ? row.tracks[0] : row.tracks;
      const sellable = track && !track.frozen;
      return {
        id: row.id,
        category: row.category,
        title: row.title,
        description: row.description,
        videoUrl: row.video_url,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        trackId: sellable ? row.track_id : null,
        trackPriceCents: sellable ? track.price_cents : null,
        artistId: row.artist_id,
        artistName: profile?.display_name ?? null,
      } as TvVideo;
    });
}

// Premiere windows stack like radio premieres: a new one starts at the
// later of the requested start time and the end of the artist's current
// premiere for the same video link, so paying twice never overlaps.
export function videoPremiereWindow(requestedStart: Date, days: number) {
  const start = requestedStart.getTime() > Date.now() ? requestedStart : new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
