"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard rendering failed.", error.message);
  }, [error]);

  return (
    <section
      role="alert"
      className="rounded-2xl border border-rose-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <RotateCcw aria-hidden="true" size={21} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        This dashboard could not be displayed
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Please try again. If the problem continues, contact your system administrator.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <RotateCcw aria-hidden="true" size={15} />
        Try again
      </button>
    </section>
  );
}
