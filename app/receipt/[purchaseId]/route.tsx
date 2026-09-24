import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
// Same reasoning as app/artists/[id]/share-card/route.tsx: without this, the
// first request for a given purchase id gets cached server-side forever,
// even once the code generating it changes.
export const dynamic = "force-dynamic";

// Illustrative streaming-payout comparison, same numbers/reasoning as
// app/ReceiptAnimation.tsx on the landing page — the point is the shape of
// the comparison (a fraction of a cent per stream vs. a real dollar amount
// per sale), not a precise streaming-rate citation. Kept in sync with that
// component's STREAMING_PAYOUT_CENTS by eye since they're rendered in two
// completely different runtimes (a client component vs. this Satori/next-og
// route) that can't share a values import cleanly.
const STREAMING_PAYOUT_CENTS = 300;

// A shareable, receipt-styled image for a completed purchase — "one-tap
// share" after a purchase (app/success/page.tsx's Share section) rather
// than a screenshot of the success page itself. Public by design (no auth
// check): a purchase id alone is an unguessable uuid, and the point of this
// route is exactly that anyone with the link — including whoever the buyer
// shares it with — can view/embed the image, same trust model as the
// existing artist share-card route.
export async function GET(req: Request, { params }: { params: { purchaseId: string } }) {
  const admin = createServiceRoleClient();
  const { data: purchase } = await admin
    .from("purchases")
    .select("amount_cents, tracks ( title, artists ( profiles ( display_name ) ) )")
    .eq("id", params.purchaseId)
    .maybeSingle();

  if (!purchase) {
    return new Response("Not found", { status: 404 });
  }

  const track = (purchase as any).tracks;
  const trackTitle = track?.title ?? "a track";
  const artistName = track?.artists?.profiles?.display_name ?? "an artist";
  const fybyPayoutCents = (purchase as any).amount_cents ?? 0;

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
          padding: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 700,
            border: "2px solid rgba(232,225,211,0.15)",
            borderRadius: 20,
            background: "rgba(232,225,211,0.04)",
            padding: 48,
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: "#C9A227", marginBottom: 8 }}>
            Just bought on Fyby
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#E8E1D3" }}>
            {trackTitle}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(232,225,211,0.6)", marginBottom: 36 }}>
            by {artistName}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: "2px dashed rgba(232,225,211,0.15)",
              fontSize: 22,
              color: "rgba(232,225,211,0.5)",
           }}
        >
            <span style={{ display: "flex" }}>Streaming payout</span>
            <span style={{ display: "flex" }}>${(STREAMING_PAYOUT_CENTS / 100).toFixed(2)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "18px 0 6px",
              fontSize: 26,
              color: "#E8E1D3",
           }}
        >
            <span style={{ display: "flex" }}>Fyby payout</span>
            <span style={{ display: "flex", color: "#C9A227", fontWeight: 700 }}>
              ${(fybyPayoutCents / 100).toFixed(2)}
            </span>
          </div>

          <div style={{ display: "flex", fontSize: 18, color: "rgba(232,225,211,0.4)", marginTop: 28 }}>
            The artist gets paid directly — fyby.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=300, must-revalidate" },
    }
  );
}
