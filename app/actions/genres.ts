"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidGenre, MAX_GENRE_SUGGESTION_LENGTH } from "@/lib/genres";

export type SuggestGenreResult = { error?: string; success?: boolean };

// Lands in genre_suggestions as 'pending' — it does NOT make the name
// selectable on its own. An admin approves or rejects it at /admin/genres
// (app/actions/admin.ts's approveGenreSuggestion/rejectGenreSuggestion);
// approval copies the name into approved_genres, which the upload form and
// storefront read alongside the fixed list in lib/genres.ts.
export async function suggestGenre(formData: FormData): Promise<SuggestGenreResult> {
  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    return { error: "Enter a genre name." };
  }
  if (name.length > MAX_GENRE_SUGGESTION_LENGTH) {
    return { error: `Keep it under ${MAX_GENRE_SUGGESTION_LENGTH} characters.` };
  }
  if (isValidGenre(name)) {
    return { error: "That genre is already on the list — pick it from the dropdown above." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to be logged in to suggest a genre." };
  }

  const { error } = await supabase.from("genre_suggestions").insert({
    suggested_by: user.id,
    suggested_name: name,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
