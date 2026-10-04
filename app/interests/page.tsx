import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InterestsForm from "./InterestsForm";

export const metadata: Metadata = { title: "What you're into · Fyby" };
export const dynamic = "force-dynamic";

// getfyby.com/interests: the member's own controls for the Fyby Engine.
export default async function InterestsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/interests")}`);

  const { data } = await supabase
    .from("user_interests")
    .select("genres, tags, personalized, birth_year")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-6">
      <div>
        <Link href="/discover" className="font-mono text-xs text-paper/60 hover:text-gold">
          &larr; Discover
        </Link>
        <h1 className="font-display text-4xl mt-2">What are you into?</h1>
        <p className="text-paper/70 mt-2">
          Your picks shape the For You feed on Discover and which sponsored cards you see. Fyby uses what you do
          and tell us here, never your race, religion, health or exact location, and never shares your details
          with advertisers.
        </p>
      </div>
      <InterestsForm
        initial={{
          genres: (data as any)?.genres ?? [],
          tags: (data as any)?.tags ?? [],
          personalized: (data as any)?.personalized ?? true,
          birthYear: (data as any)?.birth_year ?? null,
        }}
      />
    </main>
  );
}
