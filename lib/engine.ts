import { createServiceRoleClient } from "@/lib/supabase/service-role";

// The Fyby Engine, first slice (Phase 11): personal recommendations for the
// "For You" feed on /discover. Plain, explainable rules rather than a model,
// so every pick comes with a reason a fan can read ("Because you like
// Gospel/Christian"). Inputs, all from what the member did or told Fyby:
//   - artists they follow (artist_follows)
//   - what they bought (purchases -> each track's artist and genre)
//   - genres they picked on /interests (user_interests)
//   - "fans who bought what you bought also bought…" (purchase overlap,
//     counted across all fans; only totals are used, never who bought what)
//
// Sensitive traits (race, religion, health, exact location…) are never an
// input. A member who turns personalization off gets only the artists they
// follow or have bought from, which is what For You did before the engine.

export type EngineTrack = {
  id: string;
  genre: string | null;
  artists: { id: string; profiles: { display_name: string } | null } | null;
};

export type Recommendation<T> = { track: T; score: number; reason: string };

type Signals = {
  followedArtistIds: Set<string>;
  boughtArtistIds: Set<string>;
  ownedTrackIds: Set<string>;
  genreWeights: Map<string, number>;
  alsoBought: Map<string, number>;
  personalized: boolean;
};

async function loadSignals(supabase: any, userId: string): Promise<Signals> {
  const [{ data: followRows }, { data: purchaseRows }, { data: interests }] = await Promise.all([
    supabase.from("artist_follows").select("artist_id").eq("fan_id", userId),
    supabase.from("purchases").select("track_id, tracks ( artist_id, genre )").eq("fan_id", userId).eq("status", "complete"),
    supabase.from("user_interests").select("genres, personalized").eq("user_id", userId).maybeSingle(),
  ]);

  const followedArtistIds = new Set<string>((followRows ?? []).map((r: any) => r.artist_id));
  const boughtArtistIds = new Set<string>();
  const ownedTrackIds = new Set<string>();
  const genreWeights = new Map<string, number>();
  const bump = (g: string | null | undefined, w: number) => {
    if (g) genreWeights.set(g, (genreWeights.get(g) ?? 0) + w);
  };

  for (const row of purchaseRows ?? []) {
    if (row.track_id) ownedTrackIds.add(row.track_id);
    const t = Array.isArray(row.tracks) ? row.tracks[0] : row.tracks;
    if (t?.artist_id) boughtArtistIds.add(t.artist_id);
    bump(t?.genre, 2);
  }
  for (const g of interests?.genres ?? []) bump(g, 3);

  const personalized = interests?.personalized !== false;

  // Purchase overlap, read with the service role because it spans other
  // fans' purchases. Only counts per track come out of it.
  const alsoBought = new Map<string, number>();
  if (personalized && ownedTrackIds.size > 0) {
    const admin = createServiceRoleClient();
    const owned = Array.from(ownedTrackIds).slice(0, 200);
    const { data: coBuyers } = await admin
      .from("purchases")
      .select("fan_id")
      .in("track_id", owned)
      .eq("status", "complete")
      .neq("fan_id", userId)
      .limit(500);
    const fanIds = Array.from(new Set((coBuyers ?? []).map((r: any) => r.fan_id).filter(Boolean))).slice(0, 200);
    if (fanIds.length > 0) {
      const { data: theirs } = await admin
        .from("purchases")
        .select("track_id")
        .in("fan_id", fanIds)
        .eq("status", "complete")
        .limit(2000);
      for (const r of theirs ?? []) {
        if (!r.track_id || ownedTrackIds.has(r.track_id)) continue;
        alsoBought.set(r.track_id, (alsoBought.get(r.track_id) ?? 0) + 1);
      }
    }
  }

  return { followedArtistIds, boughtArtistIds, ownedTrackIds, genreWeights, alsoBought, personalized };
}

// Scores every candidate track for this member and returns the best first,
// each with the main reason it was picked. Tracks they already own are left
// out. Returns [] when there is nothing to go on yet.
export async function recommendTracks<T extends EngineTrack>(
  supabase: any,
  userId: string,
  candidates: T[],
  limit = 60
): Promise<Recommendation<T>[]> {
  const s = await loadSignals(supabase, userId);
  const results: Recommendation<T>[] = [];

  for (const track of candidates) {
    if (s.ownedTrackIds.has(track.id)) continue;
    const artistId = track.artists?.id ?? "";
    const artistName = track.artists?.profiles?.display_name ?? "this artist";

    const parts: { score: number; reason: string }[] = [];
    if (s.followedArtistIds.has(artistId)) parts.push({ score: 5, reason: `New from ${artistName}, who you follow` });
    if (s.boughtArtistIds.has(artistId)) parts.push({ score: 4, reason: `More from ${artistName}` });

    if (s.personalized) {
      const co = s.alsoBought.get(track.id) ?? 0;
      if (co > 0) parts.push({ score: Math.min(6, 2 + co), reason: "Fans who bought what you bought also got this" });
      const gw = track.genre ? s.genreWeights.get(track.genre) ?? 0 : 0;
      if (gw > 0) parts.push({ score: Math.min(4, gw), reason: `Because you like ${track.genre}` });
    }

    if (parts.length === 0) continue;
    parts.sort((a, b) => b.score - a.score);
    results.push({ track, score: parts.reduce((sum, p) => sum + p.score, 0), reason: parts[0].reason });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
