"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;
  const role = formData.get("role") as "artist" | "fan";

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    return redirect(`/signup?error=${encodeURIComponent(error?.message ?? "Sign up failed")}`);
  }

  // create the profile row
  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    role,
    display_name: displayName,
  });

  if (profileError) {
    return redirect(`/signup?error=${encodeURIComponent(profileError.message)}`);
  }

  // if signing up as an artist, also create the artists row
  if (role === "artist") {
    const { error: artistError } = await supabase.from("artists").insert({
      user_id: data.user.id,
    });

    if (artistError) {
      return redirect(`/signup?error=${encodeURIComponent(artistError.message)}`);
    }
  }

  redirect(role === "artist" ? "/dashboard" : "/");
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
