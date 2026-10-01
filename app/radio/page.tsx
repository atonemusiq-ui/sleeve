import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import RadioHero from "../RadioHero";
import { radioPreviewTrack } from "@/lib/radioPreview";

// getfyby.com/radio: Fyby Radio on its own page (linked from the 📻 Radio
// menu item). Same banner as the homepage, so it shows the "Coming soon"
// preview until the radio is switched on, then the live stations.
export const metadata: Metadata = {
  title: "Fyby Radio",
  description: "The radio station where every song has a Buy button.",
};

export default async function RadioPage() {
  const supabase = createClient();
  const { data: tracks } = await supabase
    .from("tracks")
    .select("title, cover_url, price_cents, artists!inner ( is_active, profiles ( display_name ) )")
    .ilike("title", "%heat%check%")
    .eq("frozen", false)
    .eq("artists.is_active", true)
    .limit(1);

  const normalized = (tracks ?? []).map((t: any) => {
    const artist = Array.isArray(t.artists) ? t.artists[0] : t.artists;
    const profiles = artist ? (Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles) : null;
    return { ...t, artists: { profiles } };
  });

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-10">
      <RadioHero previewTrack={radioPreviewTrack(normalized)} />
    </main>
  );
}
