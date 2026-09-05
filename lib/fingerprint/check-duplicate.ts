import type { SupabaseClient } from "@supabase/supabase-js";

// 95%+ bit-similarity between two fingerprints' overlapping frames counts as
// a duplicate. See generateFingerprint.ts for how the fingerprint is built
// and the documented limitation (no time-shift alignment — this catches "the
// same file re-uploaded," not a trimmed/remixed re-upload).
const SIMILARITY_THRESHOLD = 0.95;

// Below this, two fingerprints that happen to line up bit-for-bit early on
// aren't a meaningful comparison — e.g. a 10-second clip trivially "matching"
// the first 10 seconds of an unrelated 4-minute song. Require a reasonable
// chunk of overlapping frames before trusting the score.
const MIN_COMPARABLE_FRAMES = 20;

export type DuplicateMatch = {
  trackId: string;
  similarity: number;
};

// Hamming similarity between two fingerprints (each a comma-separated list
// of base-36-encoded 16-bit words), compared frame-by-frame over their
// shared length.
export function compareFingerprints(a: string, b: string): { similarity: number; comparedFrames: number } {
  const wordsA = a.split(",").filter(Boolean).map((w) => parseInt(w, 36));
  const wordsB = b.split(",").filter(Boolean).map((w) => parseInt(w, 36));
  const comparedFrames = Math.min(wordsA.length, wordsB.length);
  if (comparedFrames === 0) return { similarity: 0, comparedFrames: 0 };

  let totalBits = 0;
  let matchingBits = 0;
  for (let i = 0; i < comparedFrames; i++) {
    const diff = wordsA[i] ^ wordsB[i];
    for (let bit = 0; bit < 16; bit++) {
      totalBits++;
      if (!((diff >> bit) & 1)) matchingBits++;
    }
  }

  return { similarity: matchingBits / totalBits, comparedFrames };
}

// Fetches every existing fingerprinted track and returns the closest match,
// if any clears both the similarity threshold and the minimum-overlap floor.
// Pass a service-role client — audio_fingerprint isn't sensitive, but this
// runs from a server action before the new track has an artist_id row
// context of its own, so there's no RLS scoping to lean on here anyway.
export async function findDuplicateTrack(
  supabase: SupabaseClient,
  newFingerprint: string,
  excludeTrackId?: string
): Promise<DuplicateMatch | null> {
  let query = supabase.from("tracks").select("id, audio_fingerprint").not("audio_fingerprint", "is", null);
  if (excludeTrackId) query = query.neq("id", excludeTrackId);

  const { data: candidates, error } = await query;
  if (error || !candidates) return null;

  let best: DuplicateMatch | null = null;
  for (const candidate of candidates) {
    if (!candidate.audio_fingerprint) continue;
    const { similarity, comparedFrames } = compareFingerprints(newFingerprint, candidate.audio_fingerprint);
    if (comparedFrames < MIN_COMPARABLE_FRAMES) continue;
    if (similarity >= SIMILARITY_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { trackId: candidate.id, similarity };
    }
  }

  return best;
}
