"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, supabaseCookieOptions } from "./config";
import { supabaseBrowserCookies } from "./session-cookies";

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: supabaseBrowserCookies,
  });
}
