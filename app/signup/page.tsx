import Link from "next/link";
import { signup } from "@/app/actions/auth";
import FybyLogo, { FybyWordmark } from "@/app/FybyLogo";
import PasswordInput from "@/app/PasswordInput";
import { isRadioEnabled } from "@/lib/radio";
import { createClient } from "@/lib/supabase/server";
import { FOUNDING, formatPlanPrice } from "@/lib/plans";
import { getT } from "@/lib/i18n/server";
import LanguageMenu from "@/app/LanguageMenu";

export default async function SignupPage({
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

  // Founding Artist countdown (supabase/schema.sql, founding_spots_left).
  // Hidden if the lookup fails or the spots are gone.
  const supabase = createClient();
  const t = getT();
  const { data: spotsLeft } = await supabase.rpc("founding_spots_left");
  const foundingOpen = typeof spotsLeft === "number" && spotsLeft > 0;

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <div className="flex justify-end mb-4">
        <LanguageMenu />
      </div>
      <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
        <FybyLogo className="h-9 w-9" />
        <FybyWordmark className="text-3xl" />
      </Link>

      <h1 className="font-display text-2xl text-paper text-center mb-2">{t("signup.title")}</h1>
      <p className="font-mono text-xs text-paper/50 text-center mb-8">
        {t("signup.sub")}
      </p>

      {foundingOpen && (
        <div className="mb-8 rounded-lg border border-gold/50 bg-gold/10 px-4 py-3 text-center">
          <p className="font-display text-gold">
            {t("signup.foundingLeft", { left: spotsLeft, total: FOUNDING.spots })}
          </p>
          <p className="font-mono text-[11px] text-paper/70 mt-1">
            {t("signup.foundingBody", { price: formatPlanPrice(FOUNDING.priceCents.pro) })}
          </p>
        </div>
      )}

      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        {searchParams.next && (
          <input type="hidden" name="next" value={searchParams.next} />
        )}
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">{t("signup.displayName")}</label>
          <input
            name="displayName"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">{t("signup.email")}</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={searchParams.email ?? ""}
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">{t("signup.password")}</label>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <fieldset>
          <legend className="block font-mono text-xs text-paper/60 mb-2">{t("signup.iAmA")}</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 font-body">
              <input
                type="radio"
                name="role"
                value="artist"
                defaultChecked={!cameFromBuying}
              />
              {t("signup.artist")}
            </label>
            <label className="flex items-center gap-2 font-body">
              <input type="radio" name="role" value="fan" defaultChecked={cameFromBuying} />
              {t("signup.fan")}
            </label>
          </div>
        </fieldset>

        {/* Two-step signup (see verifyEmailCode in app/actions/auth.ts).
            Artists always get an emailed code since they handle payouts;
            fans skip it by default so checkout stays fast, but can opt in.
            The checkbox only affects fans — the action ignores it for artists. */}
        <div className="border border-paper/15 rounded-lg px-4 py-3 font-mono text-xs text-paper/60 flex flex-col gap-2">
          <p>
            <span className="text-paper">{t("signup.twoStepLabel")}</span> {t("signup.twoStepBody")}
          </p>
          <label className="flex items-center gap-2 text-paper/80">
            <input type="checkbox" name="verifyEmail" />
            {t("signup.fanVerify")}
          </label>
        </div>

        {/* Fyby Radio (Phase 10), explained before they join. Hidden until
            the radio is switched on (NEXT_PUBLIC_RADIO_ENABLED). */}
        {isRadioEnabled() && (
          <div className="border border-gold/30 bg-gold/5 rounded-lg px-4 py-3 font-mono text-xs text-paper/70 flex flex-col gap-2">
            <p className="text-gold">{t("signup.radioTitle")}</p>
            <p>
              <span className="text-paper">{t("signup.radioFansLabel")}</span> {t("signup.radioFans")}
            </p>
            <p>
              <span className="text-paper">{t("signup.radioArtistsLabel")}</span> {t("signup.radioArtists")}
            </p>
          </div>
        )}

        <button
          type="submit"
          className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          {t("signup.submit")}
        </button>
      </form>

      <p className="font-mono text-[11px] text-paper/40 mt-4 text-center">
        {t("signup.agreeLead")}{" "}
        <Link href="/terms" className="text-gold hover:underline">
          {t("signup.terms")}
        </Link>{" "}
        {t("signup.and")}{" "}
        <Link href="/privacy" className="text-gold hover:underline">
          {t("signup.privacy")}
        </Link>
        {cameFromBuying ? null : (
          <>
            {" "}
            {t("signup.artistsAlso")}{" "}
            <Link href="/artist-agreement" className="text-gold hover:underline">
              {t("signup.artistAgreement")}
            </Link>
          </>
        )}
        .
      </p>

      <p className="font-mono text-xs text-paper/50 mt-6">
        {t("signup.haveAccount")}{" "}
        <a
          href={searchParams.next ? `/login?next=${encodeURIComponent(searchParams.next)}` : "/login"}
          className="text-gold"
        >
          {t("signup.logIn")}
        </a>
      </p>
    </main>
  );
}
