"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, MailPlus, Shield, Trash2, UserRound, UserRoundX, Users } from "lucide-react";
import {
  changeStaffAccess,
  changeStaffRole,
  deleteStaff,
  inviteStaff,
  sendStaffPasswordReset,
} from "./actions";
import { useTranslation } from "@/i18n/provider";
import { managedStaffRoles, type ManagedStaffRole } from "@/lib/validations/staff";

export type StaffMember = {
  id: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  email: string;
};

const roleLabelKeys: Record<ManagedStaffRole, string> = {
  admin: "staffRoleAdmin",
  accountant: "staffRoleAccountant",
  teacher: "staffRoleTeacher",
  receptionist: "staffRoleReceptionist",
};

export function StaffManager({
  staff,
  currentUserId,
  canSendInvitations,
  canManageAuth,
  emailLookupError,
}: {
  staff: StaffMember[];
  currentUserId: string;
  canSendInvitations: boolean;
  canManageAuth: boolean;
  emailLookupError: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedStaffRole>("teacher");

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.success) router.refresh();
    });
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await inviteStaff({ fullName, email, role });
      setFeedback(result);
      if (result.success) {
        setFullName("");
        setEmail("");
        router.refresh();
      }
    });
  }

  function roleName(value: string) {
    return value in roleLabelKeys
      ? t(roleLabelKeys[value as ManagedStaffRole] as keyof typeof import("@/i18n/locales").dictionaries.en)
      : t("staffRoleSuperAdmin");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 transition hover:text-indigo-900"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {t("settingsPageTitle")}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Users aria-hidden="true" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("staffManagement")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("staffPageDescription")}</p>
          </div>
        </div>
      </div>

      {!canManageAuth ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("staffServiceKeyNotice")}
          <code dir="ltr" className="mx-1 rounded bg-amber-100 px-1.5 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code>
        </div>
      ) : emailLookupError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {emailLookupError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <MailPlus aria-hidden="true" size={19} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("inviteStaff")}</h2>
            <p className="text-sm text-slate-500">{t("inviteStaffDescription")}</p>
          </div>
        </div>

        <form onSubmit={submitInvite} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            {t("fullName")}
            <input
              required
              maxLength={160}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t("emailAddress")}
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t("staffRole")}
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as ManagedStaffRole)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {managedStaffRoles.map((option) => (
                <option key={option} value={option}>{roleName(option)}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending || !canSendInvitations}
              className="h-10 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("sendInvitation")}
            </button>
          </div>
        </form>
      </section>

      {feedback ? (
        <p
          role={feedback.error ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            feedback.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {t((feedback.error ?? feedback.success) as keyof typeof import("@/i18n/locales").dictionaries.en)}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("staffAccounts")}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{t("staffAccountsDescription")}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {staff.length}
          </span>
        </div>

        {staff.length ? (
          <div className="divide-y divide-slate-100">
            {staff.map((member) => {
              const isProtected = member.role === "super_admin" || member.id === currentUserId;
              return (
                <article key={member.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      {member.role === "super_admin" ? <Shield aria-hidden="true" size={18} /> : <UserRound aria-hidden="true" size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {member.fullName}
                        {member.id === currentUserId ? ` · ${t("you")}` : ""}
                      </p>
                      <p className="truncate text-xs text-slate-500">{member.email || t("emailUnavailable")}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isProtected ? (
                      <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                        {roleName(member.role)}
                      </span>
                    ) : (
                      <select
                        aria-label={`${t("staffRole")} — ${member.fullName}`}
                        value={member.role}
                        disabled={pending}
                        onChange={(event) => {
                          const nextRole = event.target.value as ManagedStaffRole;
                          run(() => changeStaffRole(member.id, nextRole));
                        }}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                      >
                        {managedStaffRoles.map((option) => (
                          <option key={option} value={option}>{roleName(option)}</option>
                        ))}
                      </select>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {member.isActive ? t("active") : t("inactive")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isProtected ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <Shield aria-hidden="true" size={14} />
                        {t("accountProtected")}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => changeStaffAccess(member.id, !member.isActive))}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <UserRoundX aria-hidden="true" size={14} />
                          {member.isActive ? t("deactivate") : t("activate")}
                        </button>
                        <button
                          type="button"
                          disabled={pending || !canManageAuth}
                          onClick={() => {
                            if (window.confirm(t("confirmPasswordReset"))) {
                              run(() => sendStaffPasswordReset(member.id));
                            }
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          title={t("sendPasswordReset")}
                        >
                          <KeyRound aria-hidden="true" size={14} />
                          {t("resetPassword")}
                        </button>
                        <button
                          type="button"
                          disabled={pending || !canManageAuth}
                          onClick={() => {
                            if (window.confirm(t("confirmStaffDelete").replace("{name}", member.fullName))) {
                              run(() => deleteStaff(member.id));
                            }
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 aria-hidden="true" size={14} />
                          {t("delete")}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">{t("noStaffAccounts")}</p>
        )}
      </section>
    </div>
  );
}
