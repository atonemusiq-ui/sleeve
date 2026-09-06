const STEPS = [
  {
    title: "1. Upload your music",
    body: "Add your tracks, set a price, and publish — takes minutes, no label required.",
  },
  {
    title: "2. Fans buy directly",
    body: "Fans find your music and buy it outright, at the price you set — not a fraction of a cent per stream.",
  },
  {
    title: "3. Get paid fast",
    body: "You keep 80% of every sale, paid out to your bank account through Stripe in 24-48 hours.",
  },
];

// Shown only to logged-out visitors (see app/page.tsx).
export default function HowItWorks() {
  return (
    <section className="mb-16">
      <h2 className="font-display text-2xl mb-6">How it works</h2>
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
