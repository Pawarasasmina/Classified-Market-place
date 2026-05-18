"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState
  );

  return (
    <form action={formAction} className="panel grid gap-5">
      <label className="space-y-2">
        <span className="text-sm font-bold">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="surface-input w-full text-sm"
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm text-red-700">{state.fieldErrors.email}</p>
        ) : null}
      </label>

      {state.message ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="action-primary px-5 py-3 text-sm font-bold disabled:opacity-60"
        >
          {pending ? "Sending..." : "Send reset link"}
        </button>
        <Link href="/login" className="action-secondary px-5 py-3 text-sm font-bold">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
