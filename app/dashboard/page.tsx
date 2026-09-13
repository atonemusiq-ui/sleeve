import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { connectStripeAccount } from "@/app/actions/stripe-connect";
import { redirect } from "next/navigation";
import Link from "next/link";
import BookingRequestsList, { type BookingRequest } from "./BookingRequestsList";
import BioManager from "./BioManager";
import ShareCard from "./ShareCard";
import GalleryManager from "./GalleryManager";
import VideoManager from "./VideoManager";
import CollapsibleSection from "@/app/CollapsibleSection";
import type { VideoTier } from "@/lib/videoTiers";

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
    .select("id, stripe_account_id, bio, bio_photo_url, gallery_urls, video_tier, bio_video_url, bio_video_type")
    .eq("user_id", user.id)
    .single();

  // Releasing/organizing/browsing tracks now lives on its own page
  // (app/dashboard/library/page.tsx) — this count is just enough to show on
  // the banner linking there, without pulling in the full track rows,
  // signed audio URLs, contributors, and albums that page needs.
  const { count: trackCount } = artist?.id
    ? await supabase
        .from("tracks")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", artist.id)
    : { count: 0 };

  // Booking requests fans submit from this artist's public page
  // (app/artists/[id]/BookingForm.tsx). RLS ("artists manage their own
  // booking requests" in supabase/schema.sql) already scopes this to rows
  // this artist owns even without the explicit filter, but the filter keeps
  // the query itself intention-revealing.
  const { data: bookingRows } = artist?.id
    ? await supabase
        .from("booking_requests")
        .select("id, fan_name, fan_email, fan_phone, event_date, event_location, message, status, created_at")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const bookingRequests: BookingRequest[] = (bookingRows ?? []) as BookingRequest[];

  // Small status hints shown in each collapsed section's header, and used to
  // decide what should greet the artist already open vs. tucked away.
  const galleryUrls: string[] = (artist as any)?.gallery_urls ?? [];
  const hasVideo = Boolean((artist as any)?.bio_video_url);
  const newBookingsCount = bookingRequests.filter((r) => r.status === "new").length;

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

      <Link
        href="/dashboard/library"
        className="flex items-center justify-between gap-4 border border-gold/40 rounded-lg px-6 py-5 mb-10 bg-gold/5 hover:bg-gold/10"
      >
        <div>
          <h2 className="font-display text-lg text-gold">Your Music Library</h2>
          <p className="font-mono text-xs text-paper/60 mt-1">
            Release new tracks, manage albums, and get to your catalog —{" "}
            {trackCount ?? 0} track{trackCount === 1 ? "" : "s"} live.
          </p>
        </div>
        <span className="font-mono text-xs text-gold flex-shrink-0">Open &rarr;</span>
      </Link>

      <CollapsibleSection
        title="Payouts"
        defaultOpen={!artist?.stripe_account_id}
        badge={
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
              artist?.stripe_account_id
                ? "text-forest border-forest/40"
                : "text-rust border-rust/40"
            }`}
          >
            {artist?.stripe_account_id ? "Connected" : "Not connected"}
          </span>
        }
      >
        <p className="font-mono text-xs text-paper/60">
          {artist?.stripe_account_id
            ? "Bank account connected via Stripe."
            : "Connect a bank account to get paid when your tracks sell."}
        </p>
        <form action={connectStripeAccount}>
          <button
            type="submit"
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
          >
            {artist?.stripe_account_id ? "Update payout info" : "Connect bank account"}
          </button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection title="Bio" defaultOpen={!artist?.bio}>
        <p className="font-mono text-xs text-paper/60">
          Shown on your public artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track released"
          )}.
        </p>
        {artist?.id && (
          <BioManager
            artistId={artist.id}
            bio={artist.bio}
            bioPhotoUrl={(artist as any).bio_photo_url ?? null}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Share on social media">
        <p className="font-mono text-xs text-paper/60">
          A mic-branded graphic with a QR code straight to your artist page — made for posts on
          apps that don&apos;t let you drop a clickable link into a caption.
        </p>
        {artist?.id && <ShareCard artistId={artist.id} artistName={profile.display_name} />}
      </CollapsibleSection>

      <CollapsibleSection
        title="Photo gallery"
        badge={
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
            {galleryUrls.length}/4 photos
          </span>
        }
      >
        <p className="font-mono text-xs text-paper/60">
          Up to 4 photos shown on your public artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track released"
          )}.
        </p>
        {artist?.id && <GalleryManager artistId={artist.id} galleryUrls={galleryUrls} />}
      </CollapsibleSection>

      <CollapsibleSection
        title="Music video"
        badge={
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
            {hasVideo ? "Added" : "Not added"}
          </span>
        }
      >
        <p className="font-mono text-xs text-paper/60">
          Shown on your public artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track released"
          )}
          . A paid add-on since video costs more to host than a photo — pick whichever tier fits how
          you want to share it.
        </p>
        {artist?.id && (
          <VideoManager
            artistId={artist.id}
            videoTier={((artist as any).video_tier as VideoTier | null) ?? null}
            bioVideoUrl={(artist as any).bio_video_url ?? null}
            bioVideoType={(artist as any).bio_video_type ?? null}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Booking requests"
        defaultOpen={newBookingsCount > 0}
        badge={
          newBookingsCount > 0 && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-gold/40 text-gold">
              {newBookingsCount} new
            </span>
          )
        }
      >
        <p className="font-mono text-xs text-paper/60">
          Fans can send these from your public artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track released"
          )}.
        </p>
        <BookingRequestsList requests={bookingRequests} />
      </CollapsibleSection>
    </main>
  );
}
