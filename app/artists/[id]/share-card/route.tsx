import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
// Without this, Next.js treats a dynamic-segment route handler with no
// cookies()/headers() calls as eligible for its on-demand-then-cache-forever
// behavior — the FIRST request for a given artist id gets cached (server
// side, independent of the CDN's own Cache-Control-driven caching below) and
// every later request, even from a brand-new deployment with changed code,
// keeps serving that first render. Confirmed live: after redesigning the mic
// graphic, this route kept returning the old circle-badge PNG for an artist
// id that had already been hit once, even though the new code was verifiably
// deployed. force-dynamic makes every request re-render from current code.
export const dynamic = "force-dynamic";

// A downloadable, mic-branded PNG artists can post directly on Instagram,
// TikTok, or Snapchat — platforms that (unlike Facebook/Twitter, see
// app/embed/[trackId]/opengraph-image.tsx) don't unfurl a live link inside a
// post at all. A QR code is the only way a plain image can still "direct"
// someone to a real page on those platforms, so it's baked into the mic
// housing here rather than relying on a tappable link. Square (1080x1080) —
// posts fine as a feed photo on all three, or as a static sticker layered
// onto a Story/TikTok video.
//
// The QR code itself is rendered by a public QR-image service
// (api.qrserver.com) rather than a bundled QR library — this repo has no
// package-manager access from this session to add and lock a new npm
// dependency safely, and that service is free, widely used, and has no
// artist- or fan-identifying data in the request (just the public artist
// page URL).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const admin = createServiceRoleClient();
  const { data: artist } = await admin
    .from("artists")
    .select("bio_photo_url, profiles ( display_name )")
    .eq("id", params.id)
    .maybeSingle();

  const artistName = (artist as any)?.profiles?.display_name ?? "an artist on Fyby";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const artistUrl = `${siteUrl}/artists/${params.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&color=22-18-26&bgcolor=232-225-211&data=${encodeURIComponent(
    artistUrl
  )}`;

  const bodyWidth = 380;
  const metalGradient = "linear-gradient(180deg, #e8c96b 0%, #d4a537 45%, #b0822a 100%)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#16121a",
        }}
      >
        {/* A large-diaphragm-style condenser mic silhouette, built as a
            stack of segments (grille head, capsule viewport holding the QR,
            a selector ring, a tapered lower body, and the XLR connector),
            rather than a plain circle — the QR itself stays a clean,
            unobstructed square so it keeps scanning reliably. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Grille head */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: bodyWidth,
              height: 110,
              borderRadius: "190px 190px 20px 20px",
              background: metalGradient,
              overflow: "hidden",
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", width: 300, height: 5, borderRadius: 3, background: "#16121a" }} />
            ))}
          </div>

          {/* Capsule viewport — the QR code sits here, flush with the body */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: bodyWidth,
              height: 340,
              background: "#e8e1d3",
              border: "4px solid #b0822a",
              borderTop: "none",
              borderBottom: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} width={300} height={300} />
          </div>

          {/* Pattern-selector ring */}
          <div style={{ display: "flex", width: bodyWidth, height: 22, background: "#8a6a20" }} />

          {/* Tapered lower body */}
          <div
            style={{
              display: "flex",
              width: 300,
              height: 90,
              borderRadius: "0 0 36px 36px",
              background: metalGradient,
            }}
          />

          {/* XLR connector */}
          <div style={{ display: "flex", width: 60, height: 24, background: "#16121a", borderRadius: "0 0 8px 8px" }} />

          {/* Stand */}
          <div style={{ display: "flex", width: 8, height: 60, background: "#d4a537", marginTop: 6 }} />
          <div style={{ display: "flex", width: 170, height: 16, borderRadius: 8, background: "#d4a537" }} />
        </div>

        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#e8e1d3", marginTop: 44 }}>
          {artistName}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#d4a537", marginTop: 10 }}>
          Scan the mic to hear my music on Fyby
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
