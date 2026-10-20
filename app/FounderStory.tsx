import { getT } from "@/lib/i18n/server";

// Shown only to logged-out visitors (see app/page.tsx), placed after "How
// it works" and before the trust footer per the Phase 5 landing-page brief.
// Static, hardcoded copy — this doesn't change per artist, so there's no
// database read behind it, just the founder's own story in his own words.
// The id lets other pages (e.g. app/login/page.tsx's founder-quote nod)
// deep-link straight to this section with /#why-i-built-this.
export default function FounderStory() {
  const t = getT();
  return (
    <section id="why-i-built-this" className="mb-16 border-t border-paper/15 pt-12 scroll-mt-8">
      <h2 className="font-display text-2xl mb-6">{t("founder.heading")}</h2>
      <div className="max-w-2xl font-body text-paper/80 leading-relaxed flex flex-col gap-4">
        <p>{t("founder.p1")}</p>
        <p>{t("founder.p2")}</p>
        <p>{t("founder.p3")}</p>
        <p>{t("founder.p4")}</p>
        <p className="font-mono text-sm text-gold mt-2">{t("founder.signoff")}</p>
      </div>
    </section>
  );
}
