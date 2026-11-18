import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { connection } from "next/server";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { StudentForm } from "../student-form";

export default async function NewStudentPage() {
  await connection();
  await requireStudentManagementAccess();
  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, class_name, section")
    .order("class_name", { ascending: true })
    .order("section", { ascending: true });

  if (error) {
    console.error("Unable to load class suggestions for a new student.", error.message);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/students" className="hover:text-indigo-700">Students</Link>
        <ChevronRight aria-hidden="true" size={13} />
        <span className="text-indigo-700">Add student</span>
      </div>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-7">
        <div className="mb-6 border-b border-slate-100 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-950">Add a student</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter the student’s personal, class, and fee information.
          </p>
        </div>
        {error ? (
          <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Existing class suggestions could not be loaded. You can still enter a class and section.
          </div>
        ) : null}
        <StudentForm classes={classes ?? []} />
      </section>
    </div>
  );
}
