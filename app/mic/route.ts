import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_COOKIE, SOURCE_MAX_AGE, formatSignupSource } from "@/lib/signupSource";

// getfyby.com/mic -- the "click the mic, give Fyby a try" link from the
// marketing videos. Sends artists straight to signup (the role picker
// defaults to Artist and shows the Founding Artist countdown).
//
// Each platform/video gets its own tag so sign-ups can be traced back:
//   getfyby.com/mic?src=tt&v=04        getfyby.com/mic?src=ig&v=12
// The tag is kept in a cookie and saved on the account at signup
// (user_metadata.signup_source, see app/actions/auth.ts), and also passed on
// as utm_source / utm_content for analytics.
const TAG = /^[a-z0-9_-]{1,32}$/i;

export function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");
  const video = request.nextUrl.searchParams.get("v");

  const target = new URL("/signup", request.nextUrl.origin);
  target.searchParams.set("utm_campaign", "mic");
  target.searchParams.set("utm_medium", "social");
  target.searchParams.set("utm_source", src && TAG.test(src) ? src.toLowerCase() : "video");
  if (video && TAG.test(video)) target.searchParams.set("utm_content", video.toLowerCase());

  const response = NextResponse.redirect(target, 307);
  const source = formatSignupSource(src ?? "video", video);
  if (source) {
    response.cookies.set(SOURCE_COOKIE, source, {
      maxAge: SOURCE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return response;
}
