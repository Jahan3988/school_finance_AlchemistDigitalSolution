import { LoaderCircle } from "lucide-react";

export default function StudentsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading student records"
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-72 max-w-[70vw] animate-pulse rounded bg-slate-100" />
        </div>
        <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
          Loading students
        </span>
      </div>
      <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
