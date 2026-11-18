"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSchoolAdminAccess } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/config";
import { managedStaffRoles, type ManagedStaffRole } from "@/lib/validations/staff";

type StaffActionResult = { error?: string; success?: string };

const staffIdSchema = z.uuid();
const inviteSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.email(),
  role: z.enum(managedStaffRoles),
});

async function getManagedTarget(userId: string) {
  const profile = await requireSchoolAdminAccess();
  const parsedId = staffIdSchema.safeParse(userId);
  if (!parsedId.success) return { error: "staffSelectValidAccount" } as const;
  if (parsedId.data === profile.id) {
    return { error: "staffCannotManageSelf" } as const;
  }

  const supabase = await createClient();
  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) {
    console.error("Unable to verify the selected staff profile.", error.message);
    return { error: "staffProfileVerifyFailed" } as const;
  }
  if (!target) return { error: "staffProfileMissing" } as const;
  if (target.role === "super_admin") {
    return { error: "superAdminProtected" } as const;
  }

  return { profile, supabase, target } as const;
}

function requireServiceRoleKey() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: "staffServiceKeyRequired",
    } as const;
  }
  return null;
}

export async function inviteStaff(input: {
  fullName: string;
  email: string;
  role: ManagedStaffRole;
}): Promise<StaffActionResult> {
  await requireSchoolAdminAccess();

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "staffInvalidForm" };
  }
  const serviceKeyError = requireServiceRoleKey();
  if (serviceKeyError) return serviceKeyError;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { full_name: parsed.data.fullName },
      redirectTo: `${getSiteUrl()}/auth/callback?next=%2F`,
    },
  );

  if (error || !data.user) {
    console.error("Unable to invite the staff member.", error?.message ?? "No user returned.");
    return { error: "staffInvitationFailed" };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName, role: parsed.data.role })
    .eq("id", data.user.id);

  if (profileError) {
    console.error("The staff invitation was sent, but its profile was not updated.", profileError.message);
    return {
      error: "staffInvitationPartial",
    };
  }

  revalidatePath("/staff");
  return { success: "staffInvitationSent" };
}

export async function changeStaffRole(
  userId: string,
  role: ManagedStaffRole,
): Promise<StaffActionResult> {
  const targetResult = await getManagedTarget(userId);
  if ("error" in targetResult) return targetResult;
  if (!managedStaffRoles.includes(role)) return { error: "staffInvalidRole" };

  const { error } = await targetResult.supabase.rpc("admin_set_staff_role", {
    p_user_id: targetResult.target.id,
    p_role: role,
  });

  if (error) {
    console.error("Unable to update the staff role.", error.message);
    return { error: "staffRoleUpdateFailed" };
  }

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: "staffRoleUpdated" };
}

export async function changeStaffAccess(
  userId: string,
  isActive: boolean,
): Promise<StaffActionResult> {
  const targetResult = await getManagedTarget(userId);
  if ("error" in targetResult) return targetResult;

  const { error } = await targetResult.supabase.rpc("admin_set_staff_active", {
    p_user_id: targetResult.target.id,
    p_is_active: isActive,
  });

  if (error) {
    console.error("Unable to update staff access.", error.message);
    return { error: "staffAccessUpdateFailed" };
  }

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: isActive ? "staffAccessRestored" : "staffAccessDeactivated" };
}

export async function sendStaffPasswordReset(userId: string): Promise<StaffActionResult> {
  const targetResult = await getManagedTarget(userId);
  if ("error" in targetResult) return targetResult;
  const serviceKeyError = requireServiceRoleKey();
  if (serviceKeyError) return serviceKeyError;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(targetResult.target.id);
  if (error || !data.user.email) {
    console.error("Unable to retrieve the staff email for a password reset.", error?.message ?? "Email missing.");
    return { error: "staffEmailMissing" };
  }

  const { error: resetError } = await targetResult.supabase.auth.resetPasswordForEmail(
    data.user.email,
    { redirectTo: `${getSiteUrl()}/reset-password` },
  );

  if (resetError) {
    console.error("Unable to send the staff password reset email.", resetError.message);
    return { error: "staffResetEmailFailed" };
  }

  return { success: "staffResetEmailSent" };
}

export async function deleteStaff(userId: string): Promise<StaffActionResult> {
  const targetResult = await getManagedTarget(userId);
  if ("error" in targetResult) return targetResult;
  if (targetResult.target.role === "admin" && targetResult.target.is_active) {
    const { count, error: countError } = await targetResult.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countError) {
      console.error("Unable to verify remaining administrator accounts.", countError.message);
      return { error: "staffProfileVerifyFailed" };
    }
    if ((count ?? 0) <= 1) return { error: "staffLastAdminProtected" };
  }
  const serviceKeyError = requireServiceRoleKey();
  if (serviceKeyError) return serviceKeyError;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetResult.target.id);
  if (error) {
    console.error("Unable to delete the staff account.", error.message);
    return { error: "staffDeleteFailed" };
  }

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: "staffDeleted" };
}
