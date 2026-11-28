import { createClient } from "@/lib/supabase/server";
import { UnlessOwned } from "@/app/TrackAudio";
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
import CompactPlayButton from "./CompactPlayButton";
import MiniPlayer from "./MiniPlayer";
import { PlayPreviewsButton, ShareArtistButton } from "./ArtistHeroActions";
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

  // Small label above the name in the hero ("Gospel · Artist on Fyby"):
  // the genre this artist releases most often.
  const genreCounts = new Map<string, number>();
  for (const tr of tracks ?? []) {
    if (tr.genre && tr.genre !== COVERS_GENRE) genreCounts.set(tr.genre, (genreCounts.get(tr.genre) ?? 0) + 1);
  }
  const topGenre = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const hasTracks = Boolean(tracks && tracks.length > 0);
  const customLinks = ((artist as any).custom_links as { label: string; url: string }[]) ?? [];
  const tourDates = (artist as any).tour_dates as string | null;
  const mailingListEnabled = (artist as any).mailing_list_enabled !== false;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-28">
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
          <p className="font-mono text-sm text-forest">{t("artist.superfanThanks", { name: artistName })}</p>
        </div>
      )}

      {searchParams.gift === "success" && (
        <div className="mb-8 border border-forest/40 rounded-lg p-4 bg-forest/10">
          <p className="font-mono text-sm text-forest">{t("artist.giftThanks", { name: artistName })}</p>
        </div>
      )}

      {/* Only the artist sees this: quick ways to change their own page. */}
      {isOwner && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border border-gold/30 bg-gold/5 rounded-lg px-4 py-3">
          <span className="font-mono text-xs text-paper/60 mr-1">{t("artist.yourPage")}</span>
          <Link href="/dashboard?edit=photos#photos" className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10">
            {t("artist.editPhotos")}
          </Link>
          <Link href="/dashboard/catalog" className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10">
            {t("artist.manageSongs")}
          </Link>
          <Link href="/dashboard?edit=photos#photos" className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 text-paper/70 hover:bg-paper/10">
            {t("artist.editBio")}
          </Link>
        </div>
      )}

      {/* Hero: big gradient banner, round photo on the right, name + bio +
          actions bottom-left. */}
      <header className="relative overflow-hidden rounded-[20px] min-h-[300px] sm:min-h-[340px] bg-[linear-gradient(160deg,#3A2A1E_0%,#221A24_55%,#16121A_100%)] flex flex-col-reverse sm:flex-row sm:items-end">
        <div className="relative z-10 p-6 sm:p-12 flex flex-col gap-3.5 max-w-2xl">
          <span className="font-mono text-xs tracking-[0.12em] uppercase text-gold">
            {topGenre ? `${topGenre} · ` : ""}Artist on Fyby
          </span>
          <h1 className="m-0 font-display font-bold text-5xl sm:text-[64px] leading-none text-paper flex items-center gap-3">
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
          {artist.bio && (
            <p className="m-0 text-[15px] leading-relaxed text-paper/80 line-clamp-3">{artist.bio}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            {hasTracks && <PlayPreviewsButton label="Play previews" />}
            {!isOwner && (artist as any).is_active && user && (
              <FollowButton artistId={artist.id} isFollowing={isFollowing} />
            )}
            <ShareArtistButton artistName={artistName} />
          </div>
        </div>

        <div className="relative sm:absolute sm:right-12 sm:top-10 pt-6 px-6 sm:p-0 flex-shrink-0">
          {circlePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={circlePhoto}
              alt={artistName}
              className="w-32 h-32 sm:w-[230px] sm:h-[230px] rounded-full object-cover border border-paper/15 shadow-2xl"
            />
          ) : (
            <div className="w-32 h-32 sm:w-[230px] sm:h-[230px] rounded-full bg-[#2B2230] border border-paper/15 flex items-center justify-center font-display text-5xl sm:text-7xl text-paper/40">
              {artistName.charAt(0).toUpperCase()}
            </div>
          )}
          {isOwner && (
            <Link
              href="/dashboard?edit=photos#photos"
              title={t("artist.editPhotoTitle")}
              className="absolute bottom-1 right-7 sm:-bottom-1 sm:right-1 w-8 h-8 rounded-full bg-ink border border-gold/50 flex items-center justify-center text-xs hover:bg-gold/20"
            >
              ✏️
            </Link>
          )}
        </div>
      </header>

      <div className="mt-9 flex flex-wrap gap-10">
        {/* ---------- Left column: songs, photos, video, merch ---------- */}
        <section className="flex-[999_1_560px] min-w-0">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="m-0 font-display font-semibold text-[26px]">Songs</h2>
            {hasTracks && (
              <span className="font-mono text-xs text-paper/60">Tap a song to hear 15 seconds</span>
            )}
          </div>

          {!hasTracks && <p className="text-paper/50 font-mono text-sm py-6">{t("artist.noTracks")}</p>}

          {hasTracks && (
            <div className="flex flex-col">
              {tracks!.map((track, i) => {
                const preorder = isPreorder((track as any).release_at);
                const tiers = offeredTiers(track as any);
                const showLicense =
                  (artist as any).is_active && track.genre !== COVERS_GENRE && !preorder && tiers.length > 0;
                const showVinyl = featureOn("vinyl") && (artist as any).is_active && (track as any).vinyl_url;
                return (
                  <div
                    key={track.id}
                    {...(i === 0 ? { "data-first-track": "" } : {})}
                    className="group rounded-[10px] px-2 sm:px-3 py-2.5 border-b border-paper/[0.08] hover:bg-paper/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5">
                      <div className="relative w-11 h-11 flex-shrink-0 rounded-md bg-[#2B2230] overflow-hidden">
                        {track.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-paper/30">♪</div>
                        )}
                        <CompactPlayButton
                          trackId={track.id}
                          previewUrl={track.preview_url}
                          releaseAt={(track as any).release_at ?? null}
                          title={track.title}
                          artistName={artistName}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[15px] text-paper truncate">{track.title}</div>
                        <div className="text-[13px] text-paper/60 truncate">
                          {artistName}
                          {track.genre ? ` · ${track.genre}` : ""}
                          {preorder
                            ? ` · ${t("store.preorderOut", { date: formatReleaseDate((track as any).release_at, dateLocale(lang)) })}`
                            : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {blockedTrackIds.has(track.id) ? (
                          <span className="font-mono text-[11px] text-rust max-w-[9rem] text-right">{t("artist.coverPending")}</span>
                        ) : !(artist as any).is_active ? (
                          <span className="font-mono text-[11px] text-rust">{t("artist.buyingOff")}</span>
                        ) : (
                          <UnlessOwned trackId={track.id} releaseAt={(track as any).release_at ?? null}>
                            <span className="font-mono text-[13px] text-paper/75 hidden sm:inline">
                              ${(track.price_cents / 100).toFixed(2)}
                            </span>
                            <BuyTrackForm
                              trackId={track.id}
                              isLoggedIn={Boolean(user)}
                              referredByFanId={referredByFanId}
                              isPreorder={preorder}
                            />
                          </UnlessOwned>
                        )}
                      </div>
                    </div>

                    {/* Small extras under the row: badges, lyrics, licensing, vinyl. */}
                    <div className="pl-[56px] sm:pl-[58px] flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
                      {track.custom_tag && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
                          #{track.custom_tag}
                        </span>
                      )}
                      {aiDisclosureBadge(track.ai_disclosure) && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full border border-gold/40 text-gold">
                          {t(`badges.${track.ai_disclosure}`)}
                        </span>
                      )}
                      {(track as any).explicit && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full border border-rust/50 text-rust">
                          {t("badges.explicit")}
                        </span>
                      )}
                      <LyricsCreditsDialog
                        trackTitle={track.title}
                        lyrics={(track as any).lyrics ?? null}
                        credits={creditsByTrack[track.id] ?? []}
                      />
                      {showLicense && (
                        <Link href={`/license/${track.id}`} className="font-mono text-[11px] text-gold hover:underline">
                          {t("artist.license", {
                            price: (Math.min(...tiers.map((o) => o.priceCents)) / 100).toFixed(0),
                          })}
                        </Link>
                      )}
                      {showVinyl && (
                        <a
                          href={(track as any).vinyl_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="font-mono text-[11px] text-flame hover:underline"
                        >
                          {t("artist.vinyl")}
                        </a>
                      )}
                      {isOwner && <RemoveTrackButton trackId={track.id} title={track.title} compact />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {galleryUrls.length > 0 && (
            <>
              <h2 className="mt-10 mb-3.5 font-display font-semibold text-[26px]">Photos</h2>
              <div className="flex gap-4 overflow-x-auto pb-1.5">
                {galleryUrls.map((url, i) => (
                  <div key={i} className="relative flex-[0_0_180px] w-[180px] h-[180px] rounded-[10px] overflow-hidden bg-[#2B2230]">
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
            <div className="mt-10">
              <VideoEmbed type={(artist as any).bio_video_type} url={(artist as any).bio_video_url} />
              <ReportVideoButton artistId={artist.id} videoUrl={(artist as any).bio_video_url} />
            </div>
          )}

          {featureOn("merch") && (artist as any).is_active && merchProducts.length > 0 && (
            <section aria-labelledby="artist-merch-heading" className="mt-10">
              <h2 id="artist-merch-heading" className="font-display font-semibold text-[26px] mb-3.5">
                {t("artist.merch")}
              </h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {merchProducts.map((p) => (
                  <MerchProductCard key={p.id} product={p} />
                ))}
              </ul>
            </section>
          )}
        </section>

        {/* ---------- Right column: about, super fan, mailing list ---------- */}
        <aside className="flex-[1_1_280px] min-w-0 flex flex-col gap-4">
          {(artist.bio || customLinks.length > 0 || tourDates) && (
            <div className="border border-paper/[0.12] rounded-[14px] p-5">
              <h3 className="m-0 mb-2 font-display text-lg">About</h3>
              {artist.bio && (
                <p className="m-0 text-sm leading-relaxed text-paper/75 whitespace-pre-wrap">{artist.bio}</p>
              )}
              {customLinks.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
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
                <div className="mt-4">
                  <p className="font-mono text-xs text-paper/40 uppercase mb-2">{t("artist.tourDates")}</p>
                  <p className="font-body text-sm text-paper/80 whitespace-pre-wrap">{tourDates}</p>
                </div>
              )}
            </div>
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

          {mailingListEnabled && (
            <div className="border border-paper/[0.12] rounded-[14px] p-5">
              <h3 className="m-0 mb-3 font-display text-lg">{t("artist.mailingList")}</h3>
              <MailingListForm artistId={artist.id} artistName={artistName} />
            </div>
          )}

          {!isOwner && (artist as any).is_active && user && (
            <FanReferralLink artistId={artist.id} fanId={user.id} />
          )}

          {featureOn("connect") && (artist as any).is_active && connectRoles.length > 0 && (
            <section aria-labelledby="artist-connect-heading" className="rounded-[14px] border border-paper/[0.12] p-5">
              <h2 id="artist-connect-heading" className="font-display text-lg mb-3">
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

          {/* Fyby Engine sponsored card: matched to this page's genres; 30% of
              what the view costs goes to this artist (lib/ads.ts). Not shown to
              the artist on their own page. */}
          {!isOwner && (artist as any).is_active && (
            <SponsoredCard
              placement="artist"
              artistId={artist.id}
              pageGenres={Array.from(new Set((tracks ?? []).map((t: any) => t.genre).filter(Boolean))) as string[]}
            />
          )}
        </aside>
      </div>

      <div className="mt-10">
        <CollapsibleSection title={t("artist.bookTitle")} description={t("artist.bookDescription")}>
          <BookingForm artistId={artist.id} />
        </CollapsibleSection>
      </div>
      <MiniPlayer />
    </main>
  );
}
