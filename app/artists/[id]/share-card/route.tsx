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
// someone to a real page on those platforms, so it's baked into a mic
// graphic here rather than relying on a tappable link. Square (1080x1080) —
// posts fine as a feed photo on all three, or as a static sticker layered
// onto a Story/TikTok video.
//
// The mic itself is a transparent PNG cutout at public/images/mic-cutout.png
// (self-hosted, so referenced by full site URL the same way the QR code
// below is, since Satori/next/og fetches <img> sources over HTTP rather
// than reading local files). It's a background-removed crop of "LATE NIGHT"
// by Matt Botsford (Unsplash, free to use commercially under the Unsplash
// License, no attribution required) — chosen specifically because it has no
// visible manufacturer logo, unlike most real mic product photography,
// which exists to sell one particular branded microphone and would read as
// Fyby endorsing that brand. Background removed with OpenCV (GrabCut) so the
// mic sits directly on this card's own dark background instead of showing
// a rectangular photo backdrop.
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
  const micCutoutUrl = `${siteUrl}/images/mic-cutout.png`;

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
          gap: 26,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={micCutoutUrl} width={300} height={492} style={{ objectFit: "contain" }} />

        {/* QR sits below the mic rather than composited onto it — a photo
            cutout's edges aren't clean/uniform enough behind a QR code to
            guarantee it keeps scanning reliably. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 280,
            height: 280,
            background: "#e8e1d3",
            borderRadius: 20,
            border: "4px solid #d4a537",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} width={240} height={240} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#e8e1d3" }}>
            {artistName}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#d4a537", marginTop: 10 }}>
            Scan the mic to hear my music on Fyby
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      // next/og defaults to `public, immutable, max-age=31536000` (1 year) —
      // fine for a one-time og:image, wrong here since this route's own
      // output changes whenever the artist's name changes or this graphic
      // gets redesigned. Confirmed live: an artist id hit once under the old
      // circle-badge design kept serving that exact cached response from an
      // upstream cache even after force-dynamic above and a fresh deploy
      // with the new mic design — force-dynamic stops the *origin* from
      // re-using a stale render, but doesn't reach back and invalidate a
      // response a downstream cache already stored under the old header.
      // A short max-age means any such cached copy expires on its own
      // shortly instead of potentially sitting for the full year.
      headers: { "Cache-Control": "public, max-age=300, must-revalidate" },
    }
  );
}
