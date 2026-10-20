"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  FOUNDER_EMAILS,
  adminForEmail,
  logAdminAction,
  requireOwnerAction,
  setAdminUiCookie,
} from "@/lib/admin";

function loginError(message: string): never {
  redirect(`/admin/login?error=${encodeURIComponent(message)}`);
}

// /admin/login. Uses the normal Fyby account system, but only lets someone
// through if their email is on the admin team. Anyone else is signed right
// back out, so a fan or artist can't use this door.
export async function adminLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) loginError("Enter your admin email and password.");

  // Check the team list first so we don't even attempt a sign-in for
  // someone who isn't on it.
  const admin = await adminForEmail(email);
  if (!admin) loginError("That email isn't on the Fyby admin team.");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      loginError("This admin account hasn't confirmed its email yet. Finish signing up on Fyby first.");
    }
    loginError("Wrong email or password.");
  }

  setAdminUiCookie(true);
  await logAdminAction(email, "Signed in");
  redirect("/admin");
}

export async function adminLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  setAdminUiCookie(false);
  redirect("/admin/login?message=" + encodeURIComponent("Signed out of the back office."));
}

// Team management (owners only). The person being added signs up for a
// normal Fyby account with this email (or already has one), then signs in
// at /admin/login. A separate work email (e.g. name@getfyby.com) keeps their
// admin access apart from any personal artist or fan account.
export async function addAdmin(formData: FormData) {
  const owner = await requireOwnerAction();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "owner" ? "owner" : "moderator";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/admin?teamError=" + encodeURIComponent("Enter a valid email."));
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from("admin_users")
    .upsert({ email, role, added_by: owner.email }, { onConflict: "email" });
  if (error) redirect("/admin?teamError=" + encodeURIComponent(error.message));

  await logAdminAction(owner.email, `Added ${role}`, email);
  revalidatePath("/admin");
}

export async function removeAdmin(formData: FormData) {
  const owner = await requireOwnerAction();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (FOUNDER_EMAILS.includes(email)) {
    redirect("/admin?teamError=" + encodeURIComponent("The founder account can't be removed."));
  }
  if (email === owner.email) {
    redirect("/admin?teamError=" + encodeURIComponent("You can't remove yourself."));
  }

  const service = createServiceRoleClient();
  await service.from("admin_users").delete().eq("email", email);
  await logAdminAction(owner.email, "Removed admin", email);
  revalidatePath("/admin");
}
