import Link from "next/link";
import { login } from "@/app/actions/auth";
import FybyLogo, { FybyWordmark } from "@/app/FybyLogo";
import PasswordInput from "@/app/PasswordInput";
import { getT } from "@/lib/i18n/server";
import LanguageMenu from "@/app/LanguageMenu";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; next?: string };
}) {
  const t = getT();
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <div className="flex justify-end mb-4">
        <LanguageMenu />
      </div>
      <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
        <FybyLogo className="h-9 w-9" />
        <FybyWordmark className="text-3xl" />
      </Link>

      <h1 className="font-display text-2xl text-paper text-center mb-2">{t("login.title")}</h1>
      <p className="font-mono text-xs text-paper/50 text-center mb-8">
        {t("login.sub")}
      </p>

      {searchParams.message && (
        <p className="font-mono text-sm text-forest mb-6">{searchParams.message}</p>
      )}

      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      <form action={login} className="flex flex-col gap-4">
        {searchParams.next && (
          <input type="hidden" name="next" value={searchParams.next} />
        )}
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">{t("login.email")}</label>
          <input
            name="email"
            type="email"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">{t("login.password")}</label>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          {t("login.submit")}
        </button>
      </form>

      <p className="font-mono text-xs text-paper/50 mt-6">
        {t("login.noAccount")}{" "}
        <a
          href={searchParams.next ? `/signup?next=${encodeURIComponent(searchParams.next)}` : "/signup"}
          className="text-gold"
        >
          {t("login.signUp")}
        </a>
      </p>
      <p className="font-mono text-xs text-paper/50 mt-2">
        <a href="/forgot-password" className="text-gold">
          {t("login.forgot")}
        </a>
      </p>

      {/* A small nod to the founder story rather than the full essay — this
          page's job is to get someone back in quickly, so we link to the
          full "Why I Built This" section on the homepage instead of
          reproducing it here. */}
      <div className="ticket-divider my-10" />

      <p className="font-body text-paper/70 text-sm leading-relaxed italic">
        {t("login.quote")}
      </p>
      <p className="font-mono text-xs text-gold mt-2">
        {t("login.quoteBy")} ·{" "}
        <Link href="/#why-i-built-this" className="underline hover:text-gold/80">
          {t("login.readStory")}
        </Link>
      </p>
    </main>
  );
}
