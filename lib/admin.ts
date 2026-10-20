import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// The back office team. Admins live in the admin_users table
// (supabase/schema.sql); the founder's email is also hard-coded here as an
// owner so a bad table edit can never lock him out of his own back office.
export const FOUNDER_EMAILS = ["atonemusiq@gmail.com"];

export type AdminRole = "owner" | "moderator";
export type AdminUser = { email: string; role: AdminRole };

// Only decides whether the top bar shows the 🛡 Admin shortcut. It grants
// nothing -- every admin page and action re-checks with getAdmin().
export const ADMIN_UI_COOKIE = "fyby_admin_ui";

// Who's signed in, if they're on the admin team. Cached per request so a page
// and its actions only look it up once.
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return adminForEmail(user?.email);
});

export async function adminForEmail(email: string | null | undefined): Promise<AdminUser | null> {
  const clean = email?.trim().toLowerCase();
  if (!clean) return null;
  if (FOUNDER_EMAILS.includes(clean)) return { email: clean, role: "owner" };

  const service = createServiceRoleClient();
  const { data } = await service.from("admin_users").select("email, role").eq("email", clean).maybeSingle();
  if (!data) return null;
  return { email: data.email, role: data.role === "owner" ? "owner" : "moderator" };
}

// For admin pages: not signed in as an admin -> the admin login page.
export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// For server actions: throws instead of redirecting.
export async function requireAdminAction(message = "Not authorized."): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new Error(message);
  return admin;
}

export async function requireOwnerAction(): Promise<AdminUser> {
  const admin = await requireAdminAction();
  if (admin.role !== "owner") throw new Error("Only an owner can change the admin team.");
  return admin;
}

// Records a back-office action so the team can see who did what.
export async function logAdminAction(actorEmail: string, action: string, detail?: string | null) {
  try {
    const service = createServiceRoleClient();
    await service.from("admin_log").insert({ actor_email: actorEmail, action, detail: detail ?? null });
  } catch (err) {
    console.error("admin_log insert failed:", err);
  }
}

export function setAdminUiCookie(on: boolean) {
  try {
    if (on) {
      cookies().set(ADMIN_UI_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
    } else {
      cookies().delete(ADMIN_UI_COOKIE);
    }
  } catch {
    // cookies() is read-only while rendering a page; only actions can set it.
  }
}
