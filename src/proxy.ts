import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, supabaseCookieOptions } from "@/lib/supabase/config";
import {
  getSessionCookieOptions,
  isSupabaseAuthCookie,
} from "@/lib/supabase/session-cookies";

const publicPaths = new Set([
  "/login",
  "/unauthorized",
  "/forgot-password",
  "/auth/callback",
  "/api/session/activity",
]);
const cacheHeaders = ["cache-control", "expires", "pragma"];

function copySessionState(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));

  for (const name of cacheHeaders) {
    const value = source.headers.get(name);
    if (value) {
      destination.headers.set(name, value);
    }
  }

  destination.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  destination.headers.set("Pragma", "no-cache");
  destination.headers.set("Expires", "0");

  return destination;
}

export async function proxy(request: NextRequest) {
  if (publicPaths.has(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, getSessionCookieOptions(options));
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", "auth-required");

    return copySessionState(response, NextResponse.redirect(loginUrl));
  }

  request.cookies.getAll().forEach(({ name, value }) => {
    if (value && isSupabaseAuthCookie(name)) {
      response.cookies.set(name, value, supabaseCookieOptions);
    }
  });

  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
