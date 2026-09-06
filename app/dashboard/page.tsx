import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logout } from "@/app/actions/auth";
import { connectStripeAccount } from "@/app/actions/stripe-connect";
import { updateBio } from "@/app/actions/artist";
import { redirect } from "next/navigation";
import Link from "next/link";
import UploadForm from "./UploadForm";
import TrackList from "./TrackList";
import AlbumManager, { type Album } from "./AlbumManager";
import type { Contributor } from "./ContributorManager";
import BookingRequestsList, { type BookingRequest } from "./BookingRequestsList";

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
    .select("id, stripe_account_id, bio")
    .eq("user_id", user.id)
    .single();

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, created_at, audio_path, audio_url, cover_url, preview_url, genre, custom_tag, ai_disclosure"
    )
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

  // Contributors + their running "owed" totals, grouped by track so
  // TrackList can render each track's own contributor list. RLS ("artists
  // manage contributors on their own tracks" in supabase/schema.sql) already
  // scopes both queries to this artist even without the explicit filters
  // below, but the filters keep the query itself intention-revealing.
  const trackIds = (tracks ?? []).map((t) => t.id);

  const { data: contributorRows } = trackIds.length
    ? await supabase
        .from("contributors")
        .select("id, track_id, name, email, phone, publishing_info, percentage")
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

  // Booking requests fans submit from this artist's public page
  // (app/artists/[id]/BookingForm.tsx). RLS ("artists manage their own
  // booking requests" in supabase/schema.sql) already scopes this to rows
  // this artist owns even without the explicit filter, but the filter keeps
  // the query itself intention-revealing (same pattern as albums above).
  const { data: bookingRows } = artist?.id
    ? await supabase
        .from("booking_requests")
        .select("id, fan_name, fan_email, fan_phone, event_date, event_location, message, status, created_at")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const bookingRequests: BookingRequest[] = (bookingRows ?? []) as BookingRequest[];

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

      <div className="border border-paper/15 rounded-lg p-6 mb-10 flex flex-col gap-3">
        <h2 className="font-display text-lg">Bio</h2>
        <p className="font-mono text-xs text-paper/60">
          Shown on your public artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track published"
          )}.
        </p>
        <form action={updateBio} className="flex flex-col gap-3">
          <textarea
            name="bio"
            defaultValue={artist?.bio ?? ""}
            rows={4}
            placeholder="Tell fans a bit about yourself..."
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
          <button
            type="submit"
            className="self-start font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
          >
            Save bio
          </button>
        </form>
      </div>

      <div className="border border-paper/15 rounded-lg p-6 mb-10 flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg">Booking requests</h2>
          <p className="font-mono text-xs text-paper/60 mt-1">
            Fans can send these from your public artist page — {artist?.id ? (
              <Link href={`/artists/${artist.id}`} className="text-gold">
                preview it
              </Link>
            ) : (
              "preview it once you have a track published"
            )}.
          </p>
        </div>
        <BookingRequestsList requests={bookingRequests} />
      </div>

      {artist?.id && <UploadForm artistId={artist.id} />}

      {artist?.id && <AlbumManager tracks={albumEligibleTracks} albums={albums} />}

      <h2 className="font-display text-xl mb-4">Your catalog</h2>

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing published yet. Use the form above to publish your first track.
        </p>
      )}

      {artist?.id && (
        <TrackList
          tracks={tracksWithPlayUrls}
          artistId={artist.id}
          contributorsByTrack={contributorsByTrack}
        />
      )}
    </main>
  );
}
