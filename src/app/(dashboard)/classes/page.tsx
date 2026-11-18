import { connection } from "next/server";
import Link from "next/link";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ClassManager } from "./class-manager";

export default async function ClassesPage() {
  await connection();
  await requireStudentManagementAccess();

  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, class_name, section")
    .order("class_name", { ascending: true })
    .order("section", { ascending: true });

  if (error) {
    console.error("Unable to load classes and sections.", error.message);
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Classes are unavailable</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Class and section records could not be loaded. Check your connection and try again.
        </p>
        <Link href="/classes" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Try again
        </Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <section>
        <p className="mb-2 text-xs font-medium text-slate-500">School</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">
          Classes &amp; sections
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Create, rename, and remove class placements used by student records.
        </p>
      </section>
      <ClassManager classes={classes ?? []} />
    </div>
  );
}
