import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { startLicenseCheckout } from "@/app/actions/licensing";
import { COVERS_GENRE } from "@/lib/genres";
import { isPreorder } from "@/lib/preorder";
import { isUuid } from "@/lib/uuid";
import {
  LICENSE_TIERS,
  MAX_LICENSEE_NAME_LENGTH,
  MAX_PROJECT_LENGTH,
  offeredTiers,
} from "@/lib/licensing";

// Where a creator buys the right to use a song: pick a license type, say who
// it's for and what it's for, agree to the terms, pay. See lib/licensing.ts.
export default async function LicenseTrackPage({ params }: { params: { trackId: string } }) {
  if (!isUuid(params.trackId)) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: track } = await supabase
    .from("tracks")
    .select(
      "id, title, cover_url, preview_url, genre, frozen, release_at, license_enabled, license_beat_cents, license_standard_cents, license_commercial_cents, artists ( id, is_active, profiles ( display_name ) )"
    )
    .eq("id", params.trackId)
    .maybeSingle();

  const artist = (track as any)?.artists;
  if (!track || !artist || artist.is_active === false || track.frozen) notFound();

  const tiers =
    track.genre === COVERS_GENRE || isPreorder((track as any).release_at) ? [] : offeredTiers(track as any);
  const artistName = artist.profiles?.display_name ?? "Unknown artist";

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link href={`/artists/${artist.id}`} className="font-mono text-xs text-paper/60 hover:text-gold">
        &larr; {artistName}
      </Link>

      <div className="flex items-center gap-4 mt-6 mb-8">
        <div className="w-20 h-20 rounded bg-paper/10 overflow-hidden flex-shrink-0">
          {track.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <p className="font-mono text-xs text-gold uppercase tracking-wide">License this song</p>
          <h1 className="font-display text-3xl">{track.title}</h1>
          <p className="text-paper/60 text-sm">by {artistName}</p>
        </div>
      </div>

      {track.preview_url && <audio controls src={track.preview_url} className="w-full h-10 mb-8" preload="none" />}

      {tiers.length === 0 ? (
        <p className="font-mono text-sm text-paper/60">This song isn&apos;t available to license right now.</p>
      ) : (
        <form action={startLicenseCheckout} className="flex flex-col gap-6">
          <input type="hidden" name="trackId" value={track.id} />

          <fieldset className="flex flex-col gap-3">
            <legend className="font-mono text-xs text-paper/60 mb-2">Choose a license</legend>
            {tiers.map(({ tier, priceCents }, i) => (
              <label
                key={tier}
                className="flex items-start gap-3 border border-paper/15 rounded-lg px-4 py-3 bg-paper/5 cursor-pointer has-[:checked]:border-gold/60 has-[:checked]:bg-gold/5"
              >
                <input type="radio" name="tier" value={tier} defaultChecked={i === 0} className="mt-1 accent-gold" />
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-lg">{LICENSE_TIERS[tier].label}</span>
                    <span className="font-mono text-forest">${(priceCents / 100).toFixed(2)}</span>
                  </span>
                  <span className="block text-sm text-paper/60 mt-1">{LICENSE_TIERS[tier].summary}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1" htmlFor="licenseeName">
              Licensed to (your name or company, as it should appear on the license)
            </label>
            <input
              id="licenseeName"
              name="licenseeName"
              required
              maxLength={MAX_LICENSEE_NAME_LENGTH}
              className="w-full bg-ink border border-paper/20 rounded px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1" htmlFor="project">
              What will you use it in? (optional — e.g. &quot;My YouTube channel&quot;, &quot;Short film: Night Shift&quot;)
            </label>
            <textarea
              id="project"
              name="project"
              rows={2}
              maxLength={MAX_PROJECT_LENGTH}
              className="w-full bg-ink border border-paper/20 rounded px-3 py-2 text-paper"
            />
          </div>

          <label className="flex items-start gap-2 font-mono text-xs text-paper/70">
            <input type="checkbox" name="agree" required className="mt-0.5" />
            <span>
              I agree to the{" "}
              <a href="/licenses/terms" target="_blank" className="text-gold underline">
                Fyby license terms
              </a>{" "}
              for the license I picked. Licenses are non-exclusive and can&apos;t be transferred or resold.
            </span>
          </label>

          <button
            type="submit"
            className="self-start font-mono text-sm px-5 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
          >
            {user ? "Continue to payment" : "Log in to license"}
          </button>

          <p className="font-mono text-xs text-paper/50">
            After payment you&apos;ll get a license certificate and the full-quality file in your library.
          </p>
        </form>
      )}
    </main>
  );
}
