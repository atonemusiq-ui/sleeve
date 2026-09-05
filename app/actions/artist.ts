"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBio(formData: FormData) {
  const bio = (formData.get("bio") as string) ?? "";

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const { data: artist, error: fetchError } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (fetchError || !artist) {
    throw new Error("Could not find your artist profile.");
  }

  const { error } = await supabase
    .from("artists")
    .update({ bio: bio.trim() || null })
    .eq("id", artist.id);

  if (error) {
    throw new Error(`Saving bio failed: ${error.message}`);
  }

  // The bio shows up both on the dashboard (via this action's own form) and
  // on the public artist page — refresh both so the change is visible
  // without a manual reload.
  revalidatePath("/dashboard");
  revalidatePath(`/artists/${artist.id}`);
}
