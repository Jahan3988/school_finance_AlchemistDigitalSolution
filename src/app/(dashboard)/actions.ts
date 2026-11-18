"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  const { error: revokeError } = await supabase.rpc("revoke_app_session");

  if (revokeError) {
    console.error("Unable to revoke the current administrator session.", revokeError.message);
    throw new Error("Unable to sign out securely. Please try again.");
  }

  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error("Unable to end the current administrator session.", error.message);
    throw new Error("Unable to sign out. Please try again.");
  }

  redirect("/login?message=signed-out");
}
