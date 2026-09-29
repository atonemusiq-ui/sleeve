import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { startCheckout } from "@/app/actions/checkout";
import { tracksNeedingCoverCredit } from "@/lib/coverCompliance";
import { GENRES } from "@/lib/genres";
import Link from "next/link";
import DiscoverTabs from "./DiscoverTabs";
import FybyLogo from "../FybyLogo";

// Phase 9: three ways to browse instead of just one long homepage grid --
// a plain recency feed (with genre/AI-disclosure filters, same as the
// homepage's "New Releases" row but with filters added), a personalized
// "For You" feed built from who a fan follows
// (app/artists/[id]/FollowButton.tsx) or has bought from, and a "Trending"
// feed ranked by purchase volume over the last 30 days. All three start
// from the same active/non-frozen track list as the homepage
// (app/page.tsx) -- this page just reorders/filters it three different
// ways rather than maintaining three separate track queries.
export default async function DiscoverPage() {
  const supabase = createClient();

  const { data: tracks } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, created_at, cover_url, preview_url, genre, subgenre, custom_tag, ai_disclosure, explicit, artists!inner ( id, is_active, profiles ( display_name ) )"
    )
    .eq("artists.is_active", true)
    .eq("frozen", false)
    .order("created_at", { ascending: false });

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

  const blockedTrackIds = Array.from(
    await tracksNeedingCoverCredit(normalizedTracks.map((t) => ({ id: t.id, genre: t.genre })))
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "For You": tracks by an artist the fan follows (artist_follows) or has
  // bought from before (purchases -> tracks.artist_id). Two separate small
  // queries rather than one join so a fan with neither yet just gets two
  // empty results instead of a query that needs an outer join to not
  // exclude them.
  const personalizedArtistIds = new Set<string>();
  if (user) {
    const [{ data: followRows }, { data: purchaseRows }] = await Promise.all([
      supabase.from("artist_follows").select("artist_id").eq("fan_id", user.id),
      supabase
        .from("purchases")
        .select("tracks ( artist_id )")
        .eq("fan_id", user.id)
        .eq("status", "complete"),
    ]);
    for (const row of followRows ?? []) personalizedArtistIds.add((row as any).artist_id);
    for (const row of purchaseRows ?? []) {
      const artistId = (row as any).tracks?.artist_id;
      if (artistId) personalizedArtistIds.add(artistId);
    }
  }

  const personalizedTracks = normalizedTracks.filter((t) => personalizedArtistIds.has(t.artists?.id));

  // "Trending": purchase volume over the last 30 days, across every fan --
  // an aggregate count, never which fan bought what, so this is the one
  // place on this page that reads through the service-role client instead
  // of the signed-in user's own session (the "fans can read their own
  // purchases" policy in supabase/schema.sql only lets a user see their own
  // rows, which a global trending count can't be built from).
  const admin = createServiceRoleClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPurchases } = await admin
    .from("purchases")
    .select("track_id")
    .eq("status", "complete")
    .gte("created_at", thirtyDaysAgo);

  const purchaseCounts: Record<string, number> = {};
  for (const row of recentPurchases ?? []) {
    if (!row.track_id) continue;
    purchaseCounts[row.track_id] = (purchaseCounts[row.track_id] ?? 0) + 1;
  }

  const trendingTracks = normalizedTracks
    .filter((t) => (purchaseCounts[t.id] ?? 0) > 0)
    .sort((a, b) => (purchaseCounts[b.id] ?? 0) - (purchaseCounts[a.id] ?? 0));

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <header className="flex items-center justify-between mb-12">
        <Link href="/" className="flex items-center gap-2.5">
          <FybyLogo className="h-8 w-8" />
          <h1 className="font-display text-3xl text-gold leading-none">Fyby</h1>
        </Link>
        <nav className="font-mono text-sm">
          <Link href="/" className="hover:text-gold">
            Home
          </Link>
        </nav>
      </header>

      <h2 className="font-display text-2xl mb-2">Discover</h2>
      <p className="text-paper/40 font-mono text-xs mb-10 max-w-xl">
        Browse what&apos;s new, what&apos;s trending, or what&apos;s picked for you based on who
        you follow and have bought from.
      </p>

      <DiscoverTabs
        recencyTracks={normalizedTracks}
        personalizedTracks={personalizedTracks}
        trendingTracks={trendingTracks}
        hasPersonalization={Boolean(user) && personalizedArtistIds.size > 0}
        isLoggedIn={Boolean(user)}
        startCheckout={startCheckout}
        blockedTrackIds={blockedTrackIds}
        allGenres={allGenres}
      />
    </main>
  );
}
