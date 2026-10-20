// Fyby's interface languages. Adding one = add its messages file next to
// en.ts/es.ts and list it here; anything it doesn't translate yet falls back
// to English. Kept free of server-only imports so client components and
// middleware can use it.
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANG: Lang = "en";
// The visitor's pick from the 🌐 menu (app/LanguageMenu.tsx).
export const LANG_COOKIE = "fyby_lang";

export function parseLang(value: unknown): Lang | null {
  return LANGUAGES.some((l) => l.code === value) ? (value as Lang) : null;
}

// First language in the browser's Accept-Language header that Fyby offers,
// e.g. "es-MX,es;q=0.9,en;q=0.8" -> "es". Used until someone picks one.
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { base: tag.split("-")[0].toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { base } of wanted) {
    const lang = parseLang(base);
    if (lang) return lang;
  }
  return DEFAULT_LANG;
}

// The locale passed to toLocaleDateString etc.
export function dateLocale(lang: Lang): string {
  return lang === "es" ? "es-US" : "en-US";
}
