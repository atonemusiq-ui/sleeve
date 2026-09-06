"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type BookingActionResult = { error?: string; success?: boolean };
export type BookingStatus = "new" | "contacted" | "booked" | "declined";

const MAX_MESSAGE_LENGTH = 2000;

// Public — no login required. A fan submits this straight from an artist's
// page (app/artists/[id]/BookingForm.tsx); the insert policy in
// supabase/schema.sql ("anyone can submit a booking request") is what
// actually allows this to write with no session. Reading these back is a
// separate, artist-only policy — see getOwnedBookingOrError below.
export async function submitBookingRequest(formData: FormData): Promise<BookingActionResult> {
  const artistId = formData.get("artistId") as string;
  const fanName = (formData.get("fanName") as string)?.trim();
  const fanEmail = (formData.get("fanEmail") as string)?.trim();
  const fanPhone = (formData.get("fanPhone") as string)?.trim() || null;
  const eventDate = (formData.get("eventDate") as string) || null;
  const eventLocation = (formData.get("eventLocation") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim();

  if (!artistId) return { error: "Missing artist." };
  if (!fanName) return { error: "Please enter your name." };
  if (!fanEmail || !fanEmail.includes("@")) return { error: "Please enter a valid email." };
  if (!message) return { error: "Please add a short message about the event." };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  const supabase = createClient();

  const { data: artist } = await supabase.from("artists").select("id").eq("id", artistId).maybeSingle();
  if (!artist) return { error: "Could not find that artist." };

  const { error } = await supabase.from("booking_requests").insert({
    artist_id: artistId,
    fan_name: fanName,
    fan_email: fanEmail,
    fan_phone: fanPhone,
    event_date: eventDate,
    event_location: eventLocation,
    message,
  });

  if (error) return { error: error.message };

  return { success: true };
}

// Ownership check mirrors getOwnedTrackOrError in app/actions/contributors.ts
// — RLS ("artists manage their own booking requests") enforces this too, but
// checking here first gives a clean error instead of a raw RLS failure.
async function getOwnedBookingOrError(bookingId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in." } as const;

  const { data: booking } = await supabase
    .from("booking_requests")
    .select("artist_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking request not found." } as const;

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", booking.artist_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!artist) return { error: "That booking request doesn't belong to your account." } as const;
  return { supabase } as const;
}

export async function updateBookingStatus(formData: FormData): Promise<void> {
  const bookingId = formData.get("bookingId") as string;
  const status = formData.get("status") as BookingStatus;

  const owned = await getOwnedBookingOrError(bookingId);
  if ("error" in owned) return;
  const { supabase } = owned;

  await supabase.from("booking_requests").update({ status }).eq("id", bookingId);
  revalidatePath("/dashboard");
}

export async function deleteBookingRequest(formData: FormData): Promise<void> {
  const bookingId = formData.get("bookingId") as string;

  const owned = await getOwnedBookingOrError(bookingId);
  if ("error" in owned) return;
  const { supabase } = owned;

  await supabase.from("booking_requests").delete().eq("id", bookingId);
  revalidatePath("/dashboard");
}
