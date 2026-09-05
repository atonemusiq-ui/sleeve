// Cover songs (genre === COVERS_GENRE, see lib/genres.ts) are, by
// definition, someone else's composition — the original songwriter(s) and
// producer(s) are legally owed royalties on every sale, separate from
// whatever the uploading artist earns. Fyby already has a royalty ledger
// built for exactly this (the `contributors` table + per-sale
// `contributor_payouts`, from Phase 2 — see supabase/schema.sql and
// app/actions/contributors.ts): crediting the original writer/producer as a
// contributor with their percentage is what "add them" means here.
//
// A Covers-tagged track with zero contributors hasn't had that credit added
// yet, so it's blocked from sale — both in the storefront UI
// (StorefrontGrid.tsx, the artist page) and, authoritatively, here at
// checkout-session creation (app/actions/checkout.ts) — until the artist
// adds at least one contributor on their dashboard.
//
// This uses the service-role client rather than the caller's own session
// client because `contributors` RLS is artist-only (the table holds PII —
// name, email, phone). Every function here returns only a track_id ->
// boolean("needs credit") result, never any contributor's actual data, so a
// fan browsing the storefront or a buyer at checkout never sees anything
// about who the contributor is — just whether the track is sellable yet.
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { COVERS_GENRE } from "@/lib/genres";

export async function trackNeedsCoverCredit(trackId: string, genre: string | null): Promise<boolean> {
  if (genre !== COVERS_GENRE) return false;

  const admin = createServiceRoleClient();
  const { data } = await admin.from("contributors").select("id").eq("track_id", trackId).limit(1);
  return !data || data.length === 0;
}

// Batch version for a page rendering many tracks at once (the storefront,
// an artist's profile page) — one query instead of one per track. Returns
// the subset of `trackIds` that are Covers-tagged AND still missing a
// contributor.
export async function tracksNeedingCoverCredit(
  tracks: { id: string; genre: string | null }[]
): Promise<Set<string>> {
  const coverTrackIds = tracks.filter((t) => t.genre === COVERS_GENRE).map((t) => t.id);
  if (coverTrackIds.length === 0) return new Set();

  const admin = createServiceRoleClient();
  const { data: rows } = await admin.from("contributors").select("track_id").in("track_id", coverTrackIds);
  const hasContributor = new Set((rows ?? []).map((r) => r.track_id));

  return new Set(coverTrackIds.filter((id) => !hasContributor.has(id)));
}
