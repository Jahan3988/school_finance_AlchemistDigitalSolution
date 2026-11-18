import type { CookieMethodsBrowser, CookieOptions } from "@supabase/ssr";
import { supabaseCookieOptions } from "./config";

export function getSessionCookieOptions(options: CookieOptions): CookieOptions {
  if (options.maxAge === 0) return options;

  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

function serializeBrowserCookie(
  name: string,
  value: string,
  options: CookieOptions,
) {
  const cookieOptions = getSessionCookieOptions(options);
  const parts = [`${name}=${value}`];

  if (cookieOptions.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(cookieOptions.maxAge)}`);
  }
  if (cookieOptions.domain) parts.push(`Domain=${cookieOptions.domain}`);
  if (cookieOptions.path) parts.push(`Path=${cookieOptions.path}`);
  if (cookieOptions.expires) {
    parts.push(`Expires=${cookieOptions.expires.toUTCString()}`);
  }
  if (cookieOptions.httpOnly) parts.push("HttpOnly");
  if (cookieOptions.secure) parts.push("Secure");
  if (typeof cookieOptions.sameSite === "string") {
    parts.push(`SameSite=${cookieOptions.sameSite}`);
  } else if (cookieOptions.sameSite) {
    parts.push("SameSite=Strict");
  }

  return parts.join("; ");
}

function readBrowserCookies() {
  return document.cookie
    .split(";")
    .map((cookie) => {
      const separator = cookie.indexOf("=");
      if (separator < 0) return null;

      return {
        name: cookie.slice(0, separator).trim(),
        value: cookie.slice(separator + 1).trim(),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } => cookie !== null);
}

export const supabaseBrowserCookies: CookieMethodsBrowser = {
  getAll() {
    if (typeof document === "undefined") return [];

    const cookies = readBrowserCookies();
    cookies.forEach(({ name, value }) => {
      if (isSupabaseAuthCookie(name)) {
        document.cookie = serializeBrowserCookie(name, value, supabaseCookieOptions);
      }
    });

    return cookies;
  },
  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value, options }) => {
      document.cookie = serializeBrowserCookie(name, value, options);
    });
  },
};
