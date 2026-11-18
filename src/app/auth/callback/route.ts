import { NextResponse, type NextRequest } from "next/server";
import { appRoles, dashboardRoles, type AppRole } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}

function loginRedirect(request: NextRequest, error = "oauth") {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return noStoreRedirect(url);
}

async function clearSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { error: revokeError } = await supabase.rpc("revoke_app_session");
    if (revokeError) {
      console.error("Unable to revoke an unverified OAuth session.", revokeError.message);
    }
  } catch (error) {
    console.error("Unable to revoke an unverified OAuth session.", error);
  }

  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      console.error("Unable to clear an unverified OAuth session.", signOutError.message);
    }
  } catch (error) {
    console.error("Unable to clear an unverified OAuth session.", error);
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return loginRedirect(request);

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Unable to complete the Supabase OAuth callback.", exchangeError.message);
    return loginRedirect(request);
  }

  const { data: active, error: sessionError } = await supabase.rpc("touch_app_session");
  if (sessionError) {
    console.error("Unable to establish the OAuth application session.", sessionError.message);
    await clearSession(supabase);
    return loginRedirect(request);
  }

  if (!active) {
    await clearSession(supabase);
    return loginRedirect(request, "session-expired");
  }

  if (request.nextUrl.searchParams.get("next") === "/reset-password") {
    return noStoreRedirect(new URL("/reset-password", request.url));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .maybeSingle();

  if (profileError) {
    console.error("Unable to verify the OAuth user's role.", profileError.message);
    await clearSession(supabase);
    return loginRedirect(request);
  }

  if (!profile || !appRoles.includes(profile.role as AppRole)) {
    await clearSession(supabase);
    return loginRedirect(request);
  }

  return noStoreRedirect(
    new URL(dashboardRoles.includes(profile.role as AppRole) ? "/" : "/unauthorized", request.url),
  );
}
