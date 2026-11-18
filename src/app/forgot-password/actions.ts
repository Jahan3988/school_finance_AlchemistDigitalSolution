"use server";

import { getSiteUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validations/auth";

const genericSuccess =
  "If an account exists for that email, a password reset link has been sent.";

export async function requestPasswordReset(input: string) {
  const parsedEmail = emailSchema.safeParse(input);
  if (!parsedEmail.success) {
    return { error: "Enter a valid email address." };
  }

  try {
    const supabase = await createClient();
    const redirectTo = `${getSiteUrl()}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, { redirectTo });

    if (error) {
      console.error("Unable to request a password reset.", error.message);
      return { error: "Password reset is temporarily unavailable. Please try again." };
    }

    return { message: genericSuccess };
  } catch (error) {
    console.error("Password reset request failed.", error);
    return { error: "Password reset is temporarily unavailable. Please try again." };
  }
}
