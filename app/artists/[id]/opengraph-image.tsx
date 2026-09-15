import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Auto-detected by Next.js's file-convention system: any crawler that reads
// og:image/twitter:image for a plain /artists/[id] link (iMessage, WhatsApp,
// Twitter/X, Facebook, Discord, Slack, email clients — anything that
// unfurls a pasted link into a preview card) gets this image, paired with
// the title/description from this folder's page.tsx generateMetadata.
//
// This is what makes "just click the mic" literally true: once a fan pastes
// or sends the artist's plain Fyby link anywhere that unfurls it, the whole
// preview card — mic image included — is one tap/click straight to this
// page. No QR code needed here, because the link itself *is* the click
// target; the QR-code version (app/artists/[id]/share-card/route.tsx) stays
// reserved for Instagram/TikTok/Snapchat, which don't unfurl links inside a
// post at all and need something a phone camera can scan instead.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// See the matching comment in app/artists/[id]/share-card/route.tsx — without
// this, an artist id's first-ever social-preview render gets stuck serving
// that same image forever, even after their name/photo changes or this
// file's own code is redeployed.
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: { id: string } }) {
  const admin = createServiceRoleClient();
  const { data: artist } = await admin
    .from("artists")
    .select("bio_photo_url, profiles ( display_name )")
    .eq("id", params.id)
    .maybeSingle();

  const artistName = (artist as any)?.profiles?.display_name ?? "an artist on Fyby";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const micCutoutUrl = `${siteUrl}/images/mic-cutout.png`;
  const bioPhotoUrl = (artist as any)?.bio_photo_url ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#16121a",
          padding: 60,
        }}
      >
        {/* The mic itself — the thing a fan recognizes and taps, wherever
            this preview card shows up. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 340,
            height: 510,
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={micCutoutUrl} width={280} height={459} style={{ objectFit: "contain" }} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 50,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: "#d4a537", letterSpacing: 2, marginBottom: 18 }}>
            FYBY — DIRECT-TO-FAN MUSIC
          </div>

          <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
            {bioPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bioPhotoUrl}
                width={64}
                height={64}
                style={{ borderRadius: 32, objectFit: "cover", marginRight: 20 }}
              />
            )}
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: "#e8e1d3", lineHeight: 1.1 }}>
              {artistName}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 34, color: "#e8e1d3", fontWeight: 700 }}>
            Just click the mic
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(232,225,211,0.6)", marginTop: 8 }}>
            to hear my music on Fyby
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // See the matching comment in app/artists/[id]/share-card/route.tsx —
      // a short max-age keeps a stale cached copy from sitting for the
      // default 1-year immutable duration next/og would otherwise set.
      headers: { "Cache-Control": "public, max-age=300, must-revalidate" },
    }
  );
}
