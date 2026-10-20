import Link from "next/link";
import { getT } from "@/lib/i18n/server";

// Shown only to logged-out visitors (see app/page.tsx) — closes the pitch
// with the two facts that matter most to a first-time visitor deciding
// whether to trust the platform with their music and their bank details.
export default function TrustFooter() {
  const t = getT();
  return (
    <section className="mt-4 mb-16 border-t border-paper/15 pt-10 text-center">
      <p className="font-mono text-xs text-paper/50 max-w-lg mx-auto">
        {t("trust.body")}
      </p>
      <Link
        href="/signup"
        className="inline-block mt-6 bg-gold text-ink font-mono text-sm font-medium rounded px-5 py-3 hover:opacity-90"
      >
        {t("trust.cta")}
      </Link>

      <p className="font-mono text-[11px] text-paper/30 mt-8">
        <Link href="/terms" className="hover:text-gold">
          {t("trust.terms")}
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-gold">
          {t("trust.privacy")}
        </Link>{" "}
        ·{" "}
        <Link href="/artist-agreement" className="hover:text-gold">
          {t("trust.artistAgreement")}
        </Link>{" "}
        ·{" "}
        <Link href="/admin/login" className="hover:text-gold">
          Admin login
        </Link>
      </p>
    </section>
  );
}
