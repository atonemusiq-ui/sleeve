// Where a sign-up came from: the platform and video tag on a
// getfyby.com/mic link (app/mic/route.ts), e.g. "tt:04". Kept in a cookie
// until they create an account, then saved on the account as
// user_metadata.signup_source.
export const SOURCE_COOKIE = "fyby_src";
export const SOURCE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const TAG = /^[a-z0-9_-]{1,32}$/;

export function formatSignupSource(src: string | null, video: string | null): string | null {
  const s = src?.toLowerCase() ?? "";
  if (!TAG.test(s)) return null;
  const v = video?.toLowerCase() ?? "";
  return TAG.test(v) ? `${s}:${v}` : s;
}

export function parseSignupSource(value: string | undefined | null): string | null {
  if (!value) return null;
  const [src, video] = value.split(":");
  return formatSignupSource(src ?? null, video ?? null);
}
