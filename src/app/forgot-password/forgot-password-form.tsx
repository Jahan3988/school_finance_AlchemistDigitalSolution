"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, Mail } from "lucide-react";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await requestPasswordReset(email);
      if (result.error) setError(result.error);
      if (result.message) setMessage(result.message);
    } catch {
      setError("Password reset is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-800">Email address</span>
        <span className="relative block">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@school.edu"
            disabled={busy}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-70"
          />
        </span>
      </label>

      {(error || message) && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {error || message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy && <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />}
        {busy ? "Sending..." : "Send reset link"}
      </button>

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
          Return to sign in
        </Link>
      </p>
    </form>
  );
}
