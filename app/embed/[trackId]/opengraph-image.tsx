import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Auto-detected by Next.js's file-convention system: any crawler that reads
// og:image/twitter:image for a URL under /embed/[trackId] (Facebook,
// Twitter/X, iMessage, Slack, Discord, etc. all unfurl links this way) gets
// this generated image instead of a manual <meta> tag. See
// app/embed/[trackId]/page.tsx's generateMetadata for the accompanying
// title/description.
//
// The "mic badge" is the shareable-graphic idea from the founder: since
// Instagram, TikTok, and Snapchat don't unfurl links inside a post at all
// (only Facebook/Twitter/etc. actually do), this same image is also offered
// as a plain downloadable PNG from the dashboard ("Download share image" in
// TrackList.tsx) — the mic is what a fan recognizes and taps/presses,
// whichever surface it shows up on.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { trackId: string } }) {
  const admin = createServiceRoleClient();
  const { data: track } = await admin
    .from("tracks")
    .select("title, cover_url, artists ( profiles ( display_name ) )")
    .eq("id", params.trackId)
    .maybeSingle();

  const title = track?.title ?? "A song on Fyby";
  const artistName = (track as any)?.artists?.profiles?.display_name ?? "an independent artist";
  const coverUrl = track?.cover_url ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#16121a",
          padding: 60,
        }}
      >
        {/* Cover art, with the mic badge overlapping its bottom-right corner */}
        <div style={{ display: "flex", position: "relative", width: 510, height: 510, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              width: 510,
              height: 510,
              borderRadius: 24,
              overflow: "hidden",
              background: "#241d2b",
              border: "2px solid rgba(232,225,211,0.15)",
            }}
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} width={510} height={510} style={{ objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", width: "100%", height: "100%" }} />
            )}
          </div>

          {/* Mic badge: a rounded "head" + a thin stand + a base arc, drawn
              with plain shapes so it renders reliably without any external
              icon font or emoji glyph. */}
          <div
            style={{
              position: "absolute",
              bottom: -30,
              right: -30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 140,
              height: 140,
              borderRadius: 70,
              background: "#d4a537",
              border: "6px solid #16121a",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", width: 34, height: 50, borderRadius: 17, background: "#16121a" }} />
              <div style={{ display: "flex", width: 4, height: 22, background: "#16121a", marginTop: 4 }} />
              <div style={{ display: "flex", width: 34, height: 6, borderRadius: 3, background: "#16121a", marginTop: 2 }} />
            </div>
          </div>
        </div>

        {/* Track/artist text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 70,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: "#d4a537", letterSpacing: 2, marginBottom: 18 }}>
            FYBY — DIRECT-TO-FAN MUSIC
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              color: "#e8e1d3",
              lineHeight: 1.1,
              marginBottom: 14,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "rgba(232,225,211,0.7)", marginBottom: 40 }}>
            by {artistName}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#e8e1d3" }}>Press the mic to hear it</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
