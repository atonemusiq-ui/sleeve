"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;
  const role = formData.get("role") as "artist" | "fan";
  // Carried through from a "log in to buy this track" bounce (see
  // app/actions/checkout.ts) so someone who had to sign up mid-purchase
  // still ends up back where they were after confirming their email and
  // logging in, instead of just landing on /dashboard.
  const next = formData.get("next") as string | null;

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // A Postgres trigger on auth.users reads `role` and `display_name`
      // from raw_user_meta_data (populated from this `options.data`) to
      // create the matching `profiles` (and, for artists, `artists`) rows.
      // Note the key is `display_name` (snake_case), matching what the
      // trigger reads — not `displayName`.
      data: {
        role,
        display_name: displayName,
      },
    },
  });

  if (error || !data.user) {
    return redirect(`/signup?error=${encodeURIComponent(error?.message ?? "Sign up failed")}`);
  }

  // `profiles`/`artists` rows are created by the database trigger above, so
  // there's nothing left to insert here.

  // Email confirmation is required, so signUp() doesn't return an active
  // session yet — send them to log in once they've confirmed their email
  // instead of straight to the dashboard.
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  redirect(
    `/login?message=${encodeURIComponent(
      "Check your email to confirm your account, then log in."
    )}${nextParam}`
  );
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next") as string | null;

  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
    return redirect(`/login?error=${encodeURIComponent(error.message)}${nextParam}`);
  }

  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
