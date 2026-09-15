import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { trackNeedsCoverCredit } from "@/lib/coverCompliance";
import { aiDisclosureBadge, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import type { Metadata } from "next";

// Powers the og:title/og:description a crawler shows alongside the image
// from opengraph-image.tsx (same folder) when this link is pasted into
// Facebook, Twitter/X, iMessage, Slack, Discord, etc. — the platforms that
// actually unfurl a plain link. Instagram/TikTok/Snapchat don't do this at
// all for post captions, which is why there's a separate downloadable share
// graphic for those (app/artists/[id]/share-card/route.tsx).
export async function generateMetadata({
  params,
}: {
  params: { trackId: string };
}): Promise<Metadata> {
  const admin = createServiceRoleClient();
  const { data: track } = await admin
    .from("tracks")
    .select("title, artists ( profiles ( display_name ) )")
    .eq("id", params.trackId)
    .maybeSingle();

  const title = track?.title ?? "A song on Fyby";
  const artistName = (track as any)?.artists?.profiles?.display_name ?? "an independent artist";
  const description = `Listen to "${title}" by ${artistName} and buy it directly — no streaming middleman.`;

  return {
    title: `${title} — ${artistName} | Fyby`,
    description,
    openGraph: { title, description, type: "music.song" },
    twitter: { card: "summary_large_image", title, description },
  };
}

// The embeddable "buy this song" widget — meant to be dropped into an
// <iframe> on an artist's own site, a blog post, etc. (see the "Embed this
// song" button on the dashboard, app/dashboard/TrackList.tsx, which
// generates the snippet). Deliberately bare: no site nav, no footer, no
// links back into the rest of Fyby except the Buy control itself — just
// enough to identify the track and buy it. Framing is controlled by
// next.config.js's headers() (every other route sends
// frame-ancestors 'none'; this one is left open so it can actually sit in
// someone else's page).
//
// This reads with the service-role client rather than the visitor's own
// session — a fan browsing an embedded widget on a third-party site has no
// Fyby session cookie in that context, so anon-key RLS would just see an
// unauthenticated request. The track/cover-art/pricing data rendered here is
// the same public information already shown on the storefront, so serving it
// without a session is no different in kind from the public storefront grid.
export default async function EmbedTrackPage({
  params,
  searchParams,
}: {
  params: { trackId: string };
  searchParams: { error?: string };
}) {
  const admin = createServiceRoleClient();

  const { data: track } = await admin
    .from("tracks")
    .select(
      "id, title, price_cents, cover_url, preview_url, genre, ai_disclosure, explicit, frozen, artists ( id, is_active, profiles ( display_name ) )"
    )
    .eq("id", params.trackId)
    .maybeSingle();

  // Reads with the service-role client (see the comment above), so this
  // doesn't get RLS's help hiding a canceled artist's track — checked
  // explicitly instead. A widget already embedded on someone else's site
  // from before the artist canceled (or the track got frozen for a policy
  // violation — app/admin/moderation/page.tsx) just needs to start showing
  // this instead of the buy flow; nothing to delete or clean up on their end.
  if (!track || (track as any).artists?.is_active === false || track.frozen) {
    return (
      <EmbedShell>
        <p className="text-sm text-paper/70">This track isn't available.</p>
      </EmbedShell>
    );
  }

  const artistName = (track as any).artists?.profiles?.display_name ?? "Unknown artist";
  const badge = aiDisclosureBadge(track.ai_disclosure as AiDisclosureLevel);
  const needsCredit = await trackNeedsCoverCredit(track.id, track.genre);

  return (
    <EmbedShell>
      <div className="aspect-square w-full rounded-md overflow-hidden bg-black/30 mb-3">
        {track.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-paper/40 text-xs font-mono">
            no cover art
          </div>
        )}
      </div>

      <div className="min-w-0 mb-2">
        <p className="font-display text-base leading-tight truncate">{track.title}</p>
        <p className="text-xs text-paper/60 truncate">{artistName}</p>
        {badge && (
          <span className="inline-block mt-1 text-[10px] font-mono uppercase tracking-wide text-gold/80 border border-gold/30 rounded px-1.5 py-0.5">
            {badge}
          </span>
        )}
        {track.explicit && (
          <span className="inline-block mt-1 ml-1 text-[10px] font-mono uppercase tracking-wide text-rust border border-rust/40 rounded px-1.5 py-0.5">
            Explicit
          </span>
        )}
      </div>

      {track.preview_url && (
        <audio controls src={track.preview_url} preload="none" className="w-full h-8 mb-3" />
      )}

      {searchParams.error && (
        <p className="text-xs text-rust mb-2">{searchParams.error}</p>
      )}

      {needsCredit ? (
        <div className="text-xs font-mono text-paper/60 border border-paper/20 rounded px-2 py-2 text-center">
          Pending contributor credit — not yet for sale.
        </div>
      ) : (
        // Plain top-level-navigating anchor, not a <form action={...}> — see
        // app/embed/buy/[trackId]/route.ts for why a server action's
        // redirect() can't reliably break out of a cross-origin iframe here.
        <a
          href={`/embed/buy/${track.id}`}
          target="_top"
          className="block text-center bg-gold text-ink font-mono text-sm font-medium rounded px-3 py-2 hover:opacity-90"
        >
          Buy — ${(track.price_cents / 100).toFixed(2)}
        </a>
      )}

      <a
        href="/"
        target="_top"
        className="block text-center text-[10px] font-mono text-paper/40 mt-3 hover:text-paper/60"
      >
        powered by Fyby
      </a>
    </EmbedShell>
  );
}

function EmbedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-3">
      <div className="w-full max-w-[300px] bg-ink border border-paper/10 rounded-lg p-4">
        {children}
      </div>
    </div>
  );
}
