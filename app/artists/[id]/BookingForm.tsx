"use client";

import { useState } from "react";
import { submitBookingRequest } from "@/app/actions/booking";

export default function BookingForm({ artistId }: { artistId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Both start checked — most fans filling this out just want to reach the
  // artist and haven't necessarily decided yet whether it's a booking, a
  // collaboration, or could be either; unchecking one is an active choice
  // to narrow it, not the default.
  const [wantsBooking, setWantsBooking] = useState(true);
  const [wantsCollaboration, setWantsCollaboration] = useState(true);

  async function handleSubmit(formData: FormData) {
    if (!wantsBooking && !wantsCollaboration) {
      setError("Please select booking, collaboration, or both.");
      return;
    }

    setBusy(true);
    setError(null);
    formData.set("artistId", artistId);
    formData.set(
      "inquiryType",
      wantsBooking && wantsCollaboration ? "both" : wantsBooking ? "booking" : "collaboration"
    );

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
      <div className="border border-forest/40 rounded-lg p-4 bg-forest/10">
        <p className="font-mono text-sm text-forest">
          Thanks — your request has been sent. The artist will follow up at the email you
          provided.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-2">
          What&apos;s this about?
        </label>
        <div className="flex flex-wrap gap-4 font-mono text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={wantsBooking}
              onChange={(e) => setWantsBooking(e.target.checked)}
            />
            Booking a performance
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={wantsCollaboration}
              onChange={(e) => setWantsCollaboration(e.target.checked)}
            />
            Collaborating on music
          </label>
        </div>
      </div>

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
          <label className="block font-mono text-xs text-paper/60 mb-1">
            Event date (if a booking)
          </label>
          <input
            name="eventDate"
            type="date"
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Event location (if a booking)
        </label>
        <input
          name="eventLocation"
          placeholder="City, venue..."
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Tell them about the event, the collaboration idea, or both
        </label>
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Type of event, expected audience, budget — or what you have in mind for a collaboration..."
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="self-start bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Sending..." : "Send request"}
      </button>
    </form>
  );
}
