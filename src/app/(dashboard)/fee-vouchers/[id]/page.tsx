import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  FileText,
  UserRound,
  WalletCards,
} from "lucide-react";
import { connection } from "next/server";
import { formatAmount, StatusBadge } from "@/components/dashboard-widgets";
import { PrintButton } from "@/components/print-button";
import { SchoolDocumentHeader } from "@/components/school-document-header";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import { getMissingFeeVoucherDirectoryMessage } from "@/lib/supabase/migration-errors";
import { createClient } from "@/lib/supabase/server";
import { feeVoucherIdSchema } from "@/lib/validations/fee-voucher";

type VoucherPayment = {
  id: string;
  receipt_number: string;
  payment_amount: number | string;
  currency: string;
  payment_date: string;
  payment_method: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function VoucherDetailsError({ message }: { message?: string }) {
  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Voucher information is unavailable</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {message ?? "We could not load this voucher’s records. Confirm the monthly-voucher migration is applied and try again."}
      </p>
      <Link href="/fee-vouchers" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        <ArrowLeft aria-hidden="true" size={15} />
        Fee vouchers
      </Link>
    </section>
  );
}

export default async function FeeVoucherDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const profile = await requireDashboardAccess();

  const { id } = await params;
  const parsedId = feeVoucherIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const { data: voucher, error: voucherError } = await supabase
    .from("fee_voucher_directory")
    .select(
      "id, student_id, voucher_number, fee_month, fee_year, total_fee, amount_paid, remaining_balance, currency, due_date, status, student_name, roll_number, class_id, section, class_name, created_at",
    )
    .eq("id", parsedId.data)
    .maybeSingle();

  if (voucherError) {
    const migrationMessage = getMissingFeeVoucherDirectoryMessage(voucherError);
    if (migrationMessage) {
      console.warn("Fee voucher details require a Supabase migration.", migrationMessage);
      return <VoucherDetailsError message={migrationMessage} />;
    }
    console.error("Unable to load fee voucher details.", voucherError.message);
    return <VoucherDetailsError />;
  }
  if (!voucher) notFound();

  const payments: VoucherPayment[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("payments")
      .select("id, receipt_number, payment_amount, currency, payment_date, payment_method")
      .eq("voucher_id", voucher.id)
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + 499);

    if (error) {
      console.error("Unable to load voucher payment history.", error.message);
      return <VoucherDetailsError />;
    }

    const page: VoucherPayment[] = data ?? [];
    payments.push(...page);
    if (page.length < 500) break;
  }

  const period = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(voucher.fee_year, voucher.fee_month - 1, 1)));

  return (
    <div className="space-y-6">
      <div className="print-hidden flex items-center justify-between gap-4">
        <Link href="/fee-vouchers" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-700">
          <ArrowLeft aria-hidden="true" size={14} />
          Fee vouchers
        </Link>
        <PrintButton label="Print challan" />
      </div>

      <article className="print-document space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-7">
        <SchoolDocumentHeader title="Fee challan" documentNumber={voucher.voucher_number} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Monthly fee challan</h1>
            <p className="mt-1 text-sm text-slate-500">{period} · Billed amount is fixed at voucher generation.</p>
          </div>
          <StatusBadge status={voucher.status} />
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Monthly fee"
            value={formatAmount(Number(voucher.total_fee), voucher.currency)}
            icon={<FileText aria-hidden="true" size={18} />}
            color="indigo"
          />
          <SummaryCard
            label="Previously paid"
            value={formatAmount(Number(voucher.amount_paid), voucher.currency)}
            icon={<CreditCard aria-hidden="true" size={18} />}
            color="emerald"
          />
          <SummaryCard
            label="Remaining balance"
            value={formatAmount(Number(voucher.remaining_balance), voucher.currency)}
            icon={<WalletCards aria-hidden="true" size={18} />}
            color={Number(voucher.remaining_balance) > 0 ? "amber" : "emerald"}
          />
          <SummaryCard
            label="Due date"
            value={formatDate(voucher.due_date)}
            icon={<CalendarDays aria-hidden="true" size={18} />}
            color="sky"
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="print-avoid-break rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-[15px] font-semibold text-slate-900">Student information</h2>
            </div>
            <dl className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2">
              <InfoItem label="Full name" value={voucher.student_name} />
              <InfoItem label="Roll number" value={voucher.roll_number} />
              <InfoItem label="Class and section" value={`${voucher.class_name} · ${voucher.section}`} />
              <InfoItem label="Fee month" value={period} />
              <InfoItem label="Voucher number" value={voucher.voucher_number} />
              <InfoItem label="Due date" value={formatDate(voucher.due_date)} />
            </dl>
            {profile.role === "admin" || profile.role === "super_admin" ? (
              <Link href={`/students/${voucher.student_id}`} className="print-hidden mt-6 inline-flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                <UserRound aria-hidden="true" size={15} />
                View student account
              </Link>
            ) : null}
          </article>
          <article className="print-avoid-break rounded-2xl border border-slate-200/80 bg-slate-50 p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-slate-900">Payment instructions</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Please pay the remaining balance at the school office on or before the due date. Present this challan when making payment and keep the official payment receipt for your records.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Payment history</h2>
            <p className="mt-1 text-xs text-slate-500">Payments recorded against this voucher</p>
          </div>
          {payments.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="print-history-table min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-semibold">Receipt number</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Payment date</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Method</th>
                    <th scope="col" className="py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-800">
                        <Link href={`/payments/${payment.id}`} className="hover:text-indigo-700">
                          {payment.receipt_number}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{formatDate(payment.payment_date)}</td>
                      <td className="py-3 pr-4 capitalize text-slate-600">{payment.payment_method.replaceAll("_", " ")}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-slate-800">
                        {formatAmount(Number(payment.payment_amount), payment.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No payments have been recorded for this voucher.</p>
          )}
        </section>
      </article>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "indigo" | "amber" | "emerald" | "sky";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</span>
      </div>
      <p className="mt-4 break-words text-xl font-bold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
