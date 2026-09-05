import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

// Short-lived — this route is what a purchaser's player actually points at
// (see app/library/page.tsx), so a fresh signed URL gets minted on every
// request rather than one being cached client-side for hours.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function GET(req: Request, { params }: { params: { trackId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Log in to stream this track." }, { status: 401 });
  }

  // RLS ("fans can read their own purchases" in supabase/schema.sql) already
  // scopes this select to the caller's own purchases, but the explicit
  // fan_id/status filters keep the intent obvious and turn "not your
  // purchase" and "not purchased at all" into the same clean 403 rather
  // than leaning on RLS to silently return nothing.
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("track_id", params.trackId)
    .eq("fan_id", user.id)
    .eq("status", "complete")
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json({ error: "You haven't purchased this track." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data: track } = await admin
    .from("tracks")
    .select("audio_path, audio_url")
    .eq("id", params.trackId)
    .maybeSingle();

  if (!track) {
    return NextResponse.json({ error: "Track not found." }, { status: 404 });
  }

  if (track.audio_path) {
    const { data: signed } = await admin.storage
      .from("track-audio")
      .createSignedUrl(track.audio_path, SIGNED_URL_TTL_SECONDS, { download: true });

    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "Couldn't prepare this track for playback." }, { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl);
  }

  if (track.audio_url) {
    // Legacy track uploaded before audio was made private — already a
    // public URL, so this redirect isn't adding confidentiality, just
    // routing it through the same purchase check as every other track so
    // the player never needs to know which storage generation a track
    // predates.
    return NextResponse.redirect(track.audio_url);
  }

  return NextResponse.json({ error: "No audio file found for this track." }, { status: 404 });
}
