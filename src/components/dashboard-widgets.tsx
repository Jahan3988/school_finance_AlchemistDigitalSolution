import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  CreditCard,
  Users,
  Wallet,
} from "lucide-react";
import type { CurrencyTotal } from "@/lib/supabase/dashboard-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const currencyAmountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(amount: number, _currency?: string) {
  // All school financial values are denominated in PKR.
  void _currency;
  return `PKR ${currencyAmountFormatter.format(amount)}`;
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  accent: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const accentClasses = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    sky: "bg-sky-50 text-sky-600 ring-sky-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  }[accent];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5 text-slate-500">{label}</p>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accentClasses}`}>
          <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-5 break-words text-[clamp(1.35rem,2vw,1.8rem)] font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

export function FeeMetrics({
  totalStudents,
  expectedFees,
  collectedThisMonth,
  pendingAmount,
  overdueAmount,
  defaultersCount,
  primaryCurrency,
}: {
  totalStudents: number;
  expectedFees: CurrencyTotal[];
  collectedThisMonth: CurrencyTotal[];
  pendingAmount: CurrencyTotal[];
  overdueAmount: CurrencyTotal[];
  defaultersCount: number;
  primaryCurrency: string;
}) {
  const numberOf = (totals: CurrencyTotal[]) =>
    totals.find((item) => item.currency === primaryCurrency)?.amount ?? 0;
  const otherCurrencyNote = (totals: CurrencyTotal[]) =>
    totals.some((item) => item.currency !== primaryCurrency)
      ? `Other currencies are not converted`
      : null;

  const cards = [
    {
      label: "Total registered students",
      value: numberFormatter.format(totalStudents),
      description: "All student records",
      icon: Users,
      accent: "indigo" as const,
    },
    {
      label: "Total expected fee (current month)",
      value: formatAmount(numberOf(expectedFees), primaryCurrency),
      description: otherCurrencyNote(expectedFees) ?? "Active students' monthly fee estimate",
      icon: Wallet,
      accent: "sky" as const,
    },
    {
      label: "Total collected fee (current month)",
      value: formatAmount(numberOf(collectedThisMonth), primaryCurrency),
      description: otherCurrencyNote(collectedThisMonth) ?? "Payments recorded this month",
      icon: ArrowUpRight,
      accent: "emerald" as const,
    },
    {
      label: "Total pending amount",
      value: formatAmount(numberOf(pendingAmount), primaryCurrency),
      description: otherCurrencyNote(pendingAmount) ?? "Balances on vouchers not yet overdue",
      icon: CreditCard,
      accent: "amber" as const,
    },
    {
      label: "Total overdue amount",
      value: formatAmount(numberOf(overdueAmount), primaryCurrency),
      description: otherCurrencyNote(overdueAmount) ?? "Outstanding past-due balances",
      icon: ArrowDownRight,
      accent: "rose" as const,
    },
    {
      label: "Defaulters count",
      value: numberFormatter.format(defaultersCount),
      description: "Students with overdue vouchers",
      icon: CircleAlert,
      accent: "violet" as const,
    },
  ];

  return (
    <section aria-label="School fee metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <CircleAlert aria-hidden="true" size={18} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
      : status === "partially_paid" || status === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-600/10"
        : status === "unpaid"
          ? "bg-slate-100 text-slate-700 ring-slate-500/10"
          : "bg-rose-50 text-rose-700 ring-rose-600/10";
  const label = status.replaceAll("_", " ");

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${tone}`}>
      {label}
    </span>
  );
}
