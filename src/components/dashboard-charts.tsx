"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, formatAmount } from "@/components/dashboard-widgets";

const statusColors = ["#10b981", "#f59e0b", "#cbd5e1"];

export function MonthlyCollectionChart({
  data,
  currency,
}: {
  data: { month: string; amount: number }[];
  currency: string;
}) {
  if (!data.some((item) => item.amount > 0)) {
    return (
      <EmptyState
        title="No collections recorded yet"
        description="Payments recorded in the last six months will appear here."
      />
    );
  }

  const axisFormat = (value: number) =>
    value >= 1_000_000
      ? `${currency} ${(value / 1_000_000).toFixed(1)}m`
      : value >= 10_000
        ? `${currency} ${(value / 1_000).toFixed(0)}k`
        : `${currency} ${Math.round(value)}`;

  return (
    <div
      className="h-[270px] w-full pt-5"
      role="img"
      aria-label={`Monthly fee collection in ${currency} over the last six months`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickFormatter={axisFormat}
            width={72}
          />
          <Tooltip
            formatter={(value) => [formatAmount(Number(value), currency), "Collected"]}
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.1)",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            name="Collected"
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#collectionFill)"
            activeDot={{ r: 5, strokeWidth: 0, fill: "#4338ca" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentStatusChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No fee vouchers yet"
        description="Voucher payment statuses will appear once fees are issued."
      />
    );
  }

  return (
    <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.9fr)]">
      <div
        className="relative mx-auto h-[220px] w-full max-w-[260px]"
        role="img"
        aria-label={`Voucher status: ${data.map((item) => `${item.label} ${item.value}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={66}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((item, index) => (
                <Cell key={item.label} fill={statusColors[index % statusColors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [Number(value).toLocaleString(), name]}
              contentStyle={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.1)",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {total.toLocaleString()}
          </span>
          <span className="mt-0.5 text-[11px] font-medium text-slate-500">vouchers</span>
        </div>
      </div>
      <ul className="space-y-4 pb-2">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2.5 text-xs font-medium text-slate-600">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: statusColors[index % statusColors.length] }}
              />
              {item.label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              {item.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
