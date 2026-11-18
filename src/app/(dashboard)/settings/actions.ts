"use server";

import { revalidatePath } from "next/cache";
import { requireSchoolAdminAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { themeModes, type ThemeMode } from "@/lib/validations/staff";

export async function updateSharedTheme(
  themeMode: ThemeMode,
): Promise<{ error?: string; success?: string }> {
  await requireSchoolAdminAccess();

  if (!themeModes.includes(themeMode)) {
    return { error: "themeInvalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_settings")
    .update({ theme_mode: themeMode, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    console.error("Unable to update the shared school theme.", error.message);
    return { error: "themeUpdateFailed" };
  }

  revalidatePath("/", "layout");
  return { success: "themeUpdated" };
}
