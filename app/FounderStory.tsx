// Shown only to logged-out visitors (see app/page.tsx), placed after "How
// it works" and before the trust footer per the Phase 5 landing-page brief.
// Static, hardcoded copy — this doesn't change per artist, so there's no
// database read behind it, just the founder's own story in his own words.
export default function FounderStory() {
  return (
    <section className="mb-16 border-t border-paper/15 pt-12">
      <h2 className="font-display text-2xl mb-6">Why I Built This</h2>
      <div className="max-w-2xl font-body text-paper/80 leading-relaxed flex flex-col gap-4">
        <p>
          I grew up in Compton, and before I ever built an app, I built songs — writing and
          producing for artists like Diana Ross, Babyface, Toni Braxton, After 7, and Tevin
          Campbell. I know what it feels like to pour your life into a record and watch it move
          people. I also know what it feels like to watch the business side of music quietly take
          more than its share from the people who actually made it.
        </p>
        <p>
          Streaming changed the way the world listens to music — but it didn&apos;t change who
          gets paid fairly for it. An artist can rack up a thousand plays and still owe more in
          coffee money than they earned from the stream. That gap between the work and the reward
          is what Fyby exists to close.
        </p>
        <p>
          I built Fyby so independent artists can sell directly to the people who actually want to
          support them — no label taking a cut, no algorithm deciding who gets heard, no waiting
          months for pennies to trickle in. Just an artist, a fan, and a fair deal.
        </p>
        <p>
          This isn&apos;t a side project for me. It&apos;s built by someone who&apos;s lived on
          both sides of the music business — the studio and the deal — and wants something better
          for the next generation of artists coming up.
        </p>
        <p className="font-mono text-sm text-gold mt-2">— Anthony &quot;A-Tone&quot; Bryant, Founder</p>
      </div>
    </section>
  );
}
