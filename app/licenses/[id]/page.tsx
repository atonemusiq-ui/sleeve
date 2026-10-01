import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isUuid } from "@/lib/uuid";
import { LICENSE_TIERS, isLicenseTier, licenseNumber } from "@/lib/licensing";
import PrintButton from "./PrintButton";

export const metadata = { title: "License certificate · Fyby" };

// The buyer's proof of license (and the artist's record of the sale). RLS on
// license_purchases (supabase/schema.sql) means only the buyer and the
// artist who sold it can load a row, so a guessed id shows nothing.
export default async function LicenseCertificatePage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/licenses/${params.id}`)}`);

  const { data: license } = await supabase
    .from("license_purchases")
    .select(
      "id, tier, licensee_name, project_description, amount_cents, status, created_at, track_id, tracks ( title ), artists ( id, profiles ( display_name ) )"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!license || !isLicenseTier(license.tier)) notFound();

  const tier = LICENSE_TIERS[license.tier];
  const trackTitle = (license as any).tracks?.title ?? "Untitled";
  const artistName = (license as any).artists?.profiles?.display_name ?? "Unknown artist";
  const issued = new Date(license.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const active = license.status === "complete";

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/library" className="font-mono text-xs text-paper/60 hover:text-gold">
          &larr; My Music
        </Link>
        <PrintButton />
      </div>

      <div className="border-2 border-gold/50 rounded-xl px-6 sm:px-10 py-10 bg-paper/5">
        <p className="font-mono text-xs text-gold uppercase tracking-widest text-center">Fyby License Certificate</p>
        <h1 className="font-display text-3xl text-center mt-3">{tier.label}</h1>
        <p className="font-mono text-xs text-paper/50 text-center mt-2">{licenseNumber(license.id)}</p>

        {!active && (
          <p className="font-mono text-sm text-rust text-center mt-4 border border-rust/40 rounded px-3 py-2">
            {license.status === "disputed"
              ? "This license is suspended while a payment dispute is open."
              : "This license is no longer valid — the payment was refunded."}
          </p>
        )}

        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="font-mono text-xs text-paper/50">Song</dt>
          <dd className="font-display text-lg">&ldquo;{trackTitle}&rdquo;</dd>
          <dt className="font-mono text-xs text-paper/50">Artist (licensor)</dt>
          <dd>{artistName}</dd>
          <dt className="font-mono text-xs text-paper/50">Licensed to</dt>
          <dd>{license.licensee_name}</dd>
          {license.project_description && (
            <>
              <dt className="font-mono text-xs text-paper/50">Project</dt>
              <dd>{license.project_description}</dd>
            </>
          )}
          <dt className="font-mono text-xs text-paper/50">Issued</dt>
          <dd>{issued}</dd>
          <dt className="font-mono text-xs text-paper/50">Fee paid</dt>
          <dd>${(license.amount_cents / 100).toFixed(2)}</dd>
          <dt className="font-mono text-xs text-paper/50">Rights granted</dt>
          <dd className="text-paper/80">
            {tier.summary} Non-exclusive, worldwide and permanent, subject to the{" "}
            <Link href="/licenses/terms" className="text-gold underline">
              Fyby license terms (v1)
            </Link>
            .
          </dd>
        </dl>

        <p className="font-mono text-[11px] text-paper/40 text-center mt-10">
          Keep this certificate as proof of license. Issued through Fyby (getfyby.com).
        </p>
      </div>

      {active && (
        <p className="font-mono text-xs text-paper/60 mt-6 print:hidden">
          Your full-quality file is in{" "}
          <Link href="/library" className="text-gold underline">
            My Music
          </Link>
          .
        </p>
      )}
    </main>
  );
}
