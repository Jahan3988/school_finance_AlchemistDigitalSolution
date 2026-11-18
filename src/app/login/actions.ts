"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appRoles, dashboardRoles, touchAppSession, type AppRole } from "@/lib/supabase/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

const signInError = "Unable to sign in. Check your credentials or contact support.";

async function clearUnverifiedSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { error: revokeError } = await supabase.rpc("revoke_app_session");
    if (revokeError) {
      console.error("Unable to revoke an unverified sign-in session.", revokeError.message);
    }
  } catch (error) {
    console.error("Unable to revoke an unverified sign-in session.", error);
  }

  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      console.error("Unable to clear an unverified sign-in session.", signOutError.message);
    }
  } catch (error) {
    console.error("Unable to clear an unverified sign-in session.", error);
  }
}

export async function login(input: LoginInput) {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  let supabaseClient: Awaited<ReturnType<typeof createClient>> | undefined;
  let role: AppRole | null = null;

  try {
    const supabase = await createClient();
    supabaseClient = supabase;
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error || !data.user) {
      return { error: signInError };
    }

    if (!(await touchAppSession(supabase))) {
      await clearUnverifiedSession(supabase);
      return { error: "Your session could not be established. Please try again." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to verify administrator role during sign-in.", profileError.message);
      await clearUnverifiedSession(supabase);
      return { error: "Administrator access could not be verified. Please try again." };
    }

    if (!profile || !appRoles.includes(profile.role as AppRole)) {
      await clearUnverifiedSession(supabase);
      return { error: signInError };
    }

    role = profile.role as AppRole;
  } catch (error) {
    console.error("Administrator sign-in request failed.", error);
    if (supabaseClient) {
      try {
        await clearUnverifiedSession(supabaseClient);
      } catch (cleanupError) {
        console.error("Unable to clear a failed sign-in session.", cleanupError);
      }
    }
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }

  redirect(role && dashboardRoles.includes(role) ? "/" : "/unauthorized");
}
