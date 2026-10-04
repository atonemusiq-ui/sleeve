"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidGenre } from "@/lib/genres";
import { INTEREST_TAGS } from "@/lib/interests";
import { revalidatePath } from "next/cache";

export type InterestsResult = { error?: string; success?: boolean };

// /interests: what the member tells the Fyby Engine they're into, and their
// personalization choice. Only the member's own row (RLS).
export async function saveInterests(formData: FormData): Promise<InterestsResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in first." };

  const genres = Array.from(
    new Set(formData.getAll("genres").filter((g): g is string => typeof g === "string" && isValidGenre(g)))
  ).slice(0, 10);
  const allowedTags = new Set(INTEREST_TAGS.map((t) => t.key));
  const tags = Array.from(
    new Set(formData.getAll("tags").filter((t): t is string => typeof t === "string" && allowedTags.has(t)))
  );

  const yearRaw = Number(formData.get("birthYear"));
  const thisYear = new Date().getFullYear();
  const birthYear = Number.isInteger(yearRaw) && yearRaw >= 1900 && yearRaw <= thisYear ? yearRaw : null;

  const { error } = await supabase.from("user_interests").upsert(
    {
      user_id: user.id,
      genres,
      tags,
      personalized: formData.get("personalized") === "on",
      birth_year: birthYear,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/discover");
  revalidatePath("/interests");
  return { success: true };
}
