"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from "react";
import { verifyEmailAndLoginAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

export function EmailVerificationAutoLogin({
  token,
  nextPath,
}: {
  token: string;
  nextPath: string;
}) {
  const [state, formAction, pending] = useActionState(
    verifyEmailAndLoginAction,
    initialState
  );
  const [isTransitionPending, startTransition] = useTransition();
  const submittedRef = useRef(false);

  const submitVerification = useCallback(() => {
    const formData = new FormData();
    formData.set("token", token);
    formData.set("next", nextPath);

    startTransition(() => {
      formAction(formData);
    });
  }, [formAction, nextPath, startTransition, token]);

  useEffect(() => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    submitVerification();
  }, [submitVerification]);

  const isLoading = pending || isTransitionPending || !state.message;

  return (
    <div className="panel grid gap-5 text-center">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[rgba(91,75,219,0.22)] border-t-[var(--brand)]" />
      <div>
        <h2 className="text-2xl font-black">
          {state.message ? "Verification needs attention" : "Verifying your email"}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {state.message ??
            "Please wait while we verify your email and sign you in."}
        </p>
      </div>

      {state.message ? (
        <button
          type="button"
          onClick={submitVerification}
          disabled={isLoading}
          className="action-primary mx-auto px-5 py-3 text-sm font-bold disabled:opacity-60"
        >
          {isLoading ? "Checking..." : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
