import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdCampaignForm from "./AdCampaignForm";

export const metadata: Metadata = { title: "Create an ad · Fyby" };
export const dynamic = "force-dynamic";

export default async function NewAdPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/advertise/new")}`);

  return (
    <main className="max-w-4xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-6">
      <div>
        <Link href="/advertise" className="font-mono text-xs text-paper/60 hover:text-gold">
          &larr; Advertise with Fyby
        </Link>
        <h1 className="font-display text-4xl mt-2">Create a sponsored card</h1>
        <p className="text-paper/70 mt-2">
          Fill in your card, pick who should see it, set a budget, and pay. Fyby reviews every ad before it runs.
        </p>
      </div>
      <AdCampaignForm userId={user.id} />
    </main>
  );
}
