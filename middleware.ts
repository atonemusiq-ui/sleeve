import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_HEADER,
  PHASE_HEADER,
  PREVIEW_COOKIE,
  featureForPath,
  isAdminEmail,
  isFeatureOn,
  livePhase,
  parsePhase,
} from "@/lib/phases";

export async function middleware(request: NextRequest) {
  // Cookies Supabase wants to refresh are collected here and applied to
  // whichever response we end up returning below.
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          pendingCookies.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          pendingCookies.push({ name, value: "", options });
        },
      },
    }
  );

  // refreshes the session if expired, and syncs cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Which release phase this request sees (lib/phases.ts). The preview
  // cookie only counts for the admin account; everyone else gets the live
  // phase from FYBY_PHASE.
  const isAdmin = isAdminEmail(user?.email);
  const preview = isAdmin ? parsePhase(request.cookies.get(PREVIEW_COOKIE)?.value) : null;
  const phase = preview ?? livePhase();

  const finish = (response: NextResponse) => {
    for (const c of pendingCookies) response.cookies.set({ name: c.name, value: c.value, ...c.options });
    return response;
  };

  // A page from a phase that isn't out yet goes back to the storefront.
  const feature = featureForPath(request.nextUrl.pathname);
  if (feature && !isFeatureOn(feature, phase)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return finish(NextResponse.json({ error: "Not available yet." }, { status: 404 }));
    }
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return finish(NextResponse.redirect(home));
  }

  // Hand the phase to server components (lib/phaseServer.ts reads it).
  // Overwritten every request, so a client can't spoof it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PHASE_HEADER, String(phase));
  requestHeaders.set(ADMIN_HEADER, isAdmin ? "1" : "0");

  return finish(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
