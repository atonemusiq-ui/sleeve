"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";

// The 🌐 menu (app/LanguageMenu.tsx). Remembered for a year on this device.
export async function setLanguage(value: string): Promise<void> {
  const lang = parseLang(value);
  if (!lang) return;
  cookies().set(LANG_COOKIE, lang, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}
