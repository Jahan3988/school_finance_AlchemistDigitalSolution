"use client";

import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SchoolFinanceMark } from "@/components/school-finance-mark";
import { useTranslation } from "@/i18n/provider";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative flex min-h-64 flex-col justify-between overflow-hidden bg-slate-950 px-7 py-8 text-white sm:px-12 sm:py-10 lg:min-h-screen lg:px-16 lg:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-36 -top-32 size-[520px] rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-16 size-[360px] rounded-full border border-white/10"
          />
          <div className="relative flex items-center gap-3">
            <SchoolFinanceMark className="size-11 bg-blue-500 shadow-lg shadow-blue-950/30" />
            <span>
              <span className="block text-base font-bold tracking-tight">School Finance</span>
            </span>
          </div>

          <div className="relative my-12 max-w-lg lg:my-0 lg:pb-12">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-100">
              <ShieldCheck aria-hidden="true" size={15} />
              {t("secureSchoolAccess")}
            </span>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t("schoolFinance")}, <span className="text-blue-300">{t("schoolOverview")}</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              {t("dashboardDescription")}
            </p>
          </div>

          <p className="relative text-xs text-slate-500">
            {t("accessDependsOnRole")}
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full max-w-[420px]">
            <div className="mb-8">
              <p className="text-sm font-semibold text-blue-700">{t("financePortal")}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">
                {t("signInToAccount")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {t("useProvisionedAccount")}
              </p>
            </div>

            <Suspense
              fallback={
                <div
                  className="h-64 animate-pulse rounded-xl bg-slate-100"
                  role="status"
                  aria-label="Loading sign-in form"
                />
              }
            >
              <LoginForm />
            </Suspense>

            <div className="mt-8 border-t border-slate-100 pt-5">
              <p className="text-center text-xs leading-5 text-slate-500">
                {t("publicRegistrationDisabled")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
