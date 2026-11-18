
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { SessionManager } from "@/components/session-manager";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { themeModes, type ThemeMode } from "@/lib/validations/staff";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-slate-50"
          aria-label="Loading dashboard"
        />
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({
  children,
}: {
  children: ReactNode;
}) {
  // Wait for an actual incoming request before dynamic rendering.
  await connection();

  const profile = await requireDashboardAccess();
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("school_settings")
    .select("theme_mode")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Unable to load the shared school theme.", error.message);
    throw new Error("Unable to load the shared school theme. Apply the school settings migration.");
  }

  const themeMode = themeModes.includes(settings.theme_mode as ThemeMode)
    ? settings.theme_mode as ThemeMode
    : "system";
  const roleLabel = profile.role.replaceAll("_", " ");

  return (
    <>
      <SessionManager />
      <DashboardShell
        key={themeMode}
        profileName={profile.full_name}
        roleLabel={roleLabel}
        themeMode={themeMode}
      >
        {children}
      </DashboardShell>
    </>
  );
}
