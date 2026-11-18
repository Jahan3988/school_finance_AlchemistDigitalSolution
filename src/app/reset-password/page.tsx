import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { touchAppSession } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { SchoolFinanceMark } from "@/components/school-finance-mark";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
          <div className="h-72 w-full max-w-md animate-pulse rounded-2xl bg-slate-200" />
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

async function ResetPasswordContent() {
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    redirect("/login?error=auth-required");
  }

  if (!(await touchAppSession(supabase))) {
    redirect("/login?error=session-expired");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <SchoolFinanceMark className="size-10 bg-blue-700" />
          <span className="text-sm font-bold text-slate-900">School Finance</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-slate-500">
          Use at least 12 characters. You&apos;ll need to sign in again after updating it.
        </p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
