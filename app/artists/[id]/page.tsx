import { createClient } from "@/lib/supabase/server";
import TrackAudio from "@/app/TrackAudio";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tracksNeedingCoverCredit } from "@/lib/coverCompliance";
import { aiDisclosureBadge } from "@/lib/aiDisclosure";
import { isUuid } from "@/lib/uuid";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BookingForm from "./BookingForm";
import ReportVideoButton from "./ReportVideoButton";
import VideoEmbed from "@/app/VideoEmbed";
import CollapsibleSection from "@/app/CollapsibleSection";
import SuperFanSection from "@/app/SuperFanSection";
import LyricsCreditsDialog from "@/app/LyricsCreditsDialog";
import MailingListForm from "./MailingListForm";
import BuyTrackForm from "./BuyTrackForm";
import { formatReleaseDate, isPreorder } from "@/lib/preorder";
import { offeredTiers } from "@/lib/licensing";
import { COVERS_GENRE } from "@/lib/genres";
import FanReferralLink from "./FanReferralLink";
import FollowButton from "./FollowButton";
import MerchProductCard from "@/app/merch/MerchProductCard";
import { connectRoleLabel } from "@/lib/connectRoles";
import SponsoredCard from "@/app/SponsoredCard";
import { featureOn } from "@/lib/phaseServer";
import RemoveTrackButton from "@/app/dashboard/RemoveTrackButton";
import { getLang, getT } from "@/lib/i18n/server";
import { dateLocale } from "@/lib/i18n/config";
import { artistCirclePhoto } from "@/lib/artistPhoto";

// Powers the og:title/og:description a crawler shows alongside the image
// from this same folder's opengraph-image.tsx when a plain artist link is
// pasted anywhere that unfurls it (iMessage, WhatsApp, Twitter/X, Facebook,
// Discord, Slack, email — see that file's comment for the full list).
// Instagram/TikTok/Snapchat don't unfurl links in a post at all, which is
// why there's a separate downloadable QR sticker for those
// (app/artists/[id]/share-card/route.tsx).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const admin = createServiceRoleClient();
  const { data: artist } = await admin
    .from("artists")
    .select("bio, profiles ( display_name )")
    .eq("id", params.id)
    .maybeSingle();

  const artistName = (artist as any)?.profiles?.display_name ?? "an artist on Fyby";
  const description =
    (artist as any)?.bio ??
    `Hear ${artistName}'s music and buy it directly — no label, no streaming middleman.`;

  return {
    title: `${artistName} | Fyby`,
    description,
    openGraph: { title: artistName, description, type: "profile" },
    twitter: { card: "summary_large_image", title: artistName, description },
  };
}

export default async function ArtistPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { superfan?: string; gift?: string; ref?: string };
}) {
  const supabase = createClient();
  const t = getT();
  const lang = getLang();

  const { data: artist } = await supabase
    .from("artists")
    .select(
      "id, user_id, is_active, bio, bio_photo_url, gallery_urls, bio_video_url, bio_video_type, custom_links, tour_dates, mailing_list_enabled, profiles ( display_name )"
    )
    .eq("id", params.id)
    .single();

  if (!artist) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user?.id === (artist as any).user_id;

  // A canceled artist page (is_active = false — see app/actions/artist.ts's
  // setArtistActive) is meant to disappear for everyone except the artist
  // themselves, who still needs to reach it to reactivate. RLS
  // (supabase/schema.sql) already stops an anonymous/other-user request from
  // reading this row at all once it's inactive, so a non-owner request
  // reaches here with `artist` present only because they're either the
  // owner or the row is active — this check is the belt to that RLS
  // suspenders, and what actually decides whether to show the hidden banner.
  if (!(artist as any).is_active && !isOwner) {
    notFound();
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, cover_url, preview_url, created_at, frozen, genre, custom_tag, ai_disclosure, explicit, lyrics, release_at, license_enabled, license_beat_cents, license_standard_cents, license_commercial_cents, vinyl_url"
    )
    // A frozen track (app/admin/moderation/page.tsx's freezeTrack) is hidden
    // here for everyone, owner included — the artist already sees why in
    // their own catalog (app/dashboard/TrackList.tsx) and the notification
    // freezing sent them.
    .eq("artist_id", artist.id)
    .eq("frozen", false)
    .order("created_at", { ascending: false });

  const artistName = (artist as any).profiles?.display_name ?? "Unknown artist";
  // Round photo at the top: profile photo, else a gallery photo, else the
  // newest cover art (lib/artistPhoto.ts).
  const circlePhoto = artistCirclePhoto({ ...(artist as any), tracks: (tracks ?? []) as any[] });
  const galleryUrls: string[] = ((artist as any).gallery_urls ?? []).filter(Boolean);

  // Contributor names for the "Lyrics & Credits" dialog (app/LyricsCreditsDialog.tsx).
  // Credits are just names -- never percentage/email/phone -- and contributors is
  // RLS-locked to the owning artist (supabase/schema.sql), so a buyer's session can't
  // read it directly. The service-role client bypasses that, and this query is scoped
  // to exactly the name column so nothing more sensitive ever leaves the server.
  const creditsByTrack: Record<string, string[]> = {};
  if (tracks && tracks.length > 0) {
    const admin = createServiceRoleClient();
    const { data: contributorRows } = await admin
      .from("contributors")
      .select("track_id, name")
      .in(
        "track_id",
        tracks.map((t) => t.id)
      );
    for (const row of contributorRows ?? []) {
      const list = creditsByTrack[row.track_id] ?? [];
      list.push(row.name);
      creditsByTrack[row.track_id] = list;
    }
  }

  // Whether the logged-in fan is already a Super Fan of this artist, so the
  // panel can say so instead of offering a subscription that
  // startSuperFanCheckout would just reject. Gated by the "Fans can view
  // their own super fan subscriptions" RLS policy (supabase/schema.sql), so
  // this only ever sees the viewer's own row.
  let isSuperFan = false;
  if (user) {
    const { data: subscription } = await supabase
      .from("artist_subscriptions")
      .select("id")
      .eq("fan_id", user.id)
      .eq("artist_id", artist.id)
      .eq("status", "active")
      .maybeSingle();

    isSuperFan = Boolean(subscription);
  }

  // Whether the logged-in fan already follows this artist -- powers the
  // Follow/Following toggle below (FollowButton.tsx) and, together with
  // purchase history, the "For You" tab on /discover
  // (app/discover/page.tsx reads the same artist_follows table). Gated the
  // same way as isSuperFan above: RLS only lets a fan see their own row.
  let isFollowing = false;
  if (user && !isOwner) {
    const { data: followRow } = await supabase
      .from("artist_follows")
      .select("id")
      .eq("fan_id", user.id)
      .eq("artist_id", artist.id)
      .maybeSingle();

    isFollowing = Boolean(followRow);
  }

  // A fan who arrived from another fan's referral link, for
  // artist_subscriptions.referred_by_fan_id. Ignored if it points at the
  // viewer themselves, so a fan can't refer themselves by editing their link.
  // Shape-checked before it goes anywhere near a form: this value
  // ends up in a `uuid references profiles(id)` column, and `?ref=anything`
  // in a shared link would otherwise fail that insert inside the webhook and
  // leave a paying fan with no subscription row. startSuperFanCheckout checks
  // it again, since the form post is not the only way to reach the action.
  const referredByFanId =
    isUuid(searchParams.ref) && searchParams.ref !== user?.id ? searchParams.ref : null;

  // Cover songs (see lib/coverCompliance.ts) can't be sold until the artist
  // has credited the original songwriter/producer as a contributor.
  const blockedTrackIds = await tracksNeedingCoverCredit(
    (tracks ?? []).map((t) => ({ id: t.id, genre: t.genre }))
  );

  // What SuperFanSection builds its share link from. Deliberately the
  // shape-checked value rather than the raw `?ref=` query param, so a junk
  // value in a shared link can never reach the uuid column behind it.
  const referralFanId = referredByFanId;

  // Merch Booth (app/merch): every artist's active merch shows here,
  // whatever their plan. The Booth page itself only features Pro artists.
  const { data: merchRows } = await supabase
    .from("merch_products")
    .select("id, title, product_key, color, design_url, price_cents")
    .eq("artist_id", artist.id)
    .eq("active", true)
    .order("created_at", { ascending: false });
  const merchProducts = (merchRows ?? []) as any[];

  // Fyby Connect (app/connect): the roles this artist offers, if they've
  // set up a Connect profile and are taking requests.
  const { data: connectProfile } = await supabase
    .from("connect_profiles")
    .select("roles, available")
    .eq("user_id", (artist as any).user_id)
    .maybeSingle();
  const connectRoles: string[] = connectProfile?.available ? (connectProfile.roles ?? []) : [];

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="font-mono text-xs text-paper/50 hover:text-gold">
          {t("artist.back")}
        </Link>
        <nav className="font-mono text-xs">
          {user ? (
            <Link href="/library" className="hover:text-gold">
              {t("artist.myMusic")}
            </Link>
          ) : (
            <Link href="/login" className="hover:text-gold">
              {t("artist.logIn")}
            </Link>
          )}
        </nav>
      </div>

      {isOwner && !(artist as any).is_active && (
        <div className="mb-8 border border-rust/40 rounded-lg p-4 bg-rust/5">
          <p className="font-mono text-xs text-rust">
            {t("artist.hidden")}{" "}
            <Link href="/dashboard" className="underline hover:text-gold">
              {t("artist.reactivate")}
            </Link>
            .
          </p>
        </div>
      )}

      {/* Stripe sends the fan back here after checkout — see the success_url
          in app/actions/superfan.ts. The subscription/gift row itself is
          written by the webhook, which may land a moment later, so these
          confirm the payment rather than reading back the new row. */}
      {searchParams.superfan === "success" && (
        <div className="mb-8 border border-forest/40 rounded-lg p-4 bg-forest/10">
          <p className="font-mono text-sm text-forest">
            {t("artist.superfanThanks", { name: artistName })}
          </p>
        </div>
      )}

      {searchParams.gift === "success" && (
        <div className="mb-8 border border-forest/40 rounded-lg p-4 bg-forest/10">
          <p className="font-mono text-sm text-forest">
            {t("artist.giftThanks", { name: artistName })}
          </p>
        </div>
      )}

      {/* Only the artist sees this: quick ways to change their own page. */}
      {isOwner && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border border-gold/30 bg-gold/5 rounded-lg px-4 py-3">
          <span className="font-mono text-xs text-paper/60 mr-1">{t("artist.yourPage")}</span>
          <Link
            href="/dashboard?edit=photos#photos"
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
          >
            {t("artist.editPhotos")}
          </Link>
          <Link
            href="/dashboard/catalog"
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
          >
            {t("artist.manageSongs")}
          </Link>
          <Link
            href="/dashboard?edit=photos#photos"
            className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 text-paper/70 hover:bg-paper/10"
          >
            {t("artist.editBio")}
          </Link>
        </div>
      )}

      <header className="mt-6 mb-10 flex items-start justify-between gap-5">
        <div className="flex items-start gap-5">
          {circlePhoto && (
            <div className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={circlePhoto}
                alt={artistName}
                className="w-20 h-20 rounded-full object-cover border border-paper/15"
              />
              {isOwner && (
                <Link
                  href="/dashboard?edit=photos#photos"
                  title={t("artist.editPhotoTitle")}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ink border border-gold/50 flex items-center justify-center text-xs hover:bg-gold/20"
                >
                  ✏️
                </Link>
              )}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl text-gold flex items-center gap-2">
              {artistName}
              {isOwner && (
                <Link
                  href="/dashboard?edit=photos#photos"
                  title={t("artist.editNameTitle")}
                  className="font-mono text-xs px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10"
                >
                  ✏️
                </Link>
              )}
            </h1>
            {artist.bio && <p className="text-paper/70 mt-3 max-w-xl">{artist.bio}</p>}
          </div>
        </div>

        {!isOwner && (artist as any).is_active && user && (
          <FollowButton artistId={artist.id} isFollowing={isFollowing} />
        )}
      </header>

      {galleryUrls.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {galleryUrls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-paper/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={t("artist.photoAlt", { name: artistName, n: i + 1 })} className="w-full h-full object-cover" />
                {isOwner && (
                  <Link
                    href="/dashboard?edit=photos#gallery"
                    title={t("artist.editPhotoTitle")}
                    className="absolute top-2 right-2 font-mono text-[11px] px-2 py-1 rounded bg-ink/80 border border-gold/50 text-gold hover:bg-ink"
                  >
                    {t("artist.edit")}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {(artist as any).bio_video_url && (artist as any).bio_video_type && (
        <div className="mb-10">
          <VideoEmbed type={(artist as any).bio_video_type} url={(artist as any).bio_video_url} />
          <ReportVideoButton artistId={artist.id} videoUrl={(artist as any).bio_video_url} />
        </div>
      )}

      {/* Custom links, tour dates, and mailing-list signup (Phase 7 --
          app/dashboard/ArtistHubManager.tsx is where the artist manages
          these). Skipped entirely when the artist hasn't set any of the
          three, so a page with none of this doesn't show an empty block. */}
      {(() => {
        const customLinks = ((artist as any).custom_links as { label: string; url: string }[]) ?? [];
        const tourDates = (artist as any).tour_dates as string | null;
        const mailingListEnabled = (artist as any).mailing_list_enabled !== false;
        if (customLinks.length === 0 && !tourDates && !mailingListEnabled) return null;

        return (
          <div className="mb-10 flex flex-col gap-6">
            {customLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs px-3 py-1.5 rounded-full border border-paper/20 text-paper/70 hover:border-gold hover:text-gold"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {tourDates && (
              <div>
                <p className="font-mono text-xs text-paper/40 uppercase mb-2">{t("artist.tourDates")}</p>
                <p className="font-body text-sm text-paper/80 whitespace-pre-wrap">{tourDates}</p>
              </div>
            )}

            {mailingListEnabled && (
              <div>
                <p className="font-mono text-xs text-paper/40 uppercase mb-2">{t("artist.mailingList")}</p>
                <MailingListForm artistId={artist.id} artistName={artistName} />
              </div>
            )}
          </div>
        );
      })()}

      <div className="ticket-divider mb-10" />

      {(!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">{t("artist.noTracks")}</p>
      )}

      {tracks && tracks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="border border-paper/15 rounded-lg p-5 bg-paper/5 flex flex-col justify-between"
            >
              <div>
                <div className="w-full aspect-square rounded bg-paper/10 overflow-hidden mb-4">
                  {track.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-paper/30 text-3xl">
                      ♪
                    </div>
                  )}
                </div>
                <h2 className="font-display text-xl">{track.title}</h2>
                {isPreorder((track as any).release_at) && (
                  <p className="font-mono text-xs text-flame mt-1">
                    {t("store.preorderOut", { date: formatReleaseDate((track as any).release_at, dateLocale(lang)) })}
                  </p>
                )}
                {(track.genre ||
                  track.custom_tag ||
                  aiDisclosureBadge(track.ai_disclosure) ||
                  (track as any).explicit) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {track.genre && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
                        {track.genre}
                      </span>
                    )}
                    {track.custom_tag && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
                        #{track.custom_tag}
                      </span>
                    )}
                    {aiDisclosureBadge(track.ai_disclosure) && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-gold/40 text-gold">
                        {t(`badges.${track.ai_disclosure}`)}
                      </span>
                    )}
                    {(track as any).explicit && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-rust/50 text-rust">
                        {t("badges.explicit")}
                      </span>
                    )}
                  </div>
                )}
              <TrackAudio trackId={track.id} previewUrl={track.preview_url} releaseAt={(track as any).release_at ?? null} />
              <LyricsCreditsDialog
                trackTitle={track.title}
                lyrics={(track as any).lyrics ?? null}
                credits={creditsByTrack[track.id] ?? []}
              />
              {isOwner && (
                <div className="mt-3">
                  <RemoveTrackButton trackId={track.id} title={track.title} compact />
                </div>
              )}
              </div>
              <div className="flex items-center justify-between mt-6">
                {blockedTrackIds.has(track.id) ? (
                  <p className="font-mono text-xs text-rust">
                    {t("artist.coverPending")}
                  </p>
                ) : !(artist as any).is_active ? (
                  <p className="font-mono text-xs text-rust">{t("artist.buyingOff")}</p>
                ) : (
                  <>
                    <span className="font-mono text-forest text-lg">
                      ${(track.price_cents / 100).toFixed(2)}
                    </span>
                    <BuyTrackForm
                      trackId={track.id}
                      isLoggedIn={Boolean(user)}
                      referredByFanId={referredByFanId}
                      isPreorder={isPreorder((track as any).release_at)}
                    />
                  </>
                )}
              </div>
              {/* Beat & sync licensing (lib/licensing.ts): shown only when the
                  artist offers at least one tier and the song is out. */}
              {(artist as any).is_active &&
                track.genre !== COVERS_GENRE &&
                !isPreorder((track as any).release_at) &&
                offeredTiers(track as any).length > 0 && (
                  <Link
                    href={`/license/${track.id}`}
                    className="mt-3 font-mono text-xs text-gold hover:underline self-end"
                  >
                    {t("artist.license", {
                      price: (Math.min(...offeredTiers(track as any).map((o) => o.priceCents)) / 100).toFixed(0),
                    })}
                  </Link>
                )}
              {/* Get it on Vinyl (lib/vinyl.ts): a link-out to the artist's
                  on-demand pressing. Fyby doesn't sell or ship the record. */}
              {featureOn("vinyl") && (artist as any).is_active && (track as any).vinyl_url && (
                <a
                  href={(track as any).vinyl_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-2 font-mono text-xs text-flame hover:underline self-end"
                >
                  {t("artist.vinyl")}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="ticket-divider my-10" />

      {/* Fyby Engine sponsored card: matched to this page's genres; 30% of
          what the view costs goes to this artist (lib/ads.ts). Not shown to
          the artist on their own page. */}
      {!isOwner && (artist as any).is_active && (
        <SponsoredCard
          placement="artist"
          artistId={artist.id}
          pageGenres={Array.from(new Set((tracks ?? []).map((t: any) => t.genre).filter(Boolean))) as string[]}
          className="mb-10"
        />
      )}

      {!isOwner && (artist as any).is_active && (
              <SuperFanSection
                          artistId={artist.id}
                          artistName={artistName}
                          isLoggedIn={Boolean(user)}
                          isSuperFan={isSuperFan}
                          referralFanId={referralFanId}
                        />
            )}

      {!isOwner && (artist as any).is_active && user && (
        <FanReferralLink artistId={artist.id} fanId={user.id} />
      )}

      {!isOwner && (artist as any).is_active && <div className="ticket-divider my-10" />}

      {featureOn("merch") && (artist as any).is_active && merchProducts.length > 0 && (
        <section aria-labelledby="artist-merch-heading" className="mb-10">
          <h2 id="artist-merch-heading" className="font-display text-2xl mb-4">
            {t("artist.merch")}
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {merchProducts.map((p) => (
              <MerchProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}

      {featureOn("connect") && (artist as any).is_active && connectRoles.length > 0 && (
        <section aria-labelledby="artist-connect-heading" className="mb-10 rounded-lg border border-paper/15 p-5">
          <h2 id="artist-connect-heading" className="font-display text-xl mb-3">
            {t("artist.availableFor")}
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {connectRoles.map((r) => (
              <span key={r} className="font-mono text-xs px-3 py-1.5 rounded-full border border-flame/50 text-flame">
                {connectRoleLabel(r)}
              </span>
            ))}
          </div>
          <Link href={`/connect/${(artist as any).user_id}`} className="font-mono text-xs text-gold hover:underline">
            {t("artist.workWith", { name: artistName })}
          </Link>
        </section>
      )}

      <CollapsibleSection
        title={t("artist.bookTitle")}
        description={t("artist.bookDescription")}
      >
        <BookingForm artistId={artist.id} />
      </CollapsibleSection>
    </main>
  );
}
