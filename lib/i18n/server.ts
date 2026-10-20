import { cookies, headers } from "next/headers";
import { LANG_COOKIE, langFromAcceptLanguage, parseLang, type Lang } from "./config";
import { makeT, type T } from "./translate";

// The language for this request: the visitor's 🌐 pick if they made one,
// otherwise their browser's language when Fyby offers it, otherwise English.
export function getLang(): Lang {
  return parseLang(cookies().get(LANG_COOKIE)?.value) ?? langFromAcceptLanguage(headers().get("accept-language"));
}

export function getT(): T {
  return makeT(getLang());
}
