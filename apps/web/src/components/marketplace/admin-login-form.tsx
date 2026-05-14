"use client";

import Link from "next/link";
import { useActionState } from "react";
import { adminLoginAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function AdminLoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(
    adminLoginAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="next" value={nextPath} />

      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Admin email
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
            placeholder="admin@example.com"
          />
          {state.fieldErrors?.email ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.email}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Password
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
            placeholder="Enter admin password"
          />
          {state.fieldErrors?.password ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.password}</p>
          ) : null}
        </label>
      </div>

      {state.message ? (
        <p className="mt-4 rounded-2xl border border-[rgba(185,56,32,0.18)] bg-[rgba(255,243,240,0.95)] px-4 py-3 text-sm text-[#8f2e1c]">
          {state.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Signing in..." : "Sign in as admin"}
        </button>
        <Link
          href="/login"
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          Regular login
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
        >
          Forgot password
        </Link>
      </div>
    </form>
  );
}
