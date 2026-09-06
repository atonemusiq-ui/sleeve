"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type UpdateBioResult = { error?: string };

// Covers both the bio text and the optional bio photo (BioManager.tsx). The
// photo file itself still uploads directly from the browser to the public
// "artist-photos" bucket (server actions don't take File objects well) —
// this just takes the resulting URL and does the validated database write,
// same split as track cover art in app/actions/tracks.ts.
export async function updateBio(formData: FormData): Promise<UpdateBioResult> {
  const bio = (formData.get("bio") as string) ?? "";
  const bioPhotoUrl = (formData.get("bioPhotoUrl") as string) || null;
  const removePhoto = formData.get("removePhoto") === "true";

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: artist, error: fetchError } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (fetchError || !artist) {
    return { error: "Could not find your artist profile." };
  }

  const updates: { bio: string | null; bio_photo_url?: string | null } = {
    bio: bio.trim() || null,
  };
  if (removePhoto) {
    updates.bio_photo_url = null;
  } else if (bioPhotoUrl) {
    updates.bio_photo_url = bioPhotoUrl;
  }

  const { error } = await supabase.from("artists").update(updates).eq("id", artist.id);

  if (error) {
    return { error: `Saving bio failed: ${error.message}` };
  }

  // The bio shows up both on the dashboard (via BioManager.tsx) and on the
  // public artist page — refresh both so the change is visible without a
  // manual reload.
  revalidatePath("/dashboard");
  revalidatePath(`/artists/${artist.id}`);
  return {};
}

export type UpdateGalleryResult = { error?: string };

const MAX_GALLERY_PHOTOS = 4;

// The public artist page's 4-photo gallery (app/dashboard/GalleryManager.tsx
// manages it, app/artists/[id]/page.tsx displays it). Each photo still
// uploads directly from the browser to the public "artist-photos" bucket —
// same split as the bio photo above — this just takes the resulting URLs
// and writes the validated array.
export async function updateGallery(formData: FormData): Promise<UpdateGalleryResult> {
  let urls: unknown;
  try {
    urls = JSON.parse((formData.get("galleryUrls") as string) ?? "[]");
  } catch {
    return { error: "Invalid gallery data." };
  }

  if (!Array.isArray(urls) || urls.some((u) => typeof u !== "string")) {
    return { error: "Invalid gallery data." };
  }

  const galleryUrls = (urls as string[]).filter(Boolean).slice(0, MAX_GALLERY_PHOTOS);

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: artist, error: fetchError } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (fetchError || !artist) {
    return { error: "Could not find your artist profile." };
  }

  const { error } = await supabase
    .from("artists")
    .update({ gallery_urls: galleryUrls })
    .eq("id", artist.id);

  if (error) {
    return { error: `Saving gallery failed: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/artists/${artist.id}`);
  return {};
}
