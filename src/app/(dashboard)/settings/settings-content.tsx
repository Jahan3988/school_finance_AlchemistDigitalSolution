"use client";

import Link from "next/link";
import { ArrowLeft, Globe2, Settings, Users } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/i18n/provider";
import type { ThemeMode } from "@/lib/validations/staff";
import { SettingsForm } from "./settings-form";

export function SettingsContentUnavailable() {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">{t("settingsUnavailable")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("settingsMigrationRequired")}</p>
    </>
  );
}

export function SettingsContent({
  themeMode,
  canManageSettings,
}: {
  themeMode: ThemeMode;
  canManageSettings: boolean;
}) {
  const { locale, t } = useTranslation();
  const labels = {
    school: locale === "ur" ? "اسکول" : "School",
    campus: locale === "ur" ? "کیمپس" : "Campus",
    admin: locale === "ur" ? "ایڈمن" : "Admin",
    status: locale === "ur" ? "حالت" : "Status",
    active: locale === "ur" ? "فعال" : "Active",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 transition hover:text-indigo-900"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {t("dashboard")}
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{t("settingsPageTitle")}</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Settings aria-hidden="true" size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("school")}</p>
              <h2 className="text-lg font-semibold text-slate-900">{t("schoolProfile")}</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.school}</p>
              <p className="mt-2 text-base font-semibold text-slate-900">School Finance</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.campus}</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{locale === "ur" ? "مین کیمپس" : "Main campus"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.admin}</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{locale === "ur" ? "پرنسپل آفس" : "Principal Office"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.status}</p>
              <p className="mt-2 text-base font-semibold text-emerald-700">{labels.active}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Globe2 aria-hidden="true" size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("languagePreference")}</p>
              <h2 className="text-lg font-semibold text-slate-900">{t("currentLanguage")}</h2>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-600">{t("currentLanguage")}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{locale === "ur" ? "اردو" : "English"}</p>
          </div>

          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </section>
      </div>

      <SettingsForm key={themeMode} themeMode={themeMode} canManageSettings={canManageSettings} />

      {canManageSettings ? (
        <Link
          href="/staff"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Users aria-hidden="true" size={20} />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">{t("manageStaff")}</span>
            <span className="mt-1 block text-sm text-slate-500">{t("staffAccountsDescription")}</span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
