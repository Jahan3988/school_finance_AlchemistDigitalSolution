import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Edit3,
  FileText,
  Phone,
  UserRound,
} from "lucide-react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { formatAmount, StatusBadge } from "@/components/dashboard-widgets";
import { getLocaleFromValue, getTranslations } from "@/i18n/locales";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { getMissingFeeVoucherDirectoryMessage } from "@/lib/supabase/migration-errors";
import { createClient } from "@/lib/supabase/server";
import { studentIdSchema } from "@/lib/validations/student";
import { StudentStatusButton } from "../student-status-button";

type VoucherRow = {
  id: string;
  voucher_number: string;
  fee_month: number;
  fee_year: number;
  total_fee: number | string;
  amount_paid: number | string;
  remaining_balance: number | string;
  currency: string;
  due_date: string;
  status: string;
};

type PaymentRow = {
  id: string;
  voucher_id: string;
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

function period(month: number, year: number) {
  return `${new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )} ${year}`;
}

export default async function StudentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  await connection();
  await requireStudentManagementAccess();

  const cookieStore = await cookies();
  const locale = getLocaleFromValue(cookieStore.get("locale")?.value);
  const t = getTranslations(locale);

  const { id } = await params;
  const parsedId = studentIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const query = await searchParams;
  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(
      "id, full_name, roll_number, class_id, section, monthly_fee_amount, currency, guardian_contact, enrollment_date, status",
    )
    .eq("id", parsedId.data)
    .maybeSingle();

  if (studentError) {
    console.error("Unable to load student details.", studentError.message);
    return <StudentDetailsError locale={locale} />;
  }
  if (!student) notFound();

  const [classResult, firstVoucherPage] = await Promise.all([
    supabase.from("classes").select("class_name").eq("id", student.class_id).maybeSingle(),
    supabase
      .from("fee_voucher_directory")
      .select("id, voucher_number, fee_month, fee_year, total_fee, amount_paid, remaining_balance, currency, due_date, status")
      .eq("student_id", parsedId.data)
      .order("fee_year", { ascending: false })
      .order("fee_month", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 499),
  ]);

  if (classResult.error || firstVoucherPage.error) {
    const migrationMessage = getMissingFeeVoucherDirectoryMessage(firstVoucherPage.error);
    if (migrationMessage) {
      console.warn("Student fee history requires a Supabase migration.", migrationMessage);
      return <StudentDetailsError message={migrationMessage} locale={locale} />;
    }
    console.error(
      "Unable to load student class or fee history.",
      classResult.error?.message ?? firstVoucherPage.error?.message,
    );
    return <StudentDetailsError locale={locale} />;
  }

  const vouchers: VoucherRow[] = firstVoucherPage.data ?? [];
  let voucherOffset = 500;
  while (vouchers.length >= voucherOffset) {
    const { data, error } = await supabase
      .from("fee_voucher_directory")
      .select("id, voucher_number, fee_month, fee_year, total_fee, amount_paid, remaining_balance, currency, due_date, status")
      .eq("student_id", parsedId.data)
      .order("fee_year", { ascending: false })
      .order("fee_month", { ascending: false })
      .order("id", { ascending: false })
      .range(voucherOffset, voucherOffset + 499);

    if (error) {
      const migrationMessage = getMissingFeeVoucherDirectoryMessage(error);
      if (migrationMessage) {
        console.warn("Student fee history requires a Supabase migration.", migrationMessage);
        return <StudentDetailsError message={migrationMessage} locale={locale} />;
      }
      console.error("Unable to load student fee voucher history.", error.message);
      return <StudentDetailsError locale={locale} />;
    }

    const page: VoucherRow[] = data ?? [];
    vouchers.push(...page);
    if (page.length < 500) break;
    voucherOffset += 500;
  }
  const payments: PaymentRow[] = [];
  const voucherIds = vouchers.map((voucher) => voucher.id);

  for (let index = 0; index < voucherIds.length; index += 200) {
    const batch = voucherIds.slice(index, index + 200);
    for (let from = 0; ; from += 500) {
      const { data, error } = await supabase
        .from("payments")
        .select("id, voucher_id, receipt_number, payment_amount, currency, payment_date, payment_method")
        .in("voucher_id", batch)
        .order("payment_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + 499);

      if (error) {
        console.error("Unable to load student payment history.", error.message);
        return <StudentDetailsError locale={locale} />;
      }

      const page: PaymentRow[] = data ?? [];
      payments.push(...page);
      if (page.length < 500) break;
    }
  }

  const voucherById = new Map(vouchers.map((voucher) => [voucher.id, voucher]));
  const outstandingBalance = vouchers.reduce(
    (total, voucher) => total + Number(voucher.remaining_balance),
    0,
  );
  const className = classResult.data?.class_name ?? t.classUnavailable;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/students" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-700">
            <ArrowLeft aria-hidden="true" size={14} />
            {t.studentDirectory}
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <UserRound aria-hidden="true" size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">{student.full_name}</h1>
              <p className="mt-0.5 text-sm text-slate-500">{t.rollNumber} {student.roll_number} · {className} · {t.classLabel} {student.section}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Link
            href={`/students/${student.id}/edit`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Edit3 aria-hidden="true" size={15} />
            {t.editStudent}
          </Link>
          <StudentStatusButton
            studentId={student.id}
            status={student.status}
            studentName={student.full_name}
          />
        </div>
      </div>

      {query.created === "1" || query.updated === "1" ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {query.created === "1" ? t.studentAddedSuccessfully : t.studentDetailsUpdated}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t.monthlyFee}
          value={formatAmount(Number(student.monthly_fee_amount), student.currency)}
          icon={<CreditCard aria-hidden="true" size={18} />}
          color="indigo"
        />
        <SummaryCard
          label={t.outstanding}
          value={formatAmount(outstandingBalance, student.currency)}
          icon={<FileText aria-hidden="true" size={18} />}
          color={outstandingBalance > 0 ? "amber" : "emerald"}
        />
        <SummaryCard
          label={t.feeVouchers}
          value={vouchers.length.toLocaleString()}
          icon={<CalendarDays aria-hidden="true" size={18} />}
          color="sky"
        />
        <SummaryCard
          label={t.finance}
          value={payments.length.toLocaleString()}
          icon={<CreditCard aria-hidden="true" size={18} />}
          color="violet"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">{t.studentInformation}</h2>
              <p className="mt-1 text-xs text-slate-500">{t.studentProfileAndEnrollment}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
              student.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}>
              {student.status === "active" ? t.active : t.inactive}
            </span>
          </div>
          <dl className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2">
            <InfoItem label={t.fullName} value={student.full_name} />
            <InfoItem label={t.rollNumber} value={student.roll_number} />
            <InfoItem label={t.classLabel} value={`${className} · ${student.section}`} />
            <InfoItem label={t.guardianContact} value={student.guardian_contact} icon={<Phone aria-hidden="true" size={14} />} />
            <InfoItem label={t.enrollmentDate} value={formatDate(student.enrollment_date)} />
            <InfoItem label={t.studentStatus} value={student.status === "active" ? t.active : t.inactive} />
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-[15px] font-semibold text-slate-900">{t.feeVoucherHistory}</h2>
            <p className="mt-1 text-xs text-slate-500">{t.issuedVouchersAndBalances}</p>
          </div>
          {vouchers.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {vouchers.map((voucher) => (
                <div key={voucher.id} className="flex items-center gap-3 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <FileText aria-hidden="true" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{voucher.voucher_number}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{period(voucher.fee_month, voucher.fee_year)} · {t.due} {formatDate(voucher.due_date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatAmount(Number(voucher.total_fee), voucher.currency)}
                    </p>
                    <div className="mt-1 flex justify-end"><StatusBadge status={voucher.status} /></div>
                    {Number(voucher.remaining_balance) > 0 ? (
                      <p className="mt-1 text-[10px] text-amber-700">
                        {t.due} {formatAmount(Number(voucher.remaining_balance), voucher.currency)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <HistoryEmpty text={t.noStudentVouchers} />
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-[15px] font-semibold text-slate-900">{t.paymentHistory}</h2>
          <p className="mt-1 text-xs text-slate-500">{t.paymentsAgainstVouchers}</p>
        </div>
        {payments.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="py-3 pr-4">{t.receipt}</th>
                  <th className="px-4 py-3">{t.feeVoucher}</th>
                  <th className="px-4 py-3">{t.date}</th>
                  <th className="px-4 py-3">{t.method}</th>
                  <th className="py-3 pl-4 text-right">{t.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="text-sm">
                    <td className="py-3.5 pr-4 font-semibold text-slate-800">{payment.receipt_number}</td>
                    <td className="px-4 py-3.5 text-slate-600">{voucherById.get(payment.voucher_id)?.voucher_number ?? t.voucherUnavailable}</td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-3.5 capitalize text-slate-600">{payment.payment_method.replaceAll("_", " ")}</td>
                    <td className="py-3.5 pl-4 text-right font-semibold tabular-nums text-slate-800">
                      {formatAmount(Number(payment.payment_amount), payment.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <HistoryEmpty text={t.noStudentPayments} />
        )}
      </section>
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
  color: "indigo" | "amber" | "emerald" | "sky" | "violet";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
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

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1.5 flex items-center gap-1.5 break-words text-sm font-medium text-slate-800">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {value}
      </dd>
    </div>
  );
}

function HistoryEmpty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}

function StudentDetailsError({ message, locale = "en" }: { message?: string; locale?: "en" | "ur" }) {
  const t = getTranslations(locale);

  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">{t.studentInformationUnavailable}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {message ?? t.couldNotLoadStudent}
      </p>
      <Link href="/students" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        <ArrowLeft aria-hidden="true" size={15} />
        {t.backToStudentDirectory}
      </Link>
    </section>
  );
}
