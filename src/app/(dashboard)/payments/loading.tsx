import { LoaderCircle } from "lucide-react";

export default function PaymentsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading payments" className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
        Loading payments
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
