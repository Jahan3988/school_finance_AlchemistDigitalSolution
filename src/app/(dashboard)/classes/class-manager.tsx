"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useDashboardToast } from "@/components/dashboard-shell";
import type { SchoolClassActionState } from "@/lib/validations/class";
import { createClass, deleteClass, updateClass } from "./actions";

type SchoolClass = {
  id: string;
  class_name: string;
  section: string;
};

const initialState: SchoolClassActionState = {};
const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

export function ClassManager({ classes }: { classes: SchoolClass[] }) {
  const [state, formAction, pending] = useActionState(createClass, initialState);
  const router = useRouter();
  const showToast = useDashboardToast();

  useEffect(() => {
    if (!state.success) return;
    showToast(state.success);
    router.refresh();
  }, [router, showToast, state.success]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-slate-900">Add a class or section</h2>
          <p className="mt-1 text-xs text-slate-500">Each class and section combination must be unique.</p>
        </div>
        <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-semibold text-slate-600">
            Class name
            <input name="class_name" required maxLength={80} className={`mt-1.5 ${inputClass}`} placeholder="e.g. Grade 6" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Section
            <input name="section" required maxLength={40} className={`mt-1.5 ${inputClass}`} placeholder="e.g. A" />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <Plus aria-hidden="true" size={16} />}
            {pending ? "Adding..." : "Add class"}
          </button>
        </form>
        {state.error ? <p role="alert" className="mt-3 text-sm text-rose-700">{state.error}</p> : null}
        {state.success ? <p role="status" className="mt-3 text-sm text-emerald-700">{state.success}</p> : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Classes and sections</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {classes.length.toLocaleString()}
          </span>
        </div>
        {classes.length ? (
          classes.map((schoolClass) => (
            <ClassRow key={schoolClass.id} schoolClass={schoolClass} />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No classes or sections yet. Add one above or enter a class while adding a student.
          </div>
        )}
      </section>
    </div>
  );
}

function ClassRow({ schoolClass }: { schoolClass: SchoolClass }) {
  const [updateState, updateAction, updating] = useActionState(
    updateClass.bind(null, schoolClass.id),
    initialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteClass.bind(null, schoolClass.id),
    initialState,
  );
  const router = useRouter();
  const showToast = useDashboardToast();

  useEffect(() => {
    if (!updateState.success) return;
    showToast(updateState.success);
    router.refresh();
  }, [router, showToast, updateState.success]);

  useEffect(() => {
    if (!deleteState.success) return;
    showToast(deleteState.success);
    router.refresh();
  }, [deleteState.success, router, showToast]);

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30 sm:p-5">
      <form action={updateAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-semibold text-slate-600">
          Class name
          <input name="class_name" required maxLength={80} defaultValue={schoolClass.class_name} className={`mt-1.5 ${inputClass}`} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Section
          <input name="section" required maxLength={40} defaultValue={schoolClass.section} className={`mt-1.5 ${inputClass}`} />
        </label>
        <button
          type="submit"
          disabled={updating}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {updating ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <Save aria-hidden="true" size={16} />}
          Save
        </button>
      </form>
      {updateState.error ? <p role="alert" className="mt-3 text-sm text-rose-700">{updateState.error}</p> : null}
      {deleteState.error ? <p role="alert" className="mt-3 text-sm text-rose-700">{deleteState.error}</p> : null}
      {updateState.success ? <p role="status" className="mt-3 text-sm text-emerald-700">{updateState.success}</p> : null}
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`Delete ${schoolClass.class_name} · ${schoolClass.section}?`)) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            disabled={deleting}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
          >
            {deleting ? <LoaderCircle aria-hidden="true" size={14} className="animate-spin" /> : <Trash2 aria-hidden="true" size={14} />}
            Delete class/section
          </button>
        </form>
      </div>
    </article>
  );
}
