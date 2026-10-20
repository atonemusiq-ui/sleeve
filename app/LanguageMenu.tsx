"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLanguage } from "@/app/actions/language";
import { LANGUAGES } from "@/lib/i18n/config";
import { useLang, useT } from "./I18nProvider";

// 🌐 language picker in the top bar (SiteLogoBar.tsx) and on the pages that
// hide that bar (home, log in, sign up). Saves the choice in a cookie and
// re-renders the page in the new language.
export default function LanguageMenu({ className = "" }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={`inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1.5 rounded-full border border-paper/20 text-paper/70 hover:border-gold/60 focus-within:border-gold/60 ${
        pending ? "opacity-60" : ""
      } ${className}`}
    >
      <span aria-hidden>🌐</span>
      <span className="sr-only">{t("language.menu")}</span>
      <select
        value={lang}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLanguage(next);
            router.refresh();
          });
        }}
        className="bg-transparent text-paper/80 outline-none cursor-pointer [&>option]:bg-ink"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
