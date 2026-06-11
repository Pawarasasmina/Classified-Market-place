"use client";

import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useState,
  useEffect,
} from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AdminSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  confirmMessage?: string;
  pendingText?: string;
};

export function AdminSubmitButton({
  children,
  confirmMessage,
  pendingText = "Saving...",
  className = "action-primary px-4 py-3 text-sm font-bold",
  disabled,
  onClick,
  ...props
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick?.(event);
  }

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      onClick={handleClick}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

type AdminActionFeedbackProps = {
  status?: string | null;
  message?: string | null;
  messages?: Record<string, string>;
  successStatuses?: string[];
  warningStatuses?: string[];
  flashStorageKey?: string;
  queryKey?: string;
};

export function AdminActionFeedback({
  status,
  message,
  messages = {},
  successStatuses = ["success", "created", "updated", "deleted", "saved"],
  warningStatuses = [],
  flashStorageKey,
  queryKey,
}: AdminActionFeedbackProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [storedFlash, setStoredFlash] = useState<{
    status?: string | null;
    message?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!flashStorageKey || status) {
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(flashStorageKey);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        status?: string | null;
        message?: string | null;
      };

      setStoredFlash(parsed);
      window.sessionStorage.removeItem(flashStorageKey);
    } catch {
      window.sessionStorage.removeItem(flashStorageKey);
    }
  }, [flashStorageKey, status]);

  useEffect(() => {
    if (!status || !queryKey || !searchParams.has(queryKey)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete(queryKey);
    params.delete("message");

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, queryKey, router, searchParams, status]);

  const activeStatus = status ?? storedFlash?.status ?? null;
  const activeMessage = message ?? storedFlash?.message ?? null;

  if (!activeStatus) {
    return null;
  }

  const isSuccess = successStatuses.includes(activeStatus);
  const isWarning = warningStatuses.includes(activeStatus);
  const fallback = isSuccess
    ? "Changes saved."
    : isWarning
      ? "Completed with warnings."
      : "Could not complete that action. Please try again.";
  const copy = activeMessage || messages[activeStatus] || fallback;

  return (
    <div
      aria-live="polite"
      className={`rounded-md border px-4 py-3 text-sm font-semibold ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-800"
          : isWarning
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-red-200 bg-red-50 text-red-700"
      } whitespace-pre-line`}
    >
      {copy}
    </div>
  );
}
