import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isAdPlacement, recordAdEvent } from "@/lib/ads";
import { isUuid } from "@/lib/uuid";

// A sponsored-card click (app/SponsoredCard.tsx): count it, then send the
// visitor to the advertiser's page. Only campaigns that ran can be clicked
// through; anything else goes home.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const home = new URL("/", url.origin);
  if (!isUuid(params.id)) return NextResponse.redirect(home);

  const admin = createServiceRoleClient();
  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id, click_url, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!campaign || !["active", "completed"].includes(campaign.status)) return NextResponse.redirect(home);

  const placement = url.searchParams.get("p");
  const artistParam = url.searchParams.get("a");
  await recordAdEvent(
    campaign.id,
    "click",
    isAdPlacement(placement) ? placement : "discover",
    isUuid(artistParam) ? artistParam : null
  );

  return NextResponse.redirect(campaign.click_url);
}
