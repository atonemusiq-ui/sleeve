"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Both scoped by auth.uid() via RLS ("users update their own notifications"
// in supabase/schema.sql) as well as the explicit filters below — belt and
// suspenders, same pattern as the rest of this codebase's server actions.
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/dashboard");
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/dashboard");
}
