import { getT } from "@/lib/i18n/server";

// Shown only to logged-out visitors (see app/page.tsx).
export default function HowItWorks() {
  const t = getT();
  const STEPS = [1, 2, 3].map((n) => ({
    title: t(`how.step${n}Title`),
    body: t(`how.step${n}Body`),
  }));
  return (
    <section className="mb-16">
      <h2 className="font-display text-2xl mb-6">{t("how.heading")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STEPS.map((step) => (
          <div key={step.title} className="border border-paper/15 rounded-lg p-5 bg-paper/5">
            <h3 className="font-display text-lg text-gold mb-2">{step.title}</h3>
            <p className="text-paper/70 text-sm">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
