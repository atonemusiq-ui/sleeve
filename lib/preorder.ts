// Pre-orders: a track can be published with a future release date. Fans can
// buy it straight away (a pre-order), but the full song stays locked -- the
// protected stream/download route (app/api/stream/[trackId]) refuses it --
// until the release date arrives, at which point it simply unlocks in every
// buyer's library. Nothing has to run on release day; the check is "is
// release_at in the past yet?" every time.
//
// Release dates are whole days in Pacific time (Fyby's home time zone): a
// song "out October 10" unlocks at 12:00am Pacific on October 10.
const RELEASE_TZ = "America/Los_Angeles";

// Latest a pre-order can be set -- far enough out for a real album cycle,
// close enough that fans aren't paying for something a year and a half away.
export const MAX_PREORDER_DAYS = 365;

export function isPreorder(releaseAt: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(releaseAt) && new Date(releaseAt as string).getTime() > now.getTime();
}

// "+HH:MM"/"-HH:MM" offset of Pacific time on a given UTC instant.
function pacificOffset(at: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: RELEASE_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  // e.g. "GMT-07:00"; fall back to standard time if the runtime can't say.
  const match = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "-08:00";
}

// Turns a <input type="date"> value ("YYYY-MM-DD") into the ISO timestamp of
// midnight Pacific on that day, or an error message if it isn't a valid
// future date inside the pre-order window. An empty value means "release
// now" and returns null with no error.
export function releaseAtFromDateInput(
  value: string | null | undefined,
  now: Date = new Date()
): { releaseAt: string | null; error?: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { releaseAt: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { releaseAt: null, error: "That release date isn't a valid date." };
  }

  // Noon UTC on that day is always the same calendar day in Pacific time, so
  // it's a safe instant to read the day's offset (PST vs PDT) from.
  const probe = new Date(`${raw}T12:00:00Z`);
  if (isNaN(probe.getTime())) {
    return { releaseAt: null, error: "That release date isn't a valid date." };
  }
  const releaseAt = new Date(`${raw}T00:00:00${pacificOffset(probe)}`);

  if (releaseAt.getTime() <= now.getTime()) {
    return { releaseAt: null, error: "A pre-order release date has to be in the future. Leave it blank to release now." };
  }
  if (releaseAt.getTime() - now.getTime() > MAX_PREORDER_DAYS * 24 * 60 * 60 * 1000) {
    return { releaseAt: null, error: `Pre-orders can be set up to ${MAX_PREORDER_DAYS} days ahead.` };
  }

  return { releaseAt: releaseAt.toISOString() };
}

export function formatReleaseDate(releaseAt: string): string {
  return new Date(releaseAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: RELEASE_TZ,
  });
}
