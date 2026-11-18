import { SchoolFinanceMark } from "@/components/school-finance-mark";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <SchoolFinanceMark className="size-10 bg-blue-700" />
          <span className="text-sm font-bold text-slate-900">School Finance</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-slate-500">
          Enter your account email and we&apos;ll send a secure password reset link.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
