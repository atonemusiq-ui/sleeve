import { stripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import Link from "next/link";

// One hour is plenty for a single sitting (stream + download), and keeps
// the signed URL from being usable long after the buyer's browser tab is
// gone. Revisiting this exact page (it's a bookmarkable URL — session_id is
// right there in the query string) mints a fresh one.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function ErrorState({ message }: { message: string }) {
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">Hmm.</h1>
      <p className="text-paper/70 mb-10">{message}</p>
      <Link
        href="/"
        className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        Back to Fyby
      </Link>
    </main>
  );
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    return (
      <ErrorState message="We couldn't find your checkout session — if you just paid, check the link Stripe emailed you." />
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return (
      <ErrorState message="We couldn't find that checkout session. It may have expired." />
    );
  }

  // This is the actual proof of purchase — nothing below runs (and no
  // signed URL gets minted) unless Stripe confirms this specific session
  // was paid.
  if (session.payment_status !== "paid") {
    return (
      <ErrorState message="This purchase hasn't gone through yet. If you completed payment, give it a moment and refresh." />
    );
  }

  const trackId = session.metadata?.track_id;
  if (!trackId) {
    return <ErrorState message="This checkout session isn't linked to a track." />;
  }

  const supabase = createServiceRoleClient();

  const { data: track } = await supabase
    .from("tracks")
    .select("id, title, audio_path, audio_url, cover_url, artists ( profiles ( display_name ) )")
    .eq("id", trackId)
    .single();

  if (!track) {
    return <ErrorState message="That track is no longer available." />;
  }

  const artistName = (track as any).artists?.profiles?.display_name ?? "Unknown artist";

  // Prefer the private, signed path (new uploads). Fall back to a legacy
  // public audio_url for any track uploaded before audio was made private —
  // still works, just wasn't gated to begin with.
  let downloadUrl: string | null = null;
  if (track.audio_path) {
    const { data: signed } = await supabase.storage
      .from("track-audio")
      .createSignedUrl(track.audio_path, SIGNED_URL_TTL_SECONDS, { download: true });
    downloadUrl = signed?.signedUrl ?? null;
  } else if (track.audio_url) {
    downloadUrl = track.audio_url;
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">Thank you!</h1>
      <p className="text-paper/70 mb-2">
        The artist gets paid directly — not a fraction of a cent, but a real share of what you
        just paid.
      </p>
      <p className="text-paper/70 mb-10">
        <span className="font-display text-xl text-paper">{track.title}</span>
        <br />
        by {artistName}
      </p>

      {downloadUrl ? (
        <div className="border border-paper/15 rounded-lg p-6 mb-10 flex flex-col items-center gap-4 bg-paper/5">
          <audio controls src={downloadUrl} className="w-full h-10" />
          <a
            href={downloadUrl}
            download
            className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
          >
            Download track
          </a>
          <p className="font-mono text-xs text-paper/50">
            This link expires in an hour — bookmark this page to get a fresh one anytime.
          </p>
        </div>
      ) : (
        <p className="font-mono text-sm text-rust mb-10">
          We couldn&apos;t find an audio file for this track. Contact the artist — your purchase
          is recorded.
        </p>
      )}

      <Link
        href="/"
        className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        Back to Fyby
      </Link>
    </main>
  );
}
