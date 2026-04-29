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
    <form action={formAction} className="mt-8">
      <input type="hidden" name="next" value={nextPath} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Full name
          </span>
          <input
            name="displayName"
            autoComplete="name"
            placeholder="Your full name"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          {state.fieldErrors?.displayName ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.displayName}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Email
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          {state.fieldErrors?.email ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.email}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Phone
          </span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+971551234567"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          {state.fieldErrors?.phone ? (
            <p className="text-sm text-[#b93820]">{state.fieldErrors.phone}</p>
          ) : null}
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Password
          </span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Choose a secure password"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
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
          className="rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Creating account..." : "Create account"}
        </button>
        <Link
          href={`/login${nextPath !== "/sell" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          Already have an account
        </Link>
      </div>
    </form>
  );
}
