export default function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard" aria-busy="true" className="animate-pulse space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="h-3 w-36 rounded bg-slate-200" />
          <div className="h-8 w-64 max-w-full rounded-lg bg-slate-200" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-10 w-48 rounded-xl bg-slate-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-36 rounded-2xl border border-slate-200/80 bg-white p-5"
          >
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="mt-6 h-7 w-36 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,1fr)]">
        <div className="h-[350px] rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-64 rounded bg-slate-100" />
          <div className="mt-10 h-56 rounded-xl bg-slate-50" />
        </div>
        <div className="h-[350px] rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-52 rounded bg-slate-100" />
          <div className="mt-8 flex justify-center">
            <div className="size-52 rounded-full bg-slate-50" />
          </div>
        </div>
      </div>
    </div>
  );
}
