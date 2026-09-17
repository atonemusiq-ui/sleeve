// Whether a string is a well-formed UUID.
//
// Used to sanity-check ids that arrive from a URL or a form before they reach
// a `uuid` column. Postgres rejects a malformed uuid with a 22P02 error, which
// inside a Stripe webhook means a 500 and an event Stripe retries until it
// gives up — so a junk `?ref=` value in a shared link could otherwise stop a
// paying fan's subscription from ever being recorded.
//
// Shape only. A well-formed uuid that matches no row still fails the foreign
// key, so callers that care must also check the row exists (or handle the
// failure), which is why the subscriptions webhook retries without the
// referrer rather than trusting this alone.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
