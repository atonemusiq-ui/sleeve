import Link from "next/link";
import { signup } from "@/app/actions/auth";
import FybyLogo, { FybyWordmark } from "@/app/FybyLogo";
import PasswordInput from "@/app/PasswordInput";
import { isRadioEnabled } from "@/lib/radio";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; email?: string };
}) {
  // Arriving here via a "log in to buy this track" bounce (see
  // app/actions/checkout.ts), or via the "create a free account" prompt on
  // /success after a purchase (see app/success/page.tsx), means they're
  // here to buy/claim a purchase, not to sell — default the role picker to
  // Fan in either case instead of Artist.
  const cameFromBuying = Boolean(searchParams.next) || Boolean(searchParams.email);

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
        <FybyLogo className="h-9 w-9" />
        <FybyWordmark className="text-3xl" />
      </Link>

      <h1 className="font-display text-2xl text-paper text-center mb-2">Create your account</h1>
      <p className="font-mono text-xs text-paper/50 text-center mb-8">
        Join Fyby to start selling your music, or supporting the artists you love.
      </p>

      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        {searchParams.next && (
          <input type="hidden" name="next" value={searchParams.next} />
        )}
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Display name</label>
          <input
            name="displayName"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={searchParams.email ?? ""}
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Password</label>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <fieldset>
          <legend className="block font-mono text-xs text-paper/60 mb-2">I am a...</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 font-body">
              <input
                type="radio"
                name="role"
                value="artist"
                defaultChecked={!cameFromBuying}
              />
              Artist
            </label>
            <label className="flex items-center gap-2 font-body">
              <input type="radio" name="role" value="fan" defaultChecked={cameFromBuying} />
              Fan
            </label>
          </div>
        </fieldset>

        {/* Fyby Radio (Phase 10), explained before they join. Hidden until
            the radio is switched on (NEXT_PUBLIC_RADIO_ENABLED). */}
        {isRadioEnabled() && (
          <div className="border border-gold/30 bg-gold/5 rounded-lg px-4 py-3 font-mono text-xs text-paper/70 flex flex-col gap-2">
            <p className="text-gold">📻 Fyby Radio comes with every account</p>
            <p>
              <span className="text-paper">Fans:</span> listen free, nonstop, by genre or mood, and buy any
              song you hear with one tap.
            </p>
            <p>
              <span className="text-paper">Artists:</span> check &quot;Play on Fyby Radio&quot; when you
              upload. Every new artist gets extra plays free for their first month, and you can premiere a
              new song for heavy rotation.
            </p>
          </div>
        )}

        <button
          type="submit"
          className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          Sign up
        </button>
      </form>

      <p className="font-mono text-[11px] text-paper/40 mt-4 text-center">
        By signing up, you agree to Fyby&apos;s{" "}
        <Link href="/terms" className="text-gold hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-gold hover:underline">
          Privacy Policy
        </Link>
        {cameFromBuying ? null : (
          <>
            {" "}
            — Artists also agree to the{" "}
            <Link href="/artist-agreement" className="text-gold hover:underline">
              Artist Agreement
            </Link>
          </>
        )}
        .
      </p>

      <p className="font-mono text-xs text-paper/50 mt-6">
        Already have an account?{" "}
        <a
          href={searchParams.next ? `/login?next=${encodeURIComponent(searchParams.next)}` : "/login"}
          className="text-gold"
        >
          Log in
        </a>
      </p>
    </main>
  );
}
