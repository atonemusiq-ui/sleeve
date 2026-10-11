// "Get it on Vinyl": a link-out from a track to a pressing the artist has
// set up with an on-demand vinyl service (elasticStage or similar). Fyby
// doesn't sell or ship the record -- the fan buys it on the pressing
// service's own page. An in-app vinyl checkout can come later.

export const MAX_VINYL_URL_LENGTH = 500;

// Services we name in the dashboard hint. Any https link is accepted, so an
// artist using a different presser isn't blocked.
export const SUGGESTED_VINYL_SERVICES = ["elasticStage"];

// Returns the cleaned link, null for "remove it", or an error message.
export function parseVinylUrl(raw: string | null | undefined): { url: string | null } | { error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { url: null };
  if (value.length > MAX_VINYL_URL_LENGTH) return { error: "That link is too long." };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { error: "Paste the full link to your vinyl page, starting with https://" };
  }
  if (parsed.protocol !== "https:") {
    return { error: "The vinyl link has to start with https://" };
  }
  return { url: parsed.toString() };
}
