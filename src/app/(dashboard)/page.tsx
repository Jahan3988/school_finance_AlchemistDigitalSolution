import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  ReceiptText,
  Users,
} from "lucide-react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/dashboard-data";
import { DashboardActions, RetryDashboardButton } from "@/components/dashboard-actions";
import { MonthlyCollectionChart, PaymentStatusChart } from "@/components/dashboard-charts";
import {
  EmptyState,
  FeeMetrics,
  formatAmount,
  PanelHeader,
  StatusBadge,
} from "@/components/dashboard-widgets";
import { getLocaleFromValue, getTranslations } from "@/i18n/locales";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ST";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function Home() {
  await connection();

  const cookieStore = await cookies();
  const locale = getLocaleFromValue(cookieStore.get("locale")?.value);
  const t = getTranslations(locale);

  const supabase = await createClient();
  const result = await getDashboardData(supabase);

  if (result.data === null) {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <CircleDollarSign aria-hidden="true" size={22} />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          {t.dashboardUnavailable}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {result.error}
        </p>
        <RetryDashboardButton />
      </section>
    );
  }

  const { data } = result;
  const updatedTime = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(data.generatedAt));

  return (
    <div className="space-y-7 sm:space-y-8">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{t.workspace}</span>
            <ChevronRight aria-hidden="true" size={13} />
            <span className="text-indigo-700">{t.dashboard}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">
            {t.schoolOverview}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {t.dashboardDescription}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <CalendarDays aria-hidden="true" size={15} />
            {t.updated} {updatedTime}
          </p>
          <DashboardActions />
        </div>
      </section>

      <FeeMetrics
        totalStudents={data.totalStudents}
        expectedFees={data.expectedFees}
        collectedThisMonth={data.collectedThisMonth}
        pendingAmount={data.pendingAmount}
        overdueAmount={data.overdueAmount}
        defaultersCount={data.defaultersCount}
        primaryCurrency={data.primaryCurrency}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,1fr)]">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
          <PanelHeader
            title={t.monthlyFeeCollection}
            description={`Recorded payments over the last six months · ${data.primaryCurrency}`}
          />
          <MonthlyCollectionChart
            data={data.monthlyCollection}
            currency={data.primaryCurrency}
          />
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
          <PanelHeader
            title={t.paymentStatus}
            description={t.feeVoucherDistribution}
          />
          <div className="mt-3">
            <PaymentStatusChart data={data.paymentStatuses} />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
          <PanelHeader
            title={t.recentPayments}
            description={t.latestTransactions}
            action={
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
                {t.latestSix}
              </span>
            }
          />
          {data.recentPayments.length === 0 ? (
            <EmptyState
              title={t.noPaymentsRecorded}
              description={t.noPaymentsRecordedDescription}
            />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.recentPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center gap-3 py-3.5 first:pt-1"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                    {initials(payment.studentName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {payment.studentName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      Receipt {payment.receiptNumber} · Voucher {payment.voucherNumber}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatAmount(payment.amount, payment.currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
          <PanelHeader
            title={t.recentFeeVouchers}
            description="Recently issued student fee vouchers"
            action={
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
                {t.latestSix}
              </span>
            }
          />
          {data.recentVouchers.length === 0 ? (
            <EmptyState
              title={t.noFeeVouchersYet}
              description={t.noFeeVouchersYetDescription}
            />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.recentVouchers.map((voucher) => (
                <li
                  key={voucher.id}
                  className="flex items-center gap-3 py-3.5 first:pt-1"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <ReceiptText aria-hidden="true" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {voucher.studentName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {voucher.voucherNumber} · {voucher.period}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatAmount(voucher.amount, voucher.currency)}
                    </p>
                    <div className="mt-1 flex justify-end">
                      <StatusBadge status={voucher.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <PanelHeader
          title={t.studentsRequiringFollowUp}
          description={t.overdueStudentsDescription}
          action={
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
              <ArrowUpRight aria-hidden="true" size={13} />
              {data.defaultersCount.toLocaleString()} {t.students}
            </span>
          }
        />
        {data.defaulters.length === 0 ? (
          <EmptyState
            title={t.noOverdueBalances}
            description={t.noOverdueBalancesDescription}
          />
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="pb-3 pl-1 pr-4">{t.student}</th>
                  <th className="pb-3 px-4">{t.classLabel}</th>
                  <th className="pb-3 px-4 text-center">{t.overdueVouchers}</th>
                  <th className="pb-3 pl-4 pr-1 text-right">{t.outstanding}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.defaulters.map((student) => (
                  <tr key={student.studentId} className="text-sm">
                    <td className="py-3.5 pl-1 pr-4">
                      <div className="font-semibold text-slate-800">{student.studentName}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {t.rollNo} {student.rollNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{student.className}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-slate-600">
                      {student.overdueVouchers}
                    </td>
                    <td className="py-3.5 pl-4 pr-1 text-right font-semibold tabular-nums text-rose-700">
                      {student.amounts
                        .map(({ amount, currency }) => formatAmount(amount, currency))
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <Users aria-hidden="true" size={14} />
          <span>{t.showingStudents}</span>
          <FileText aria-hidden="true" size={14} className="ml-auto hidden sm:block" />
        </div>
      </section>
    </div>
  );
}
