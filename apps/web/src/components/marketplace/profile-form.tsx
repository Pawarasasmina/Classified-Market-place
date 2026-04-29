"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateProfileAction } from "@/app/(main)/actions";
import { type FormActionState, type SessionUser } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function ProfileForm({ user }: { user: SessionUser }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-6">
      <div className="grid gap-6 lg:grid-cols-[0.62fr_0.38fr]">
        <div className="space-y-4">
          <label className="space-y-2 rounded-[1.5rem] border border-[var(--line)] bg-white p-4">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Display name
            </span>
            <input
              name="displayName"
              defaultValue={user.displayName}
              className="w-full bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none"
            />
            <p className="text-sm text-[var(--muted)]">
              This is the public-facing name shown on your listings.
            </p>
            {state.fieldErrors?.displayName ? (
              <p className="text-sm text-[#b93820]">{state.fieldErrors.displayName}</p>
            ) : null}
          </label>

          <label className="space-y-2 rounded-[1.5rem] border border-[var(--line)] bg-white p-4">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Phone
            </span>
            <input
              name="phone"
              defaultValue={user.phone ?? ""}
              placeholder="+971551234567"
              className="w-full bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none"
            />
            <p className="text-sm text-[var(--muted)]">
              Use international format. Updating this number will require a fresh
              verification pass.
            </p>
            {state.fieldErrors?.phone ? (
              <p className="text-sm text-[#b93820]">{state.fieldErrors.phone}</p>
            ) : null}
          </label>

          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.78)] p-4 text-sm leading-7 text-[var(--muted)]">
            Email is currently read-only because the live profile API only supports
            updating your display name and phone number in this phase.
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white p-4">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Email address
            </span>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {user.email}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {user.emailVerified
                ? "Email verification is complete."
                : "Email verification is still pending."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white p-4">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Phone verification
            </span>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {user.phoneVerified ? "Verified and ready" : "Verification pending"}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {user.phoneVerified
                ? "Your account is ready for phone-gated marketplace flows."
                : "Complete OTP verification to keep listing creation friction-free."}
            </p>
            {!user.phoneVerified ? (
              <Link
                href="/verify?next=%2Fprofile"
                className="mt-4 inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Verify phone
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Saving..." : "Save profile"}
        </button>
        {state.message ? (
          <p className="text-sm text-[var(--muted)]">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
