import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  FileText,
  UserRound,
} from "lucide-react";
import { connection } from "next/server";
import { formatAmount } from "@/components/dashboard-widgets";
import { PrintButton } from "@/components/print-button";
import { SchoolDocumentHeader } from "@/components/school-document-header";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import { getMissingPaymentReceiptDirectoryMessage } from "@/lib/supabase/migration-errors";
import { createClient } from "@/lib/supabase/server";
import { paymentIdSchema } from "@/lib/validations/payment";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function methodLabel(value: string) {
  switch (value) {
    case "cash":
      return "Cash";
    case "bank_transfer":
      return "Bank Transfer";
    case "easypaisa":
      return "EasyPaisa";
    case "jazzcash":
      return "JazzCash";
    default:
      return value.replaceAll("_", " ");
  }
}

function PaymentDetailsError({ message }: { message?: string }) {
  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Payment information is unavailable</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {message ?? "We could not load this payment record. Confirm the fee collection migration is applied and try again."}
      </p>
      <Link href="/payments" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        <ArrowLeft aria-hidden="true" size={15} />
        Payment history
      </Link>
    </section>
  );
}

type ReceiptPayment = {
  id: string;
  receipt_number: string;
  payment_amount: number | string;
  currency: string;
  payment_date: string;
  payment_method: string;
  created_at: string;
};

function toCents(value: number | string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function receiptSequence(value: string) {
  return /^RCP-\d{8}-(\d+)$/.exec(value)?.[1] ?? null;
}

export default async function PaymentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const profile = await requireDashboardAccess();
  const { id } = await params;
  const parsedId = paymentIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("payment_receipt_directory")
    .select(
      "id, receipt_number, voucher_id, voucher_number, student_id, student_name, roll_number, class_name, section, payment_amount, currency, payment_date, payment_method, transaction_reference, total_fee, due_date, fee_month, fee_year",
    )
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) {
    const migrationMessage = getMissingPaymentReceiptDirectoryMessage(error);
    if (migrationMessage) {
      console.warn("Payment receipt details require a Supabase migration.", migrationMessage);
      return <PaymentDetailsError message={migrationMessage} />;
    }
    console.error("Unable to load payment receipt details.", error.message);
    return <PaymentDetailsError />;
  }
  if (!payment) notFound();

  const history: ReceiptPayment[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error: historyError } = await supabase
      .from("payments")
      .select("id, receipt_number, payment_amount, currency, payment_date, payment_method, created_at")
      .eq("voucher_id", payment.voucher_id)
      .range(from, from + 499);

    if (historyError) {
      console.error("Unable to load payment receipt history.", historyError.message);
      return <PaymentDetailsError />;
    }

    const page: ReceiptPayment[] = data ?? [];
    history.push(...page);
    if (page.length < 500) break;
  }

  history.sort((left, right) => {
    const leftSequence = receiptSequence(left.receipt_number);
    const rightSequence = receiptSequence(right.receipt_number);
    if (leftSequence !== null && rightSequence !== null) {
      return leftSequence.length - rightSequence.length || leftSequence.localeCompare(rightSequence);
    }
    if (leftSequence === null && rightSequence !== null) return -1;
    if (leftSequence !== null && rightSequence === null) return 1;
    return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
  });

  const receiptIndex = history.findIndex((entry) => entry.id === payment.id);
  const totalFeeCents = toCents(payment.total_fee);
  const receiptAmountCents = toCents(payment.payment_amount);
  const priorPaymentCents: number[] = [];
  let hasInvalidPriorPayment = false;
  if (receiptIndex >= 0) {
    for (const entry of history.slice(0, receiptIndex)) {
      const amount = toCents(entry.payment_amount);
      if (amount === null) {
        hasInvalidPriorPayment = true;
        break;
      }
      priorPaymentCents.push(amount);
    }
  }
  if (
    receiptIndex < 0 ||
    totalFeeCents === null ||
    receiptAmountCents === null ||
    hasInvalidPriorPayment
  ) {
    console.error("Payment receipt history does not contain valid data for the requested transaction.");
    return (
      <PaymentDetailsError message="The payment could not be matched to its voucher history, so a reliable receipt cannot be printed." />
    );
  }

  const previousBalanceCents =
    totalFeeCents - priorPaymentCents.reduce((sum, amount) => sum + amount, 0);
  const remainingBalanceCents = previousBalanceCents - receiptAmountCents;
  if (previousBalanceCents < 0 || remainingBalanceCents < 0) {
    console.error("Payment receipt history exceeds the voucher's total fee.");
    return (
      <PaymentDetailsError message="The payment history does not match the voucher total, so a reliable receipt cannot be printed." />
    );
  }
  const previousBalance = previousBalanceCents / 100;
  const remainingBalance = remainingBalanceCents / 100;

  const month = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(payment.fee_year, payment.fee_month - 1, 1)));

  return (
    <div className="space-y-6">
      <div className="print-hidden flex items-center justify-between gap-4">
        <Link href="/payments" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-700">
          <ArrowLeft aria-hidden="true" size={14} />
          Payment history
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      <article className="print-document space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-7">
        <SchoolDocumentHeader title="Payment receipt" documentNumber={payment.receipt_number} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Payment received</h1>
            <p className="mt-1 text-sm text-slate-500">Issued on {formatDate(payment.payment_date)}</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">
            {formatAmount(Number(payment.payment_amount), payment.currency)}
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Previous balance"
          value={formatAmount(previousBalance, payment.currency)}
          icon={<Banknote aria-hidden="true" size={18} />}
          color="indigo"
        />
        <SummaryCard
          label="Amount received"
          value={formatAmount(Number(payment.payment_amount), payment.currency)}
          icon={<FileText aria-hidden="true" size={18} />}
          color="emerald"
        />
        <SummaryCard
          label="Remaining balance after payment"
          value={formatAmount(remainingBalance, payment.currency)}
          icon={<CreditCard aria-hidden="true" size={18} />}
          color={remainingBalance > 0 ? "amber" : "emerald"}
        />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
        <article className="print-avoid-break rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Payment details</h2>
            <p className="mt-1 text-xs text-slate-500">Receipt and transaction information</p>
          </div>
          <dl className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2">
            <InfoItem label="Payment date" value={formatDate(payment.payment_date)} />
            <InfoItem label="Payment method" value={methodLabel(payment.payment_method)} />
            <InfoItem label="Transaction reference" value={payment.transaction_reference || "—"} />
            <InfoItem label="Student" value={payment.student_name} />
            <InfoItem label="Roll number" value={payment.roll_number} />
            <InfoItem label="Class and section" value={`${payment.class_name} · ${payment.section}`} />
            <InfoItem label="Fee month" value={month} />
          </dl>
          {profile.role === "admin" || profile.role === "super_admin" ? (
            <Link href={`/students/${payment.student_id}`} className="print-hidden mt-6 inline-flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              <UserRound aria-hidden="true" size={15} />
              View student account
            </Link>
          ) : null}
        </article>

        <article className="print-avoid-break rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Voucher information</h2>
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fee voucher</p>
            <Link href={`/fee-vouchers/${payment.voucher_id}`} className="print-hidden mt-1.5 inline-flex items-center gap-2 text-base font-bold text-indigo-700 hover:text-indigo-900">
              <FileText aria-hidden="true" size={17} />
              {payment.voucher_number}
            </Link>
            <p className="hidden text-base font-bold text-slate-900 print:block">{payment.voucher_number}</p>
            <p className="mt-1 text-sm text-slate-600">{payment.class_name} · Section {payment.section} · {month}</p>
            <dl className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Due date</dt>
                <dd className="font-medium text-slate-800">{formatDate(payment.due_date)}</dd>
              </div>
              <InfoItem label="Voucher total" value={formatAmount(Number(payment.total_fee), payment.currency)} />
            </dl>
          </div>
        </article>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Payment history</h2>
            <p className="mt-1 text-xs text-slate-500">All payments recorded for this voucher, in transaction order</p>
          </div>
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
                {history.map((entry) => (
                  <tr key={entry.id} className={entry.id === payment.id ? "bg-emerald-50" : undefined}>
                    <td className="py-3 pr-4 font-semibold text-slate-800">
                      {entry.receipt_number}
                      {entry.id === payment.id ? <span className="ml-2 text-[10px] font-bold uppercase text-emerald-700">This receipt</span> : null}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{formatDate(entry.payment_date)}</td>
                    <td className="py-3 pr-4 text-slate-600">{methodLabel(entry.payment_method)}</td>
                    <td className="py-3 text-right font-semibold tabular-nums text-slate-800">
                      {formatAmount(Number(entry.payment_amount), entry.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
