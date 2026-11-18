"use client";

import { useLanguage } from "@/i18n/provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
          locale === "en"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLocale("ur")}
        aria-pressed={locale === "ur"}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
          locale === "ur"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        اردو
      </button>
    </div>
  );
}
