import { connection } from "next/server";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { themeModes, type ThemeMode } from "@/lib/validations/staff";
import { SettingsContent, SettingsContentUnavailable } from "./settings-content";

export default async function SettingsPage() {
  await connection();
  const profile = await requireDashboardAccess();
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("school_settings")
    .select("theme_mode")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Unable to load shared school settings.", error.message);
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <SettingsContentUnavailable />
      </section>
    );
  }

  const themeMode = themeModes.includes(settings.theme_mode as ThemeMode)
    ? settings.theme_mode as ThemeMode
    : "system";
  return (
    <SettingsContent
      themeMode={themeMode}
      canManageSettings={profile.role === "admin" || profile.role === "super_admin"}
    />
  );
}
