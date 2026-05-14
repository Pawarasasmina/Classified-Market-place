"use client";

import { useActionState, useState } from "react";
import {
  requestPhoneOtpAction,
  verifyPhoneAction,
} from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function VerifyForm({
  nextPath,
  initialPhone,
}: {
  nextPath: string;
  initialPhone: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [otpCode, setOtpCode] = useState("");
  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    verifyPhoneAction,
    initialState
  );
  const [requestState, requestFormAction, requestPending] = useActionState(
    requestPhoneOtpAction,
    initialState
  );

  return (
    <form action={verifyFormAction}>
      <input type="hidden" name="next" value={nextPath} />

      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Phone number
          </span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+971551234567"
            className="surface-input w-full text-sm"
          />
          {verifyState.fieldErrors?.phone || requestState.fieldErrors?.phone ? (
            <p className="text-sm text-[#b93820]">
              {verifyState.fieldErrors?.phone ?? requestState.fieldErrors?.phone}
            </p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            OTP code
          </span>
          <input
            name="otpCode"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            placeholder="Enter the code you receive"
            className="surface-input w-full text-sm tracking-[0.4em]"
          />
          <p className="text-sm text-[var(--muted)]">
            Request a code first. In Phase 1, the app can run in dev OTP mode and
            show the preview code directly until real SMS delivery is connected.
          </p>
          {verifyState.fieldErrors?.otpCode ? (
            <p className="text-sm text-[#b93820]">{verifyState.fieldErrors.otpCode}</p>
          ) : null}
        </label>
      </div>

      {requestState.message ? (
        <p className="mt-4 rounded-md border border-[rgba(31,107,90,0.18)] bg-[rgba(239,250,246,0.95)] px-4 py-3 text-sm text-[var(--success)]">
          {requestState.message}
        </p>
      ) : null}

      {verifyState.message ? (
        <p className="mt-4 rounded-md border border-[rgba(185,56,32,0.18)] bg-[rgba(255,243,240,0.95)] px-4 py-3 text-sm text-[#8f2e1c]">
          {verifyState.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={verifyPending || requestPending}
          className="action-primary px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {verifyPending ? "Verifying..." : "Verify phone"}
        </button>
        <button
          type="submit"
          formAction={requestFormAction}
          disabled={verifyPending || requestPending}
          className="action-secondary px-5 py-3 text-sm font-bold"
        >
          {requestPending ? "Sending..." : "Send / resend code"}
        </button>
      </div>
    </form>
  );
}
