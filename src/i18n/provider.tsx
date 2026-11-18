"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  getDocumentDirection,
  getLocaleFromValue,
  getTranslations,
  type Locale,
} from "@/i18n/locales";

const LANGUAGE_STORAGE_KEY = "school-finance-language";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (value: Locale) => void;
  t: (key: keyof typeof import("@/i18n/locales").dictionaries.en) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LOCALE;
    }

    try {
      return getLocaleFromValue(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    } catch {
      return DEFAULT_LOCALE;
    }
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDocumentDirection(locale);
    document.documentElement.dataset.locale = locale;
    document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage failures so language switching remains resilient.
    }
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: keyof typeof import("@/i18n/locales").dictionaries.en) =>
      getTranslations(locale)[key] ?? getTranslations(DEFAULT_LOCALE)[key] ?? String(key);

    return {
      locale,
      setLocale: (nextLocale) => setLocaleState(getLocaleFromValue(nextLocale)),
      t,
    };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }
  return context;
}

export function useTranslation() {
  const { locale, t } = useLanguage();
  return { locale, t };
}
