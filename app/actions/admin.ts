"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";

// Same allowlist as app/admin/flagged/page.tsx — kept in one place would be
// nicer, but co-locating the check with each server action means an action
// can never run for a non-admin even if the page-level gate were ever
// bypassed or a new admin route forgot to check. See that file for why this
// is email-based rather than a `role` column.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    throw new Error("Not authorized.");
  }
}

export async function dismissFlag(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const admin = createServiceRoleClient();
  await admin.from("flagged_uploads").update({ status: "dismissed" }).eq("id", id);
  revalidatePath("/admin/flagged");
}

export async function confirmDuplicateFlag(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const admin = createServiceRoleClient();
  await admin.from("flagged_uploads").update({ status: "confirmed_duplicate" }).eq("id", id);
  revalidatePath("/admin/flagged");
}

// Same shape as the two above, for reported bio videos (see
// app/actions/video.ts's reportVideo and app/admin/videos/page.tsx).
export async function dismissVideoReport(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const admin = createServiceRoleClient();
  await admin.from("reported_videos").update({ status: "dismissed" }).eq("id", id);
  revalidatePath("/admin/videos");
}

// Clears the artist's video (not their video_tier — they already paid for
// the feature, so a policy violation costs them the video, not the money)
// and marks the report resolved.
export async function removeReportedVideo(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const artistId = formData.get("artistId") as string;
  const admin = createServiceRoleClient();

  await admin.from("artists").update({ bio_video_url: null, bio_video_type: null }).eq("id", artistId);
  await admin.from("reported_videos").update({ status: "removed" }).eq("id", id);

  revalidatePath("/admin/videos");
  revalidatePath(`/artists/${artistId}`);
}

// Genre suggestions (see app/actions/genres.ts's suggestGenre and
// app/admin/genres/page.tsx) — approving one copies its name into
// approved_genres (upsert, so re-approving an already-live name is a no-op)
// so the upload form's dropdown and the storefront's rows pick it up
// immediately; the suggestion row itself just moves out of the pending
// queue rather than being deleted, so there's a record of who asked for it.
export async function approveGenreSuggestion(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const admin = createServiceRoleClient();

  if (name) {
    await admin.from("approved_genres").upsert({ name }, { onConflict: "name" });
  }
  await admin.from("genre_suggestions").update({ status: "approved" }).eq("id", id);

  revalidatePath("/admin/genres");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function rejectGenreSuggestion(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const admin = createServiceRoleClient();

  await admin.from("genre_suggestions").update({ status: "rejected" }).eq("id", id);
  revalidatePath("/admin/genres");
}
