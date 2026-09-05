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
