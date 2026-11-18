"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, LoaderCircle, ReceiptText } from "lucide-react";
import { useDashboardToast } from "@/components/dashboard-shell";
import { formatAmount } from "@/components/dashboard-widgets";
import {
  paymentMethods,
  type PaymentActionState,
  type PaymentMethod,
} from "@/lib/validations/payment";
import { collectPayment } from "./actions";

export type OutstandingVoucherOption = {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  voucherNumber: string;
  feeMonth: number;
  feeYear: number;
  totalFee: number;
  amountPaid: number;
  remainingBalance: number;
  currency: string;
  dueDate: string;
};

const initialState: PaymentActionState = {};
const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
};

export function PaymentCollectionForm({
  vouchers,
  initialIdempotencyKey,
  today,
}: {
  vouchers: OutstandingVoucherOption[];
  initialIdempotencyKey: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(collectPayment, initialState);
  const idempotencyKey = state.nextIdempotencyKey ?? initialIdempotencyKey;
  const router = useRouter();
  const showToast = useDashboardToast();

  useEffect(() => {
    if (!state.success) return;
    showToast(state.success);
    router.refresh();
  }, [router, showToast, state.success]);

  return (
    <PaymentFormFields
      key={idempotencyKey}
      state={state}
      formAction={formAction}
      pending={pending}
      idempotencyKey={idempotencyKey}
      vouchers={vouchers}
      today={today}
    />
  );
}

function PaymentFormFields({
  state,
  formAction,
  pending,
  idempotencyKey,
  vouchers,
  today,
}: {
  state: PaymentActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  idempotencyKey: string;
  vouchers: OutstandingVoucherOption[];
  today: string;
}) {
  const [studentId, setStudentId] = useState(vouchers[0]?.studentId ?? "");
  const [voucherId, setVoucherId] = useState(vouchers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [transactionReference, setTransactionReference] = useState("");

  const students = Array.from(
    new Map(
      vouchers.map((voucher) => [
        voucher.studentId,
        { id: voucher.studentId, name: voucher.studentName, rollNumber: voucher.rollNumber },
      ]),
    ).values(),
  );
  const selectedStudentId = students.some((student) => student.id === studentId)
    ? studentId
    : students[0]?.id ?? "";
  const studentVouchers = vouchers.filter(
    (voucher) => voucher.studentId === selectedStudentId,
  );
  const selectedVoucherId = studentVouchers.some((voucher) => voucher.id === voucherId)
    ? voucherId
    : studentVouchers[0]?.id ?? "";
  const selectedVoucher = studentVouchers.find(
    (voucher) => voucher.id === selectedVoucherId,
  );

  const inputClass =
    "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />

      {state.error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-start gap-2">
            <ReceiptText aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p>{state.success}</p>
              {state.receiptId ? (
                <Link
                  href={`/payments/${state.receiptId}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-900 underline underline-offset-2"
                >
                  View and print receipt
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {vouchers.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Student
              <select
                name="student_id"
                required
                value={selectedStudentId}
                onChange={(event) => {
                  const nextStudent = event.target.value;
                  setStudentId(nextStudent);
                  setVoucherId(vouchers.find((voucher) => voucher.studentId === nextStudent)?.id ?? "");
                  setAmount("");
                }}
                className={inputClass}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · Roll {student.rollNumber}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Voucher number
              <select
                name="voucher_id"
                required
                value={selectedVoucherId}
                onChange={(event) => {
                  setVoucherId(event.target.value);
                  setAmount("");
                }}
                className={inputClass}
              >
                {studentVouchers.map((voucher) => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.voucherNumber} · {new Intl.DateTimeFormat("en", {
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(Date.UTC(voucher.feeYear, voucher.feeMonth - 1, 1)))} · {formatAmount(voucher.remainingBalance, voucher.currency)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Payment amount
              <input
                name="payment_amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={selectedVoucher?.remainingBalance}
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
              <span className="mt-1.5 block text-[11px] font-normal text-slate-500">
                Outstanding: {selectedVoucher
                  ? formatAmount(selectedVoucher.remainingBalance, selectedVoucher.currency)
                  : "—"}
              </span>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Payment date
              <input
                name="payment_date"
                type="date"
                max={today}
                required
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Payment method
              <select
                name="payment_method"
                value={paymentMethod}
                onChange={(event) => {
                  const method = paymentMethods.find(
                    (value) => value === event.target.value,
                  );
                  if (method) setPaymentMethod(method);
                }}
                className={inputClass}
              >
                {Object.entries(methodLabels).map(([method, label]) => (
                  <option key={method} value={method}>{label}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Transaction reference
              <input
                name="transaction_reference"
                maxLength={128}
                value={transactionReference}
                onChange={(event) => setTransactionReference(event.target.value)}
                className={inputClass}
                placeholder="Optional bank or wallet reference"
              />
            </label>
          </div>

          {selectedVoucher ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs">
              <span className="text-slate-600">
                Voucher total <strong className="font-semibold text-slate-800">{formatAmount(selectedVoucher.totalFee, selectedVoucher.currency)}</strong>
                <span className="mx-2 text-slate-300">·</span>
                Paid so far <strong className="font-semibold text-slate-800">{formatAmount(selectedVoucher.amountPaid, selectedVoucher.currency)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <ReceiptText aria-hidden="true" size={14} />
                Receipt number generated automatically
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <Banknote aria-hidden="true" size={15} className="mt-0.5 shrink-0" />
              Partial payments are supported. The database checks the latest balance before recording each payment.
            </p>
            <button
              type="submit"
              disabled={pending || !selectedVoucher}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <Banknote aria-hidden="true" size={16} />}
              {pending ? "Recording payment..." : "Record payment"}
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-slate-800">No outstanding vouchers</p>
          <p className="mt-1 text-xs text-slate-500">Generate monthly vouchers or confirm all balances have been paid.</p>
        </div>
      )}
    </form>
  );
}
