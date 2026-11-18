"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { updatePassword } from "./actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await updatePassword({ password, confirmPassword });
      if (result?.success) {
        router.replace("/login?message=password-updated");
        router.refresh();
      } else if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError("Unable to update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-800">New password</span>
        <input
          type="password"
          name="new-password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-70"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-800">Confirm new password</span>
        <input
          type="password"
          name="confirm-new-password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={busy}
          className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-70"
        />
      </label>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy && <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />}
        {busy ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
