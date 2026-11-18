import { z } from "zod";

export const voucherGenerationSchema = z.object({
  month: z.coerce
    .number()
    .int("Select a valid month.")
    .min(1, "Select a valid month.")
    .max(12, "Select a valid month."),
  year: z.coerce
    .number()
    .int("Select a valid year.")
    .min(2000, "Select a valid year.")
    .max(9999, "Select a valid year."),
  due_date: z.iso.date("Enter a valid payment due date."),
});

export const feeVoucherIdSchema = z.uuid("Invalid fee voucher.");

export const voucherStatuses = ["pending", "paid", "overdue"] as const;
export const voucherStatusSchema = z.enum(voucherStatuses);

export type VoucherGenerationState = {
  error?: string;
  success?: string;
  createdCount?: number;
  alreadyGeneratedCount?: number;
  activeStudentCount?: number;
};
