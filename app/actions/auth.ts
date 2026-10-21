"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SOURCE_COOKIE, parseSignupSource } from "@/lib/signupSource";
import { siteOrigin } from "@/lib/siteUrl";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;
  const rawRole = formData.get("role");
  const role: "artist" | "fan" | "vendor" =
    rawRole === "artist" || rawRole === "vendor" ? rawRole : "fan";
  // Carried through from a "log in to buy this track" bounce (see
  // app/actions/checkout.ts) so someone who had to sign up mid-purchase
  // still ends up back where they were after confirming their email and
  // logging in, instead of just landing on /dashboard.
  const next = formData.get("next") as string | null;
  // Fans can opt in to verifying their email with a code at signup (the
  // checkbox on /signup). Artists always do — see verifyEmailCode below.
  const fanWantsCode = formData.get("verifyEmail") === "on";

  const supabase = createClient();
  const admin = createServiceRoleClient();

  // Which marketing video sent them, if any (set by getfyby.com/mic, see
  // app/mic/route.ts). Saved on the account so sign-ups can be counted per
  // platform and video.
  const signupSource = parseSignupSource(cookies().get(SOURCE_COOKIE)?.value);
  const metadata = {
    role,
    display_name: displayName,
    ...(signupSource ? { signup_source: signupSource } : {}),
  };

  // Fans who didn't ask for a code are created already confirmed and signed
  // straight in. Creating them confirmed in one step (instead of signUp()
  // and then confirming) means there's no window where Supabase still thinks
  // the email is unconfirmed -- that race is what sent fans to "check your
  // email" in production -- and no confirmation email goes out for nothing.
  if (role === "fan" && !fanWantsCode) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (createError || !created.user) {
      const taken = createError && /already|registered|exists/i.test(createError.message);
      const message = taken
        ? "An account with that email already exists. Log in instead."
        : createError?.message ?? "Sign up failed";
      return redirect(`/signup?error=${encodeURIComponent(message)}`);
    }

    await claimPastPurchases(created.user.id, email);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) {
      redirect(next && next.startsWith("/") ? next : "/");
    }
    console.error("[signup] fan sign-in after create failed", {
      userId: created.user.id,
      message: signInError.message,
    });
    const loginNext = next ? `&next=${encodeURIComponent(next)}` : "";
    return redirect(`/login?error=${encodeURIComponent("Your account is ready. Please log in.")}${loginNext}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // A Postgres trigger on auth.users reads `role` and `display_name`
      // from raw_user_meta_data (populated from this `options.data`) to
      // create the matching `profiles` (and, for artists, `artists`) rows.
      // Note the key is `display_name` (snake_case), matching what the
      // trigger reads — not `displayName`.
      data: metadata,
    },
  });

  if (error || !data.user) {
    return redirect(`/signup?error=${encodeURIComponent(error?.message ?? "Sign up failed")}`);
  }

  // `profiles`/`artists` rows are created by the database trigger above, so
  // there's nothing left to insert here.
  await claimPastPurchases(data.user.id, email);

  // Email confirmation is required, so signUp() didn't return an active
  // session yet. Two-step signup: the confirmation email Supabase just sent
  // carries a 6-digit code ({{ .Token }} in the "Confirm signup" template),
  // and /verify-email takes it and signs them straight in — no need to go
  // find the link and then log in separately.
  redirect(verifyEmailUrl(email, next));
}

// Claim any purchases already sitting under this email with no fan_id -- a
// guest checkout from before buying required an account, or someone
// completing the "create a free account" prompt on /success right after
// paying (see app/success/page.tsx). Uses the service-role client since
// there's no purchases UPDATE policy for RLS to allow this for a brand-new
// account. This doesn't verify the signer owns that inbox; it reunites a
// purchase with an account claiming the email that paid for it.
async function claimPastPurchases(userId: string, email: string) {
  const { error } = await createServiceRoleClient()
    .from("purchases")
    .update({ fan_id: userId })
    .eq("buyer_email", email)
    .is("fan_id", null);
  if (error) {
    console.error("[signup] failed to claim past purchases by email", { userId, message: error.message });
  }
}

function verifyEmailUrl(email: string, next: string | null, extra?: { error?: string; message?: string }) {
  const params = new URLSearchParams({ email });
  if (next) params.set("next", next);
  if (extra?.error) params.set("error", extra.error);
  if (extra?.message) params.set("message", extra.message);
  return `/verify-email?${params.toString()}`;
}

// Second step of signup: check the code from the confirmation email. A
// successful verifyOtp() both confirms the email and starts a session, so
// they land in the app already logged in.
export async function verifyEmailCode(formData: FormData) {
  const email = ((formData.get("email") as string) ?? "").trim();
  const token = ((formData.get("code") as string) ?? "").replace(/\s/g, "");
  const next = formData.get("next") as string | null;

  if (!email) {
    redirect("/signup");
  }
  if (!/^\d{6,10}$/.test(token)) {
    redirect(verifyEmailUrl(email, next, { error: "Enter the code from your email." }));
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.session) {
    redirect(
      verifyEmailUrl(email, next, {
        error: "That code didn't work — it may have expired. Check the code or send a new one.",
      })
    );
  }

  const role = data.user?.user_metadata?.role;
  const fallback = role === "artist" ? "/dashboard" : role === "vendor" ? "/vendor" : "/";
  redirect(next && next.startsWith("/") ? next : fallback);
}

export async function resendEmailCode(formData: FormData) {
  const email = ((formData.get("email") as string) ?? "").trim();
  const next = formData.get("next") as string | null;

  if (!email) {
    redirect("/signup");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    // Most often Supabase's per-email rate limit (one resend per ~60s).
    redirect(verifyEmailUrl(email, next, { error: error.message }));
  }

  redirect(verifyEmailUrl(email, next, { message: "New code sent — check your inbox." }));
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next") as string | null;

  const supabase = createClient();

  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Signed up but never entered their code: send a fresh one and take
    // them to the code screen instead of a dead-end error.
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      await supabase.auth.resend({ type: "signup", email });
      return redirect(
        verifyEmailUrl(email, next, {
          message: "Your email isn't verified yet — we just sent you a new code.",
        })
      );
    }
    const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
    return redirect(`/login?error=${encodeURIComponent(error.message)}${nextParam}`);
  }

  // Vendors have their own portal; everyone else lands where they always did.
  const home = signedIn?.user?.user_metadata?.role === "vendor" ? "/vendor" : "/dashboard";
  redirect(next && next.startsWith("/") ? next : home);
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;

  const supabase = createClient();
  const siteUrl = siteOrigin();

  // Errors here (including "no account with that email") are deliberately
  // not surfaced — same message either way, so this can't be used to probe
  // which emails have accounts.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  redirect(
    `/forgot-password?message=${encodeURIComponent(
      "If an account exists for that email, a reset link is on its way."
    )}`
  );
}
