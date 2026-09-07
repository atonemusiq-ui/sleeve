import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

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
        {/* Mic housing: a big rounded capsule holding the QR code where the
            mesh/grille would be, a thin stand, and a base arc beneath it. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 420,
            height: 420,
            borderRadius: 210,
            background: "#d4a537",
            border: "10px solid #e8e1d3",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 320,
              height: 320,
              borderRadius: 24,
              overflow: "hidden",
              background: "#e8e1d3",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} width={320} height={320} />
          </div>
        </div>
        <div style={{ display: "flex", width: 10, height: 60, background: "#d4a537", marginTop: -4 }} />
        <div style={{ display: "flex", width: 140, height: 16, borderRadius: 8, background: "#d4a537" }} />

        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#e8e1d3", marginTop: 46 }}>
          {artistName}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#d4a537", marginTop: 10 }}>
          🎤 Scan the mic to hear my music on Fyby
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
