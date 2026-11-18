import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Search,
  WalletCards,
} from "lucide-react";
import { connection } from "next/server";
import { formatAmount, StatusBadge } from "@/components/dashboard-widgets";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import {
  getMissingFeeVoucherDirectoryMessage,
  getMissingPaymentReceiptDirectoryMessage,
} from "@/lib/supabase/migration-errors";
import { createClient } from "@/lib/supabase/server";
import { paymentMethods } from "@/lib/validations/payment";
import {
  PaymentCollectionForm,
  type OutstandingVoucherOption,
} from "./payment-collection-form";

type PaymentSearchParams = {
  search?: string;
  method?: string;
  class?: string;
  section?: string;
  page?: string;
};

type PaymentHistoryRow = {
  id: string;
  receipt_number: string;
  voucher_id: string;
  voucher_number: string;
  payment_amount: number | string;
  currency: string;
  payment_date: string;
  payment_method: string;
  transaction_reference: string | null;
  student_name: string;
  roll_number: string;
  class_name: string;
  section: string;
  voucher_status: string;
};

type PaymentMethodFilter =
  | (typeof paymentMethods)[number]
  | "card"
  | "online"
  | "cheque"
  | "other";

const methodOptions: { value: PaymentMethodFilter; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "card", label: "Card (legacy)" },
  { value: "online", label: "Online (legacy)" },
  { value: "cheque", label: "Cheque (legacy)" },
  { value: "other", label: "Other (legacy)" },
];

const pageSize = 15;

function safeSearch(value: string | undefined) {
  return (value ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .slice(0, 80);
}

function pageHref(
  page: number,
  filters: { search: string; method: string; className: string; section: string },
) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.method) params.set("method", filters.method);
  if (filters.className) params.set("class", filters.className);
  if (filters.section) params.set("section", filters.section);
  params.set("page", String(page));
  return `/payments?${params.toString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatPaymentMethod(value: string) {
  return methodOptions.find((method) => method.value === value)?.label.replace(" (legacy)", "")
    ?? value.replaceAll("_", " ");
}

async function fetchOutstandingVouchers(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{
  data: OutstandingVoucherOption[] | null;
  error: { code: string; message: string } | null;
}> {
  const vouchers: OutstandingVoucherOption[] = [];

  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("fee_voucher_directory")
      .select(
        "id, student_id, student_name, roll_number, voucher_number, fee_month, fee_year, total_fee, amount_paid, remaining_balance, currency, due_date",
      )
      .gt("remaining_balance", 0)
      .order("student_name", { ascending: true })
      .order("fee_year", { ascending: false })
      .order("fee_month", { ascending: false })
      .range(from, from + 499);

    if (error) {
      return { data: null, error: { code: error.code, message: error.message } };
    }

    const page = data ?? [];
    vouchers.push(
      ...page.map((voucher) => ({
        id: voucher.id,
        studentId: voucher.student_id,
        studentName: voucher.student_name,
        rollNumber: voucher.roll_number,
        voucherNumber: voucher.voucher_number,
        feeMonth: voucher.fee_month,
        feeYear: voucher.fee_year,
        totalFee: Number(voucher.total_fee),
        amountPaid: Number(voucher.amount_paid),
        remainingBalance: Number(voucher.remaining_balance),
        currency: voucher.currency,
        dueDate: voucher.due_date,
      })),
    );

    if (page.length < 500) return { data: vouchers, error: null };
  }
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<PaymentSearchParams>;
}) {
  await connection();
  await requireDashboardAccess();
  const params = await searchParams;
  const search = safeSearch(params.search);
  const selectedMethod = methodOptions.some((method) => method.value === params.method)
    ? params.method ?? ""
    : "";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const supabase = await createClient();
  const [
    { data: classes, error: classError },
    outstandingResult,
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, class_name, section")
      .order("class_name", { ascending: true })
      .order("section", { ascending: true }),
    fetchOutstandingVouchers(supabase),
  ]);

  if (classError || outstandingResult.error) {
    const migrationMessage = getMissingFeeVoucherDirectoryMessage(outstandingResult.error);
    if (migrationMessage) {
      console.warn("Payment collection requires a Supabase migration.", migrationMessage);
      return <PaymentPageError message={migrationMessage} />;
    }
    console.error(
      "Unable to load payment collection options.",
      classError?.message ?? outstandingResult.error?.message,
    );
    return <PaymentPageError />;
  }

  const outstandingVouchers = outstandingResult.data ?? [];
  const availableClasses = classes ?? [];
  const classNames = [...new Set(availableClasses.map((schoolClass) => schoolClass.class_name))];
  const selectedClass = classNames.includes(params.class ?? "") ? params.class ?? "" : "";
  const sections = availableClasses
    .map((schoolClass) => schoolClass.section)
    .filter((section, index, list) => list.indexOf(section) === index);
  const selectedSection = sections.includes(params.section ?? "") ? params.section ?? "" : "";
  const filters = {
    search,
    method: selectedMethod,
    className: selectedClass,
    section: selectedSection,
  };

  let countQuery = supabase
    .from("payment_receipt_directory")
    .select("id", { count: "exact", head: true });
  let paymentQuery = supabase
    .from("payment_receipt_directory")
    .select(
      "id, receipt_number, voucher_id, voucher_number, payment_amount, currency, payment_date, payment_method, transaction_reference, student_name, roll_number, class_name, section, voucher_status",
    )
    .order("payment_date", { ascending: false })
    .order("id", { ascending: false });

  if (selectedMethod) {
    countQuery = countQuery.eq("payment_method", selectedMethod);
    paymentQuery = paymentQuery.eq("payment_method", selectedMethod);
  }
  if (selectedClass) {
    countQuery = countQuery.eq("class_name", selectedClass);
    paymentQuery = paymentQuery.eq("class_name", selectedClass);
  }
  if (selectedSection) {
    countQuery = countQuery.eq("section", selectedSection);
    paymentQuery = paymentQuery.eq("section", selectedSection);
  }
  if (search) {
    const filter = [
      `receipt_number.ilike.%${search}%`,
      `voucher_number.ilike.%${search}%`,
      `student_name.ilike.%${search}%`,
      `roll_number.ilike.%${search}%`,
      `transaction_reference.ilike.%${search}%`,
    ].join(",");
    countQuery = countQuery.or(filter);
    paymentQuery = paymentQuery.or(filter);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    const migrationMessage = getMissingPaymentReceiptDirectoryMessage(countError);
    if (migrationMessage) {
      console.warn("Payment history requires a Supabase migration.", migrationMessage);
      return <PaymentPageError message={migrationMessage} />;
    }
    console.error("Unable to count payment records.", countError.message);
    return <PaymentPageError />;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(safePage, totalPages);
  const { data, error: paymentError } = await paymentQuery.range(
    (currentPage - 1) * pageSize,
    currentPage * pageSize - 1,
  );

  if (paymentError) {
    const migrationMessage = getMissingPaymentReceiptDirectoryMessage(paymentError);
    if (migrationMessage) {
      console.warn("Payment history requires a Supabase migration.", migrationMessage);
      return <PaymentPageError message={migrationMessage} />;
    }
    console.error("Unable to load payment history.", paymentError.message);
    return <PaymentPageError />;
  }

  const payments: PaymentHistoryRow[] = data ?? [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Workspace</span>
            <ChevronRight aria-hidden="true" size={13} />
            <span className="text-indigo-700">Payments</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">
            Fee collection
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Record full or partial payments and review issued receipts.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm md:self-auto">
          <WalletCards aria-hidden="true" size={15} className="text-indigo-600" />
          {outstandingVouchers.length.toLocaleString()} open vouchers
        </span>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-slate-900">Collect a payment</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Choose a student and an outstanding voucher. Receipts are generated automatically; each payment is applied atomically.
          </p>
        </div>
        <PaymentCollectionForm
          vouchers={outstandingVouchers}
          initialIdempotencyKey={randomUUID()}
          today={today}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <form action="/payments" method="get" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_170px_140px_auto_auto]">
            <label className="relative block">
              <span className="sr-only">Search payment history</span>
              <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="search"
                maxLength={80}
                defaultValue={search}
                placeholder="Search receipt, voucher, student"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label>
              <span className="sr-only">Filter by payment method</span>
              <select name="method" defaultValue={selectedMethod} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">All methods</option>
                {methodOptions.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by class</span>
              <select name="class" defaultValue={selectedClass} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">All classes</option>
                {classNames.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by section</span>
              <select name="section" defaultValue={selectedSection} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">All sections</option>
                {sections.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <Search aria-hidden="true" size={15} />
              Filter
            </button>
            <Link href="/payments" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
              Clear
            </Link>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CreditCard aria-hidden="true" size={16} />
            </span>
            Payment history
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{total.toLocaleString()}</span>
          </div>
          <p className="text-xs text-slate-500">
            {total === 0 ? "No records" : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total.toLocaleString()}`}
          </p>
        </div>

        {payments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-5 py-3.5">Receipt / Student</th>
                  <th className="px-4 py-3.5">Voucher</th>
                  <th className="px-4 py-3.5">Class</th>
                  <th className="px-4 py-3.5">Payment date</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5 text-right">Amount</th>
                  <th className="px-4 py-3.5">Voucher status</th>
                  <th className="px-5 py-3.5 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="text-sm transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/payments/${payment.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
                        {payment.receipt_number}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-600">{payment.student_name}</p>
                      <p className="text-[11px] text-slate-400">Roll {payment.roll_number}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{payment.voucher_number}</td>
                    <td className="px-4 py-3.5 text-slate-600">{payment.class_name} · {payment.section}</td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{formatPaymentMethod(payment.payment_method)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                      {formatAmount(Number(payment.payment_amount), payment.currency)}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={payment.voucher_status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/payments/${payment.id}`} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <CreditCard aria-hidden="true" size={20} />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              {search || selectedMethod || selectedClass || selectedSection ? "No payments match these filters" : "No payments recorded yet"}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              {search || selectedMethod || selectedClass || selectedSection
                ? "Change your filters or clear them to see all payments."
                : "Recorded payments and automatically generated receipts will appear here."}
            </p>
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Payment history pages" className="flex items-center justify-between border-t border-slate-100 px-4 py-4 sm:px-5">
            <Link
              aria-disabled={currentPage === 1}
              tabIndex={currentPage === 1 ? -1 : undefined}
              href={pageHref(Math.max(1, currentPage - 1), filters)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${currentPage === 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              <ChevronLeft aria-hidden="true" size={15} /> Previous
            </Link>
            <span className="text-xs font-medium text-slate-500">Page {currentPage} of {totalPages}</span>
            <Link
              aria-disabled={currentPage === totalPages}
              tabIndex={currentPage === totalPages ? -1 : undefined}
              href={pageHref(Math.min(totalPages, currentPage + 1), filters)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${currentPage === totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              Next <ChevronRight aria-hidden="true" size={15} />
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function PaymentPageError({ message }: { message?: string }) {
  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Payment records are unavailable</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {message ?? "We could not load payment records. Confirm the fee collection migration is applied and try again."}
      </p>
      <Link href="/payments" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Try again
      </Link>
    </section>
  );
}
