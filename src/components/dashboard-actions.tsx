"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/provider";

export function DashboardActions() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={() => router.push("/fee-vouchers")}
        variant="outline"
        className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
      >
        {t("createVoucher")}
      </Button>
      <Button
        type="button"
        onClick={() => router.push("/payments")}
        className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 focus-visible:ring-indigo-600"
      >
        {t("recordPayment")}
      </Button>
    </div>
  );
}

export function RetryDashboardButton() {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-4 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:ring-indigo-600"
    >
      {t("tryAgain")}
    </Button>
  );
}
