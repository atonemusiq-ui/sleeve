import { NextResponse } from "next/server";
import { isRadioEnabled } from "@/lib/radio";
import { fetchRadioEligibleTracks, homeStationFor, stationsFor } from "@/lib/radioCatalog";

// Always computed fresh: a track an artist just opted in (or out) should
// show up (or disappear) on the next page load, not after a cache expires.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isRadioEnabled()) {
    return NextResponse.json({ stations: [], premieres: [] });
  }
  try {
    const tracks = await fetchRadioEligibleTracks();
    const stations = stationsFor(tracks);
    // Songs with an active Radio Premiere, for the homepage's "Premiering
    // now" row. Soonest-ending last, so the newest premieres lead.
    const premieres = tracks
      .filter((t) => t.premiereEndsAt)
      .sort((a, b) => (b.premiereEndsAt! > a.premiereEndsAt! ? 1 : -1))
      .slice(0, 8)
      .map((t) => ({
        trackId: t.id,
        title: t.title,
        coverUrl: t.cover_url,
        artistName: t.artists?.profiles?.display_name ?? "Unknown artist",
        stationSlug: homeStationFor(t, stations)?.slug ?? null,
      }));
    return NextResponse.json({ stations, premieres });
  } catch {
    return NextResponse.json({ error: "Couldn't load radio stations." }, { status: 500 });
  }
}
