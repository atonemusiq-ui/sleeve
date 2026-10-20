import { getLang } from "@/lib/i18n/server";

// Shown on legal pages (terms, privacy, artist agreement, license terms) when
// the visitor reads Fyby in another language: the page is translated for
// convenience, and the English text is the one that legally applies.
export default function LegalTranslationNote() {
  const lang = getLang();
  if (lang === "en") return null;
  return (
    <p
      data-no-translate
      className="font-mono text-xs text-paper/60 border border-paper/15 rounded-lg px-3 py-2 mb-6"
    >
      {lang === "es"
        ? "Esta traducción es solo para tu comodidad. Si hay alguna diferencia, la versión en inglés es la que rige."
        : "This translation is for convenience only. If there is any difference, the English version applies."}
    </p>
  );
}
