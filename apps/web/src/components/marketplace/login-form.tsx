"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/(main)/actions";
import { GoogleAuthForm } from "@/components/marketplace/google-auth-form";
import { PasswordField } from "@/components/marketplace/password-field";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function LoginForm({
  nextPath,
  adminMode = false,
}: {
  nextPath: string;
  adminMode?: boolean;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="grid gap-6">
      {!adminMode ? (
        <GoogleAuthForm nextPath={nextPath} mode="signin" />
      ) : null}

      <form action={formAction} className="panel">
        <input type="hidden" name="next" value={nextPath} />

        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-bold">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="surface-input w-full text-sm"
              placeholder="you@example.com"
            />
            {state.fieldErrors?.email ? (
              <p className="text-sm text-red-700">{state.fieldErrors.email}</p>
            ) : null}
          </label>

          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={state.fieldErrors?.password}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="inline-flex items-center gap-2 font-semibold text-[var(--muted)]">
              <input
                type="checkbox"
                name="rememberMe"
                value="true"
                className="h-4 w-4 accent-[var(--brand)]"
              />
              Remember me
            </label>
            {!adminMode ? (
              <Link href="/forgot-password" className="font-bold text-[var(--brand-strong)]">
                Forgot password?
              </Link>
            ) : null}
          </div>
        </div>

        {state.message ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="action-primary px-4 py-3 text-sm font-bold disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
          {!adminMode ? (
            <>
              <Link
                href={`/register${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
                className="action-secondary px-4 py-3 text-sm font-bold"
              >
                Create account
              </Link>
              <Link
                href={`/register${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}#seller-signup`}
                className="action-secondary px-4 py-3 text-sm font-bold"
              >
                Create seller account
              </Link>
              <Link
                href={nextPath === "/login" ? "/" : nextPath}
                className="action-secondary px-4 py-3 text-sm font-bold"
              >
                Continue as guest
              </Link>
            </>
          ) : null}
        </div>
      </form>
    </div>
  );
}
