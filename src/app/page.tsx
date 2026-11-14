import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { OverviewChart } from "@/components/overview-chart";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Students", icon: Users },
  { label: "Fee collection", icon: CreditCard },
  { label: "Fee structure", icon: BookOpen },
];

const transactions = [
  {
    name: "Aarav Sharma",
    detail: "Grade 8 · Annual tuition",
    initials: "AS",
    color: "bg-sky-100 text-sky-700",
    amount: "$1,250.00",
    time: "Today, 10:42 AM",
    status: "Paid",
  },
  {
    name: "Mia Johnson",
    detail: "Grade 6 · Term 2",
    initials: "MJ",
    color: "bg-violet-100 text-violet-700",
    amount: "$840.00",
    time: "Today, 9:18 AM",
    status: "Paid",
  },
  {
    name: "Noah Williams",
    detail: "Grade 10 · Lab fee",
    initials: "NW",
    color: "bg-amber-100 text-amber-700",
    amount: "$320.00",
    time: "Yesterday, 3:54 PM",
    status: "Pending",
  },
];

const stats = [
  {
    label: "Total collected",
    value: "$128,450",
    change: "+12.8%",
    note: "vs. last month",
    icon: Wallet,
    tone: "text-blue-700 bg-blue-50",
  },
  {
    label: "Outstanding fees",
    value: "$24,680",
    change: "8.2%",
    note: "of total fees",
    icon: CreditCard,
    tone: "text-amber-700 bg-amber-50",
  },
  {
    label: "Students enrolled",
    value: "1,248",
    change: "+34",
    note: "since last term",
    icon: Users,
    tone: "text-violet-700 bg-violet-50",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <a href="/" className="mb-10 flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-700 text-white">
            <BookOpen aria-hidden="true" size={21} />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight">Northstar</span>
            <span className="block text-xs text-slate-500">School finance</span>
          </span>
        </a>

        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map(({ label, icon: Icon, active }) => (
            <a
              key={label}
              href="#"
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-auto space-y-1">
          <a
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <CircleHelp aria-hidden="true" size={18} />
            Help & support
          </a>
          <a
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Settings aria-hidden="true" size={18} />
            Settings
          </a>
          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 px-2 pt-5">
            <div className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              JD
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Jordan Davis</p>
              <p className="truncate text-xs text-slate-500">School administrator</p>
            </div>
            <ChevronDown aria-hidden="true" size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-xs font-medium text-slate-500">Northstar Academy</p>
            <p className="text-sm font-semibold">School administration</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              aria-label="Search"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <Search aria-hidden="true" size={19} />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <Bell aria-hidden="true" size={19} />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />
            </button>
            <div className="ml-1 flex size-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">
              JD
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-sm text-slate-500">Saturday, November 14, 2026</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Good morning, Jordan
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Here&apos;s what&apos;s happening with your school fees.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Plus aria-hidden="true" size={17} />
              Record a payment
            </button>
          </div>

          <section aria-label="Fee overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map(({ label, value, change, note, icon: Icon, tone }, index) => (
              <article
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}>
                    <Icon aria-hidden="true" size={18} />
                  </span>
                </div>
                <p className="mt-4 text-[28px] font-bold tracking-tight">{value}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  {index === 1 ? (
                    <ArrowDownLeft aria-hidden="true" size={14} className="text-amber-600" />
                  ) : (
                    <ArrowUpRight aria-hidden="true" size={14} className="text-emerald-600" />
                  )}
                  <span className="font-semibold text-slate-700">{change}</span>
                  {note}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">Fee collection</h2>
                  <p className="mt-1 text-sm text-slate-500">Payments collected over time</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
                >
                  This year
                  <ChevronDown aria-hidden="true" size={14} className="ml-2 inline" />
                </button>
              </div>
              <OverviewChart />
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">Recent payments</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest fee activity</p>
                </div>
                <a href="#" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  View all
                </a>
              </div>
              <ul className="divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <li key={transaction.name} className="flex items-center gap-3 py-4 first:pt-1">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${transaction.color}`}
                    >
                      {transaction.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{transaction.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{transaction.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{transaction.amount}</p>
                      <p
                        className={`mt-0.5 text-[11px] font-medium ${
                          transaction.status === "Paid" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {transaction.status} · {transaction.time}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
