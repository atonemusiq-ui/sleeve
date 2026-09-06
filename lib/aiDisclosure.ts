// Plain (non-"use server") module, same reason as lib/trackPricing.ts and
// lib/genres.ts: a "use server" file's exports must all be async server
// actions, so this shared list/validator lives here where
// app/actions/upload.ts, app/actions/tracks.ts, UploadForm.tsx, TrackList.tsx,
// and the storefront can all share one source of truth.
//
// Per the original Phase 5 spec, AI disclosure is a required 3-way choice
// per track, not a plain yes/no — "human" is the default (and the only value
// that shows no badge anywhere); the other two both count as "AI music" for
// the storefront's dedicated AI row.
export const AI_DISCLOSURE_LEVELS = [
  { value: "human", label: "No — fully human-made" },
  { value: "ai_assisted", label: "AI-Assisted" },
  { value: "ai_generated", label: "Fully AI-Generated" },
] as const;

export type AiDisclosureLevel = (typeof AI_DISCLOSURE_LEVELS)[number]["value"];

export function isAiDisclosureLevel(value: string | null | undefined): value is AiDisclosureLevel {
  if (!value) return false;
  return (AI_DISCLOSURE_LEVELS as readonly { value: string }[]).some((l) => l.value === value);
}

// null for "human" (no badge to show), otherwise the badge text.
export function aiDisclosureBadge(value: string | null | undefined): string | null {
  if (value === "ai_assisted") return "AI-Assisted";
  if (value === "ai_generated") return "Fully AI-Generated";
  return null;
}

export function isAiMusic(value: string | null | undefined): boolean {
  return value === "ai_assisted" || value === "ai_generated";
}

// Shown at upload next to the required rights checkbox — covers both plain
// ownership and, per Phase 5, compliance with the terms of any AI tools used.
export const RIGHTS_ATTESTATION_TEXT =
  "I own the rights to this recording and, if any AI tools were used to create it, this release complies with those tools' terms of service.";
