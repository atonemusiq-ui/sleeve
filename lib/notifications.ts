// Both the Stripe webhook (service-role client, no user session) and
// ordinary server actions (a logged-in user's own client) create
// notifications, so this takes any Supabase client with a compatible
// `.from()` rather than importing a specific client type from either side.
// Reading/marking-read is a separate path — see app/actions/notifications.ts
// and app/NotificationBell.tsx — gated by the "users read/update their own
// notifications" RLS policies in supabase/schema.sql. There's no insert
// policy at all: only server-side code using a service-role or otherwise
// trusted client ever calls this.
export async function createNotification(
  supabase: { from: (table: string) => any },
  params: { userId: string; type: string; title: string; body?: string | null; link?: string | null }
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });

  if (error) {
    // Best-effort — a failed notification insert shouldn't block the sale,
    // booking, or refund it was describing.
    console.error("Failed to create notification:", error.message);
  }
}
