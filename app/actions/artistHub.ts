"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNotification } from "@/lib/notifications";

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
// submitBookingRequest in app/actions/booking.ts.
//
// This is a plain insert, not an upsert with onConflict/ignoreDuplicates:
// under RLS, Postgres needs to see a potentially-conflicting existing row to
// evaluate ON CONFLICT DO NOTHING safely, and the SELECT policy here is
// (correctly) scoped to the owning artist only -- a fan signing up has no
// session, so that check has nothing to see and Postgres refuses the whole
// statement with "new row violates row-level security policy", even though
// the insert policy itself allows it. Catching the unique-violation error
// code (23505) after a plain insert gets the same "repeat signup is a
// harmless no-op" behavior without needing anon to see other fans' rows.
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
    .insert({ artist_id: artistId, fan_email: fanEmail });

  if (error && error.code !== "23505") return { error: error.message };

  const admin = createServiceRoleClient();

  if (error) {
    // Already on the list. If they'd unsubscribed earlier, signing up again
    // turns new-release emails back on; otherwise it's a harmless repeat.
    const { data: rejoined } = await admin
      .from("artist_fans")
      .update({ unsubscribed_at: null })
      .eq("artist_id", artistId)
      .eq("fan_email", fanEmail)
      .not("unsubscribed_at", "is", null)
      .select("id");
    if (!rejoined || rejoined.length === 0) return { success: true };
  }

  // Let the artist know someone joined (the bell in their dashboard).
  // Best-effort: a failed notification never fails the signup itself.
  try {
    const { data: owner } = await admin.from("artists").select("user_id").eq("id", artistId).maybeSingle();
    const { count } = await admin
      .from("artist_fans")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .is("unsubscribed_at", null);
    if (owner?.user_id) {
      await createNotification(admin, {
        userId: owner.user_id,
        type: "mailing_list_signup",
        title: "New fan joined your mailing list",
        body: `${fanEmail} signed up.${count ? ` You now have ${count} on your list.` : ""}`,
        link: "/dashboard",
      });
    }
  } catch (notifyErr: any) {
    console.error("Mailing list signup notification failed:", notifyErr?.message);
  }

  return { success: true };
}

// Whether the artist's mailing list automatically gets an email each time
// they release a song (app/actions/upload.ts). On by default.
export async function updateNotifyFansOnRelease(formData: FormData): Promise<ArtistHubActionResult> {
  const owned = await getOwnArtistOrError();
  if ("error" in owned) return owned;
  const { supabase, artistId } = owned;

  const enabled = formData.get("enabled") === "true";
  const { error } = await supabase.from("artists").update({ notify_fans_on_release: enabled }).eq("id", artistId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
