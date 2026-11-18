import Link from "next/link";
import { ChevronRight, FileChartColumnIncreasing, Search } from "lucide-react";
import { z } from "zod";
import { connection } from "next/server";
import { formatAmount, StatusBadge } from "@/components/dashboard-widgets";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import {
  getMissingClasswiseReportMessage,
  getMissingFeeVoucherDirectoryMessage,
  getMissingPaymentReceiptDirectoryMessage,
} from "@/lib/supabase/migration-errors";
import { createClient } from "@/lib/supabase/server";

const reportTypes = [
  "monthly_collection",
  "outstanding",
  "paid_vouchers",
  "overdue_vouchers",
  "classwise_collection",
] as const;
const paymentStatuses = ["paid", "pending", "overdue"] as const;
const pageSize = 20;

type ReportType = (typeof reportTypes)[number];
type ReportSearchParams = {
  report?: string;
  search?: string;
  class?: string;
  section?: string;
  status?: string;
  month?: string;
  year?: string;
  page?: string;
};

type PaymentReportRow = {
  kind: "payment";
  id: string;
  receiptNumber: string;
  voucherNumber: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  status: string;
};

type VoucherReportRow = {
  kind: "voucher";
  id: string;
  voucherNumber: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  feeMonth: number;
  feeYear: number;
  totalFee: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate: string;
  status: string;
};

type ClassReportRow = {
  kind: "classwise";
  className: string;
  section: string;
  studentCount: number;
  paymentCount: number;
  collectedAmount: number;
};

type ReportRow = PaymentReportRow | VoucherReportRow | ClassReportRow;

const classReportRowsSchema = z.array(z.object({
  class_name: z.string(),
  section: z.string(),
  student_count: z.coerce.number().int().nonnegative(),
  payment_count: z.coerce.number().int().nonnegative(),
  collected_amount: z.coerce.number().finite().nonnegative(),
  total_count: z.coerce.number().int().nonnegative(),
}));

function safeSearch(value: string | undefined) {
  return (value ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .slice(0, 80);
}

function parsePeriod(value: string | undefined, min: number, max: number) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function getReportType(value: string | undefined): ReportType {
  return reportTypes.find((report) => report === value) ?? "monthly_collection";
}

function reportTitle(report: ReportType) {
  switch (report) {
    case "monthly_collection":
      return "Monthly collection report";
    case "outstanding":
      return "Outstanding fee report";
    case "paid_vouchers":
      return "Paid voucher report";
    case "overdue_vouchers":
      return "Overdue voucher report";
    case "classwise_collection":
      return "Class-wise collection report";
  }
}

function pageHref(
  page: number,
  filters: {
    report: ReportType;
    search: string;
    className: string;
    section: string;
    status: string;
    month: number;
    year: number;
  },
) {
  const params = new URLSearchParams({
    report: filters.report,
    month: String(filters.month),
    year: String(filters.year),
    page: String(page),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.className) params.set("class", filters.className);
  if (filters.section) params.set("section", filters.section);
  if (filters.status) params.set("status", filters.status);
  return `/reports?${params.toString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatPeriod(month: number, year: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function paymentMethodLabel(value: string) {
  switch (value) {
    case "bank_transfer":
      return "Bank transfer";
    case "easypaisa":
      return "EasyPaisa";
    case "jazzcash":
      return "JazzCash";
    default:
      return value.replaceAll("_", " ");
  }
}

function ReportsError({ message }: { message: string }) {
  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Reports are unavailable</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{message}</p>
      <Link href="/reports" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Try again
      </Link>
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  await connection();
  await requireDashboardAccess();

  const params = await searchParams;
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const report = getReportType(params.report);
  const search = safeSearch(params.search);
  const month = parsePeriod(params.month, 1, 12) ?? currentMonth;
  const year = parsePeriod(params.year, 2000, 9999) ?? currentYear;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const supabase = await createClient();
  const { data: classRows, error: classError } = await supabase
    .from("classes")
    .select("class_name, section")
    .order("class_name", { ascending: true })
    .order("section", { ascending: true });

  if (classError) {
    console.error("Unable to load report filters.", classError.message);
    return <ReportsError message="Class filters could not be loaded. Please try again." />;
  }

  const classes = classRows ?? [];
  const classNames = [...new Set(classes.map((item) => item.class_name))];
  const className = classNames.includes(params.class ?? "") ? params.class ?? "" : "";
  const availableSections = classes
    .filter((item) => !className || item.class_name === className)
    .map((item) => item.section);
  const sections = [...new Set(availableSections)];
  const section = sections.includes(params.section ?? "") ? params.section ?? "" : "";
  const status = paymentStatuses.find((item) => item === params.status) ?? "";
  const offset = (safePage - 1) * pageSize;
  const filters = { report, search, className, section, status, month, year };

  let rows: ReportRow[] = [];
  let total = 0;

  if (report === "classwise_collection") {
    const { data, error } = await supabase.rpc("get_classwise_collection_report", {
      p_month: month,
      p_year: year,
      p_search: search || null,
      p_class_name: className || null,
      p_section: section || null,
      p_payment_status: status || null,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) {
      const migrationMessage = getMissingClasswiseReportMessage(error);
      if (migrationMessage) {
        console.warn("Class-wise reports require a Supabase migration.", migrationMessage);
        return <ReportsError message={migrationMessage} />;
      }
      console.error("Unable to load class-wise collection report.", error.message);
      return <ReportsError message="The class-wise collection report could not be loaded." />;
    }

    const parsedRows = classReportRowsSchema.safeParse(data);
    if (!parsedRows.success) {
      console.error("Supabase returned invalid class-wise report data.");
      return <ReportsError message="The class-wise report returned invalid data." />;
    }

    total = parsedRows.data[0]?.total_count ?? 0;
    rows = parsedRows.data.map((item) => ({
      kind: "classwise",
      className: item.class_name,
      section: item.section,
      studentCount: item.student_count,
      paymentCount: item.payment_count,
      collectedAmount: item.collected_amount,
    }));
  } else if (report === "monthly_collection") {
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();
    let countQuery = supabase
      .from("payment_receipt_directory")
      .select("id", { count: "exact", head: true })
      .gte("payment_date", start)
      .lt("payment_date", end);
    let dataQuery = supabase
      .from("payment_receipt_directory")
      .select(
        "id, receipt_number, voucher_number, student_name, roll_number, class_name, section, payment_date, payment_method, payment_amount, voucher_status",
      )
      .gte("payment_date", start)
      .lt("payment_date", end)
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false });

    if (className) {
      countQuery = countQuery.eq("class_name", className);
      dataQuery = dataQuery.eq("class_name", className);
    }
    if (section) {
      countQuery = countQuery.eq("section", section);
      dataQuery = dataQuery.eq("section", section);
    }
    if (status) {
      countQuery = countQuery.eq("voucher_status", status);
      dataQuery = dataQuery.eq("voucher_status", status);
    }
    if (search) {
      const searchFilter = `student_name.ilike.%${search}%,roll_number.ilike.%${search}%`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
    }

    const [
      { count, error: countError },
      { data, error },
    ] = await Promise.all([
      countQuery,
      dataQuery.range(offset, offset + pageSize - 1),
    ]);

    if (countError || error) {
      const migrationMessage =
        getMissingPaymentReceiptDirectoryMessage(countError) ??
        getMissingPaymentReceiptDirectoryMessage(error);
      if (migrationMessage) {
        console.warn("Monthly collection reports require a Supabase migration.", migrationMessage);
        return <ReportsError message={migrationMessage} />;
      }
      console.error("Unable to load monthly collection report.", countError?.message ?? error?.message);
      return <ReportsError message="The monthly collection report could not be loaded." />;
    }

    total = count ?? 0;
    rows = (data ?? []).map((item) => ({
      kind: "payment",
      id: item.id,
      receiptNumber: item.receipt_number,
      voucherNumber: item.voucher_number,
      studentName: item.student_name,
      rollNumber: item.roll_number,
      className: item.class_name,
      section: item.section,
      paymentDate: item.payment_date,
      paymentMethod: item.payment_method,
      amount: Number(item.payment_amount),
      status: item.voucher_status,
    }));
  } else {
    let countQuery = supabase
      .from("fee_voucher_directory")
      .select("id", { count: "exact", head: true });
    let dataQuery = supabase
      .from("fee_voucher_directory")
      .select(
        "id, voucher_number, student_name, roll_number, class_name, section, fee_month, fee_year, total_fee, amount_paid, remaining_balance, due_date, status",
      )
      .order("fee_year", { ascending: false })
      .order("fee_month", { ascending: false })
      .order("due_date", { ascending: true })
      .order("id", { ascending: false });

    if (report === "outstanding") {
      countQuery = countQuery.gt("remaining_balance", 0);
      dataQuery = dataQuery.gt("remaining_balance", 0);
    } else if (report === "paid_vouchers") {
      countQuery = countQuery.eq("status", "paid");
      dataQuery = dataQuery.eq("status", "paid");
    } else {
      countQuery = countQuery.eq("status", "overdue");
      dataQuery = dataQuery.eq("status", "overdue");
    }
    if (status) {
      countQuery = countQuery.eq("status", status);
      dataQuery = dataQuery.eq("status", status);
    }
    if (className) {
      countQuery = countQuery.eq("class_name", className);
      dataQuery = dataQuery.eq("class_name", className);
    }
    if (section) {
      countQuery = countQuery.eq("section", section);
      dataQuery = dataQuery.eq("section", section);
    }
    countQuery = countQuery.eq("fee_month", month).eq("fee_year", year);
    dataQuery = dataQuery.eq("fee_month", month).eq("fee_year", year);
    if (search) {
      const searchFilter = `student_name.ilike.%${search}%,roll_number.ilike.%${search}%`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
    }

    const [
      { count, error: countError },
      { data, error },
    ] = await Promise.all([
      countQuery,
      dataQuery.range(offset, offset + pageSize - 1),
    ]);

    if (countError || error) {
      const migrationMessage =
        getMissingFeeVoucherDirectoryMessage(countError) ??
        getMissingFeeVoucherDirectoryMessage(error);
      if (migrationMessage) {
        console.warn("Voucher reports require a Supabase migration.", migrationMessage);
        return <ReportsError message={migrationMessage} />;
      }
      console.error("Unable to load voucher report.", countError?.message ?? error?.message);
      return <ReportsError message="The voucher report could not be loaded." />;
    }

    total = count ?? 0;
    rows = (data ?? []).map((item) => ({
      kind: "voucher",
      id: item.id,
      voucherNumber: item.voucher_number,
      studentName: item.student_name,
      rollNumber: item.roll_number,
      className: item.class_name,
      section: item.section,
      feeMonth: item.fee_month,
      feeYear: item.fee_year,
      totalFee: Number(item.total_fee),
      amountPaid: Number(item.amount_paid),
      remainingBalance: Number(item.remaining_balance),
      dueDate: item.due_date,
      status: item.status,
    }));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(safePage, totalPages);

  return (
    <div className="space-y-7">
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>Workspace</span>
          <ChevronRight aria-hidden="true" size={13} />
          <span className="text-indigo-700">Reports</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">Financial reports</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Live collections and voucher balances from Supabase · amounts in PKR.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40">
        <form action="/reports" method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block md:col-span-2 xl:col-span-1">
            <span className="sr-only">Search student name or roll number</span>
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="search"
              maxLength={80}
              defaultValue={search}
              placeholder="Search student or roll number"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <label>
            <span className="sr-only">Report type</span>
            <select name="report" defaultValue={report} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              <option value="monthly_collection">Monthly collection</option>
              <option value="outstanding">Outstanding fees</option>
              <option value="paid_vouchers">Paid vouchers</option>
              <option value="overdue_vouchers">Overdue vouchers</option>
              <option value="classwise_collection">Class-wise collection</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by class</span>
            <select name="class" defaultValue={className} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              <option value="">All classes</option>
              {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by section</span>
            <select name="section" defaultValue={section} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              <option value="">All sections</option>
              {sections.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by payment status</span>
            <select name="status" defaultValue={status} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by month</span>
            <select name="month" defaultValue={month} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              {Array.from({ length: 12 }, (_, index) => {
                const monthValue = index + 1;
                return (
                  <option key={monthValue} value={monthValue}>
                    {new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" })
                      .format(new Date(Date.UTC(2020, index, 1)))}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by year</span>
            <select name="year" defaultValue={year} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              {Array.from({ length: Math.max(1, currentYear + 2 - 2000) }, (_, index) => currentYear + 1 - index)
                .filter((yearOption) => yearOption >= 2000)
                .map((yearOption) => <option key={yearOption} value={yearOption}>{yearOption}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700">
              <Search aria-hidden="true" size={15} />
              Apply filters
            </button>
            <Link href="/reports" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileChartColumnIncreasing aria-hidden="true" size={18} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{reportTitle(report)}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatPeriod(month, year)} · {total.toLocaleString()} records · PKR
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {total === 0
              ? "No records"
              : `Showing ${offset + 1}–${Math.min(offset + rows.length, total)} of ${total.toLocaleString()}`}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-52 items-center justify-center px-6 py-10 text-center text-sm text-slate-500">
            No records match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {report === "monthly_collection" ? (
                    <>
                      <th className="px-5 py-3.5">Receipt / student</th>
                      <th className="px-4 py-3.5">Class</th>
                      <th className="px-4 py-3.5">Payment date</th>
                      <th className="px-4 py-3.5">Method</th>
                      <th className="px-4 py-3.5">Voucher status</th>
                      <th className="px-5 py-3.5 text-right">Collected</th>
                    </>
                  ) : report === "classwise_collection" ? (
                    <>
                      <th className="px-5 py-3.5">Class</th>
                      <th className="px-4 py-3.5 text-right">Students with payments</th>
                      <th className="px-4 py-3.5 text-right">Payment count</th>
                      <th className="px-5 py-3.5 text-right">Collected</th>
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-3.5">Voucher / student</th>
                      <th className="px-4 py-3.5">Class</th>
                      <th className="px-4 py-3.5">Billing period</th>
                      <th className="px-4 py-3.5 text-right">Total fee</th>
                      <th className="px-4 py-3.5 text-right">Paid</th>
                      <th className="px-4 py-3.5 text-right">Balance</th>
                      <th className="px-4 py-3.5">Due date</th>
                      <th className="px-5 py-3.5">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  if (row.kind === "payment") {
                    return (
                      <tr key={row.id} className="text-sm transition hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <Link href={`/payments/${row.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
                            {row.receiptNumber}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-600">{row.studentName}</p>
                          <p className="text-[11px] text-slate-400">Roll {row.rollNumber} · {row.voucherNumber}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{row.className} · {row.section}</td>
                        <td className="px-4 py-3.5 text-slate-600">{formatDate(row.paymentDate)}</td>
                        <td className="px-4 py-3.5 capitalize text-slate-600">{paymentMethodLabel(row.paymentMethod)}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={row.status} /></td>
                        <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-800">{formatAmount(row.amount)}</td>
                      </tr>
                    );
                  }
                  if (row.kind === "voucher") {
                    return (
                      <tr key={row.id} className="text-sm transition hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <Link href={`/fee-vouchers/${row.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
                            {row.voucherNumber}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-600">{row.studentName}</p>
                          <p className="text-[11px] text-slate-400">Roll {row.rollNumber}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{row.className} · {row.section}</td>
                        <td className="px-4 py-3.5 text-slate-600">{formatPeriod(row.feeMonth, row.feeYear)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{formatAmount(row.totalFee)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{formatAmount(row.amountPaid)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">{formatAmount(row.remainingBalance)}</td>
                        <td className="px-4 py-3.5 text-slate-600">{formatDate(row.dueDate)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={row.status} /></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`${row.className}-${row.section}`} className="text-sm">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{row.className} · {row.section}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{row.studentCount.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{row.paymentCount.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-800">{formatAmount(row.collectedAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <Link
              href={pageHref(Math.max(1, currentPage - 1), filters)}
              aria-disabled={currentPage === 1}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${currentPage === 1 ? "pointer-events-none text-slate-300" : "text-indigo-700 hover:bg-indigo-50"}`}
            >
              Previous
            </Link>
            <p className="text-xs text-slate-500">Page {currentPage} of {totalPages}</p>
            <Link
              href={pageHref(Math.min(totalPages, currentPage + 1), filters)}
              aria-disabled={currentPage === totalPages}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${currentPage === totalPages ? "pointer-events-none text-slate-300" : "text-indigo-700 hover:bg-indigo-50"}`}
            >
              Next
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
