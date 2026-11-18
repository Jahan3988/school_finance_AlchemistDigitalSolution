import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./server";

export const appRoles = [
  "super_admin",
  "admin",
  "accountant",
  "teacher",
  "receptionist",
] as const;

export type AppRole = (typeof appRoles)[number];

export const dashboardRoles: readonly AppRole[] = ["super_admin", "admin", "accountant"];

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function touchAppSession(supabase: ServerSupabaseClient) {
  const { data, error } = await supabase.rpc("touch_app_session");

  if (error) {
    console.error("Unable to validate the current application session.", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "PGRST202") {
      throw new Error(
        "Supabase cannot resolve public.touch_app_session(). Apply the application-session migration if the function is missing, or reload the PostgREST schema cache if it already exists.",
      );
    }

    throw new Error("Unable to validate the current session.");
  }

  return data === true;
}

export async function requireDashboardAccess() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    redirect("/login?error=auth-required");
  }

  if (!(await touchAppSession(supabase))) {
    redirect("/login?error=session-expired");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", data.claims.sub)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to verify the current administrator profile.", profileError.message);
    throw new Error("Unable to verify administrator access.");
  }

  if (!profile || !appRoles.includes(profile.role as AppRole)) {
    redirect("/unauthorized");
  }

  if (!profile.is_active) {
    redirect("/unauthorized");
  }

  if (!dashboardRoles.includes(profile.role as AppRole)) {
    redirect("/unauthorized");
  }

  return profile;
}

export async function requireSchoolAdminAccess() {
  const profile = await requireDashboardAccess();

  if (profile.role !== "super_admin" && profile.role !== "admin") {
    redirect("/unauthorized");
  }

  return profile;
}

export async function requireStudentManagementAccess() {
  return requireSchoolAdminAccess();
}
