"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ContributorActionResult = { error?: string };

async function getOwnedTrackOrError(trackId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in." } as const;

  // Ownership is also enforced by RLS ("artists manage contributors on
  // their own tracks" in supabase/schema.sql), but checking here first lets
  // us return a clean error message instead of a raw Postgres RLS failure.
  // Two-step lookup (rather than an embedded-relation filter) to match the
  // query style already used elsewhere in this codebase (e.g.
  // app/dashboard/page.tsx's artists lookup).
  const { data: track } = await supabase.from("tracks").select("artist_id").eq("id", trackId).maybeSingle();
  if (!track) return { error: "Track not found." } as const;

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", track.artist_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!artist) return { error: "That track doesn't belong to your account." } as const;
  return { supabase } as const;
}

export async function addContributor(formData: FormData): Promise<ContributorActionResult> {
  const trackId = formData.get("trackId") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const publishingInfo = (formData.get("publishingInfo") as string)?.trim() || null;
  const percentage = parseFloat(formData.get("percentage") as string);

  if (!name) return { error: "Name is required." };
  if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
    return { error: "Percentage must be between 0 and 100." };
  }

  const owned = await getOwnedTrackOrError(trackId);
  if ("error" in owned) return owned;
  const { supabase } = owned;

  // Pre-check the 100% cap here for a clean inline error — the database
  // trigger (supabase/schema.sql) still enforces this even if this check is
  // ever skipped, but a raw trigger exception isn't a message you'd want to
  // show an artist directly.
  const { data: existing } = await supabase.from("contributors").select("percentage").eq("track_id", trackId);
  const currentTotal = (existing ?? []).reduce((sum, c) => sum + Number(c.percentage), 0);
  if (currentTotal + percentage > 100) {
    return {
      error: `That would bring this track's contributor split to ${(currentTotal + percentage).toFixed(
        1
      )}% — contributors can't add up to more than 100% (currently ${currentTotal.toFixed(1)}%).`,
    };
  }

  const { error } = await supabase.from("contributors").insert({
    track_id: trackId,
    name,
    email,
    phone,
    publishing_info: publishingInfo,
    percentage,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}

export async function updateContributor(formData: FormData): Promise<ContributorActionResult> {
  const id = formData.get("id") as string;
  const trackId = formData.get("trackId") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const publishingInfo = (formData.get("publishingInfo") as string)?.trim() || null;
  const percentage = parseFloat(formData.get("percentage") as string);

  if (!name) return { error: "Name is required." };
  if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
    return { error: "Percentage must be between 0 and 100." };
  }

  const owned = await getOwnedTrackOrError(trackId);
  if ("error" in owned) return owned;
  const { supabase } = owned;

  const { data: existing } = await supabase
    .from("contributors")
    .select("id, percentage")
    .eq("track_id", trackId);
  const currentTotal = (existing ?? [])
    .filter((c) => c.id !== id)
    .reduce((sum, c) => sum + Number(c.percentage), 0);
  if (currentTotal + percentage > 100) {
    return {
      error: `That would bring this track's contributor split to ${(currentTotal + percentage).toFixed(
        1
      )}% — contributors can't add up to more than 100% (currently ${currentTotal.toFixed(1)}% without this one).`,
    };
  }

  const { error } = await supabase
    .from("contributors")
    .update({ name, email, phone, publishing_info: publishingInfo, percentage })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}

export async function deleteContributor(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const trackId = formData.get("trackId") as string;

  const owned = await getOwnedTrackOrError(trackId);
  if ("error" in owned) return;
  const { supabase } = owned;

  await supabase.from("contributors").delete().eq("id", id);
  revalidatePath("/dashboard");
}

// Flips every currently-"owed" payout row for this contributor to "paid" —
// this is what "resets the running balance" means: the next dashboard read
// sums only rows still in "owed" status, so newly-paid rows drop out of the
// running total immediately while staying in the table as payment history.
export async function markContributorPaid(formData: FormData): Promise<void> {
  const contributorId = formData.get("contributorId") as string;
  const trackId = formData.get("trackId") as string;

  const owned = await getOwnedTrackOrError(trackId);
  if ("error" in owned) return;
  const { supabase } = owned;

  await supabase
    .from("contributor_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("contributor_id", contributorId)
    .eq("status", "owed");

  revalidatePath("/dashboard");
}
