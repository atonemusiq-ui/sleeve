import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logout } from "@/app/actions/auth";
import { connectStripeAccount } from "@/app/actions/stripe-connect";
import { redirect } from "next/navigation";
import Link from "next/link";
import BookingRequestsList, { type BookingRequest } from "./BookingRequestsList";
import BioManager from "./BioManager";
import ShareCard from "./ShareCard";
import GalleryManager from "./GalleryManager";
import VideoManager from "./VideoManager";
import ArtistVisibilityManager from "./ArtistVisibilityManager";
import ArtistHubManager from "./ArtistHubManager";
import CollapsibleSection from "@/app/CollapsibleSection";
import NotificationBell from "@/app/NotificationBell";
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
    .select(
            "id, plan, stripe_account_id, bio, bio_photo_url, gallery_urls, video_tier, bio_video_url, bio_video_type, is_active, custom_links, tour_dates, mailing_list_enabled"
    )
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
        .select(
          "id, fan_name, fan_email, fan_phone, event_date, event_location, message, status, created_at, inquiry_type"
        )
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const bookingRequests: BookingRequest[] = (bookingRows ?? []) as BookingRequest[];

  // Year-to-date earnings for the Payouts section, in cents. Track/album
  // sales only -- Super Fan subscription revenue isn't included here, since
  // that's a recurring stream an artist already tracks separately via their
  // Stripe dashboard, not a one-time sale. purchases has no RLS policy
  // letting an artist read rows for their own tracks (only "fans can read
  // their own purchases" -- supabase/schema.sql), so this goes through the
  // service-role client, same as the contributor-credits lookup on the
  // public artist page. "Complete" only -- a 'refunded' or 'disputed' sale's
  // artist_net_payout_cents no longer reflects money the artist actually
  // keeps, and "year to date" resets on Jan 1 in the server's clock (UTC).
  let ytdEarningsCents = 0;
  if (artist?.id) {
    const admin = createServiceRoleClient();
    const { data: ownTracks } = await admin.from("tracks").select("id").eq("artist_id", artist.id);
    const ownTrackIds = (ownTracks ?? []).map((t) => t.id);
    if (ownTrackIds.length > 0) {
      const yearStart = `${new Date().getFullYear()}-01-01T00:00:00.000Z`;
      const { data: ytdPurchases } = await admin
        .from("purchases")
        .select("artist_net_payout_cents")
        .in("track_id", ownTrackIds)
        .eq("status", "complete")
        .gte("created_at", yearStart);
      ytdEarningsCents = (ytdPurchases ?? []).reduce(
        (sum, p) => sum + (p.artist_net_payout_cents ?? 0),
        0
      );
    }
  }

  // Mailing-list signups (app/actions/artistHub.ts's joinMailingList,
  // ArtistHubManager.tsx's "Copy emails"). Oldest first so a "copy emails"
  // export lands in signup order, not reverse.
  const { data: fanRows } = artist?.id
    ? await supabase
        .from("artist_fans")
        .select("fan_email")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };
  const fanEmails: string[] = (fanRows ?? []).map((r: any) => r.fan_email);

  // New sale / booking / refund alerts (app/api/webhooks/stripe/route.ts,
  // app/actions/booking.ts) — most recent first, capped since this is a
  // dropdown, not its own page.
  const { data: notificationRows } = await supabase
    .from("notifications")
    .select("id, title, body, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Small status hints shown in each collapsed section's header, and used to
  // decide what should greet the artist already open vs. tucked away.
  const galleryUrls: string[] = (artist as any)?.gallery_urls ?? [];
  const hasVideo = Boolean((artist as any)?.bio_video_url);
  const newBookingsCount = bookingRequests.filter((r) => r.status === "new").length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
        <div>
          <h1 className="font-display text-3xl text-gold">Artist Studio</h1>
          <p className="font-mono text-sm text-paper/60 mt-1">{profile.display_name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-sm">
          <NotificationBell notifications={notificationRows ?? []} />
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

            <Link
                      href="/dashboard/subscription"
                      className="flex items-center justify-between gap-4 border border-paper/15 rounded-lg px-6 py-5 mb-10 bg-paper/5 hover:bg-paper/10"
                    >
        <div>
                  <h2 className="font-display text-lg">Subscription</h2>
                    <p className="font-mono text-xs text-paper/60 mt-1">
                      {(artist as any)?.plan === "pro"
                                      ? "Pro plan -- 5% commission on every sale."
                                      : (artist as any)?.plan === "artist"
                                      ? "Artist plan -- 10% commission on every sale."
                                      : "Free plan -- 15% commission on every sale. Upgrade to lower it."}
                    </p>
        </div>
                      <span className="font-mono text-xs text-gold flex-shrink-0">Manage &rarr;</span>
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
        <div className="mt-3 mb-1">
          <p className="font-mono text-[10px] text-paper/40 uppercase">
            {new Date().getFullYear()} earnings
          </p>
          <p className="font-display text-2xl text-forest">
            ${(ytdEarningsCents / 100).toFixed(2)}
          </p>
          <p className="font-mono text-[10px] text-paper/40 mt-0.5">
            Track and album sales, year to date. Super Fan subscriptions aren&apos;t included --
            see your Stripe dashboard for that.
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

      <CollapsibleSection
        title="Links, tour dates & mailing list"
        badge={
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
            {fanEmails.length} signup{fanEmails.length === 1 ? "" : "s"}
          </span>
        }
      >
        <p className="font-mono text-xs text-paper/60 mb-4">
          All shown on your public artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track released"
          )}.
        </p>
        {artist?.id && (
          <ArtistHubManager
            customLinks={((artist as any).custom_links as { label: string; url: string }[]) ?? []}
            tourDates={(artist as any).tour_dates ?? null}
            mailingListEnabled={(artist as any).mailing_list_enabled !== false}
            fanEmails={fanEmails}
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
        title="Booking & collaboration requests"
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
          Fans can send a booking inquiry, a collaboration request, or both from your public
          artist page — {artist?.id ? (
            <Link href={`/artists/${artist.id}`} className="text-gold">
              preview it
            </Link>
          ) : (
            "preview it once you have a track released"
          )}.
        </p>
        <BookingRequestsList requests={bookingRequests} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Page visibility"
        defaultOpen={(artist as any)?.is_active === false}
        badge={
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
              (artist as any)?.is_active === false
                ? "text-rust border-rust/40"
                : "text-forest border-forest/40"
            }`}
          >
            {(artist as any)?.is_active === false ? "Hidden" : "Active"}
          </span>
        }
      >
        <ArtistVisibilityManager isActive={(artist as any)?.is_active !== false} />
      </CollapsibleSection>
    </main>
  );
}
