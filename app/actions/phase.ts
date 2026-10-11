"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, isAdminEmail, parsePhase } from "@/lib/phases";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) throw new Error("Not authorized.");
}

// Investor demo: shows the admin the app as it looks at one release phase.
// Only affects the admin's own browser -- middleware ignores the cookie for
// everyone else, so the public site never changes from here.
export async function setPreviewPhase(phase: number) {
  await requireAdmin();
  const parsed = parsePhase(phase);
  if (!parsed) throw new Error("Not a valid phase.");

  cookies().set(PREVIEW_COOKIE, String(parsed), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  revalidatePath("/", "layout");
}

// Back to the live site.
export async function clearPreviewPhase() {
  await requireAdmin();
  cookies().delete(PREVIEW_COOKIE);
  revalidatePath("/", "layout");
}
