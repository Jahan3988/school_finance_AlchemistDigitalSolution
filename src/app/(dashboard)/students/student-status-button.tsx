"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardToast } from "@/components/dashboard-shell";
import type { StudentStatus } from "@/lib/validations/student";
import { changeStudentStatus } from "./actions";

export function StudentStatusButton({
  studentId,
  studentName,
  status,
}: {
  studentId: string;
  studentName: string;
  status: StudentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const showToast = useDashboardToast();
  const router = useRouter();
  const nextStatus = status === "active" ? "inactive" : "active";

  function updateStatus() {
    if (
      nextStatus === "inactive" &&
      !window.confirm(`Deactivate ${studentName}? Their fee and payment history will be retained.`)
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await changeStudentStatus(studentId, nextStatus);
      if (result.error) {
        setError(result.error);
        showToast(result.error);
        return;
      }

      showToast(result.success ?? "Student status updated.");
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={updateStatus}
        aria-label={`${status === "active" ? "Deactivate" : "Reactivate"} ${studentName}`}
        className={`text-xs font-semibold transition disabled:opacity-50 ${
          status === "active"
            ? "text-slate-500 hover:text-rose-700"
            : "text-indigo-700 hover:text-indigo-900"
        }`}
      >
        {pending ? <LoaderCircle aria-hidden="true" size={14} className="animate-spin" /> : status === "active" ? "Deactivate" : "Reactivate"}
      </button>
      {error ? <span role="alert" className="sr-only">{error}</span> : null}
    </span>
  );
}
