import { NextResponse, type NextRequest } from "next/server";

// getfyby.com/mic -- the "click the mic, give Fyby a try" link from the
// marketing videos. Sends artists straight to signup (the role picker
// defaults to Artist and shows the Founding Artist countdown).
//
// Each platform/video gets its own tag so sign-ups can be traced back:
//   getfyby.com/mic?src=tiktok        getfyby.com/mic?src=ig&v=03
// src and v are passed on as utm_source / utm_content for analytics.
const TAG = /^[a-z0-9_-]{1,32}$/i;

export function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");
  const video = request.nextUrl.searchParams.get("v");

  const target = new URL("/signup", request.nextUrl.origin);
  target.searchParams.set("utm_campaign", "mic");
  target.searchParams.set("utm_medium", "social");
  target.searchParams.set("utm_source", src && TAG.test(src) ? src.toLowerCase() : "video");
  if (video && TAG.test(video)) target.searchParams.set("utm_content", video.toLowerCase());

  return NextResponse.redirect(target, 307);
}
