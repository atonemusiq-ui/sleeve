"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNotification } from "@/lib/notifications";
import { isUuid } from "@/lib/uuid";
import { isValidGenre } from "@/lib/genres";
import {
  CONNECT_REQUEST_STATUSES,
  MAX_CONNECT_ROLES,
  connectRoleLabel,
  isConnectRole,
  type ConnectRequestStatus,
} from "@/lib/connectRoles";
import { revalidatePath } from "next/cache";

export type ConnectActionResult = { error?: string; success?: boolean };

const MAX_HEADLINE = 120;
const MAX_SHORT = 80;
const MAX_MESSAGE = 2000;

function clean(value: FormDataEntryValue | null, max: number): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  return s.slice(0, max);
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// /connect/me: create or update the signed-in member's Connect profile.
export async function saveConnectProfile(formData: FormData): Promise<ConnectActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in to set up your Connect profile." };

  const roles = Array.from(new Set(formData.getAll("roles").filter(isConnectRole)));
  if (roles.length === 0) return { error: "Pick at least one thing you do." };
  if (roles.length > MAX_CONNECT_ROLES) return { error: `Pick up to ${MAX_CONNECT_ROLES} roles.` };

  const genres = Array.from(
    new Set(formData.getAll("genres").filter((g): g is string => typeof g === "string" && isValidGenre(g)))
  ).slice(0, 5);

  const rawSample = clean(formData.get("sampleUrl"), 500);
  const sampleUrl = safeUrl(rawSample);
  if (rawSample && !sampleUrl) return { error: "Your sample link should start with https://" };

  const { error } = await supabase.from("connect_profiles").upsert(
    {
      user_id: user.id,
      headline: clean(formData.get("headline"), MAX_HEADLINE),
      roles,
      genres,
      rate_text: clean(formData.get("rate"), MAX_SHORT),
      location: clean(formData.get("location"), MAX_SHORT),
      remote: formData.get("remote") === "on",
      sample_url: sampleUrl,
      available: formData.get("available") === "on",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/connect");
  revalidatePath("/connect/me");
  revalidatePath(`/connect/${user.id}`);
  return { success: true };
}

// /connect/[userId]: send a request to another member. Login required so the
// recipient always knows who's asking and can reply by email.
export async function sendConnectRequest(formData: FormData): Promise<ConnectActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Log in to send a request." };

  const toUser = formData.get("toUser");
  const role = formData.get("role");
  const message = clean(formData.get("message"), MAX_MESSAGE);
  const deadlineRaw = clean(formData.get("deadline"), 10);

  if (!isUuid(toUser)) return { error: "Unknown member." };
  if (toUser === user.id) return { error: "That's your own profile." };
  if (!isConnectRole(role)) return { error: "Pick what you need them for." };
  if (!message) return { error: "Add a short message about the project." };
  const deadline = deadlineRaw && /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) ? deadlineRaw : null;

  const { data: target } = await supabase
    .from("connect_profiles")
    .select("user_id, roles, available")
    .eq("user_id", toUser)
    .maybeSingle();
  if (!target || !target.available) return { error: "This member isn't taking requests right now." };

  // A simple brake on spam: at most 10 requests a day per sender.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("connect_requests")
    .select("id", { count: "exact", head: true })
    .eq("from_user", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) return { error: "You've sent 10 requests today. Try again tomorrow." };

  const { error } = await supabase.from("connect_requests").insert({
    from_user: user.id,
    to_user: toUser,
    role,
    budget_text: clean(formData.get("budget"), MAX_SHORT),
    deadline,
    message,
    contact_email: user.email,
  });
  if (error) return { error: error.message };

  const { data: sender } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  await createNotification(createServiceRoleClient(), {
    userId: toUser,
    type: "connect",
    title: `New Connect request: ${connectRoleLabel(role)}`,
    body: `${sender?.display_name ?? "A Fyby member"} wants to work with you.`,
    link: "/connect/me",
  });

  revalidatePath("/connect/me");
  return { success: true };
}

// /connect/me inbox: the recipient marks a request accepted, declined or done.
export async function updateConnectRequestStatus(formData: FormData): Promise<ConnectActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in first." };

  const requestId = formData.get("requestId");
  const status = formData.get("status") as ConnectRequestStatus;
  if (!isUuid(requestId)) return { error: "Unknown request." };
  if (!CONNECT_REQUEST_STATUSES.includes(status)) return { error: "Unknown status." };

  const { data: updated, error } = await supabase
    .from("connect_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("to_user", user.id)
    .select("from_user, role")
    .maybeSingle();
  if (error) return { error: error.message };

  if (updated && (status === "accepted" || status === "declined")) {
    const { data: me } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    await createNotification(createServiceRoleClient(), {
      userId: updated.from_user,
      type: "connect",
      title: status === "accepted" ? "Your Connect request was accepted" : "Your Connect request was declined",
      body: `${me?.display_name ?? "The member"} ${status} your ${connectRoleLabel(updated.role)} request.`,
      link: "/connect/me",
    });
  }

  revalidatePath("/connect/me");
  return { success: true };
}
