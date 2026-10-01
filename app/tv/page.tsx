import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import FybyTV from "../FybyTV";
import { fetchFybyTvVideos } from "@/lib/fybyTvServer";

// getfyby.com/tv: Fyby TV on its own page (linked from the 📺 TV menu item).
export const metadata: Metadata = {
  title: "Fyby TV",
  description: "Music video premieres, Fyby news, and how-tos.",
};

export const dynamic = "force-dynamic";

export default async function TvPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const videos = await fetchFybyTvVideos();

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-10">
      <FybyTV videos={videos} isLoggedIn={Boolean(user)} />
    </main>
  );
}
