import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// This client uses the service role key, which bypasses Row Level Security.
// Only use it in server-side code that never runs in the browser (webhooks,
// trusted background jobs) — never expose this client or its key to the client.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}
