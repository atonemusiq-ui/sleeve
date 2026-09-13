// Flat one-time fee to apply for the "Verified Human+AI" badge (see
// app/actions/verification.ts's startVerificationCheckout and the review
// queue at app/admin/verifications/page.tsx). Priced the same as the
// cheapest video tier (lib/videoTiers.ts) — a low-friction paid add-on, not
// a subscription, and it's a review fee (Fyby's time reading the note and
// deciding), not pay-to-win: the badge is only granted on approval, and a
// rejected application keeps its fee (see startVerificationCheckout's
// comment on why refunding-on-reject isn't handled automatically).
export const VERIFICATION_FEE_CENTS = 999;

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export function verificationBadgeLabel(status: string | null | undefined): string | null {
  return status === "approved" ? "Verified Human+AI" : null;
}
