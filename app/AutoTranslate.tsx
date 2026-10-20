"use client";

import { useEffect } from "react";
import { useLang } from "./I18nProvider";

// Whole-site translation for the 🌐 menu.
//
// Most of Fyby's pages are written in English directly in their components.
// Rather than rewrite all of them, this swaps the text on screen for the
// visitor's language using a phrase book (lib/i18n/auto/<lang>.json) built
// from every piece of English text in the app (scripts/extract-ui-text.js).
// Song titles, artist names and anything else people type in aren't in the
// phrase book, so they're left exactly as written.
//
// It runs after React has hydrated the page, then keeps watching, so text
// that appears later (error messages, dialogs, new rows) is translated too.
// Add data-no-translate to an element to leave it (and everything in it)
// alone.

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "svg"]);

type PhraseBook = Record<string, string>;

const loaders: Record<string, () => Promise<{ default: PhraseBook }>> = {
  es: () => import("@/lib/i18n/auto/es.json") as Promise<{ default: PhraseBook }>,
};

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function skipped(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (node.hasAttribute("data-no-translate") || (node as HTMLElement).isContentEditable) return true;
  }
  return false;
}

export default function AutoTranslate() {
  const lang = useLang();

  useEffect(() => {
    const root = document.documentElement;
    const done = () => root.classList.remove("fyby-translating");
    const load = loaders[lang];
    if (!load) {
      done();
      return;
    }

    let observer: MutationObserver | null = null;
    let cancelled = false;
    // Translated text nodes, so we don't look them up again (and so React
    // re-rendering English into a node is noticed as a change).
    const translated = new WeakMap<Node, string>();

    load()
      .then(({ default: book }) => {
        if (cancelled) return;

        const translateText = (node: Text) => {
          const value = node.nodeValue ?? "";
          if (translated.get(node) === value) return;
          const key = clean(value);
          if (!key) return;
          const hit = book[key];
          if (!hit || hit === key) return;
          // Keep the spacing around the text so "by " + name still reads right.
          const lead = value.match(/^\s*/)?.[0] ?? "";
          const trail = value.match(/\s*$/)?.[0] ?? "";
          const next = lead + hit + trail;
          translated.set(node, next);
          node.nodeValue = next;
        };

        const translateAttributes = (el: Element) => {
          for (const attr of ATTRIBUTES) {
            const value = el.getAttribute(attr);
            if (!value) continue;
            const hit = book[clean(value)];
            if (hit && hit !== value) el.setAttribute(attr, hit);
          }
          // Buttons written as <input type="submit" value="...">.
          if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button") && el.value) {
            const hit = book[clean(el.value)];
            if (hit) el.value = hit;
          }
        };

        const walk = (start: Node) => {
          if (start.nodeType === Node.TEXT_NODE) {
            if (!skipped(start.parentElement)) translateText(start as Text);
            return;
          }
          if (!(start instanceof Element) || skipped(start)) return;
          translateAttributes(start);
          const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: (n) =>
              n instanceof Element && (SKIP_TAGS.has(n.tagName) || n.hasAttribute("data-no-translate"))
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT,
          });
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
            else translateAttributes(n as Element);
          }
        };

        walk(document.body);
        const title = book[clean(document.title)];
        if (title) document.title = title;
        done();

        observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === "characterData") walk(m.target);
            else if (m.type === "attributes" && m.target instanceof Element && !skipped(m.target)) translateAttributes(m.target);
            else m.addedNodes.forEach(walk);
          }
          const t = book[clean(document.title)];
          if (t) document.title = t;
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...ATTRIBUTES],
        });
      })
      .catch(done);

    return () => {
      cancelled = true;
      observer?.disconnect();
      done();
    };
  }, [lang]);

  return null;
}
