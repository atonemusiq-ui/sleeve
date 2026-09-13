import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import UploadForm from "../UploadForm";
import AlbumManager, { type Album } from "../AlbumManager";
import { GENRES } from "@/lib/genres";

// Split out of the main Artist Studio dashboard (app/dashboard/page.tsx) so
// releasing/organizing your own music has its own focused page instead of
// living alongside the profile/business settings sections. Browsing/editing
// already-released tracks has its own page too now (app/dashboard/catalog),
// since that's a different job — this page is for adding new music and
// bundling it into albums, that one's for managing what's already out.
export default async function MusicLibraryPage() {
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
    .select("id")
    .eq("user_id", user.id)
    .single();

  // Admin-approved genre suggestions (see app/actions/genres.ts and
  // app/admin/genres/page.tsx) sit alongside the fixed list from
  // lib/genres.ts wherever a genre picker is offered — publicly readable,
  // so the plain (non-service-role) client is fine here.
  const { data: approvedGenreRows } = await supabase.from("approved_genres").select("name").order("name");
  const allGenres = [...GENRES, ...(approvedGenreRows ?? []).map((g) => g.name)];

  // Only id/title are needed here — enough for AlbumManager to offer tracks
  // to bundle. Full track rows (with signed play URLs, contributors, etc.)
  // are fetched on the catalog page instead. { count: "exact" } piggybacks a
  // total count onto this same query rather than running a second one just
  // for the "Your Catalog" banner below.
  const { data: tracks, count: trackCount } = artist?.id
    ? await supabase
        .from("tracks")
        .select("id, title", { count: "exact" })
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
    : { data: [] as any[], count: 0 };

  // Albums + their ordered track lists, scoped to this artist. RLS ("artists
  // manage their own albums"/"...album_tracks" in supabase/schema.sql)
  // already limits both to rows this artist owns.
  const { data: albumRows } = artist?.id
    ? await supabase
        .from("albums")
        .select("id, title, price_cents, created_at")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const albumIds = (albumRows ?? []).map((a) => a.id);
  const { data: albumTrackRows } = albumIds.length
    ? await supabase
        .from("album_tracks")
        .select("album_id, track_order, tracks ( id, title )")
        .in("album_id", albumIds)
        .order("track_order", { ascending: true })
    : { data: [] as any[] };

  const albums: Album[] = (albumRows ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    price_cents: a.price_cents,
    tracks: (albumTrackRows ?? [])
      .filter((at) => at.album_id === a.id)
      .map((at) => ({ id: (at.tracks as any)?.id, title: (at.tracks as any)?.title ?? "Untitled" })),
  }));

  const albumEligibleTracks = (tracks ?? []).map((t) => ({ id: t.id, title: t.title }));

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <div>
          <Link href="/dashboard" className="font-mono text-xs text-paper/50 hover:text-gold">
            &larr; Artist Studio
          </Link>
          <h1 className="font-display text-3xl text-gold mt-2">Music Library</h1>
        </div>
        {artist?.id && (
          <Link href={`/artists/${artist.id}`} className="font-mono text-sm hover:text-gold">
            View public profile
          </Link>
        )}
      </header>

      <div className="ticket-divider mb-10" />

      {artist?.id && <UploadForm artistId={artist.id} allGenres={allGenres} />}

      {artist?.id && <AlbumManager tracks={albumEligibleTracks} albums={albums} />}

      <Link
        href="/dashboard/catalog"
        className="flex items-center justify-between gap-4 border border-gold/40 rounded-lg px-6 py-5 mt-2 bg-gold/5 hover:bg-gold/10"
      >
        <div>
          <h2 className="font-display text-lg text-gold">Your Catalog</h2>
          <p className="font-mono text-xs text-paper/60 mt-1">
            Browse, edit, and manage your {trackCount ?? 0} released track{trackCount === 1 ? "" : "s"}.
          </p>
        </div>
        <span className="font-mono text-xs text-gold flex-shrink-0">Open &rarr;</span>
      </Link>
    </main>
  );
}
