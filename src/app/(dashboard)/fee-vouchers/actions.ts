"use server";

import { revalidatePath } from "next/cache";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  voucherGenerationSchema,
  type VoucherGenerationState,
} from "@/lib/validations/fee-voucher";

export async function generateMonthlyVouchers(
  _previousState: VoucherGenerationState,
  formData: FormData,
): Promise<VoucherGenerationState> {
  await requireStudentManagementAccess();

  const parsed = voucherGenerationSchema.safeParse({
    month: formData.get("month"),
    year: formData.get("year"),
    due_date: formData.get("due_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid voucher period." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_fee_vouchers", {
    p_month: parsed.data.month,
    p_year: parsed.data.year,
    p_due_date: parsed.data.due_date,
  });

  if (error) {
    console.error("Unable to generate monthly fee vouchers.", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "42501") {
      return { error: "You are not authorized to generate fee vouchers." };
    }
    if (error.code === "PGRST202") {
      return {
        error: "Voucher generation is not available yet. Apply the monthly fee voucher migration and reload the Supabase schema.",
      };
    }

    return { error: "Voucher generation failed. Please try again." };
  }

  const result = Array.isArray(data) ? data[0] : null;
  if (
    !result ||
    !Number.isInteger(result.created_count) ||
    !Number.isInteger(result.already_generated_count) ||
    !Number.isInteger(result.active_student_count)
  ) {
    console.error("Voucher generation returned an invalid result.");
    return { error: "Voucher generation did not return a valid result. Please try again." };
  }

  revalidatePath("/fee-vouchers");
  revalidatePath("/");
  revalidatePath("/students");

  const success =
    result.active_student_count === 0
      ? "There are no active students to bill for this period."
      : result.created_count === 0
        ? `All ${result.already_generated_count} active student vouchers already exist for this period.`
        : `Generated ${result.created_count} voucher${result.created_count === 1 ? "" : "s"}.${
            result.already_generated_count > 0
              ? ` ${result.already_generated_count} already existed and were left unchanged.`
              : ""
          }`;

  return {
    success,
    createdCount: result.created_count,
    alreadyGeneratedCount: result.already_generated_count,
    activeStudentCount: result.active_student_count,
  };
}
