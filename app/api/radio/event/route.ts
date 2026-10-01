import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { isRadioEnabled } from "@/lib/radio";

// POST /api/radio/event  { trackId, station, event: "buy_click", session }
//
// Records a Buy tap from the radio player (plays are logged by
// /api/radio/next). Paired with the fan's purchases afterward, this is how
// the radio-to-purchase rate gets measured. Only accepts tracks that are
// actually opted in to radio, so the table can't be filled with junk rows.
export async function POST(req: Request) {
  if (!isRadioEnabled()) return NextResponse.json({ ok: false }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const trackId = body?.trackId;
  const station = typeof body?.station === "string" ? body.station.slice(0, 64) : null;
  const session = typeof body?.session === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.session) ? body.session : null;
  if (!isUuid(trackId) || body?.event !== "buy_click") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: track } = await admin
    .from("tracks")
    .select("id")
    .eq("id", trackId)
    .eq("radio_opt_in", true)
    .maybeSingle();
  if (!track) return NextResponse.json({ ok: false }, { status: 404 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await admin.from("radio_events").insert({
    track_id: trackId,
    station,
    event: "buy_click",
    session_id: session,
    fan_id: user?.id ?? null,
  });

  return NextResponse.json({ ok: true });
}
