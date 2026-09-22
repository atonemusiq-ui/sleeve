"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ArtistHubActionResult = { error?: string; success?: boolean };

export type CustomLink = { label: string; url: string };

const MAX_LINKS = 8;
const MAX_LABEL_LENGTH = 40;
const MAX_TOUR_DATES_LENGTH = 4000;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function getOwnArtistOrError() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." } as const;

  const { data: artist } = await supabase.from("artists").select("id").eq("user_id", user.id).maybeSingle();
  if (!artist) return { error: "Could not find your artist profile." } as const;

  return { supabase, artistId: artist.id } as const;
}

// Custom links (app/dashboard/ArtistHubManager.tsx) are sent as parallel
// label[]/url[] form fields rather than a JSON blob, since a plain <form>
// with repeated inputs is what the rest of this app's dashboard forms
// already do -- no client-side JSON.stringify to get wrong. Blank pairs
// (an artist who removed a row but left the empty slot) are dropped rather
// than rejected.
export async function updateCustomLinks(formData: FormData): Promise<ArtistHubActionResult> {
  const owned = await getOwnArtistOrError();
  if ("error" in owned) return owned;
  const { supabase, artistId } = owned;

  const labels = formData.getAll("label") as string[];
  const urls = formData.getAll("url") as string[];

  const links: CustomLink[] = [];
  for (let i = 0; i < Math.max(labels.length, urls.length); i++) {
    const label = (labels[i] ?? "").trim();
    const url = (urls[i] ?? "").trim();
    if (!label && !url) continue;
    if (!label) return { error: `Link ${i + 1} is missing a label.` };
    if (label.length > MAX_LABEL_LENGTH) {
      return { error: `"${label}" is too long (max ${MAX_LABEL_LENGTH} characters).` };
    }
    if (!url || !isHttpUrl(url)) {
      return { error: `"${label}" needs a valid http(s) link.` };
    }
    links.push({ label, url });
  }

  if (links.length > MAX_LINKS) {
    return { error: `Up to ${MAX_LINKS} links.` };
  }

  const { error } = await supabase.from("artists").update({ custom_links: links }).eq("id", artistId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTourDates(formData: FormData): Promise<ArtistHubActionResult> {
  const owned = await getOwnArtistOrError();
  if ("error" in owned) return owned;
  const { supabase, artistId } = owned;

  const tourDates = ((formData.get("tourDates") as string) ?? "").trim();
  if (tourDates.length > MAX_TOUR_DATES_LENGTH) {
    return { error: `Tour dates are too long (max ${MAX_TOUR_DATES_LENGTH} characters).` };
  }

  const { error } = await supabase
    .from("artists")
    .update({ tour_dates: tourDates || null })
    .eq("id", artistId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMailingListEnabled(formData: FormData): Promise<ArtistHubActionResult> {
  const owned = await getOwnArtistOrError();
  if ("error" in owned) return owned;
  const { supabase, artistId } = owned;

  const enabled = formData.get("enabled") === "true";

  const { error } = await supabase
    .from("artists")
    .update({ mailing_list_enabled: enabled })
    .eq("id", artistId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

// Public -- no login required. A fan signs up straight from an artist's page
// (app/artists/[id]/MailingListForm.tsx); the insert policy in
// supabase/schema.sql ("anyone can join an artist's mailing list") is what
// actually allows this to write with no session -- same shape as
// submitBookingRequest in app/actions/booking.ts. The unique index on
// (artist_id, fan_email) plus ignoreDuplicates makes a repeat signup a
// harmless no-op (an INSERT ... ON CONFLICT DO NOTHING, needing only the
// insert policy above) rather than a duplicate row or a confusing error.
export async function joinMailingList(formData: FormData): Promise<ArtistHubActionResult> {
  const artistId = formData.get("artistId") as string;
  const fanEmail = (formData.get("fanEmail") as string)?.trim().toLowerCase();

  if (!artistId) return { error: "Missing artist." };
  if (!fanEmail || !fanEmail.includes("@")) return { error: "Please enter a valid email." };

  const supabase = createClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id, mailing_list_enabled")
    .eq("id", artistId)
    .maybeSingle();
  if (!artist) return { error: "Could not find that artist." };
  if ((artist as any).mailing_list_enabled === false) {
    return { error: "This artist isn't accepting mailing list signups right now." };
  }

  const { error } = await supabase
    .from("artist_fans")
    .upsert({ artist_id: artistId, fan_email: fanEmail }, { onConflict: "artist_id,fan_email", ignoreDuplicates: true });

  if (error) return { error: error.message };
  return { success: true };
}
