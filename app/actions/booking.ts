"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export type BookingActionResult = { error?: string; success?: boolean };
export type BookingStatus = "new" | "contacted" | "booked" | "declined";
export type InquiryType = "booking" | "collaboration" | "both";

const MAX_MESSAGE_LENGTH = 2000;
const INQUIRY_TYPES: InquiryType[] = ["booking", "collaboration", "both"];

const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  booking: "booking",
  collaboration: "collaboration",
  both: "booking/collaboration",
};

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
  // Which kind of inquiry this is (BookingForm.tsx's two checkboxes) —
  // defaults to "booking" for any older/direct caller that doesn't send one.
  const inquiryTypeRaw = (formData.get("inquiryType") as string) || "booking";
  const inquiryType: InquiryType = INQUIRY_TYPES.includes(inquiryTypeRaw as InquiryType)
    ? (inquiryTypeRaw as InquiryType)
    : "booking";

  if (!artistId) return { error: "Missing artist." };
  if (!fanName) return { error: "Please enter your name." };
  if (!fanEmail || !fanEmail.includes("@")) return { error: "Please enter a valid email." };
  if (!message) return { error: "Please add a short message about what you have in mind." };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  const supabase = createClient();

  // user_id (not just id) so a successful insert below can notify the
  // artist without a second round trip.
  const { data: artist } = await supabase.from("artists").select("id, user_id").eq("id", artistId).maybeSingle();
  if (!artist) return { error: "Could not find that artist." };

  const { error } = await supabase.from("booking_requests").insert({
    artist_id: artistId,
    fan_name: fanName,
    fan_email: fanEmail,
    fan_phone: fanPhone,
    event_date: eventDate,
    event_location: eventLocation,
    message,
    inquiry_type: inquiryType,
  });

  if (error) return { error: error.message };

  // Best-effort — a fan's booking request is what matters here, not this.
  // Notifications has no insert policy at all (see supabase/schema.sql) —
  // deliberately, so no client role can write one for an arbitrary user —
  // so this one write uses the service-role client rather than the
  // anonymous fan-facing one above, same as the Stripe webhook does.
  await createNotification(createServiceRoleClient(), {
    userId: artist.user_id,
    type: "booking",
    title: `New ${INQUIRY_TYPE_LABEL[inquiryType]} request from ${fanName}`,
    body: eventDate ? `For ${eventDate}` : undefined,
    link: "/dashboard",
  });

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
