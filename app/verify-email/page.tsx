import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyEmailCode, resendEmailCode } from "@/app/actions/auth";
import FybyLogo, { FybyWordmark } from "@/app/FybyLogo";

// Step two of signup: enter the code from the confirmation email.
export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string; next?: string; error?: string; message?: string };
}) {
  const email = searchParams.email;
  if (!email) {
    redirect("/signup");
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
        <FybyLogo className="h-9 w-9" />
        <FybyWordmark className="text-3xl" />
      </Link>

      <p className="font-mono text-[11px] text-gold text-center tracking-widest mb-2">STEP 2 OF 2</p>
      <h1 className="font-display text-2xl text-paper text-center mb-2">Check your email</h1>
      <p className="font-mono text-xs text-paper/50 text-center mb-8">
        We sent a verification code to <span className="text-paper">{email}</span>. Enter it below to
        finish creating your account.
      </p>

      {searchParams.message && (
        <p className="font-mono text-sm text-forest mb-6">{searchParams.message}</p>
      )}
      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      <form action={verifyEmailCode} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        {searchParams.next && <input type="hidden" name="next" value={searchParams.next} />}

        <div>
          <label htmlFor="code" className="block font-mono text-xs text-paper/60 mb-1">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,12}"
            maxLength={12}
            required
            autoFocus
            placeholder="123456"
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-3 text-paper text-center font-mono text-2xl tracking-[0.4em] placeholder:text-paper/20"
          />
        </div>

        <button
          type="submit"
          className="mt-2 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          Verify &amp; continue
        </button>
      </form>

      <form action={resendEmailCode} className="mt-6 font-mono text-xs text-paper/50">
        <input type="hidden" name="email" value={email} />
        {searchParams.next && <input type="hidden" name="next" value={searchParams.next} />}
        Didn&apos;t get it? Check spam, or{" "}
        <button type="submit" className="text-gold hover:underline">
          send a new code
        </button>
        .
      </form>

      <p className="font-mono text-xs text-paper/50 mt-2">
        Wrong email?{" "}
        <Link href="/signup" className="text-gold">
          Start over
        </Link>
      </p>
    </main>
  );
}
