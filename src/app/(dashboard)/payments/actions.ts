"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  paymentIdSchema,
  paymentSchema,
  type PaymentActionState,
} from "@/lib/validations/payment";

export async function collectPayment(
  _previousState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  await requireDashboardAccess();

  const parsed = paymentSchema.safeParse({
    student_id: formData.get("student_id"),
    voucher_id: formData.get("voucher_id"),
    payment_amount: formData.get("payment_amount"),
    payment_date: formData.get("payment_date"),
    payment_method: formData.get("payment_method"),
    transaction_reference: formData.get("transaction_reference"),
    idempotency_key: formData.get("idempotency_key"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the payment details and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_fee_payment", {
    p_student_id: parsed.data.student_id,
    p_voucher_id: parsed.data.voucher_id,
    p_payment_amount: parsed.data.payment_amount,
    p_payment_date: new Date(`${parsed.data.payment_date}T00:00:00.000Z`).toISOString(),
    p_payment_method: parsed.data.payment_method,
    p_transaction_reference: parsed.data.transaction_reference,
    p_idempotency_key: parsed.data.idempotency_key,
  });

  if (error) {
    console.error("Unable to record the fee payment.", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "42501") {
      return { error: "You are not authorized to record payments." };
    }
    if (error.code === "23514") {
      return { error: "Payment amount exceeds the voucher's remaining balance." };
    }
    if (error.code === "23503") {
      return { error: "The selected student voucher could not be found. Refresh and try again." };
    }
    if (error.code === "22023") {
      if (
        error.message.toLowerCase().includes("payment date") &&
        error.message.toLowerCase().includes("future")
      ) {
        return { error: "Payment date cannot be in the future." };
      }
      return {
        error: "This payment submission was already used with different details. Refresh the form and try again.",
      };
    }
    if (error.code === "PGRST202") {
      return {
        error: "Payment collection is not available yet. Apply the fee collection migration and reload the Supabase schema.",
      };
    }

    return { error: "Payment could not be recorded. Please try again." };
  }

  const result = Array.isArray(data) ? data[0] : null;
  const parsedPaymentId = paymentIdSchema.safeParse(result?.payment_id);
  if (
    !result ||
    !parsedPaymentId.success ||
    typeof result.receipt_number !== "string" ||
    typeof result.duplicate_submission !== "boolean"
  ) {
    console.error("Payment collection returned an invalid result.");
    return { error: "Payment was not confirmed. Check the payment history before retrying." };
  }

  revalidatePath("/payments");
  revalidatePath("/fee-vouchers");
  revalidatePath("/");
  revalidatePath("/students");

  return {
    receiptId: parsedPaymentId.data,
    receiptNumber: result.receipt_number,
    duplicateSubmission: result.duplicate_submission,
    nextIdempotencyKey: randomUUID(),
    success: result.duplicate_submission
      ? `This payment was already recorded. Receipt ${result.receipt_number}.`
      : `Payment recorded successfully. Receipt ${result.receipt_number}.`,
  };
}
