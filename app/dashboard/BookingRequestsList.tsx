"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus, deleteBookingRequest, type BookingStatus } from "@/app/actions/booking";

export type BookingRequest = {
  id: string;
  fan_name: string;
  fan_email: string;
  fan_phone: string | null;
  event_date: string | null;
  event_location: string | null;
  message: string;
  status: BookingStatus;
  created_at: string;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Booked",
  declined: "Declined",
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  new: "text-gold border-gold/40",
  contacted: "text-paper/70 border-paper/30",
  booked: "text-forest border-forest/40",
  declined: "text-rust border-rust/40",
};

const ALL_STATUSES: BookingStatus[] = ["new", "contacted", "booked", "declined"];

export default function BookingRequestsList({ requests }: { requests: BookingRequest[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  if (requests.length === 0) {
    return <p className="text-paper/50 font-mono text-sm">No booking requests yet.</p>;
  }

  async function handleStatus(id: string, status: BookingStatus) {
    setBusyId(id);
    const formData = new FormData();
    formData.set("bookingId", id);
    formData.set("status", status);
    await updateBookingStatus(formData);
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this booking request? This can't be undone.")) return;
    setBusyId(id);
    const formData = new FormData();
    formData.set("bookingId", id);
    await deleteBookingRequest(formData);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <div
          key={r.id}
          className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-display text-lg">{r.fan_name}</span>
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded-full border ml-2 ${STATUS_COLOR[r.status]}`}
              >
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <span className="font-mono text-xs text-paper/40">
              {new Date(r.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="font-mono text-xs text-paper/60 flex flex-wrap gap-x-4 gap-y-1">
            <span>{r.fan_email}</span>
            {r.fan_phone && <span>{r.fan_phone}</span>}
            {r.event_date && <span>Event: {r.event_date}</span>}
            {r.event_location && <span>{r.event_location}</span>}
          </div>

          <p className="text-paper/80 text-sm whitespace-pre-wrap">{r.message}</p>

          <div className="flex gap-2 flex-wrap mt-1">
            {ALL_STATUSES.filter((s) => s !== r.status).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busyId === r.id}
                onClick={() => handleStatus(r.id, s)}
                className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10 disabled:opacity-50"
              >
                Mark {STATUS_LABEL[s]}
              </button>
            ))}
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => handleDelete(r.id)}
              className="font-mono text-xs px-2 py-1 rounded border border-rust/40 text-rust hover:bg-rust/10 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
