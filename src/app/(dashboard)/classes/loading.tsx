import { LoaderCircle } from "lucide-react";

export default function ClassesLoading() {
  return (
    <div aria-busy="true" aria-label="Loading classes and sections" className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
        Loading classes and sections
      </div>
    </div>
  );
}
