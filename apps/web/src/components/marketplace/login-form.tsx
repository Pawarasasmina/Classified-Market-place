"use client";

import Link from "next/link";
import { useActionState } from "react";
import { googleLoginAction, loginAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [googleState, googleFormAction, googlePending] = useActionState(
    googleLoginAction,
    initialState
  );

  return (
    <div className="mt-6 grid gap-6">
      <form action={formAction} className="rounded-md border border-slate-200 bg-white p-5">
        <input type="hidden" name="next" value={nextPath} />

        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              placeholder="you@example.com"
            />
            {state.fieldErrors?.email ? (
              <p className="text-sm text-red-700">{state.fieldErrors.email}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              placeholder="Enter your password"
            />
            {state.fieldErrors?.password ? (
              <p className="text-sm text-red-700">{state.fieldErrors.password}</p>
            ) : null}
          </label>
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
            className="action-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
          <Link
            href={`/register${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Create account
          </Link>
        </div>
      </form>

      <form action={googleFormAction} className="rounded-md border border-slate-200 bg-white p-5">
        <input type="hidden" name="next" value={nextPath} />
        <h2 className="text-lg font-semibold">Google login</h2>
        <div className="mt-4 grid gap-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold">Google ID token</span>
            <textarea
              name="idToken"
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              placeholder="Paste a Google credential token here"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="email"
              type="email"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Dev mode email"
            />
            <input
              name="displayName"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Dev mode name"
            />
          </div>
        </div>
        {googleState.message ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {googleState.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={googlePending}
          className="mt-4 rounded-md border border-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-strong)]"
        >
          {googlePending ? "Connecting..." : "Continue with Google"}
        </button>
      </form>
    </div>
  );
}
