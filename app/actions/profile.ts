"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const MAX_DISPLAY_NAME = 60;

export type UpdateNameResult = { error?: string; name?: string };

// The artist (or fan) changing the name everyone sees: on their artist page,
// the Artists on Fyby directory, the storefront and receipts. Edited from the
// Artist Studio (app/dashboard/ArtistNameEditor.tsx). Only display_name is
// written; the "users can update their own profile" policy scopes it to
// their own row.
export async function updateDisplayName(formData: FormData): Promise<UpdateNameResult> {
  const name = ((formData.get("displayName") as string) ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Your name can't be empty." };
  if (name.length > MAX_DISPLAY_NAME) return { error: `Keep it to ${MAX_DISPLAY_NAME} characters or fewer.` };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) return { error: `Saving your name failed: ${error.message}` };

  const { data: artist } = await supabase.from("artists").select("id").eq("user_id", user.id).maybeSingle();
  revalidatePath("/dashboard");
  revalidatePath("/artists");
  revalidatePath("/");
  if (artist?.id) revalidatePath(`/artists/${artist.id}`);
  return { name };
}
