import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, supabaseCookieOptions } from "./config";
import { getSessionCookieOptions } from "./session-cookies";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, getSessionCookieOptions(options));
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith(
              "Cookies can only be modified in a Server Action or Route Handler.",
            )
          ) {
            return;
          }

          throw error;
        }
      },
    },
  });
}
