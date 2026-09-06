"use client";

import { useState } from "react";
import { submitBookingRequest } from "@/app/actions/booking";

export default function BookingForm({ artistId }: { artistId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    formData.set("artistId", artistId);

    const result = await submitBookingRequest(formData);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="border border-forest/40 rounded-lg p-6 bg-forest/10">
        <p className="font-mono text-sm text-forest">
          Thanks — your booking request has been sent. The artist will follow up at the email you
          provided.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="border border-paper/15 rounded-lg p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl">Book this artist</h2>
        <p className="font-mono text-xs text-paper/60 mt-1">
          Send a booking inquiry straight to the artist — they'll reach out at the email you give
          below.
        </p>
      </div>

      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Your name</label>
          <input
            name="fanName"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Your email</label>
          <input
            name="fanEmail"
            type="email"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Phone (optional)</label>
          <input
            name="fanPhone"
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Event date (optional)</label>
          <input
            name="eventDate"
            type="date"
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Event location (optional)
        </label>
        <input
          name="eventLocation"
          placeholder="City, venue..."
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Tell them about the event
        </label>
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Type of event, expected audience, budget..."
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="self-start bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Sending..." : "Send booking request"}
      </button>
    </form>
  );
}
