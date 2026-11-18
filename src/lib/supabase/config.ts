export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    throw new Error("Supabase authentication redirects require NEXT_PUBLIC_SITE_URL.");
  }

  const parsedUrl = new URL(siteUrl);
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a secure, credential-free site URL.");
  }

  return parsedUrl.origin;
}

export const supabaseCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
