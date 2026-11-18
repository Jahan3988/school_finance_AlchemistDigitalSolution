import { connection } from "next/server";
import { cookies } from "next/headers";
import { StaffManager, type StaffMember } from "./staff-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdminAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocaleFromValue, getTranslations } from "@/i18n/locales";

export default async function StaffPage() {
  await connection();
  const cookieStore = await cookies();
  const translations = getTranslations(getLocaleFromValue(cookieStore.get("locale")?.value));
  const currentUser = await requireSchoolAdminAccess();
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .order("full_name");

  if (error) {
    console.error("Unable to load staff profiles.", error.message);
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h1 className="text-xl font-bold text-slate-900">{translations.staffLoadUnavailable}</h1>
        <p className="mt-2 text-sm text-slate-600">{translations.staffLoadMigrationNote}</p>
      </section>
    );
  }

  const serviceKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const emailById = new Map<string, string>();
  let emailLookupError = "";

  if (serviceKeyConfigured) {
    const admin = createAdminClient();
    for (let page = 1; ; page += 1) {
      const { data, error: usersError } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (usersError) {
        console.error("Unable to load staff email addresses.", usersError.message);
        emailLookupError = translations.staffEmailLookupFailed;
        break;
      }

      for (const user of data.users) {
        if (user.email) emailById.set(user.id, user.email);
      }
      if (data.users.length < 1000) break;
    }
  }

  const staff: StaffMember[] = (profiles ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    email: emailById.get(profile.id) ?? "",
  }));

  return (
    <StaffManager
      staff={staff}
      currentUserId={currentUser.id}
      canSendInvitations={serviceKeyConfigured}
      canManageAuth={serviceKeyConfigured}
      emailLookupError={emailLookupError}
    />
  );
}
