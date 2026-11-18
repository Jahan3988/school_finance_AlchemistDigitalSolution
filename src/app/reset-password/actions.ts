"use server";

import { touchAppSession } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";

export async function updatePassword(input: ResetPasswordInput) {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid new password." };
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claims?.claims?.sub !== "string") {
    return { error: "This password reset link is invalid or has expired. Request a new one." };
  }

  try {
    if (!(await touchAppSession(supabase))) {
      return { error: "This password reset session has expired. Request a new reset link." };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (updateError) {
      console.error("Unable to update the account password.", updateError.message);
      return { error: "Unable to update your password. Please try again." };
    }

    const { error: revokeError } = await supabase.rpc("revoke_app_session");
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });

    if (revokeError || signOutError) {
      console.error(
        "Password updated, but the reset session could not be fully cleared.",
        revokeError?.message ?? signOutError?.message,
      );
      return {
        error: "Your password was updated. Please close this page and sign in again.",
      };
    }
  } catch (error) {
    console.error("Password update request failed.", error);
    return { error: "Unable to update your password. Please try again." };
  }

  return { success: true };
}
