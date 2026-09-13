import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";
import TrackList from "../TrackList";
import type { Contributor } from "../ContributorManager";
import { GENRES } from "@/lib/genres";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Browsing/editing already-released tracks, split out from the Music
// Library page (app/dashboard/library/page.tsx) — that page is for adding
// new music and bundling albums, this one's for managing what's already
// out, so each has its own focused page instead of one long combined view.
export default async function CatalogPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
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

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, created_at, audio_path, audio_url, cover_url, preview_url, genre, subgenre, custom_tag, ai_disclosure, verification_status, verification_note"
    )
    .eq("artist_id", artist?.id)
    .order("created_at", { ascending: false });

  // Admin-approved genre suggestions sit alongside the fixed list wherever a
  // genre picker is offered — TrackList's per-track edit form needs this too.
  const { data: approvedGenreRows } = await supabase.from("approved_genres").select("name").order("name");
  const allGenres = [...GENRES, ...(approvedGenreRows ?? []).map((g) => g.name)];

  // Audio lives in the private "track-audio" bucket, so playback here needs
  // a signed URL — ownership was already verified above (tracks scoped to
  // this artist's own artist_id), so it's safe to mint these with the
  // service-role client rather than a separate storage RLS round trip.
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

  // Contributors + their running "owed" totals, grouped by track so
  // TrackList can render each track's own contributor list. RLS ("artists
  // manage contributors on their own tracks" in supabase/schema.sql) already
  // scopes both queries to this artist even without the explicit filters
  // below, but the filters keep the query itself intention-revealing.
  const trackIds = (tracks ?? []).map((t) => t.id);

  const { data: contributorRows } = trackIds.length
    ? await supabase
        .from("contributors")
        .select("id, track_id, name, email, phone, publishing_info, percentage, stripe_account_id, onboarding_token")
        .in("track_id", trackIds)
    : { data: [] as any[] };

  const contributorIds = (contributorRows ?? []).map((c) => c.id);

  const { data: owedRows } = contributorIds.length
    ? await supabase
        .from("contributor_payouts")
        .select("contributor_id, amount_owed_cents")
        .eq("status", "owed")
        .in("contributor_id", contributorIds)
    : { data: [] as any[] };

  const owedByContributor = new Map<string, number>();
  for (const row of owedRows ?? []) {
    owedByContributor.set(
      row.contributor_id,
      (owedByContributor.get(row.contributor_id) ?? 0) + (row.amount_owed_cents ?? 0)
    );
  }

  const contributorsByTrack: Record<string, Contributor[]> = {};
  for (const c of contributorRows ?? []) {
    const list = contributorsByTrack[c.track_id] ?? [];
    list.push({ ...c, owedCents: owedByContributor.get(c.id) ?? 0 });
    contributorsByTrack[c.track_id] = list;
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-12">
        <Link href="/dashboard/library" className="font-mono text-xs text-paper/50 hover:text-gold">
          &larr; Music Library
        </Link>
        <h1 className="font-display text-3xl text-gold mt-2">Your Catalog</h1>
      </header>

      <div className="ticket-divider mb-10" />

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing released yet.{" "}
          <Link href="/dashboard/library" className="text-gold">
            Release your first track
          </Link>
          .
        </p>
      )}

      {artist?.id && (
        <TrackList
          tracks={tracksWithPlayUrls}
          artistId={artist.id}
          contributorsByTrack={contributorsByTrack}
          allGenres={allGenres}
        />
      )}
    </main>
  );
}
