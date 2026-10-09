import { createClient } from "@/lib/supabase/server";
import { pickAd, recordAdEvent, type AdPlacement } from "@/lib/ads";
import { featureOn } from "@/lib/phaseServer";

// A sponsored card from the Fyby Engine (lib/ads.ts). Renders nothing when
// no campaign fits this viewer and page. Each render counts one view; the
// click goes through /api/ads/click so it's counted before the visitor leaves.
export default async function SponsoredCard({
  placement,
  artistId = null,
  pageGenres = [],
  className = "",
}: {
  placement: AdPlacement;
  artistId?: string | null;
  pageGenres?: string[];
  className?: string;
}) {
  // The advertiser program ships in Phase 6 (lib/phases.ts).
  if (!featureOn("ads")) return null;

  let ad = null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    ad = await pickAd({ userId: user?.id ?? null, pageGenres });
    if (ad) await recordAdEvent(ad.id, "impression", placement, artistId);
  } catch (err: any) {
    console.error("Sponsored card failed:", err?.message);
    return null;
  }
  if (!ad) return null;

  const href = `/api/ads/click/${ad.id}?p=${placement}${artistId ? `&a=${artistId}` : ""}`;

  return (
    <aside aria-label="Sponsored" className={`rounded-2xl border border-paper/15 bg-ink/60 p-4 flex gap-4 items-center ${className}`}>
      {ad.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.image_url} alt="" className="h-20 w-20 rounded-xl object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-paper/50">
          Sponsored · {ad.brand_name}
        </p>
        <p className="font-semibold leading-snug mt-0.5">{ad.headline}</p>
        {ad.body && <p className="text-paper/70 text-sm mt-1">{ad.body}</p>}
        <details className="mt-1">
          <summary className="font-mono text-[10px] text-paper/45 cursor-pointer hover:text-paper/70">Why this ad?</summary>
          <p className="font-mono text-[10px] text-paper/55 mt-1">
            {ad.reason}. Advertisers never get your personal details.{" "}
            <a href="/interests" className="underline">
              Change your ad settings
            </a>
            .
          </p>
        </details>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener sponsored"
        className="shrink-0 font-mono text-xs px-4 py-2.5 rounded-full bg-flame text-ink font-medium hover:bg-gold"
      >
        Learn more
      </a>
    </aside>
  );
}
