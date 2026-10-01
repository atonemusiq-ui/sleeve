import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import { TV_CATEGORIES } from "@/lib/fybyTv";
import TvAdminForm from "./TvAdminForm";
import TvAdminRow from "./TvAdminRow";

// Same one-person allowlist as the other admin pages.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export const dynamic = "force-dynamic";

export default async function FybyTvAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) redirect("/");

  const { data: rows } = await createServiceRoleClient()
    .from("fyby_tv_videos")
    .select("id, category, title, video_url, published, sort_order, starts_at, ends_at, amount_cents, artists ( profiles ( display_name ) )")
    .order("category")
    .order("sort_order")
    .order("created_at", { ascending: false });

  const videos = (rows ?? []).map((r: any) => {
    const artist = Array.isArray(r.artists) ? r.artists[0] : r.artists;
    const profile = artist ? (Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles) : null;
    return {
      id: r.id as string,
      category: r.category as keyof typeof TV_CATEGORIES,
      title: r.title as string,
      videoUrl: r.video_url as string,
      published: r.published as boolean,
      sortOrder: r.sort_order as number,
      endsAt: r.ends_at as string | null,
      amountCents: r.amount_cents as number,
      artistName: (profile?.display_name as string | undefined) ?? null,
    };
  });

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl text-gold">Fyby TV</h1>
      <p className="font-mono text-xs text-paper/50 mt-2 mb-8 max-w-2xl">
        Add Fyby&apos;s own videos to the homepage player. Upload the video to YouTube (Unlisted works) or
        Vimeo, then paste the link here. Lower &quot;order&quot; numbers show first. Artist premieres appear
        here automatically after they pay.
      </p>

      <TvAdminForm />

      <div className="ticket-divider my-10" />

      {(["whats_new", "how_to", "premiere"] as const).map((cat) => {
        const list = videos.filter((v) => v.category === cat);
        return (
          <section key={cat} className="mb-10">
            <h2 className="font-display text-xl mb-3">
              {TV_CATEGORIES[cat].label} <span className="text-paper/40 text-sm">({list.length})</span>
            </h2>
            {list.length === 0 ? (
              <p className="font-mono text-xs text-paper/40">Nothing here yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((v) => (
                  <TvAdminRow key={v.id} video={v} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
