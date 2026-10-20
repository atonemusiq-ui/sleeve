"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n/config";
import { makeT, type T } from "@/lib/i18n/translate";

// Hands the request's language (lib/i18n/server.ts getLang, read once in
// app/layout.tsx) to client components, which call useT() for their text.
const LangContext = createContext<Lang>(DEFAULT_LANG);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): T {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}
