"use server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { revalidatePath } from "next/cache";

// Toggles whether the logged-in fan follows an artist (see
// app/artists/[id]/FollowButton.tsx) -- the "For You" tab on /discover
// (app/discover/page.tsx) is built from this plus the fan's own purchase
// history, so following an artist is a lighter-weight signal than buying
// something but still moves that artist's tracks into that feed.
export async function toggleFollow(formData: FormData) {
  const artistId = formData.get("artistId") as string;
  const isCurrentlyFollowing = formData.get("isFollowing") === "true";

  if (!isUuid(artistId)) {
    throw new Error("Invalid artist.");
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Log in to follow an artist.");
  }

  if (isCurrentlyFollowing) {
    await supabase.from("artist_follows").delete().eq("fan_id", user.id).eq("artist_id", artistId);
  } else {
    // unique(fan_id, artist_id) makes a double-click harmless -- upsert
    // rather than insert so a stale "not following" client state (two tabs
    // open, say) can't throw a duplicate-key error.
    await supabase
      .from("artist_follows")
      .upsert({ fan_id: user.id, artist_id: artistId }, { onConflict: "fan_id,artist_id" });
  }

  // The artist page reads isFollowing server-side on render (see that
  // file), so the toggle needs a revalidate rather than relying on client
  // state alone -- this also keeps /discover's "For You" tab correct on
  // next visit without a manual refresh.
  revalidatePath(`/artists/${artistId}`);
  revalidatePath("/discover");
}
