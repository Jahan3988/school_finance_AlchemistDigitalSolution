"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { themeModes, type ThemeMode } from "@/lib/validations/staff";
import { updateSharedTheme } from "./actions";

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} satisfies Record<ThemeMode, typeof Sun>;

const themeKeys = {
  light: "themeLight",
  dark: "themeDark",
  system: "themeSystem",
} as const;

export function SettingsForm({
  themeMode,
  canManageSettings,
}: {
  themeMode: ThemeMode;
  canManageSettings: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedTheme, setSelectedTheme] = useState(themeMode);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function chooseTheme(mode: ThemeMode) {
    if (!canManageSettings || pending || mode === selectedTheme) return;
    setSelectedTheme(mode);
    setFeedback(null);
    startTransition(async () => {
      const result = await updateSharedTheme(mode);
      setFeedback(result);
      if (result.error) {
        setSelectedTheme(themeMode);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("sharedAppearance")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("sharedThemeDescription")}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {themeModes.map((mode) => {
          const Icon = themeIcons[mode];
          return (
            <button
              key={mode}
              type="button"
              disabled={!canManageSettings || pending}
              aria-pressed={selectedTheme === mode}
              onClick={() => chooseTheme(mode)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                selectedTheme === mode
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <Icon aria-hidden="true" size={19} />
              <span className="text-sm font-semibold">{t(themeKeys[mode])}</span>
            </button>
          );
        })}
      </div>

      {!canManageSettings ? (
        <p className="mt-3 text-xs text-slate-500">{t("adminOnlyTheme")}</p>
      ) : null}
      {feedback ? (
        <p
          role={feedback.error ? "alert" : "status"}
          className={`mt-4 text-sm ${feedback.error ? "text-red-700" : "text-emerald-700"}`}
        >
          {t((feedback.error ?? feedback.success) as keyof typeof import("@/i18n/locales").dictionaries.en)}
        </p>
      ) : null}
    </section>
  );
}
