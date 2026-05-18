"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resetPasswordAction } from "@/app/(main)/actions";
import { PasswordField } from "@/components/marketplace/password-field";
import { PasswordStrengthMeter } from "@/components/marketplace/password-strength-meter";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState
  );
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="panel grid gap-5">
      <input type="hidden" name="token" value={token} />

      <div className="grid gap-2">
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          placeholder="Choose a new password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={state.fieldErrors?.password}
        />
        <PasswordStrengthMeter password={password} />
      </div>

      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Confirm your new password"
        error={state.fieldErrors?.confirmPassword}
      />

      {state.message ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || !token}
          className="action-primary px-5 py-3 text-sm font-bold disabled:opacity-60"
        >
          {pending ? "Resetting..." : "Reset password"}
        </button>
        <Link href="/login" className="action-secondary px-5 py-3 text-sm font-bold">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
