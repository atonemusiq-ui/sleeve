// Server-only helper shared by app/actions/radioPremiere.ts and the Stripe
// webhook. Kept out of the "use server" actions file so it isn't exposed as
// a client-callable server action.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PREMIERE_TIERS, type PremiereTier } from "@/lib/radio";

const DAY_MS = 24 * 60 * 60 * 1000;

// A premiere bought while one is still running is added onto the end of it,
// so paying twice never wastes days.
export async function premiereWindow(trackId: string, tier: PremiereTier) {
  const admin = createServiceRoleClient();
  const { data: latest } = await admin
    .from("radio_premieres")
    .select("ends_at")
    .eq("track_id", trackId)
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = latest?.ends_at ? new Date(latest.ends_at) : new Date();
  const end = new Date(start.getTime() + PREMIERE_TIERS[tier].days * DAY_MS);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
