"use client";

import Link from "next/link";
import { ArrowLeft, CircleHelp, Clock3, Headphones, Mail, Phone } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/i18n/provider";

export default function HelpSupportPage() {
  const { locale, t } = useTranslation();
  const labels = {
    email: locale === "ur" ? "ای میل" : "Email",
    phone: locale === "ur" ? "فون" : "Phone",
    hours: locale === "ur" ? "کلاک" : "Hours",
    support: locale === "ur" ? "معاونت" : "Support",
    quickHelp: locale === "ur" ? "فوری مدد چاہیے؟" : "Need quick help?",
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
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{t("helpSupportPageTitle")}</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Headphones aria-hidden="true" size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("helpSupport")}</p>
              <h2 className="text-lg font-semibold text-slate-900">{t("supportChannels")}</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Mail aria-hidden="true" size={18} className="mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.email}</p>
                <a
                  href={`mailto:${t("supportEmail")}`}
                  dir="ltr"
                  className="mt-1 block text-base font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  {t("supportEmail")}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Phone aria-hidden="true" size={18} className="mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.phone}</p>
                <a
                  href={`tel:${t("supportPhone")}`}
                  dir="ltr"
                  className="mt-1 block text-base font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  {t("supportPhone")}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Clock3 aria-hidden="true" size={18} className="mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.hours}</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{t("supportHours")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <CircleHelp aria-hidden="true" size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{labels.support}</p>
              <h2 className="text-lg font-semibold text-slate-900">{t("helpDesk")}</h2>
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            {locale === "ur"
              ? "اسکول رسائی، فیس ریکارڈ اور واؤچر کی تازہ کاری کے مسئلے کے لیے کام کے اوقات میں ایڈمن معاونت ڈیسک سے رابطہ کریں۔"
              : "For school access, fee record issues, and voucher updates, contact the admin support desk during working hours."}
          </p>

          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">{labels.quickHelp}</p>
            <p className="mt-1 text-sm text-slate-600">{t("contactAdministrator")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
