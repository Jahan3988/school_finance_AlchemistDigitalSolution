"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  CircleHelp,
  FileChartColumnIncreasing,
  FileText,
  LayoutDashboard,
  Menu,
  School,
  Settings,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutForm } from "@/components/logout-form";
import { SchoolFinanceMark } from "@/components/school-finance-mark";
import { useTranslation } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import type { ThemeMode } from "@/lib/validations/staff";

const toastContext = createContext<((message: string) => void) | null>(null);

export function useDashboardToast() {
  const showToast = useContext(toastContext);
  if (!showToast) {
    throw new Error("useDashboardToast must be used inside DashboardShell.");
  }
  return showToast;
}

const navigationGroups = [
  {
    labelKey: "workspace",
    items: [{ labelKey: "dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    labelKey: "school",
    items: [
      { labelKey: "students", icon: Users, href: "/students" },
      { labelKey: "classesAndSections", icon: School, href: "/classes" },
      { labelKey: "feeVouchers", icon: FileText, href: "/fee-vouchers" },
    ],
  },
  {
    labelKey: "finance",
    items: [
      { labelKey: "feeCollection", icon: WalletCards, href: "/payments" },
      { labelKey: "reports", icon: FileChartColumnIncreasing, href: "/reports" },
    ],
  },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function SidebarContent({
  profileName,
  roleLabel,
  onNavigate,
}: {
  profileName: string;
  roleLabel: string;
  onNavigate: () => void;
}) {
  const showToast = useDashboardToast();
  const pathname = usePathname();
  const { t } = useTranslation();
  const canManageStudents = roleLabel === "admin" || roleLabel === "super admin";

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-2 py-1"
      >
        <SchoolFinanceMark className="size-10 bg-indigo-600 shadow-sm shadow-indigo-200" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold tracking-tight text-slate-950">
            School Finance
          </span>
          <span className="block text-xs text-slate-500">{t("schoolManagement")}</span>
        </span>
      </Link>

      <div className="mt-9 flex-1 space-y-7 overflow-y-auto">
        {navigationGroups.map((group) => (
          <div key={group.labelKey}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t(group.labelKey as keyof typeof import("@/i18n/locales").dictionaries.en)}
            </p>
            <nav aria-label={t(group.labelKey as keyof typeof import("@/i18n/locales").dictionaries.en)} className="space-y-1">
              {group.items.map(({ labelKey, icon: Icon, href }) => {
                const label = t(labelKey as keyof typeof import("@/i18n/locales").dictionaries.en);
                return href &&
                  ((labelKey !== "students" && labelKey !== "classesAndSections") ||
                    canManageStudents) ? (
                    <Link
                      key={labelKey}
                      href={href}
                      onClick={onNavigate}
                      aria-current={
                        href === "/"
                          ? pathname === "/"
                            ? "page"
                            : undefined
                          : pathname.startsWith(href)
                            ? "page"
                            : undefined
                      }
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                        href === "/"
                          ? pathname === "/"
                            ? "bg-indigo-50 font-semibold text-indigo-700"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          : pathname.startsWith(href)
                            ? "bg-indigo-50 font-semibold text-indigo-700"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <Icon aria-hidden="true" size={18} />
                      <span className="flex-1">{label}</span>
                      {((href === "/" && pathname === "/") ||
                        (href !== "/" && pathname.startsWith(href))) && (
                        <span className="size-1.5 rounded-full bg-indigo-600" />
                      )}
                    </Link>
                  ) : (
                    <button
                      key={labelKey}
                      type="button"
                      onClick={() => {
                        showToast(`${label} ${t("upcomingFeature")}`);
                        onNavigate();
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      <Icon
                        aria-hidden="true"
                        size={18}
                        className="text-slate-400 transition group-hover:text-slate-600"
                      />
                      <span className="flex-1">{label}</span>
                      <ChevronRight
                        aria-hidden="true"
                        size={14}
                        className="text-slate-300 opacity-0 transition group-hover:opacity-100"
                      />
                    </button>
                  );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <Settings aria-hidden="true" size={18} className="text-slate-400" />
          {t("settings")}
        </Link>
        <Link
          href="/help-support"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <CircleHelp aria-hidden="true" size={18} className="text-slate-400" />
          {t("helpSupport")}
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
          {initials(profileName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{profileName}</p>
          <p className="truncate text-xs capitalize text-slate-500">{roleLabel}</p>
        </div>
        <LogoutForm className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" />
      </div>
    </div>
  );
}

export function DashboardShell({
  profileName,
  roleLabel,
  themeMode,
  children,
}: {
  profileName: string;
  roleLabel: string;
  themeMode: ThemeMode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeThemeMode, setActiveThemeMode] = useState(themeMode);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const root = document.documentElement;
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark =
        activeThemeMode === "dark" ||
        (activeThemeMode === "system" && systemPreference.matches);
      root.classList.toggle("dark", dark);
      root.dataset.themeMode = activeThemeMode;
    };

    applyTheme();
    if (activeThemeMode !== "system") return;
    systemPreference.addEventListener("change", applyTheme);
    return () => systemPreference.removeEventListener("change", applyTheme);
  }, [activeThemeMode]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("shared-school-theme")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "school_settings",
          filter: "id=eq.1",
        },
        (payload) => {
          const nextMode = payload.new.theme_mode;
          if (nextMode === "light" || nextMode === "dark" || nextMode === "system") {
            setActiveThemeMode(nextMode);
            router.refresh();
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Unable to subscribe to shared school theme updates.", status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <toastContext.Provider value={showToast}>
      <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
        <aside className="dashboard-sidebar fixed inset-y-0 left-0 z-30 hidden w-[268px] border-r border-slate-200/80 bg-white px-5 py-6 lg:block">
          <SidebarContent
            profileName={profileName}
            roleLabel={roleLabel}
            onNavigate={() => {}}
          />
        </aside>

        {mobileMenuOpen ? (
          <div className="dashboard-mobile-navigation fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative flex h-full w-[min(84vw,300px)] flex-col bg-white px-5 py-6 shadow-2xl">
              <div className="mb-5 flex justify-end">
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <SidebarContent
                  profileName={profileName}
                  roleLabel={roleLabel}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </aside>
          </div>
        ) : null}

        <div className="dashboard-shell-frame">
          <header className="dashboard-topbar sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="flex h-[68px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-9">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label={t("openNavigation")}
                  aria-expanded={mobileMenuOpen}
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                >
                  <Menu aria-hidden="true" size={20} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-500">
                    School Finance
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {t("schoolAdministration")}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <LiveDateTime />
                <LanguageSwitcher />
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-800">{profileName}</p>
                  <p className="text-xs capitalize text-slate-500">{roleLabel}</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800 sm:hidden">
                  {initials(profileName)}
                </div>
              </div>
            </div>
          </header>

          <main className="dashboard-content mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
            {children}
          </main>
        </div>
      </div>

      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="dashboard-toast fixed bottom-5 right-5 z-[60] flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl shadow-slate-900/10"
        >
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-indigo-500" />
          <span className="flex-1">{toastMessage}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToastMessage(null)}
            className="-mr-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      ) : null}
    </toastContext.Provider>
  );
}

function LiveDateTime() {
  const { locale, t } = useTranslation();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const timer = setInterval(updateTime, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <time
      dateTime={now?.toISOString()}
      aria-label={t("dateTimeLocal")}
      className="max-w-28 truncate text-right text-[10px] font-medium leading-4 text-slate-500 sm:max-w-none sm:text-xs"
    >
      {now
        ? new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(now)
        : ""}
    </time>
  );
}
