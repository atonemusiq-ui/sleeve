import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isUuid } from "@/lib/uuid";
import { isPreorder } from "@/lib/preorder";
import BuyTrackForm from "@/app/artists/[id]/BuyTrackForm";
import TrackAudio, { UnlessOwned } from "@/app/TrackAudio";

// The "share a snippet" page. A fan who bought a song taps Share in their
// Library (app/library/ShareSnippetButton.tsx) and sends this link to a
// friend; the friend hears the 15-second preview and can buy the song right
// here. ?ref=<fan id> credits the sharer through the existing referral
// system (BuyTrackForm -> app/actions/checkout.ts re-validates it).

export const dynamic = "force-dynamic";

async function loadTrack(trackId: string) {
  if (!isUuid(trackId)) return null;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("tracks")
    .select(
      "id, title, cover_url, preview_url, price_cents, release_at, frozen, artists!inner ( id, is_active, profiles ( display_name ) )"
    )
    .eq("id", trackId)
    .maybeSingle();
  if (!data || data.frozen) return null;
  const artist: any = Array.isArray(data.artists) ? data.artists[0] : data.artists;
  if (!artist?.is_active) return null;
  const profile = Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles;
  return {
    id: data.id as string,
    title: data.title as string,
    coverUrl: data.cover_url as string | null,
    previewUrl: data.preview_url as string | null,
    priceCents: data.price_cents as number,
    releaseAt: (data as any).release_at as string | null,
    artistId: artist.id as string,
    artistName: (profile?.display_name as string)?.trim() || "Unknown artist",
  };
}

async function sharerName(ref: string | undefined): Promise<string | null> {
  if (!ref || !isUuid(ref)) return null;
  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("display_name").eq("id", ref).maybeSingle();
  return (data?.display_name as string | undefined)?.trim() || null;
}

export async function generateMetadata({ params }: { params: { trackId: string } }): Promise<Metadata> {
  const track = await loadTrack(params.trackId);
  if (!track) return { title: "Fyby" };
  const title = `${track.title} by ${track.artistName} · Fyby`;
  const description = "Hear a snippet and buy it on Fyby, where the artist keeps the money.";
  return {
    title,
    description,
    openGraph: { title, description, images: track.coverUrl ? [track.coverUrl] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedSnippetPage({
  params,
  searchParams,
}: {
  params: { trackId: string };
  searchParams: { ref?: string };
}) {
  const track = await loadTrack(params.trackId);
  if (!track) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ref = isUuid(searchParams.ref) && searchParams.ref !== user?.id ? searchParams.ref! : null;
  const fromName = await sharerName(ref ?? undefined);
  const artistHref = `/artists/${track.artistId}${ref ? `?ref=${ref}` : ""}`;

  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold mb-6">
        {fromName ? `${fromName} shared a song with you` : "A song for you on Fyby"}
      </p>
      <div className="w-64 h-64 mx-auto rounded-xl overflow-hidden bg-paper/10 border border-gold/30 shadow-2xl">
        {track.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">♪</div>
        )}
      </div>
      <h1 className="font-display text-3xl mt-8 leading-tight">{track.title}</h1>
      <Link href={artistHref} className="text-paper/60 hover:text-gold">
        {track.artistName}
      </Link>

      <div className="mt-8 text-left">
        <TrackAudio trackId={track.id} previewUrl={track.previewUrl} releaseAt={track.releaseAt} className="w-full" />
        {track.previewUrl && (
          <p className="font-mono text-[11px] text-paper/50 mt-1 text-center">Snippet · buy it to hear the whole song</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <UnlessOwned trackId={track.id} releaseAt={track.releaseAt}>
          <span className="font-mono text-forest text-xl">${(track.priceCents / 100).toFixed(2)}</span>
          <BuyTrackForm
            trackId={track.id}
            isLoggedIn={Boolean(user)}
            referredByFanId={ref}
            isPreorder={isPreorder(track.releaseAt)}
          />
        </UnlessOwned>
      </div>

      <p className="text-paper/50 text-sm mt-10">
        On Fyby you buy music straight from the artist, and they keep the money.
      </p>
      <Link href={artistHref} className="inline-block mt-4 font-mono text-xs text-gold">
        See more from {track.artistName} →
      </Link>
    </main>
  );
}
