import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  WalletCards,
} from "lucide-react";
import { connection } from "next/server";
import { formatAmount, StatusBadge } from "@/components/dashboard-widgets";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import { getMissingFeeVoucherDirectoryMessage } from "@/lib/supabase/migration-errors";
import { createClient } from "@/lib/supabase/server";
import { voucherStatuses } from "@/lib/validations/fee-voucher";
import { VoucherGenerationForm } from "./voucher-generation-form";

type VoucherSearchParams = {
  search?: string;
  class?: string;
  section?: string;
  status?: string;
  month?: string;
  year?: string;
  page?: string;
};

const pageSize = 15;

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

function pageHref(
  page: number,
  filters: {
    search: string;
    className: string;
    section: string;
    status: string;
    month: number | null;
    year: number | null;
  },
) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.className) params.set("class", filters.className);
  if (filters.section) params.set("section", filters.section);
  if (filters.status) params.set("status", filters.status);
  if (filters.month) params.set("month", String(filters.month));
  if (filters.year) params.set("year", String(filters.year));
  params.set("page", String(page));
  return `/fee-vouchers?${params.toString()}`;
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

export default async function FeeVouchersPage({
  searchParams,
}: {
  searchParams: Promise<VoucherSearchParams>;
}) {
  await connection();
  const profile = await requireDashboardAccess();
  const params = await searchParams;
  const now = new Date();
  const search = safeSearch(params.search);
  const requestedStatus = voucherStatuses.find((status) => status === params.status) ?? "";
  const month = parsePeriod(params.month, 1, 12);
  const year = parsePeriod(params.year, 2000, 9999);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const supabase = await createClient();
  const [
    { data: classes, error: classError },
    { count: activeStudentCount, error: activeError },
  ] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id, class_name, section")
        .order("class_name", { ascending: true })
        .order("section", { ascending: true }),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  if (classError || activeError) {
    console.error(
      "Unable to load fee voucher filters.",
      classError?.message ?? activeError?.message,
    );
    return <VoucherPageError />;
  }

  const availableClasses = classes ?? [];
  const classNames = [...new Set(availableClasses.map((schoolClass) => schoolClass.class_name))];
  const selectedClass = classNames.includes(params.class ?? "") ? params.class ?? "" : "";
  const sections = availableClasses
    .map((schoolClass) => schoolClass.section)
    .filter((section, index, list) => list.indexOf(section) === index);
  const selectedSection = sections.includes(params.section ?? "") ? params.section ?? "" : "";
  const selectedMonth = month;
  const selectedYear = year;
  const filters = {
    search,
    className: selectedClass,
    section: selectedSection,
    status: requestedStatus,
    month: selectedMonth,
    year: selectedYear,
  };

  let countQuery = supabase
    .from("fee_voucher_directory")
    .select("id", { count: "exact", head: true });
  let voucherQuery = supabase
    .from("fee_voucher_directory")
    .select(
      "id, student_id, voucher_number, fee_month, fee_year, total_fee, amount_paid, remaining_balance, currency, due_date, status, student_name, roll_number, class_id, section, class_name",
    )
    .order("fee_year", { ascending: false })
    .order("fee_month", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (selectedClass) {
    countQuery = countQuery.eq("class_name", selectedClass);
    voucherQuery = voucherQuery.eq("class_name", selectedClass);
  }
  if (selectedSection) {
    countQuery = countQuery.eq("section", selectedSection);
    voucherQuery = voucherQuery.eq("section", selectedSection);
  }
  if (requestedStatus) {
    countQuery = countQuery.eq("status", requestedStatus);
    voucherQuery = voucherQuery.eq("status", requestedStatus);
  }
  if (selectedMonth !== null) {
    countQuery = countQuery.eq("fee_month", selectedMonth);
    voucherQuery = voucherQuery.eq("fee_month", selectedMonth);
  }
  if (selectedYear !== null) {
    countQuery = countQuery.eq("fee_year", selectedYear);
    voucherQuery = voucherQuery.eq("fee_year", selectedYear);
  }
  if (search) {
    const searchFilter =
      `voucher_number.ilike.%${search}%,student_name.ilike.%${search}%,roll_number.ilike.%${search}%`;
    countQuery = countQuery.or(searchFilter);
    voucherQuery = voucherQuery.or(searchFilter);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    const migrationMessage = getMissingFeeVoucherDirectoryMessage(countError);
    if (migrationMessage) {
      console.warn("Fee vouchers require a Supabase migration.", migrationMessage);
      return <VoucherPageError message={migrationMessage} />;
    }
    console.error("Unable to count fee vouchers.", countError.message);
    return <VoucherPageError />;
  }
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(safePage, totalPages);
  const { data: vouchers, error: voucherError } = await voucherQuery.range(
    (currentPage - 1) * pageSize,
    currentPage * pageSize - 1,
  );

  if (voucherError) {
    const migrationMessage = getMissingFeeVoucherDirectoryMessage(voucherError);
    if (migrationMessage) {
      console.warn("Fee vouchers require a Supabase migration.", migrationMessage);
      return <VoucherPageError message={migrationMessage} />;
    }
    console.error("Unable to load fee vouchers.", voucherError.message);
    return <VoucherPageError />;
  }

  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const defaultDueDate = new Date(
    Date.UTC(currentYear, currentMonth, 0),
  ).toISOString().slice(0, 10);
  const isAdministrator =
    profile.role === "super_admin" || profile.role === "admin";

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Workspace</span>
            <ChevronRight aria-hidden="true" size={13} />
            <span className="text-indigo-700">Fee vouchers</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">
            Fee vouchers
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Generate monthly charges and track payment status across the school.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm md:self-auto">
          <WalletCards aria-hidden="true" size={15} className="text-indigo-600" />
          {activeStudentCount ?? 0} active students
        </span>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FileText aria-hidden="true" size={19} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Generate monthly vouchers</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Each active student is billed using their current monthly fee. Previously generated voucher amounts remain unchanged.
            </p>
          </div>
        </div>
        <VoucherGenerationForm
          isAdministrator={isAdministrator}
          currentMonth={currentMonth}
          currentYear={currentYear}
          defaultDueDate={defaultDueDate}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <form action="/fee-vouchers" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_160px_130px_145px_145px_auto_auto]">
            <label className="relative block">
              <span className="sr-only">Search vouchers</span>
              <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="search"
                maxLength={80}
                defaultValue={search}
                placeholder="Search voucher, student, roll"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
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
            <label>
              <span className="sr-only">Filter by payment status</span>
              <select name="status" defaultValue={requestedStatus} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by billing month</span>
              <select name="month" defaultValue={selectedMonth ?? ""} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">All months</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1)))}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by billing year</span>
              <select name="year" defaultValue={selectedYear ?? ""} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">All years</option>
                {Array.from({ length: Math.max(1, currentYear + 2 - 2000) }, (_, index) => currentYear + 1 - index)
                  .filter((year) => year >= 2000)
                  .map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <Search aria-hidden="true" size={15} />
              Filter
            </button>
            <Link href="/fee-vouchers" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
              Clear
            </Link>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FileText aria-hidden="true" size={16} />
            </span>
            Vouchers
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{total.toLocaleString()}</span>
          </div>
          <p className="text-xs text-slate-500">
            {total === 0 ? "No records" : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total.toLocaleString()}`}
          </p>
        </div>

        {vouchers?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-5 py-3.5">Voucher / Student</th>
                  <th className="px-4 py-3.5">Class</th>
                  <th className="px-4 py-3.5">Billing period</th>
                  <th className="px-4 py-3.5 text-right">Total fee</th>
                  <th className="px-4 py-3.5 text-right">Paid</th>
                  <th className="px-4 py-3.5 text-right">Balance</th>
                  <th className="px-4 py-3.5">Due date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.map((voucher) => (
                  <tr key={voucher.id} className="text-sm transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/fee-vouchers/${voucher.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
                        {voucher.voucher_number}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-600">{voucher.student_name}</p>
                      <p className="text-[11px] text-slate-400">Roll {voucher.roll_number}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {voucher.class_name}<span className="ml-1 text-slate-400">· {voucher.section}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{formatPeriod(voucher.fee_month, voucher.fee_year)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{formatAmount(Number(voucher.total_fee), voucher.currency)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{formatAmount(Number(voucher.amount_paid), voucher.currency)}</td>
                    <td className={`px-4 py-3.5 text-right font-semibold tabular-nums ${Number(voucher.remaining_balance) > 0 ? "text-amber-700" : "text-slate-500"}`}>
                      {formatAmount(Number(voucher.remaining_balance), voucher.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(voucher.due_date)}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={voucher.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/fee-vouchers/${voucher.id}`} aria-label={`View voucher ${voucher.voucher_number}`} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <FileText aria-hidden="true" size={20} />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              {search || selectedClass || selectedSection || requestedStatus || selectedMonth || selectedYear
                ? "No vouchers match these filters"
                : "No fee vouchers yet"}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              {search || selectedClass || selectedSection || requestedStatus || selectedMonth || selectedYear
                ? "Change your filters or clear them to see all vouchers."
                : "Choose a month, year, and due date above to generate vouchers for active students."}
            </p>
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Voucher pages" className="flex items-center justify-between border-t border-slate-100 px-4 py-4 sm:px-5">
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

function VoucherPageError({ message }: { message?: string }) {
  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Fee vouchers are unavailable</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {message ?? "We could not load voucher records. Confirm the monthly-voucher migration is applied and try again."}
      </p>
      <Link href="/fee-vouchers" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Try again
      </Link>
    </section>
  );
}
