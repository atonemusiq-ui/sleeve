import { createClient } from "@/lib/supabase/server";
import { startCheckout, startAlbumCheckout } from "@/app/actions/checkout";
import { tracksNeedingCoverCredit } from "@/lib/coverCompliance";
import { GENRES } from "@/lib/genres";
import Link from "next/link";
import StorefrontGrid from "@/app/StorefrontGrid";

// Phase 4: a dedicated marketplace section for tracks disclosed as 100%
// AI-generated (ai_disclosure = 'ai_generated' — see lib/aiDisclosure.ts and
// the required 3-way disclosure choice at upload). Deliberately narrower
// than the "AI Music" row on the main storefront (app/StorefrontGrid.tsx),
// which also folds in "AI-Assisted" tracks — this page is its own space
// specifically for fully-AI-generated work, giving those artists a
// platform of their own rather than a shared row buried on the homepage.
//
// Payout math is unchanged — still the standard 80/20 split (see
// app/api/webhooks/stripe/route.ts). This is a browsing/discovery
// distinction, not a different fee structure: differentiating by fee would
// cut against the same non-punitive philosophy behind treating AI
// disclosure as transparency rather than a penalty (see
// lib/aiDisclosure.ts's comment). A paid "Verified Human+AI" certification
// tier remains a separate, not-yet-built idea for monetizing the
// distinction differently, if that's ever wanted.
export default async function AiMusicPage() {
  const supabase = createClient();

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, created_at, cover_url, preview_url, genre, subgenre, custom_tag, ai_disclosure, verification_status, artists ( id, bio, user_id, profiles ( display_name ) )"
    )
    .eq("ai_disclosure", "ai_generated")
    .order("created_at", { ascending: false });

  // Admin-approved genre suggestions get their own row here too, same as
  // the main storefront (app/page.tsx) — an AI-generated track can carry a
  // genre just like any other.
  const { data: approvedGenreRows } = await supabase.from("approved_genres").select("name").order("name");
  const allGenres = [...GENRES, ...(approvedGenreRows ?? []).map((g) => g.name)];

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

  const trackIds = normalizedTracks.map((t) => t.id);

  // Same track_id -> album lookup as the main storefront, scoped to just
  // these tracks — an AI-generated track can still be part of a bundled
  // album sale.
  const { data: albumTrackRows } = trackIds.length
    ? await supabase
        .from("album_tracks")
        .select("track_id, albums ( id, title, price_cents )")
        .in("track_id", trackIds)
    : { data: [] as any[] };

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

  const blockedTrackIds = Array.from(
    await tracksNeedingCoverCredit(normalizedTracks.map((t) => ({ id: t.id, genre: t.genre })))
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold">AI Music</h1>
          <p className="font-mono text-xs text-paper/50 mt-1">
            Every track here is disclosed by its own artist as 100% AI-generated.
          </p>
        </div>
        <Link href="/" className="font-mono text-sm hover:text-gold flex-shrink-0">
          ← Full storefront
        </Link>
      </header>

      <p className="text-paper/40 font-mono text-xs mb-10 max-w-xl">
        A space of their own for artists working entirely with AI tools — same 80/20 payout as
        every other track on Fyby, just browsed on its own instead of mixed in with human-made
        work. Tracks that are AI-assisted rather than fully AI-generated stay on the main
        storefront's AI Music row.
      </p>

      <div className="ticket-divider mb-10" />

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>}

      {!error && normalizedTracks.length === 0 && (
        <p className="text-paper/50 font-mono text-sm">
          No fully AI-generated tracks yet — check back soon, or browse the{" "}
          <Link href="/" className="text-gold">
            full storefront
          </Link>
          .
        </p>
      )}

      {!error && normalizedTracks.length > 0 && (
        <StorefrontGrid
          tracks={normalizedTracks}
          startCheckout={startCheckout}
          startAlbumCheckout={startAlbumCheckout}
          isLoggedIn={Boolean(user)}
          albumByTrackId={albumByTrackId}
          albumTrackCounts={albumTrackCounts}
          blockedTrackIds={blockedTrackIds}
          allGenres={allGenres}
          hideAiRow
        />
      )}
    </main>
  );
}
