"use client";

import Link from "next/link";
import { useActionState } from "react";
import { adminRegisterAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function AdminRegisterForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(
    adminRegisterAction,
    initialState
  );

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
            placeholder="Admin full name"
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
            placeholder="admin@example.com"
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

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Admin invite code
          </span>
          <input
            name="adminInviteCode"
            type="password"
            autoComplete="off"
            placeholder="Enter secure admin invite code"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
          {state.fieldErrors?.adminInviteCode ? (
            <p className="text-sm text-[#b93820]">
              {state.fieldErrors.adminInviteCode}
            </p>
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
          className="rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Creating admin account..." : "Register as admin"}
        </button>
        <Link
          href={`/admin/login${nextPath !== "/admin/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          Already have admin account
        </Link>
      </div>
    </form>
  );
}
