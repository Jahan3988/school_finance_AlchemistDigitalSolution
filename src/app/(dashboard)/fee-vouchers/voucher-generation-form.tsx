"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle, Sparkles } from "lucide-react";
import { useDashboardToast } from "@/components/dashboard-shell";
import type { VoucherGenerationState } from "@/lib/validations/fee-voucher";
import { generateMonthlyVouchers } from "./actions";

const initialState: VoucherGenerationState = {};

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: month,
    label: new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, index, 1)),
    ),
  };
});

export function VoucherGenerationForm({
  isAdministrator,
  currentMonth,
  currentYear,
  defaultDueDate,
}: {
  isAdministrator: boolean;
  currentMonth: number;
  currentYear: number;
  defaultDueDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    generateMonthlyVouchers,
    initialState,
  );
  const router = useRouter();
  const showToast = useDashboardToast();
  const yearOptions = Array.from(
    { length: currentYear + 2 - 2000 },
    (_, index) => 2000 + index,
  );
  const fieldClassName =
    "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50";

  useEffect(() => {
    if (state.success) {
      showToast(state.success);
      router.refresh();
    }
  }, [router, showToast, state]);

  if (!isAdministrator) {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm leading-6 text-indigo-900">
        Monthly voucher generation is available to school administrators.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.success}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">
          Billing month
          <select name="month" defaultValue={currentMonth} className={fieldClassName}>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Billing year
          <select name="year" defaultValue={currentYear} className={fieldClassName}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Payment due date
          <input
            type="date"
            name="due_date"
            required
            defaultValue={defaultDueDate}
            className={fieldClassName}
          />
        </label>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
          <CalendarDays aria-hidden="true" size={15} className="mt-0.5 shrink-0" />
          Creates one voucher per active student. Existing vouchers for the selected month are left unchanged.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" size={16} />
          )}
          {pending ? "Generating vouchers..." : "Generate monthly vouchers"}
        </button>
      </div>
    </form>
  );
}
