"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { login } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { useTranslation } from "@/i18n/provider";

const rememberedEmailKey = "northstar.remembered-email";

export function LoginForm() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const { setValue } = form;
  const serverError = errors.root?.server?.message;
  const errorMessage = searchParams.get("error");
  const authError =
    errorMessage === "auth-required"
      ? t("signIn")
      : errorMessage === "session-expired"
        ? "Your session expired. Please sign in again."
        : errorMessage === "oauth"
          ? "Google sign-in could not be completed. Please try again."
          : null;
  const successMessage =
    searchParams.get("message") === "signed-out"
      ? "You have been signed out successfully."
      : searchParams.get("message") === "password-updated"
        ? "Your password was updated. Sign in with your new password."
        : null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedEmail = window.localStorage.getItem(rememberedEmailKey);
        if (savedEmail) {
          setValue("email", savedEmail);
          setRememberEmail(true);
        }
      } catch (error) {
        console.error("Unable to read the remembered email preference.", error);
      }

    });

    return () => window.cancelAnimationFrame(frame);
  }, [setValue]);

  useEffect(() => {
    if (errorMessage !== "session-expired") return;

    void createClient()
      .auth.signOut({ scope: "local" })
      .then(({ error }) => {
        if (error) {
          console.error("Unable to clear the expired browser session.", error.message);
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to clear the expired browser session.", error);
      });
  }, [errorMessage]);

  async function onSubmit(values: LoginInput) {
    form.clearErrors("root.server");
    setGoogleError(null);
    try {
      if (rememberEmail) {
        window.localStorage.setItem(rememberedEmailKey, values.email);
      } else {
        window.localStorage.removeItem(rememberedEmailKey);
      }
    } catch (error) {
      console.error("Unable to save the remembered email preference.", error);
    }

    const result = await login(values);

    if (result?.error) {
      form.setError("root.server", { type: "server", message: result.error });
    }
  }

  async function signInWithGoogle() {
    setGoogleError(null);
    form.clearErrors("root.server");
    setGooglePending(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) {
        console.error("Unable to start Google sign-in.", error.message);
        setGoogleError("Google sign-in is temporarily unavailable. Please try again.");
      }
    } catch (error) {
      console.error("Google sign-in request failed.", error);
      setGoogleError("Google sign-in is temporarily unavailable. Please try again.");
    } finally {
      setGooglePending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {(serverError || authError) && (
        <div
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
          aria-live="assertive"
        >
          <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{serverError || authError}</p>
        </div>
      )}

      {successMessage && (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </p>
      )}

      {googleError && (
        <div
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{googleError}</p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold text-slate-800">
          Email address
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            {...form.register("email")}
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="you@school.edu"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 aria-[invalid=true]:border-rose-400"
            disabled={isSubmitting || googlePending}
          />
        </div>
        {errors.email && (
          <p id="email-error" className="text-xs text-rose-700">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-semibold text-slate-800">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            {...form.register("password")}
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 aria-[invalid=true]:border-rose-400"
            disabled={isSubmitting || googlePending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs text-rose-700">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || googlePending}
        aria-busy={isSubmitting || googlePending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />}
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={rememberEmail}
          onChange={(event) => setRememberEmail(event.target.checked)}
          disabled={isSubmitting || googlePending}
          className="size-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
        />
        Remember my email on this device
      </label>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium text-slate-500">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isSubmitting || googlePending}
        aria-busy={googlePending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {googlePending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
        ) : (
          <span aria-hidden="true" className="text-base font-bold text-blue-700">
            G
          </span>
        )}
        {googlePending ? "Connecting to Google..." : "Continue with Google"}
      </button>
    </form>
  );
}
