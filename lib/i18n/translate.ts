import { DEFAULT_LANG, type Lang } from "./config";
import en from "./messages/en";
import es from "./messages/es";

const MESSAGES: Record<Lang, unknown> = { en, es };

export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

function lookup(messages: unknown, key: string): string | undefined {
  let node: any = messages;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

// t("store.buySong") -> the string in this language, falling back to
// English, then to the key itself so a missing one is easy to spot.
// {name}-style placeholders are filled from vars.
export function makeT(lang: Lang): T {
  return (key, vars) => {
    const text = lookup(MESSAGES[lang], key) ?? lookup(MESSAGES[DEFAULT_LANG], key) ?? key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  };
}
