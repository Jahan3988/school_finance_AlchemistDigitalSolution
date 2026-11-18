import "server-only";

import { z } from "zod";
import {
  getMissingDashboardSummaryMessage,
  getMissingFeeVoucherDirectoryMessage,
  getMissingPaymentReceiptDirectoryMessage,
} from "./migration-errors";
import { createClient } from "./server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Numeric = number | string;

export type CurrencyTotal = {
  currency: string;
  amount: number;
};

export type DashboardData = {
  generatedAt: string;
  primaryCurrency: string;
  totalStudents: number;
  expectedFees: CurrencyTotal[];
  collectedThisMonth: CurrencyTotal[];
  pendingAmount: CurrencyTotal[];
  overdueAmount: CurrencyTotal[];
  defaultersCount: number;
  monthlyCollection: { month: string; amount: number }[];
  paymentStatuses: { label: string; value: number }[];
  recentPayments: {
    id: string;
    studentName: string;
    voucherNumber: string;
    receiptNumber: string;
    amount: number;
    currency: string;
    paymentDate: string;
    paymentMethod: string;
  }[];
  recentVouchers: {
    id: string;
    studentName: string;
    voucherNumber: string;
    period: string;
    amount: number;
    currency: string;
    status: string;
    dueDate: string;
  }[];
  defaulters: {
    studentId: string;
    studentName: string;
    rollNumber: string;
    className: string;
    overdueVouchers: number;
    amounts: CurrencyTotal[];
  }[];
};

export type DashboardDataResult =
  | { data: DashboardData; error: null }
  | { data: null; error: string };

const numericSchema = z.coerce.number().finite().nonnegative();

const dashboardSummarySchema = z.object({
  total_expected_fee: numericSchema,
  total_collected_fee: numericSchema,
  total_pending_amount: numericSchema,
  total_overdue_amount: numericSchema,
  defaulters_count: numericSchema,
  total_students: numericSchema,
  monthly_collection: z.array(z.object({
    month: z.string(),
    amount: numericSchema,
  })),
  payment_statuses: z.array(z.object({
    label: z.enum(["Paid", "Overdue", "Pending"]),
    value: numericSchema,
  })),
  defaulters: z.array(z.object({
    studentId: z.uuid(),
    studentName: z.string(),
    rollNumber: z.string(),
    className: z.string(),
    section: z.string(),
    overdueVouchers: numericSchema,
    amount: numericSchema,
  })),
});

type RecentPaymentRow = {
  id: string;
  student_name: string;
  voucher_number: string;
  receipt_number: string;
  payment_amount: Numeric;
  currency: string;
  payment_date: string;
  payment_method: string;
};

type RecentVoucherRow = {
  id: string;
  student_name: string;
  voucher_number: string;
  fee_month: number;
  fee_year: number;
  total_fee: Numeric;
  currency: string;
  status: string;
  due_date: string;
};

function toAmount(value: Numeric): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function pkrTotal(amount: number): CurrencyTotal[] {
  return [{ currency: "PKR", amount }];
}

export async function getDashboardData(
  supabase: SupabaseClient,
): Promise<DashboardDataResult> {
  const now = new Date();
  const [
    summaryResult,
    recentPaymentsResult,
    recentVouchersResult,
  ] = await Promise.all([
    supabase.rpc("get_school_dashboard_summary", {
      p_month: now.getUTCMonth() + 1,
      p_year: now.getUTCFullYear(),
    }),
    supabase
      .from("payment_receipt_directory")
      .select(
        "id, student_name, voucher_number, receipt_number, payment_amount, currency, payment_date, payment_method",
      )
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(6),
    supabase
      .from("fee_voucher_directory")
      .select(
        "id, student_name, voucher_number, fee_month, fee_year, total_fee, currency, status, due_date",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(6),
  ]);

  if (summaryResult.error || recentPaymentsResult.error || recentVouchersResult.error) {
    const migrationMessage =
      getMissingDashboardSummaryMessage(summaryResult.error) ??
      getMissingPaymentReceiptDirectoryMessage(recentPaymentsResult.error) ??
      getMissingFeeVoucherDirectoryMessage(recentVouchersResult.error);

    if (migrationMessage) {
      console.warn("Dashboard requires a Supabase migration.", migrationMessage);
      return { data: null, error: migrationMessage };
    }

    for (const [context, error] of [
      ["financial summary", summaryResult.error],
      ["recent payments", recentPaymentsResult.error],
      ["recent vouchers", recentVouchersResult.error],
    ] as const) {
      if (error) {
        console.error(`Unable to load dashboard ${context}.`, error.message);
      }
    }

    return {
      data: null,
      error: "Dashboard information could not be loaded. Please try again.",
    };
  }

  const parsedSummary = dashboardSummarySchema.safeParse(summaryResult.data?.[0]);
  if (!parsedSummary.success) {
    console.error("Supabase returned an invalid dashboard summary.");
    return {
      data: null,
      error: "Dashboard information could not be loaded. Please try again.",
    };
  }

  const summary = parsedSummary.data;
  const recentPayments: RecentPaymentRow[] = recentPaymentsResult.data ?? [];
  const recentVouchers: RecentVoucherRow[] = recentVouchersResult.data ?? [];

  return {
    data: {
      generatedAt: now.toISOString(),
      primaryCurrency: "PKR",
      totalStudents: summary.total_students,
      expectedFees: pkrTotal(summary.total_expected_fee),
      collectedThisMonth: pkrTotal(summary.total_collected_fee),
      pendingAmount: pkrTotal(summary.total_pending_amount),
      overdueAmount: pkrTotal(summary.total_overdue_amount),
      defaultersCount: summary.defaulters_count,
      monthlyCollection: summary.monthly_collection,
      paymentStatuses: summary.payment_statuses,
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        studentName: payment.student_name,
        voucherNumber: payment.voucher_number,
        receiptNumber: payment.receipt_number,
        amount: toAmount(payment.payment_amount),
        currency: "PKR",
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method,
      })),
      recentVouchers: recentVouchers.map((voucher) => ({
        id: voucher.id,
        studentName: voucher.student_name,
        voucherNumber: voucher.voucher_number,
        period: `${new Intl.DateTimeFormat("en", {
          month: "short",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(voucher.fee_year, voucher.fee_month - 1, 1)))} ${voucher.fee_year}`,
        amount: toAmount(voucher.total_fee),
        currency: "PKR",
        status: voucher.status,
        dueDate: voucher.due_date,
      })),
      defaulters: summary.defaulters.map((defaulter) => ({
        studentId: defaulter.studentId,
        studentName: defaulter.studentName,
        rollNumber: defaulter.rollNumber,
        className: `${defaulter.className} · ${defaulter.section}`,
        overdueVouchers: defaulter.overdueVouchers,
        amounts: pkrTotal(defaulter.amount),
      })),
    },
    error: null,
  };
}
