import { z } from "zod";

const paymentAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(?:\.\d{1,2})?$/,
    "Enter a positive amount with up to 2 decimal places.",
  )
  .transform(Number)
  .pipe(
    z
      .number()
      .finite()
      .positive("Payment amount must be greater than zero.")
      .max(9_999_999_999.99, "Payment amount exceeds the supported limit."),
  );

export const paymentMethods = [
  "cash",
  "bank_transfer",
  "easypaisa",
  "jazzcash",
] as const;

export const paymentSchema = z.object({
  student_id: z.uuid("Select a student."),
  voucher_id: z.uuid("Select a fee voucher."),
  payment_amount: paymentAmountSchema,
  payment_date: z
    .iso.date("Enter a valid payment date.")
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      "Payment date cannot be in the future.",
    ),
  payment_method: z.enum(paymentMethods, {
    error: "Select a supported payment method.",
  }),
  transaction_reference: z
    .string()
    .trim()
    .max(128, "Transaction reference must be 128 characters or fewer.")
    .transform((value) => value || null),
  idempotency_key: z.uuid("Refresh the payment form and try again."),
});

export const paymentIdSchema = z.uuid("Invalid payment record.");

export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentActionState = {
  error?: string;
  success?: string;
  receiptId?: string;
  receiptNumber?: string;
  duplicateSubmission?: boolean;
  nextIdempotencyKey?: string;
};
