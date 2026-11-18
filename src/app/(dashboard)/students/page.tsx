import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/components/dashboard-widgets";
import { getLocaleFromValue, getTranslations } from "@/i18n/locales";
import { StudentStatusButton } from "./student-status-button";

type SearchParams = {
  search?: string;
  class?: string;
  section?: string;
  page?: string;
};

const pageSize = 10;

function safeSearch(value: string | undefined) {
  return (value ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .slice(0, 80);
}

function pageHref(
  page: number,
  filters: { search: string; className: string; section: string },
) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.className) params.set("class", filters.className);
  if (filters.section) params.set("section", filters.section);
  params.set("page", String(page));
  return `/students?${params.toString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  await requireStudentManagementAccess();

  const cookieStore = await cookies();
  const locale = getLocaleFromValue(cookieStore.get("locale")?.value);
  const t = getTranslations(locale);

  const params = await searchParams;
  const search = safeSearch(params.search);
  const supabase = await createClient();
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, class_name, section")
    .order("class_name", { ascending: true })
    .order("section", { ascending: true });

  if (classesError) {
    console.error("Unable to load classes for the student directory.", classesError.message);
    return <StudentDirectoryError />;
  }

  const availableClasses = classes ?? [];
  const classNames = [...new Set(availableClasses.map((schoolClass) => schoolClass.class_name))];
  const selectedClass = classNames.includes(params.class ?? "")
    ? params.class ?? ""
    : "";
  const availableSections = availableClasses
    .map((schoolClass) => schoolClass.section)
    .filter((section, index, sections) => sections.indexOf(section) === index);
  const selectedSection = availableSections.includes(params.section ?? "")
    ? params.section ?? ""
    : "";
  const filters = { search, className: selectedClass, section: selectedSection };
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;

  let countQuery = supabase
    .from("students")
    .select("id", { count: "exact", head: true });
  let studentQuery = supabase
    .from("students")
    .select(
      "id, full_name, roll_number, class_id, section, monthly_fee_amount, currency, guardian_contact, enrollment_date, status",
    )
    .order("full_name", { ascending: true })
    .order("id", { ascending: true });

  if (selectedClass) {
    const classIds = availableClasses
      .filter((schoolClass) => schoolClass.class_name === selectedClass)
      .map((schoolClass) => schoolClass.id);
    countQuery = countQuery.in("class_id", classIds);
    studentQuery = studentQuery.in("class_id", classIds);
  }
  if (selectedSection) {
    countQuery = countQuery.eq("section", selectedSection);
    studentQuery = studentQuery.eq("section", selectedSection);
  }
  if (search) {
    const searchFilter = `full_name.ilike.%${search}%,roll_number.ilike.%${search}%`;
    countQuery = countQuery.or(searchFilter);
    studentQuery = studentQuery.or(searchFilter);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    console.error("Unable to count student records.", countError.message);
    return <StudentDirectoryError />;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(safePage, totalPages);
  const { data: students, error: studentsError } = await studentQuery.range(
    (currentPage - 1) * pageSize,
    currentPage * pageSize - 1,
  );

  if (studentsError) {
    console.error("Unable to load student records.", studentsError.message);
    return <StudentDirectoryError />;
  }

  const classNameById = new Map(
    availableClasses.map((schoolClass) => [schoolClass.id, schoolClass.class_name]),
  );

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{t.workspace}</span>
            <ChevronRight aria-hidden="true" size={13} />
            <span className="text-indigo-700">{t.students}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">
            {t.studentDirectory}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {t.studentDirectoryDescription}
          </p>
        </div>
        <Link
          href="/students/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
        >
          <Plus aria-hidden="true" size={17} />
          {t.addStudent}
        </Link>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <form action="/students" method="get" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_140px_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t.searchStudents}</span>
              <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="search"
                defaultValue={search}
                maxLength={80}
                placeholder={t.searchNameOrRoll}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label>
              <span className="sr-only">{t.filterByClass}</span>
              <select
                name="class"
                defaultValue={selectedClass}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">{t.allClasses}</option>
                {classNames.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">{t.filterBySection}</span>
              <select
                name="section"
                defaultValue={selectedSection}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">{t.allSections}</option>
                {availableSections.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Search aria-hidden="true" size={15} />
              {t.search}
            </button>
            <Link
              href="/students"
              className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              {t.clear}
            </Link>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users aria-hidden="true" size={16} />
            </span>
            {t.students}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {total.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {total === 0
              ? t.noRecords
              : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total.toLocaleString()}`}
          </p>
        </div>

        {students?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-5 py-3.5">{t.student}</th>
                  <th className="px-4 py-3.5">{t.classLabel}</th>
                  <th className="px-4 py-3.5">{t.guardianContact}</th>
                  <th className="px-4 py-3.5 text-right">{t.monthlyFee}</th>
                  <th className="px-4 py-3.5">{t.enrolled}</th>
                  <th className="px-4 py-3.5">{t.status}</th>
                  <th className="px-5 py-3.5 text-right">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="group text-sm transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/students/${student.id}`}
                        className="font-semibold text-slate-900 hover:text-indigo-700"
                      >
                        {student.full_name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{t.rollNo} {student.roll_number}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {classNameById.get(student.class_id) ?? t.classUnavailable}
                      <span className="ml-1 text-slate-400">· {student.section}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{student.guardian_contact}</td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                      {formatAmount(Number(student.monthly_fee_amount), student.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(student.enrollment_date)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        student.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`size-1.5 rounded-full ${student.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {student.status === "active" ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/students/${student.id}`}
                          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                          {t.view}
                        </Link>
                        <StudentStatusButton
                          studentId={student.id}
                          status={student.status}
                          studentName={student.full_name}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <GraduationCap aria-hidden="true" size={23} />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              {search || selectedClass || selectedSection ? t.noStudentsMatchFilters : t.noStudentsYet}
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              {search || selectedClass || selectedSection
                ? t.tryChangingFilters
                : t.startBuildingDirectory}
            </p>
            {!search && !selectedClass && !selectedSection ? (
              <Link
                href="/students/new"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                <Plus aria-hidden="true" size={15} />
                {t.addFirstStudent}
              </Link>
            ) : null}
          </div>
        )}

        {totalPages > 1 ? (
          <nav
            aria-label="Student pages"
            className="flex items-center justify-between border-t border-slate-100 px-4 py-4 sm:px-5"
          >
            <Link
              aria-disabled={currentPage === 1}
              tabIndex={currentPage === 1 ? -1 : undefined}
              href={pageHref(Math.max(1, currentPage - 1), filters)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${
                currentPage === 1
                  ? "pointer-events-none border-slate-100 text-slate-300"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <ChevronLeft aria-hidden="true" size={15} />
              {t.previous}
            </Link>
            <span className="text-xs font-medium text-slate-500">
              {t.pageOf} {currentPage} of {totalPages}
            </span>
            <Link
              aria-disabled={currentPage === totalPages}
              tabIndex={currentPage === totalPages ? -1 : undefined}
              href={pageHref(Math.min(totalPages, currentPage + 1), filters)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${
                currentPage === totalPages
                  ? "pointer-events-none border-slate-100 text-slate-300"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.next}
              <ChevronRight aria-hidden="true" size={15} />
            </Link>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

async function StudentDirectoryError() {
  const cookieStore = await cookies();
  const locale = getLocaleFromValue(cookieStore.get("locale")?.value);
  const t = getTranslations(locale);

  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">{t.studentInformationUnavailable}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {t.couldNotLoadStudent}
      </p>
      <Link href="/students" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        {t.tryAgain}
      </Link>
    </section>
  );
}
