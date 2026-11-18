import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { LogoutForm } from "@/components/logout-form";
import { SchoolFinanceMark } from "@/components/school-finance-mark";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <Link href="/login" className="mx-auto mb-8 inline-flex items-center gap-3">
          <SchoolFinanceMark className="size-10 bg-blue-700" />
          <span className="text-sm font-bold text-slate-900">School Finance</span>
        </Link>
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert aria-hidden="true" size={23} />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight">This dashboard is not available</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your account does not have permission to access this area. Contact your school
          administrator if you believe this is a mistake.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <LogoutForm className="h-11 w-full rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800" />
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
