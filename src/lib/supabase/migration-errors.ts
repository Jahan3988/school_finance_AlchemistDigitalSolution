import type { PostgrestError } from "@supabase/supabase-js";

type DatabaseApiError = Pick<PostgrestError, "code" | "message">;

function missingRelationMessage(
  error: DatabaseApiError | null | undefined,
  relation: string,
  migration: string,
) {
  if (error?.code !== "PGRST205" || !error.message.includes(relation)) {
    return null;
  }

  return `The connected Supabase project is missing public.${relation}. Apply supabase/migrations/${migration} in that project, run NOTIFY pgrst, 'reload schema'; in SQL Editor, then restart the app.`;
}

function missingFunctionMessage(
  error: DatabaseApiError | null | undefined,
  functionName: string,
) {
  if (error?.code !== "PGRST202" || !error.message.includes(functionName)) {
    return null;
  }

  return `Supabase cannot find public.${functionName}. Apply the monthly-voucher and fee-collection migrations first, then supabase/migrations/20261116130000_dashboard_financial_reports.sql. Run NOTIFY pgrst, 'reload schema'; in SQL Editor afterward.`;
}

export function getMissingFeeVoucherDirectoryMessage(
  error: DatabaseApiError | null | undefined,
) {
  return missingRelationMessage(
    error,
    "fee_voucher_directory",
    "20261116110000_monthly_fee_vouchers.sql",
  );
}

export function getMissingDashboardSummaryMessage(
  error: DatabaseApiError | null | undefined,
) {
  return missingFunctionMessage(error, "get_school_dashboard_summary");
}

export function getMissingClasswiseReportMessage(
  error: DatabaseApiError | null | undefined,
) {
  return missingFunctionMessage(error, "get_classwise_collection_report");
}

export function getMissingPaymentReceiptDirectoryMessage(
  error: DatabaseApiError | null | undefined,
) {
  const message = missingRelationMessage(
    error,
    "payment_receipt_directory",
    "20261116120000_fee_collection_and_payments.sql",
  );
  return message?.replace(
    "Apply supabase/migrations/",
    "Apply the monthly-voucher migration first, then supabase/migrations/",
  ) ?? null;
}
