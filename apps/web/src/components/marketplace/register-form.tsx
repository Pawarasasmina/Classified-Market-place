"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="panel">
      <input type="hidden" name="next" value={nextPath} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Full name
          </span>
          <input
            name="displayName"
            autoComplete="name"
            placeholder="Your full name"
            className="surface-input w-full text-sm"
          />
          {state.fieldErrors?.displayName ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.displayName}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Email
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            className="surface-input w-full text-sm"
          />
          {state.fieldErrors?.email ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.email}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Phone
          </span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+971551234567"
            className="surface-input w-full text-sm"
          />
          {state.fieldErrors?.phone ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.phone}</p>
          ) : null}
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Password
          </span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Choose a secure password"
            className="surface-input w-full text-sm"
          />
          {state.fieldErrors?.password ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.password}</p>
          ) : null}
        </label>
      </div>

      {state.message ? (
        <p className="mt-4 rounded-md border border-[rgba(185,56,32,0.18)] bg-[rgba(255,243,240,0.95)] px-4 py-3 text-sm text-[#8f2e1c]">
          {state.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="action-primary px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Creating account..." : "Create account"}
        </button>
        <Link
          href={`/login${nextPath !== "/sell" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="action-secondary px-5 py-3 text-sm font-bold"
        >
          Already have an account
        </Link>
      </div>
    </form>
  );
}
