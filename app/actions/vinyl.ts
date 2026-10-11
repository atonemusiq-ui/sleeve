"use server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { parseVinylUrl } from "@/lib/vinyl";
import { revalidatePath } from "next/cache";

export type VinylLinkResult = { error?: string; success?: boolean };

// Artist side: set or clear the "Get it on Vinyl" link on one of their
// tracks (app/dashboard/VinylLinkSettings.tsx). A blank link removes it.
export async function updateVinylLink(formData: FormData): Promise<VinylLinkResult> {
  const trackId = formData.get("trackId") as string;
  if (!isUuid(trackId)) return { error: "Track not found." };

  const parsed = parseVinylUrl(formData.get("vinylUrl") as string | null);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  // Same two-step ownership check as app/actions/licensing.ts; RLS on tracks
  // enforces it again on the update itself.
  const { data: track } = await supabase.from("tracks").select("artist_id").eq("id", trackId).maybeSingle();
  if (!track) return { error: "Track not found." };

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", track.artist_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!artist) return { error: "That track isn't yours." };

  const { error } = await supabase.from("tracks").update({ vinyl_url: parsed.url }).eq("id", trackId);
  if (error) return { error: `Couldn't save the vinyl link: ${error.message}` };

  revalidatePath("/dashboard/catalog");
  revalidatePath(`/artists/${track.artist_id}`);
  return { success: true };
}
