"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction } from "@/app/(main)/actions";
import { GoogleAuthForm } from "@/components/marketplace/google-auth-form";
import { PasswordField } from "@/components/marketplace/password-field";
import { PasswordStrengthMeter } from "@/components/marketplace/password-strength-meter";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-6">
      <GoogleAuthForm nextPath={nextPath} mode="signup" />

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
              <p className="text-sm text-[#b93820]">
                {state.fieldErrors.displayName}
              </p>
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

          <div className="grid gap-2 sm:col-span-2">
            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              placeholder="Choose a secure password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={state.fieldErrors?.password}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="sm:col-span-2">
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your password"
              error={state.fieldErrors?.confirmPassword}
            />
          </div>

          <label className="flex gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm font-semibold text-[var(--muted)] sm:col-span-2">
            <input
              type="checkbox"
              name="termsAccepted"
              value="true"
              className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
            />
            <span>
              I agree to the Terms and Privacy Policy for using this marketplace.
            </span>
          </label>
          {state.fieldErrors?.termsAccepted ? (
            <p className="text-sm text-[#b93820] sm:col-span-2">
              {state.fieldErrors.termsAccepted}
            </p>
          ) : null}
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
            href={`/login${nextPath !== "/my-listings" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="action-secondary px-5 py-3 text-sm font-bold"
          >
            Already have an account
          </Link>
          <Link href="/" className="action-secondary px-5 py-3 text-sm font-bold">
            Continue as guest
          </Link>
        </div>
      </form>
    </div>
  );
}
