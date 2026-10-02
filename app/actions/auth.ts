"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
  // Fans can opt in to verifying their email with a code at signup (the
  // checkbox on /signup). Artists always do — see verifyEmailCode below.
  const fanWantsCode = formData.get("verifyEmail") === "on";

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

  const admin = createServiceRoleClient();

  // Claim any purchases already sitting under this email with no fan_id —
  // a guest/anonymous checkout from before buying required an account, or
  // someone completing the "create a free account" prompt on /success
  // right after paying (see app/success/page.tsx). Uses the service-role
  // client since there's no purchases UPDATE policy for RLS to allow this
  // for a brand-new account. Same trust model this app already accepts for
  // fan signups generally (auto-confirmed with no inbox round trip) — this
  // doesn't verify the signer actually owns that inbox, it just reunites a
  // purchase with an account claiming the email that paid for it.
  const { error: claimError } = await admin
    .from("purchases")
    .update({ fan_id: data.user.id })
    .eq("buyer_email", email)
    .is("fan_id", null);

  if (claimError) {
    console.error("[signup] failed to claim past purchases by email", {
      userId: data.user.id,
      email,
      message: claimError.message,
    });
  }

  // Artists still confirm their email before they can log in — they handle
  // real money via Stripe Connect, so that's worth the friction. Fans
  // don't: email confirmation was exactly the extra step in "get bounced to
  // sign up mid-checkout, then come back and buy" (see
  // app/actions/checkout.ts), so a fan gets auto-confirmed and signed in
  // immediately instead. This uses the service-role admin API — a trusted,
  // server-only operation — rather than touching the project-wide "confirm
  // email" setting, which would also turn off confirmation for artists.
  if (role === "fan" && !fanWantsCode) {
    const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, {
      email_confirm: true,
    });

    if (confirmError) {
      console.error("[signup] fan auto-confirm failed", {
        userId: data.user.id,
        email,
        message: confirmError.message,
      });
    } else {
      // Immediately signing in right after admin-confirming can occasionally
      // race ahead of that confirmation propagating through Supabase's auth
      // backend, which surfaces as a spurious "Email not confirmed" on the
      // very next call. One short retry absorbs that lag instead of bouncing
      // a fan to "check your email" over a race condition that isn't theirs.
      let signInError = (await supabase.auth.signInWithPassword({ email, password })).error;

      if (signInError) {
        console.error("[signup] fan sign-in after auto-confirm failed, retrying once", {
          userId: data.user.id,
          email,
          message: signInError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        signInError = (await supabase.auth.signInWithPassword({ email, password })).error;
      }

      if (!signInError) {
        redirect(next && next.startsWith("/") ? next : "/");
      } else {
        console.error("[signup] fan sign-in after auto-confirm failed twice", {
          userId: data.user.id,
          email,
          message: signInError.message,
        });
      }
    }
    // If auto-confirm or sign-in failed for any reason, fall through to the
    // same "check your email" path an artist gets — worst case a fan sees
    // one extra step, not a broken signup.
  }

  // Email confirmation is required, so signUp() didn't return an active
  // session yet. Two-step signup: the confirmation email Supabase just sent
  // carries a 6-digit code ({{ .Token }} in the "Confirm signup" template),
  // and /verify-email takes it and signs them straight in — no need to go
  // find the link and then log in separately.
  redirect(verifyEmailUrl(email, next));
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
  const fallback = role === "artist" ? "/dashboard" : "/";
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

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

  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
