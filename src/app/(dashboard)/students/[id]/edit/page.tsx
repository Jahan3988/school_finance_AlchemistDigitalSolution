import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getLocaleFromValue, getTranslations } from "@/i18n/locales";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { studentIdSchema } from "@/lib/validations/student";
import { StudentForm, type StudentFormValues } from "../../student-form";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await requireStudentManagementAccess();

  const cookieStore = await cookies();
  const locale = getLocaleFromValue(cookieStore.get("locale")?.value);
  const t = getTranslations(locale);

  const { id } = await params;
  const parsedId = studentIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const [studentResult, classesResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, roll_number, class_id, section, monthly_fee_amount, guardian_contact, enrollment_date, status")
      .eq("id", parsedId.data)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id, class_name, section")
      .order("class_name", { ascending: true })
      .order("section", { ascending: true }),
  ]);

  if (studentResult.error || classesResult.error) {
    console.error(
      "Unable to load student data for editing.",
      studentResult.error?.message ?? classesResult.error?.message,
    );
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{t.studentInformationUnavailable}</h1>
        <p className="mt-2 text-sm text-slate-500">{t.couldNotLoadStudent}</p>
        <Link href={`/students/${parsedId.data}`} className="mt-4 inline-flex text-sm font-semibold text-indigo-700">{t.backToStudentDirectory}</Link>
      </section>
    );
  }

  const student = studentResult.data;
  if (!student) notFound();

  const className = classesResult.data?.find((item) => item.id === student.class_id)?.class_name ?? "";
  const formStudent: StudentFormValues = {
    id: student.id,
    full_name: student.full_name,
    roll_number: student.roll_number,
    class_name: className,
    section: student.section,
    monthly_fee_amount: String(student.monthly_fee_amount),
    guardian_contact: student.guardian_contact,
    enrollment_date: student.enrollment_date,
    status: student.status,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/students" className="hover:text-indigo-700">{t.students}</Link>
        <ChevronRight aria-hidden="true" size={13} />
        <Link href={`/students/${student.id}`} className="hover:text-indigo-700">{student.full_name}</Link>
        <ChevronRight aria-hidden="true" size={13} />
        <span className="text-indigo-700">{t.editStudent}</span>
      </div>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-7">
        <div className="mb-6 border-b border-slate-100 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-950">{t.editStudent}</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {t.updateProfileDetails.replace("{name}", student.full_name)}
          </p>
        </div>
        <StudentForm classes={classesResult.data ?? []} student={formStudent} />
      </section>
    </div>
  );
}
