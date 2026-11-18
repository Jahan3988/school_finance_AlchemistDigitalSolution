"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { useDashboardToast } from "@/components/dashboard-shell";
import { getTranslations } from "@/i18n/locales";
import { useLanguage } from "@/i18n/provider";
import {
  createStudent,
  updateStudent,
} from "./actions";
import type { StudentActionState } from "@/lib/validations/student";

type StudentClass = {
  id: string;
  class_name: string;
  section: string;
};

export type StudentFormValues = {
  id: string;
  full_name: string;
  roll_number: string;
  class_name: string;
  section: string;
  monthly_fee_amount: string;
  guardian_contact: string;
  enrollment_date: string;
  status: "active" | "inactive";
};

const initialState: StudentActionState = {};

function FieldError({ errors, name }: { errors: StudentActionState["fieldErrors"]; name: keyof NonNullable<StudentActionState["fieldErrors"]> }) {
  const message = errors?.[name]?.[0];
  return message ? (
    <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-rose-600">
      {message}
    </p>
  ) : null;
}

export function StudentForm({
  classes,
  student,
}: {
  classes: StudentClass[];
  student?: StudentFormValues;
}) {
  const isEditing = Boolean(student);
  const action = student
    ? updateStudent.bind(null, student.id)
    : createStudent;
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const showToast = useDashboardToast();
  const { locale } = useLanguage();
  const t = getTranslations(locale);
  const [className, setClassName] = useState(student?.class_name ?? "");

  useEffect(() => {
    if (state.success && state.studentId) {
      showToast(state.success);
      router.push(`/students/${state.studentId}?${isEditing ? "updated" : "created"}=1`);
    }
  }, [isEditing, router, showToast, state]);

  const fieldClassName =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        const statusInput = event.currentTarget.elements.namedItem("status");
        if (
          student?.status === "active" &&
          statusInput instanceof HTMLSelectElement &&
          statusInput.value === "inactive" &&
          !window.confirm(t.deactivateStudent.replace("{name}", student.full_name))
        ) {
          event.preventDefault();
        }
      }}
    >
      {state.error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <section className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          {t.fullName}
          <input
            name="full_name"
            autoComplete="name"
            required
            maxLength={160}
            defaultValue={student?.full_name}
            aria-invalid={Boolean(state.fieldErrors?.full_name)}
            aria-describedby={state.fieldErrors?.full_name ? "full_name-error" : undefined}
            className={fieldClassName}
            placeholder="e.g. Amina Rahimi"
          />
          <FieldError errors={state.fieldErrors} name="full_name" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.rollNumber}
          <input
            name="roll_number"
            required
            maxLength={40}
            defaultValue={student?.roll_number}
            aria-invalid={Boolean(state.fieldErrors?.roll_number)}
            aria-describedby={state.fieldErrors?.roll_number ? "roll_number-error" : undefined}
            className={fieldClassName}
            placeholder="e.g. 2026-014"
          />
          <FieldError errors={state.fieldErrors} name="roll_number" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.classLabel}
          <input
            name="class_name"
            list="student-class-options"
            required
            maxLength={80}
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.class_name)}
            aria-describedby={state.fieldErrors?.class_name ? "class_name-error" : undefined}
            className={fieldClassName}
            placeholder="e.g. Grade 6"
          />
          <datalist id="student-class-options">
            {[...new Set(classes.map((item) => item.class_name))].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <FieldError errors={state.fieldErrors} name="class_name" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.section}
          <input
            name="section"
            list="student-section-options"
            required
            maxLength={40}
            defaultValue={student?.section}
            aria-invalid={Boolean(state.fieldErrors?.section)}
            aria-describedby={state.fieldErrors?.section ? "section-error" : undefined}
            className={fieldClassName}
            placeholder="e.g. A"
          />
          <datalist id="student-section-options">
            {[...new Set(
              classes
                .filter((item) => item.class_name.toLocaleLowerCase() === className.trim().toLocaleLowerCase())
                .map((item) => item.section),
            )].map((section) => (
              <option key={section} value={section} />
            ))}
          </datalist>
          <FieldError errors={state.fieldErrors} name="section" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.monthlyFee}
          <input
            name="monthly_fee_amount"
            type="number"
            inputMode="decimal"
            min="0"
            max="9999999999.99"
            step="0.01"
            required
            defaultValue={student?.monthly_fee_amount ?? "0"}
            aria-invalid={Boolean(state.fieldErrors?.monthly_fee_amount)}
            aria-describedby={state.fieldErrors?.monthly_fee_amount ? "monthly_fee_amount-error" : "monthly-fee-hint"}
            className={fieldClassName}
          />
          <span id="monthly-fee-hint" className="mt-1.5 block text-xs font-normal text-slate-500">
            {t.nonNegativeFeeHint}
          </span>
          <FieldError errors={state.fieldErrors} name="monthly_fee_amount" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.guardianContact}
          <input
            name="guardian_contact"
            type="tel"
            autoComplete="tel"
            required
            maxLength={80}
            defaultValue={student?.guardian_contact}
            aria-invalid={Boolean(state.fieldErrors?.guardian_contact)}
            aria-describedby={state.fieldErrors?.guardian_contact ? "guardian_contact-error" : undefined}
            className={fieldClassName}
            placeholder={t.phoneNumberOrEmail}
          />
          <FieldError errors={state.fieldErrors} name="guardian_contact" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.enrollmentDate}
          <input
            name="enrollment_date"
            type="date"
            required
            defaultValue={student?.enrollment_date ?? new Date().toISOString().slice(0, 10)}
            aria-invalid={Boolean(state.fieldErrors?.enrollment_date)}
            aria-describedby={state.fieldErrors?.enrollment_date ? "enrollment_date-error" : undefined}
            className={fieldClassName}
          />
          <FieldError errors={state.fieldErrors} name="enrollment_date" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t.studentStatus}
          <select
            name="status"
            defaultValue={student?.status ?? "active"}
            aria-invalid={Boolean(state.fieldErrors?.status)}
            aria-describedby={state.fieldErrors?.status ? "status-error" : undefined}
            className={fieldClassName}
          >
            <option value="active">{t.active}</option>
            <option value="inactive">{t.inactive}</option>
          </select>
          <FieldError errors={state.fieldErrors} name="status" />
        </label>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
        <Link
          href={student ? `/students/${student.id}` : "/students"}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {t.cancel}
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
          ) : (
            <Save aria-hidden="true" size={16} />
          )}
          {pending ? t.saving : isEditing ? t.saveChanges : t.addStudent}
        </button>
      </div>
    </form>
  );
}
